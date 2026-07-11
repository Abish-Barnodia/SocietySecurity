import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { sendSuccess, sendError } from '../../utils/response.util';
import { AppError } from '../../middlewares/error.middleware';
import { auditLog } from '../../utils/audit.util';
import { verifySignedQRPayload } from '../../utils/qr.util';
import bcrypt from 'bcryptjs';

export const logEntry = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { unitId, entryPointId, method, visitorName, visitorPhone, vehicleNumber, qrPayload, otpCode, notes, gatePhotoUrl } = req.body;
    
    // Resolve guard via userId (guardId is NOT in the JWT payload)
    const guard = await prisma.guard.findUnique({ where: { userId: req.user!.userId } });
    if (!guard || !guard.isOnDuty) return next(new AppError('Guard must be on an active shift', 400));

    // Validate the unit belongs to the guard's property
    const unit = await prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit || unit.propertyId !== guard.propertyId) {
      return next(new AppError('Forbidden: Unit does not belong to your assigned property', 403));
    }

    let resolvedPassId = null;
    let status = 'APPROVED';

    if (method === 'QR_SCAN') {
      if (!qrPayload) return next(new AppError('QR Payload required for QR scan', 400));
      const parsedQr = verifySignedQRPayload(qrPayload);
      if (!parsedQr) {
        status = 'DENIED';
      } else {
        const pass = await prisma.pass.findUnique({ where: { id: parsedQr.passId } });
        if (!pass || pass.status !== 'ACTIVE') status = 'DENIED';
        else {
          const now = new Date();
          if (now < pass.validFrom || now > pass.validUntil) status = 'DENIED';
          else if (pass.unitId !== unitId) status = 'DENIED';
          else resolvedPassId = pass.id;
        }
      }
    } else if (method === 'OTP') {
      if (!otpCode || !req.body.passId) return next(new AppError('OTP and Pass ID required', 400));
      const pass = await prisma.pass.findUnique({ where: { id: req.body.passId } });
      if (!pass || pass.status !== 'ACTIVE' || !pass.otpCode || pass.unitId !== unitId) status = 'DENIED';
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

    let entry: any;
    await prisma.$transaction(async (tx) => {
      entry = await tx.entry.create({
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
        await tx.passUsageHistory.create({
          data: {
            passId: resolvedPassId,
            entryId: entry.id,
            outcome: status === 'APPROVED' ? 'CLEARED' : 'DENIED'
          }
        });
      }
    });

    await auditLog(req.user!.userId, 'LOG_ENTRY', 'Entry', entry.id);
    return sendSuccess(res, 201, `Entry logged as ${status}`, entry);
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

    await auditLog(req.user!.userId, 'LOG_EXIT', 'Entry', id);
    return sendSuccess(res, 200, 'Exit logged', updated);
  } catch (err) { next(err); }
};

export const getUnitEntries = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // For Resident
    const currentResident = await prisma.resident.findUnique({
        where: { userId: req.user!.userId }
    });
    if (!currentResident) return next(new AppError('Resident context not found', 404));

    let page = parseInt(req.query.page as string);
    page = Number.isNaN(page) ? 1 : Math.max(1, page);
    let limit = parseInt(req.query.limit as string);
    limit = Number.isNaN(limit) ? 20 : Math.min(100, Math.max(1, limit));
    const skip = (page - 1) * limit;

    const [entries, total] = await prisma.$transaction([
      prisma.entry.findMany({
        where: { unitId: currentResident.unitId },
        orderBy: { entryAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.entry.count({ where: { unitId: currentResident.unitId } })
    ]);
    
    return sendSuccess(res, 200, 'Entries fetched', {
      entries,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (err) { next(err); }
};

export const getAllEntries = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // For Manager / Committee — scoped strictly to their property to prevent cross-tenant exposure
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { manager: true, guard: true },
    });
    const propertyId = user?.manager?.propertyId ?? user?.guard?.propertyId;
    if (!propertyId) return next(new AppError('No property context found', 403));

    let page = parseInt(req.query.page as string);
    page = Number.isNaN(page) ? 1 : Math.max(1, page);
    let limit = parseInt(req.query.limit as string);
    limit = Number.isNaN(limit) ? 20 : Math.min(100, Math.max(1, limit));
    const skip = (page - 1) * limit;

    const [entries, total] = await prisma.$transaction([
      prisma.entry.findMany({
        where: { unit: { propertyId } },
        include: { unit: true, guard: true, pass: true },
        orderBy: { entryAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.entry.count({ where: { unit: { propertyId } } }),
    ]);

    return sendSuccess(res, 200, 'All entries fetched', {
      entries,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (err) { next(err); }
};
