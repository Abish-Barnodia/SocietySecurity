import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { sendSuccess, sendError } from '../../utils/response.util';
import { AppError } from '../../middlewares/error.middleware';
import { auditLog } from '../../utils/audit.util';
import { verifySignedQRPayload } from '../../utils/qr.util';
import { assignParkingSlot, releaseParkingSlot } from '../../utils/parking.util';
import { io } from '../../server';
import bcrypt from 'bcryptjs';

export const logEntry = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entryPointId, method, vehicleNumber, qrPayload, otpCode, notes, gatePhotoUrl } = req.body;
    let { unitId, visitorName, visitorPhone } = req.body;

    // Every method except QR_SCAN still needs the guard to tell us who/where —
    // a QR scan is fully self-describing once the signed pass resolves, so
    // the guard app never has to (and can't, without the HMAC secret) know
    // the unit/visitor identity up front.
    if (method !== 'QR_SCAN' && (!unitId || !visitorName)) {
      return next(new AppError('unitId and visitorName are required for this method', 400));
    }

    const guard = await prisma.guard.findUnique({ where: { userId: req.user!.userId } });
    if (!guard || !guard.isOnDuty) return next(new AppError('Guard must be on an active shift', 400));

    let resolvedPassId: string | null = null;
    let status = 'APPROVED';
    let denialReason: string | null = null;
    // Only set for a valid QR scan that needs resident approval — carries the
    // context needed after entry.create() to open the WalkinApproval ticket
    // and notify the resident. Never set for MANUAL_GUARD, so that existing
    // walk-in behavior (no resident-approval ticket here) is untouched.
    let qrApproval: { pass: any; unit: any; entryPoint: any } | null = null;

    if (method === 'QR_SCAN') {
      if (!qrPayload) return next(new AppError('QR Payload required for QR scan', 400));
      const parsedQr = verifySignedQRPayload(qrPayload);
      const pass = parsedQr
        ? await prisma.pass.findUnique({
            where: { id: parsedQr.passId },
            include: { unit: true, resident: { include: { user: true } } },
          })
        : null;

      // No signature, or the signed passId doesn't correspond to any real
      // pass — there's no unit/resident to attach this attempt to at all,
      // so there's nothing meaningful to persist as an Entry.
      if (!pass) {
        return sendSuccess(res, 200, 'Entry logged as DENIED', { status: 'DENIED', reason: 'Invalid or unrecognized QR code' });
      }

      const entryPoint = await prisma.entryPoint.findUnique({ where: { id: entryPointId } });
      const now = new Date();

      // From here on a real pass (and therefore a real unit) exists, so
      // every outcome — including denials — gets a proper audit-trail Entry.
      unitId = pass.unitId;
      visitorName = pass.visitorName;
      visitorPhone = pass.visitorPhone;

      if (pass.status !== 'ACTIVE') denialReason = `Pass is ${pass.status.toLowerCase()}`;
      else if (now < pass.validFrom) denialReason = 'Pass is not valid yet';
      else if (now > pass.validUntil) denialReason = 'Pass has expired';
      else if (!entryPoint || entryPoint.propertyId !== guard.propertyId) denialReason = 'Gate does not belong to your property';
      else if (pass.unit.propertyId !== guard.propertyId) denialReason = 'Pass does not belong to your property';
      else if (pass.entryPointIds.length > 0 && !pass.entryPointIds.includes(entryPointId)) denialReason = 'Pass is not valid at this gate';
      else if (
        pass.type === 'ONE_TIME' &&
        (await prisma.passUsageHistory.findFirst({
          where: { passId: pass.id, outcome: { in: ['CLEARED', 'PENDING'] } },
        }))
      ) {
        denialReason = 'Pass has already been used';
      }

      if (denialReason) {
        status = 'DENIED';
      } else {
        resolvedPassId = pass.id;
        status = 'PENDING_APPROVAL';
        qrApproval = { pass, unit: pass.unit, entryPoint };
      }
    } else if (method === 'OTP') {
      if (!otpCode || !req.body.passId) return next(new AppError('OTP and Pass ID required', 400));
      const pass = await prisma.pass.findUnique({ where: { id: req.body.passId } });
      if (!pass || pass.status !== 'ACTIVE' || !pass.otpCode) status = 'DENIED';
      else {
        const isValid = await bcrypt.compare(otpCode, pass.otpCode);
        if (!isValid) status = 'DENIED';
        else resolvedPassId = pass.id;
      }
    } else if (method === 'MANUAL_GUARD') {
      // Manual guard entry usually implies walk-in, so status might be pending if it requires resident approval
      // We will handle walk-in flows in another module, but here we just log it as pending.
      status = 'PENDING_APPROVAL';
    }

    const { entry, walkinCreated } = await prisma.$transaction(async (tx) => {
      const createdEntry = await tx.entry.create({
        data: {
          unitId,
          guardId: guard.id,
          entryPointId,
          method,
          visitorName,
          visitorPhone,
          vehicleNumber,
          passId: resolvedPassId,
          status: status as any,
          notes,
          gatePhotoUrl
        }
      });

      if (resolvedPassId) {
        const outcome = status === 'PENDING_APPROVAL' ? 'PENDING' : (status === 'APPROVED' ? 'CLEARED' : 'DENIED');
        await tx.passUsageHistory.create({
          data: { passId: resolvedPassId, entryId: createdEntry.id, outcome }
        });
      }

      let walkinTicket = null;
      if (qrApproval) {
        const { pass } = qrApproval;
        const timeoutAt = new Date(Date.now() + 120_000);
        walkinTicket = await tx.walkinApproval.create({
          data: {
            entryId: createdEntry.id,
            residentId: pass.residentId,
            visitorName,
            purpose: pass.purpose ?? '',
            timeoutAt,
          }
        });
      }

      return { entry: createdEntry, walkinCreated: walkinTicket };
    });

    await assignParkingSlot(entry.id, guard.propertyId, vehicleNumber);

    let enriched: Record<string, unknown> = denialReason ? { reason: denialReason } : {};

    if (qrApproval) {
      const { pass, unit, entryPoint } = qrApproval;
      const timeoutAt = walkinCreated!.timeoutAt;

      io?.to(`unit_${unitId}`).emit('visitor_approval_request', {
        entryId: entry.id,
        visitorName,
        visitorPhone,
        visitorPhoto: pass.visitorPhoto,
        purpose: pass.purpose,
        vehicleNumber,
        expectedTime: pass.validUntil,
        apartment: unit.unitNumber,
        tower: unit.tower,
        gateName: entryPoint.name,
        timeoutAt,
      });

      const { triggerAlert } = await import('../../utils/alert.util');
      await triggerAlert({
        priority: 'P2',
        title: 'Visitor at your gate',
        body: `${visitorName} scanned in — approve or deny within 2 minutes.`,
        targetUserIds: [pass.resident.userId],
        propertyId: guard.propertyId,
        entryId: entry.id,
        imageUrl: pass.visitorPhoto ?? undefined,
      });

      enriched = {
        visitorPhoto: pass.visitorPhoto,
        residentPhone: pass.resident.user.phone,
        unit: { unitNumber: unit.unitNumber, tower: unit.tower },
        gateName: entryPoint.name,
        timeoutAt,
      };
    }

    await auditLog(req.user!.userId, 'LOG_ENTRY', 'Entry', entry.id);
    return sendSuccess(res, 201, `Entry logged as ${status}`, { ...entry, ...enriched });
  } catch (err) { next(err); }
};

