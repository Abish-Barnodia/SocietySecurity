import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { sendSuccess, sendError } from '../../utils/response.util';
import { AppError } from '../../middlewares/error.middleware';
import { auditLog } from '../../utils/audit.util';
import { generateSignedQRPayload } from '../../utils/qr.util';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export const createPass = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, visitorName, visitorPhone, purpose, validFrom, validUntil, entryPointIds, recurringRule, unitId: reqUnitId } = req.body;
    
    let residentId = null;
    let finalUnitId = reqUnitId;

    if (req.user!.role === 'RESIDENT') {
      const currentResident = await prisma.resident.findUnique({
          where: { userId: req.user!.userId }
      });
      if (!currentResident) return next(new AppError('Resident context not found', 404));
      residentId = currentResident.id;
      finalUnitId = currentResident.unitId;
    } else if (req.user!.role === 'MANAGER' || req.user!.role === 'COMMITTEE') {
      if (!finalUnitId) return next(new AppError('unitId is required for managers creating passes', 400));
      // Optionally find the primary resident of this unit to assign as host
      const unitResident = await prisma.resident.findFirst({ where: { unitId: finalUnitId } });
      residentId = unitResident ? unitResident.id : null;
    } else {
      return next(new AppError('Unauthorized to create passes', 403));
    }

    // For DELIVERY type, we optionally create an OTP
    let otpPlaintext = null;
    let otpHash = null;
    if (type === 'DELIVERY') {
        otpPlaintext = Math.floor(100000 + Math.random() * 900000).toString();
        otpHash = await bcrypt.hash(otpPlaintext, 10);
    }

    const pass = await prisma.pass.create({
      data: {
        residentId,
        unitId: finalUnitId,
        type,
        visitorName,
        visitorPhone,
        purpose,
        validFrom: new Date(validFrom),
        validUntil: new Date(validUntil),
        entryPointIds: entryPointIds || [],
        otpCode: otpHash,
        ...(recurringRule && {
          recurringRule: {
            create: recurringRule
          }
        })
      },
      include: {
        recurringRule: true
      }
    });

    // Generate QR payload now that we have the pass ID
    const qrPayloadString = generateSignedQRPayload({
        passId: pass.id,
        visitorName: pass.visitorName,
        validFrom: new Date(validFrom).getTime(),
        validUntil: new Date(validUntil).getTime()
    });

    const updatedPass = await prisma.pass.update({
        where: { id: pass.id },
        data: { qrPayload: qrPayloadString },
        include: { recurringRule: true }
    });

    await auditLog(req.user!.userId, 'CREATE_PASS', 'Pass', pass.id);

    return sendSuccess(res, 201, 'Pass created successfully', {
      pass: updatedPass,
      otpCode: otpPlaintext // Only returned once to the creator
    });
  } catch (err) { next(err); }
};

export const getMyPasses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const currentResident = await prisma.resident.findUnique({
        where: { userId: req.user!.userId }
    });
    if (!currentResident) return next(new AppError('Resident context not found', 404));

    const passes = await prisma.pass.findMany({
      where: { unitId: currentResident.unitId },
      include: { recurringRule: true },
      orderBy: { createdAt: 'desc' }
    });

    return sendSuccess(res, 200, 'Passes fetched', passes);
  } catch (err) { next(err); }
};

export const suspendPass = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    
    const pass = await prisma.pass.findUnique({ where: { id } });
    if (!pass) return next(new AppError('Pass not found', 404));

    // Ownership check — only the resident who owns the unit can suspend this pass
    const resident = await prisma.resident.findUnique({ where: { userId: req.user!.userId } });
    if (!resident || pass.unitId !== resident.unitId) {
      return next(new AppError('Forbidden: You do not own this pass', 403));
    }

    const updatedPass = await prisma.pass.update({
      where: { id },
      data: { status: 'SUSPENDED', suspendedAt: new Date() }
    });

    await auditLog(req.user!.userId, 'SUSPEND_PASS', 'Pass', id);
    return sendSuccess(res, 200, 'Pass suspended', updatedPass);
  } catch (err) { next(err); }
};

export const revokePass = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    
    const pass = await prisma.pass.findUnique({ where: { id } });
    if (!pass) return next(new AppError('Pass not found', 404));

    // Residents may only revoke their own unit's passes; managers can revoke any
    if (req.user!.role === 'RESIDENT') {
      const resident = await prisma.resident.findUnique({ where: { userId: req.user!.userId } });
      if (!resident || pass.unitId !== resident.unitId) {
        return next(new AppError('Forbidden: You do not own this pass', 403));
      }
    }

    const updatedPass = await prisma.pass.update({
      where: { id },
      data: { status: 'REVOKED', revokedAt: new Date(), revokedBy: req.user!.userId }
    });

    await auditLog(req.user!.userId, 'REVOKE_PASS', 'Pass', id);
    return sendSuccess(res, 200, 'Pass revoked', updatedPass);
  } catch (err) { next(err); }
};

export const deletePass = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    const pass = await prisma.pass.findUnique({ where: { id } });
    if (!pass) return next(new AppError('Pass not found', 404));

    // Ownership check — only the resident who owns the unit can delete this pass
    const resident = await prisma.resident.findUnique({ where: { userId: req.user!.userId } });
    if (!resident || pass.unitId !== resident.unitId) {
      return next(new AppError('Forbidden: You do not own this pass', 403));
    }

    const isExpired = pass.status === 'EXPIRED' || pass.validUntil < new Date();
    if (!isExpired) {
      return next(new AppError('Only expired passes can be deleted', 400));
    }

    await prisma.pass.delete({ where: { id } });

    await auditLog(req.user!.userId, 'DELETE_PASS', 'Pass', id);
    return sendSuccess(res, 200, 'Pass deleted');
  } catch (err) { next(err); }
};

export const verifyPass = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    const pass = await prisma.pass.findUnique({
      where: { id },
      include: {
        resident: { select: { name: true, phone: true } },
        unit: { select: { unitNumber: true, tower: true } },
      }
    });
    if (!pass) return next(new AppError('Pass not found', 404));

    const now = new Date();
    const isWithinWindow = now >= pass.validFrom && now <= pass.validUntil;
    const isClear = pass.status === 'ACTIVE' && isWithinWindow;

    return sendSuccess(res, 200, 'Pass verified', {
      pass,
      clearance: isClear ? 'CLEAR' : 'DENIED',
      reason: isClear ? null : (pass.status !== 'ACTIVE' ? `Pass is ${pass.status.toLowerCase()}` : 'Outside valid time window'),
    });
  } catch (err) { next(err); }
};

export const getAllPasses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Used by MANAGER — with offset pagination
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [passes, total] = await prisma.$transaction([
      prisma.pass.findMany({
        include: { unit: true, resident: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.pass.count(),
    ]);

    return sendSuccess(res, 200, 'All passes fetched', {
      passes,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (err) { next(err); }
};
