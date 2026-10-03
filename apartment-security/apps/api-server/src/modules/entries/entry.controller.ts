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

    if (method !== 'QR_SCAN' && (!unitId || !visitorName)) {
      return next(new AppError('unitId and visitorName are required for this method', 400));
    }

    const guard = await prisma.guard.findUnique({ where: { userId: req.user!.userId } });
    if (!guard || !guard.isOnDuty) return next(new AppError('Guard must be on an active shift', 400));

    let resolvedPassId: string | null = null;
    let status = 'APPROVED';
    let denialReason: string | null = null;
    let qrApproval: { pass: any; unit: any; entryPoint: any } | null = null;

    if (method === 'QR_SCAN') {
      if (!qrPayload) return next(new AppError('QR Payload required for QR scan', 400));
      const parsedQr = verifySignedQRPayload(qrPayload);
      const pass = parsedQr
        ? await prisma.pass.findUnique({
            where: { id: parsedQr.passId },
            include: {
              unit: { include: { residents: { include: { user: true } } } },
              resident: { include: { user: true } },
            },
          })
        : null;

      if (!pass) {
        return sendSuccess(res, 200, 'Entry logged as DENIED', { status: 'DENIED', reason: 'Invalid or unrecognized QR code' });
      }

      const entryPoint = await prisma.entryPoint.findUnique({ where: { id: entryPointId } });
      const now = new Date();

      unitId = pass.unitId;
      visitorName = pass.visitorName;
      visitorPhone = pass.visitorPhone;

      // Check if visitor is ALREADY INSIDE (Active open entry without exitAt)
      // If so, this QR scan is the EXIT SCAN (leaving the building)!
      const openEntry = await prisma.entry.findFirst({
        where: {
          passId: pass.id,
          status: 'APPROVED',
          exitAt: null,
        },
        include: {
          entryPoint: true,
        },
        orderBy: { entryAt: 'desc' },
      });

      if (openEntry) {
        // ========== PHASE 2: EXIT SCAN (Leaving the building) ==========
        const exitAt = now;
        const entryAt = new Date(openEntry.entryAt);
        const durationMs = Math.max(0, exitAt.getTime() - entryAt.getTime());
        const durationMinutes = Math.max(1, Math.round(durationMs / 60000));
        const durationHours = (durationMinutes / 60).toFixed(1);
        const durationFormatted = durationMinutes < 60 ? `${durationMinutes}m` : `${durationHours}h (${durationMinutes}m)`;

        // 1. Mark entry as exited
        const updatedEntry = await prisma.entry.update({
          where: { id: openEntry.id },
          data: { exitAt },
        });

        // 2. Expire pass after successful exit (2 of 2 scans used)
        if (pass.type === 'ONE_TIME' || pass.type === 'DELIVERY' || pass.type === 'CONTRACTOR') {
          await prisma.pass.update({
            where: { id: pass.id },
            data: { status: 'EXPIRED' },
          });
        }

        // 3. Record PassUsageHistory outcome as EXITED
        await prisma.passUsageHistory.create({
          data: {
            passId: pass.id,
            entryId: openEntry.id,
            outcome: 'EXITED',
          },
        });

        // 4. Release allocated parking
        await releaseParkingSlot(openEntry.id);

        // 5. Notify resident via Real-time Socket & Push Notification
        io?.to(`unit_${pass.unitId}`).emit('visitor_exit_logged', {
          entryId: openEntry.id,
          passId: pass.id,
          visitorName: pass.visitorName,
          entryAt: entryAt.toISOString(),
          exitAt: exitAt.toISOString(),
          durationMinutes,
          durationFormatted,
          gateName: entryPoint?.name || 'Gate',
          unitNumber: pass.unit.unitNumber,
          tower: pass.unit.tower,
        });

        const { triggerAlert } = await import('../../utils/alert.util');
        await triggerAlert({
          priority: 'P3',
          title: 'Visitor Left Building',
          body: `${pass.visitorName} has left via ${entryPoint?.name || 'Gate'} (Duration: ${durationFormatted}). QR Pass completed & expired.`,
          targetUserIds: pass.unit.residents.map((r: any) => r.userId),
          propertyId: guard.propertyId,
          entryId: openEntry.id,
        });

        await auditLog(req.user!.userId, 'LOG_EXIT_SCAN', 'Entry', openEntry.id);

        return sendSuccess(res, 200, 'Visitor exit verified and logged. Pass completed & expired.', {
          id: openEntry.id,
          status: 'APPROVED',
          direction: 'EXIT',
          isExit: true,
          visitorName: pass.visitorName,
          visitorPhone: pass.visitorPhone,
          vehicleNumber: openEntry.vehicleNumber || vehicleNumber,
          unit: { unitNumber: pass.unit.unitNumber, tower: pass.unit.tower },
          gateName: entryPoint?.name,
          entryAt: openEntry.entryAt,
          exitAt,
          durationFormatted,
          durationMinutes,
          passStatus: 'EXPIRED',
          message: `Visitor exit logged. Stay duration: ${durationFormatted}. QR Pass is now expired (2/2 scans used).`,
        });
      }

      // ========== PHASE 1: ENTRY SCAN (Entering the building) ==========
      const alreadyExited = await prisma.passUsageHistory.findFirst({
        where: { passId: pass.id, outcome: 'EXITED' },
      });

      if (alreadyExited && (pass.type === 'ONE_TIME' || pass.type === 'DELIVERY')) {
        denialReason = 'Pass has already been completed and visitor exited (QR code expired)';
      } else if (pass.status !== 'ACTIVE') {
        denialReason = `Pass is ${pass.status.toLowerCase()}`;
      } else if (now < pass.validFrom) {
        denialReason = 'Pass is not valid yet';
      } else if (now > pass.validUntil) {
        denialReason = 'Pass has expired';
      } else if (!entryPoint || entryPoint.propertyId !== guard.propertyId) {
        denialReason = 'Gate does not belong to your property';
      } else if (pass.unit.propertyId !== guard.propertyId) {
        denialReason = 'Pass does not belong to your property';
      } else if (pass.entryPointIds.length > 0 && !pass.entryPointIds.includes(entryPointId)) {
        denialReason = 'Pass is not valid at this gate';
      }

      if (denialReason) {
        status = 'DENIED';
      } else {
        resolvedPassId = pass.id;
        status = 'APPROVED'; // Pre-approved pass clear for entry
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
      // Manual guard entry for walk-in or delivery
      status = 'APPROVED';
    }

    const { entry } = await prisma.$transaction(async (tx) => {
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
          gatePhotoUrl,
        },
      });

      if (resolvedPassId) {
        const outcome = status === 'APPROVED' ? 'ENTERED' : (status === 'PENDING_APPROVAL' ? 'PENDING' : 'DENIED');
        await tx.passUsageHistory.create({
          data: { passId: resolvedPassId, entryId: createdEntry.id, outcome },
        });
      }

      return { entry: createdEntry };
    });

    let enriched: Record<string, unknown> = denialReason ? { reason: denialReason } : {};

    if (qrApproval && status === 'APPROVED') {
      const { pass, unit, entryPoint } = qrApproval;

      // Notify resident that visitor has entered and live timer has started
      io?.to(`unit_${unitId}`).emit('visitor_entry_logged', {
        entryId: entry.id,
        passId: pass.id,
        visitorName,
        visitorPhone,
        visitorPhoto: pass.visitorPhoto,
        purpose: pass.purpose,
        vehicleNumber,
        apartment: unit.unitNumber,
        tower: unit.tower,
        gateName: entryPoint?.name || 'Gate',
        entryAt: entry.entryAt.toISOString(),
      });

      const { triggerAlert } = await import('../../utils/alert.util');
      await triggerAlert({
        priority: 'P3',
        title: 'Visitor Entered Building',
        body: `${visitorName} has entered via ${entryPoint?.name || 'Gate'}. Visit timer started. Destination: Tower ${unit.tower || ''} Flat ${unit.unitNumber}.`,
        targetUserIds: unit.residents.map((r: any) => r.userId),
        propertyId: guard.propertyId,
        entryId: entry.id,
        imageUrl: pass.visitorPhoto ?? undefined,
      });

      enriched = {
        visitorPhoto: pass.visitorPhoto,
        residentPhone: pass.resident?.user?.phone,
        unit: { unitNumber: unit.unitNumber, tower: unit.tower },
        gateName: entryPoint?.name,
        direction: 'ENTRY',
        isEntry: true,
        entryAt: entry.entryAt,
        message: `${visitorName} entered building. Timer started (1/2 scans used).`,
      };
    }

    await assignParkingSlot(entry.id, guard.propertyId, vehicleNumber);
    await auditLog(req.user!.userId, 'LOG_ENTRY', 'Entry', entry.id);
    return sendSuccess(res, 201, `Entry logged as ${status}`, { ...entry, ...enriched });
  } catch (err) { next(err); }
};