export const logExit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { exitAt } = req.body;
    
    const entry = await prisma.entry.findUnique({ where: { id } });
    if (!entry) return next(new AppError('Entry not found', 404));

    const updated = await prisma.entry.update({
      where: { id },
      data: { exitAt: exitAt ? new Date(exitAt) : new Date() }
    });

    await releaseParkingSlot(id);

    await auditLog(req.user!.userId, 'LOG_EXIT', 'Entry', id);
    return sendSuccess(res, 200, 'Exit logged', updated);
  } catch (err) { next(err); }
};

export const getEntryPoints = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const propertyId = req.user!.propertyId;

    if (!propertyId) return next(new AppError('Property context not found', 404));

    const entryPoints = await prisma.entryPoint.findMany({
      where: { propertyId, isActive: true },
      orderBy: { name: 'asc' },
    });

    return sendSuccess(res, 200, 'Entry points fetched', entryPoints);
  } catch (err) { next(err); }
};

export const getRecentEntries = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const propertyId = req.user!.propertyId;
    if (!propertyId) return next(new AppError('Property context not found', 404));

    const entries = await prisma.entry.findMany({
      where: { unit: { propertyId }, status: 'APPROVED' },
      include: {
        unit: { select: { unitNumber: true, tower: true } },
        entryPoint: { select: { name: true } },
      },
      orderBy: { entryAt: 'desc' },
      take: 10,
    });

    return sendSuccess(res, 200, 'Recent entries fetched', entries);
  } catch (err) { next(err); }
};

export const getFrequentVisitors = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const propertyId = req.user!.propertyId;
    if (!propertyId) return next(new AppError('Property context not found', 404));

    // Get recent distinct visitors (using group by or distinct on entry table)
    // Prisma distinct is applied after where.
    const entries = await prisma.entry.findMany({
      where: { unit: { propertyId }, method: 'MANUAL_GUARD' },
      select: { visitorName: true, vehicleNumber: true, entryAt: true },
      distinct: ['visitorName'],
      orderBy: { entryAt: 'desc' },
      take: 20,
    });

    return sendSuccess(res, 200, 'Frequent visitors fetched', entries);
  } catch (err) { next(err); }
};

export const getUnitsForGuard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const propertyId = req.user!.propertyId;
    if (!propertyId) return next(new AppError('Property context not found', 404));

    const units = await prisma.unit.findMany({
      where: {
        propertyId,
        residents: { some: {} }
      },
      select: { id: true, unitNumber: true, tower: true, _count: { select: { residents: true } } },
      orderBy: { unitNumber: 'asc' },
    });
    return sendSuccess(res, 200, 'Units fetched', units);
  } catch (err) { next(err); }
};


export const getUnitEntries = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const unitId = req.user!.unitId;
    if (!unitId) return next(new AppError('Resident context not found', 404));

    const entries = await prisma.entry.findMany({
      where: { unitId },
      include: { entryPoint: { select: { name: true } } },
      orderBy: { entryAt: 'desc' },
      take: 30
    });
    
    return sendSuccess(res, 200, 'Entries fetched', entries);
  } catch (err) { next(err); }
};

export const getAllEntries = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // For Manager / Committee — with offset pagination
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [entries, total] = await prisma.$transaction([
      prisma.entry.findMany({
        include: { unit: true, guard: true, pass: true },
        orderBy: { entryAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.entry.count(),
    ]);

    return sendSuccess(res, 200, 'All entries fetched', {
      entries,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (err) { next(err); }
};
