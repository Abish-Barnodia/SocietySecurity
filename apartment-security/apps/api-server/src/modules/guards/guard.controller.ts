import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { sendSuccess, sendError } from '../../utils/response.util';
import { AppError } from '../../middlewares/error.middleware';
import { auditLog } from '../../utils/audit.util';

export const startShift = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entryPointId, latitude, longitude } = req.body;
    
    const guard = await prisma.guard.findUnique({ where: { userId: req.user!.userId } });
    if (!guard) return next(new AppError('Guard profile not found', 404));

    // Check if already on duty
    if (guard.isOnDuty) return next(new AppError('You are already on an active shift', 400));

    // Verify entry point
    const entryPoint = await prisma.entryPoint.findUnique({ where: { id: entryPointId } });
    if (!entryPoint || entryPoint.propertyId !== guard.propertyId) {
      return next(new AppError('Invalid entry point', 400));
    }

    const shift = await prisma.$transaction(async (tx) => {
      // 1. Create shift
      const newShift = await tx.shift.create({
        data: { guardId: guard.id }
      });

      // 2. Create post check-in
      await tx.guardPost.create({
        data: {
          guardId: guard.id,
          shiftId: newShift.id,
          entryPointId,
          latitude,
          longitude
        }
      });

      // 3. Mark guard as on duty
      await tx.guard.update({
        where: { id: guard.id },
        data: { isOnDuty: true }
      });

      return newShift;
    });

    await auditLog(req.user!.userId, 'START_SHIFT', 'Shift', shift.id);
    return sendSuccess(res, 201, 'Shift started successfully', shift);
  } catch (err) { next(err); }
};

export const endShift = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { handoverNote } = req.body;
    
    const guard = await prisma.guard.findUnique({ where: { userId: req.user!.userId } });
    if (!guard) return next(new AppError('Guard profile not found', 404));

    if (!guard.isOnDuty) return next(new AppError('You are not on an active shift', 400));

    // Find active shift
    const activeShift = await prisma.shift.findFirst({
      where: { guardId: guard.id, endedAt: null },
      orderBy: { startedAt: 'desc' }
    });

    if (!activeShift) return next(new AppError('Active shift record not found', 404));

    await prisma.$transaction([
      prisma.shift.update({
        where: { id: activeShift.id },
        data: { endedAt: new Date(), signedOffAt: new Date(), handoverNote }
      }),
      prisma.guard.update({
        where: { id: guard.id },
        data: { isOnDuty: false }
      })
    ]);

    await auditLog(req.user!.userId, 'END_SHIFT', 'Shift', activeShift.id);
    return sendSuccess(res, 200, 'Shift ended successfully');
  } catch (err) { next(err); }
};

export const checkInPost = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entryPointId, latitude, longitude } = req.body;
    
    const guard = await prisma.guard.findUnique({ where: { userId: req.user!.userId } });
    if (!guard || !guard.isOnDuty) return next(new AppError('Not on an active shift', 400));

    const activeShift = await prisma.shift.findFirst({
      where: { guardId: guard.id, endedAt: null }
    });
    if (!activeShift) return next(new AppError('Active shift not found', 404));

    const post = await prisma.guardPost.create({
      data: {
        guardId: guard.id,
        shiftId: activeShift.id,
        entryPointId,
        latitude,
        longitude
      }
    });

    await auditLog(req.user!.userId, 'POST_CHECK_IN', 'GuardPost', post.id);
    return sendSuccess(res, 201, 'Checked into post', post);
  } catch (err) { next(err); }
};
