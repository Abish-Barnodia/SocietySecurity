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
    const { type, visitorName, visitorPhone, purpose, validFrom, validUntil, entryPointIds, recurringRule } = req.body;
    
    // Validate resident context
    const currentResident = await prisma.resident.findUnique({
        where: { userId: req.user!.userId }
    });
    if (!currentResident) return next(new AppError('Resident context not found', 404));

    // For DELIVERY type, we optionally create an OTP
    let otpPlaintext = null;
    let otpHash = null;
    if (type === 'DELIVERY') {
        otpPlaintext = Math.floor(100000 + Math.random() * 900000).toString();
        otpHash = await bcrypt.hash(otpPlaintext, 10);
    }

    const pass = await prisma.pass.create({
      data: {
        residentId: currentResident.id,
        unitId: currentResident.unitId,
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

    const updatedPass = await prisma.pass.update({
      where: { id },
      data: { status: 'REVOKED', revokedAt: new Date(), revokedBy: req.user!.userId }
    });

    await auditLog(req.user!.userId, 'REVOKE_PASS', 'Pass', id);
    return sendSuccess(res, 200, 'Pass revoked', updatedPass);
  } catch (err) { next(err); }
};

export const getAllPasses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Used by MANAGER
    const passes = await prisma.pass.findMany({
      include: { unit: true, resident: true },
      orderBy: { createdAt: 'desc' },
      take: 100 // pagination could be added here
    });

    return sendSuccess(res, 200, 'All passes fetched', passes);
  } catch (err) { next(err); }
};