export const logExit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { exitAt } = req.body;
    
    const entry = await prisma.entry.findUnique({
      where: { id },
      include: {
        pass: true,
        unit: { include: { residents: { select: { userId: true } } } },
        entryPoint: true,
      },
    });
    if (!entry) return next(new AppError('Entry not found', 404));

    const exitTime = exitAt ? new Date(exitAt) : new Date();
    const durationMs = Math.max(0, exitTime.getTime() - new Date(entry.entryAt).getTime());
    const durationMinutes = Math.max(1, Math.round(durationMs / 60000));
    const durationHours = (durationMinutes / 60).toFixed(1);
    const durationFormatted = durationMinutes < 60 ? `${durationMinutes}m` : `${durationHours}h (${durationMinutes}m)`;

    const updated = await prisma.entry.update({
      where: { id },
      data: { exitAt: exitTime },
    });

    if (entry.passId) {
      if (entry.pass?.type === 'ONE_TIME' || entry.pass?.type === 'DELIVERY' || entry.pass?.type === 'CONTRACTOR') {
        await prisma.pass.update({
          where: { id: entry.passId },
          data: { status: 'EXPIRED' },
        });
      }
      await prisma.passUsageHistory.create({
        data: { passId: entry.passId, entryId: id, outcome: 'EXITED' },
      });
    }

    await releaseParkingSlot(id);

    // Notify resident via socket
    io?.to(`unit_${entry.unitId}`).emit('visitor_exit_logged', {
      entryId: id,
      passId: entry.passId,
      visitorName: entry.visitorName,
      entryAt: entry.entryAt.toISOString(),
      exitAt: exitTime.toISOString(),
      durationMinutes,
      durationFormatted,
      gateName: entry.entryPoint?.name || 'Gate',
      unitNumber: entry.unit?.unitNumber,
      tower: entry.unit?.tower,
    });

    const { triggerAlert } = await import('../../utils/alert.util');
    if (entry.unit?.residents && entry.unit.residents.length > 0) {
      await triggerAlert({
        priority: 'P3',
        title: 'Visitor Left Building',
        body: `${entry.visitorName} has left the building (Total duration: ${durationFormatted}).`,
        targetUserIds: entry.unit.residents.map((r: any) => r.userId),
        propertyId: req.user?.propertyId || '',
        entryId: id,
      });
    }

    await auditLog(req.user!.userId, 'LOG_EXIT', 'Entry', id);
    return sendSuccess(res, 200, 'Exit logged', { ...updated, durationMinutes, durationFormatted });
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
