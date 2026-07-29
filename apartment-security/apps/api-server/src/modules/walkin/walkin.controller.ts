import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { sendSuccess, sendError } from '../../utils/response.util';
import { AppError } from '../../middlewares/error.middleware';
import { auditLog } from '../../utils/audit.util';
import { io } from '../../server'; // Socket.io instance

export const requestWalkin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { unitId, entryPointId, visitorName, visitorPhone, purpose, gatePhotoUrl } = req.body;
    
    const guard = await prisma.guard.findUnique({ where: { userId: req.user!.userId } });
    if (!guard || !guard.isOnDuty) return next(new AppError('Guard must be on an active shift', 400));

    // Validate the unit belongs to the guard's property
    const targetUnit = await prisma.unit.findUnique({ where: { id: unitId } });
    if (!targetUnit || targetUnit.propertyId !== guard.propertyId) {
      return next(new AppError('Forbidden: Unit does not belong to your assigned property', 403));
    }

    // Create a pending entry
    const entry = await prisma.entry.create({
      data: {
        unitId,
        guardId: guard.id,
        entryPointId,
        method: 'MANUAL_GUARD',
        status: 'PENDING_APPROVAL',
        visitorName,
        visitorPhone,
        notes: purpose,
        gatePhotoUrl
      }
    });

    await auditLog(req.user!.userId, 'REQUEST_WALKIN', 'Entry', entry.id);

    // Broadcast to unit room via Socket.io
    io?.to(`unit_${unitId}`).emit('walkin_request', {
      entryId: entry.id,
      visitorName,
      purpose,
      gatePhotoUrl
    });

    // Notify all residents in the unit via push using the shared alert utility
    const unit = await prisma.unit.findUnique({ where: { id: unitId }, include: { residents: { include: { user: true } } } });
    if (unit) {
      const { triggerAlert } = await import('../../utils/alert.util');
      await triggerAlert({
        priority: 'P2',
        title: 'Visitor at your gate',
        body: `${visitorName} is requesting entry. Please approve or deny.`,
        targetUserIds: unit.residents.map((r: any) => r.userId),
        propertyId: (await prisma.entryPoint.findUnique({ where: { id: entryPointId } }))?.propertyId ?? '',
        entryId: entry.id,
      });
    }

    return sendSuccess(res, 201, 'Walk-in request sent to residents', entry);
  } catch (err) { next(err); }
};

export const respondWalkin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { status, notes } = req.body;
    
    const currentResident = await prisma.resident.findUnique({
        where: { userId: req.user!.userId }
    });
    if (!currentResident) return next(new AppError('Resident context not found', 404));

    const entry = await prisma.entry.findUnique({ where: { id } });
    if (!entry) return next(new AppError('Entry not found', 404));

    if (entry.unitId !== currentResident.unitId) {
        return next(new AppError('Unauthorized to respond to this request', 403));
    }
    if (entry.status !== 'PENDING_APPROVAL') {
        return next(new AppError(`Request already ${entry.status.toLowerCase()}`, 400));
    }

    const updatedEntry = await prisma.entry.update({
      where: { id },
      data: {
        status, // 'APPROVED' or 'DENIED'
        notes: notes ? `${entry.notes || ''} | Res: ${notes}` : entry.notes
      }
    });

    await auditLog(req.user!.userId, 'RESPOND_WALKIN', 'Entry', id);

    // Notify Guard App
    io?.to(`guard_${entry.guardId}`).emit('walkin_response', {
      entryId: entry.id,
      status
    });

    return sendSuccess(res, 200, `Walk-in ${status.toLowerCase()}`, updatedEntry);
  } catch (err) { next(err); }
};
