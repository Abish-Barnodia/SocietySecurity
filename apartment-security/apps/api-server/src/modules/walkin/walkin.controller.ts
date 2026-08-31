import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { sendSuccess, sendError } from '../../utils/response.util';
import { AppError } from '../../middlewares/error.middleware';
import { auditLog } from '../../utils/audit.util';
import { assignParkingSlot } from '../../utils/parking.util';

export const requestWalkin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { unitId, entryPointId, visitorName, visitorPhone, purpose, gatePhotoUrl, gatePhotoBase64, vehicleNumber } = req.body;
    
    let finalPhotoUrl = gatePhotoUrl;
    if (gatePhotoBase64) {
      const { uploadBuffer } = await import('../../utils/objectStorage.util');
      const buffer = Buffer.from(gatePhotoBase64, 'base64');
      finalPhotoUrl = await uploadBuffer(buffer, `entries/${Date.now()}.jpg`, 'image/jpeg');
    }
    
    const guard = await prisma.guard.findUnique({ where: { userId: req.user!.userId } });
    if (!guard || !guard.isOnDuty) return next(new AppError('Guard must be on an active shift', 400));

    // Validate the unit belongs to the guard's property
    const targetUnit = await prisma.unit.findUnique({
      where: { id: unitId },
      include: { residents: { include: { user: true } } },
    });
    if (!targetUnit || targetUnit.propertyId !== guard.propertyId) {
      return next(new AppError('Forbidden: Unit does not belong to your assigned property', 403));
    }
    // No resident to notify — creating the entry anyway would leave a
    // PENDING_APPROVAL request nobody can ever approve or deny.
    if (targetUnit.residents.length === 0) {
      return next(new AppError('This unit has no registered resident to approve the request', 400));
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
        vehicleNumber,
        notes: purpose,
        gatePhotoUrl: finalPhotoUrl
      }
    });

    // Broadcast to unit room via Socket.io
    const io = req.app.get('io');
    io?.to(`unit_${unitId}`).emit('walkin_request', {
      entryId: entry.id,
      visitorName,
      purpose,
      vehicleNumber,
      gatePhotoUrl: finalPhotoUrl
    });

    // Both run after the resident-facing notification (above), not before —
    // neither is needed for it, and auditLog already swallows its own errors.
    await assignParkingSlot(entry.id, targetUnit.propertyId, vehicleNumber);
    auditLog(req.user!.userId, 'REQUEST_WALKIN', 'Entry', entry.id);

    // Notify all residents in the unit via push using the shared alert utility
    await prisma.walkinApproval.create({
      data: {
        entryId: entry.id,
        residentId: targetUnit.residents[0].id, // Assign to the first resident (usually primary)
        visitorName,
        purpose: purpose || '',
        timeoutAt: new Date(Date.now() + 2 * 60 * 1000) // 2 minutes timeout
      }
    });

    const { triggerAlert } = await import('../../utils/alert.util');
    await triggerAlert({
      priority: 'P2',
      title: 'Visitor at your gate',
      body: `${visitorName} is requesting entry. Please approve or deny.`,
      targetUserIds: targetUnit.residents.map((r: any) => r.userId),
      propertyId: targetUnit.propertyId,
      entryId: entry.id,
      imageUrl: finalPhotoUrl,
      dataOnly: false,
      extraData: {
        type: 'VISITOR_APPROVAL',
        visitorName,
        timeoutAt: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
      },
    });

    return sendSuccess(res, 201, 'Walk-in request sent to residents', entry);
  } catch (err) { next(err); }
};
export const getWalkin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const resident = await prisma.resident.findUnique({ where: { userId: req.user!.userId } });
    if (!resident) return next(new AppError('Resident context not found', 404));

    const entry = await prisma.entry.findUnique({
      where: { id },
      include: {
        walkinApproval: true,
        unit: { select: { unitNumber: true, tower: true } },
        entryPoint: { select: { name: true } },
      }
    });
    if (!entry) return next(new AppError('Entry not found', 404));
    if (entry.unitId !== resident.unitId) return next(new AppError('Unauthorized', 403));

    return sendSuccess(res, 200, 'Entry fetched', entry);
  } catch (err) { next(err); }
};

export const respondWalkin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { status, notes } = req.body;

    if (!req.user!.unitId) return next(new AppError('Resident context not found', 404));

    const entry = await prisma.entry.findUnique({ where: { id }, include: { walkinApproval: true } });
    if (!entry) return next(new AppError('Entry not found', 404));

    if (entry.unitId !== req.user!.unitId) {
        return next(new AppError('Unauthorized to respond to this request', 403));
    }
    if (entry.status !== 'PENDING_APPROVAL') {
        return next(new AppError(`Request already ${entry.status.toLowerCase()}`, 400));
    }
    if (entry.walkinApproval && (entry.walkinApproval.decision || entry.walkinApproval.timeoutAt < new Date())) {
        return next(new AppError('Request already resolved or timed out', 400));
    }

    // Atomic update: ensure we only update if it's still PENDING_APPROVAL
    const updateResult = await prisma.entry.updateMany({
      where: { id, status: 'PENDING_APPROVAL' },
      data: {
        status, // 'APPROVED' or 'DENIED'
        notes: notes ? `${entry.notes || ''} | Res: ${notes}` : entry.notes
      }
    });

    if (updateResult.count === 0) {
      return next(new AppError('Request already resolved by another family member', 400));
    }

    const updatedEntry = await prisma.entry.findUnique({ where: { id } });

    if (entry.walkinApproval) {
      await prisma.walkinApproval.update({
        where: { entryId: id },
        data: { decision: status, respondedAt: new Date() }
      });
      await prisma.passUsageHistory.updateMany({
        where: { entryId: id },
        data: { outcome: status === 'APPROVED' ? 'CLEARED' : 'DENIED' }
      });
    }

    // Notify Guard App — room is `guard:${id}` (colon), matching what
    // socket.handler.ts actually joins guards to on connect.
    const io = req.app.get('io');
    io?.to(`guard:${entry.guardId}`).emit(
      entry.walkinApproval ? 'visitor_approval_response' : 'walkin_response',
      { entryId: entry.id, status }
    );

    // Whichever household member responds first needs to silence the ringing
    // alert on every other family member's phone — mirrors the same
    // unit-room broadcast visitorApprovalTimeout.job.ts already uses for the
    // timeout case, which this endpoint was missing entirely.
    io?.to(`unit_${entry.unitId}`).emit('walkin_resolved', { entryId: entry.id, status });

    const householdUsers = await prisma.user.findMany({
      where: { resident: { unitId: entry.unitId } },
      select: { fcmTokens: true },
    });
    const resolveTokens = householdUsers.flatMap((u) => u.fcmTokens);
    if (resolveTokens.length) {
      const { sendPush } = await import('../../utils/push.util');
      sendPush(resolveTokens, {
        title: '',
        body: '',
        dataOnly: true,
        data: { type: 'VISITOR_APPROVAL_RESOLVED', entryId: entry.id, status },
      }).catch(() => {});
    }

    // auditLog swallows its own errors and never affects the outcome — no
    // reason to make the guard/resident wait on it after the decision is in.
    auditLog(req.user!.userId, 'RESPOND_WALKIN', 'Entry', id);

    return sendSuccess(res, 200, `Walk-in ${status.toLowerCase()}`, updatedEntry);
  } catch (err) { next(err); }
};

export const callResident = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const guardId = req.user!.guardId;
    if (!guardId) return next(new AppError('Guard profile not found', 404));

    const entry = await prisma.entry.findUnique({ where: { id }, include: { walkinApproval: true } });
    if (!entry) return next(new AppError('Entry not found', 404));
    if (entry.guardId !== guardId) return next(new AppError('Unauthorized: not your entry', 403));
    if (!entry.walkinApproval || entry.walkinApproval.decision !== 'TIMEOUT') {
      return next(new AppError('Call Resident is only available after the approval window times out', 400));
    }

    const guardCalledAt = new Date();
    await prisma.walkinApproval.update({ where: { entryId: id }, data: { guardCalledAt } });
    await auditLog(req.user!.userId, 'CALL_RESIDENT', 'WalkinApproval', entry.walkinApproval.id);

    return sendSuccess(res, 200, 'Call recorded', { guardCalledAt });
  } catch (err) { next(err); }
};

export const getPendingWalkins = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const propertyId = req.user!.propertyId;

    if (!propertyId && req.user!.role !== 'COMMITTEE') {
      return next(new AppError('No property context found', 400));
    }

    const where: any = { status: 'PENDING_APPROVAL' };
    if (propertyId) {
      where.unit = { propertyId };
    }

    const pendingWalkins = await prisma.entry.findMany({
      where,
      include: {
        unit: { select: { unitNumber: true, tower: true } },
        entryPoint: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return sendSuccess(res, 200, 'Pending walk-ins retrieved', pendingWalkins);
  } catch (err) { next(err); }
};
