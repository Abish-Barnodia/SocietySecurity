import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { sendSuccess, sendError } from '../../utils/response.util';
import { AppError } from '../../middlewares/error.middleware';
import { auditLog } from '../../utils/audit.util';
import { io } from '../../server';
import { sendSMS } from '../../utils/sms.util';
import { env } from '../../config/env';
import { acknowledgeAlert } from '../../utils/alert.util';

export const broadcastAlert = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, severity, title, message, targetRoles } = req.body;

    const propertyId = req.user!.propertyId;

    if (!propertyId) return next(new AppError('No property context found for alert broadcast', 400));

    if (severity === 'CRITICAL' && req.user!.role !== 'MANAGER') {
      return next(new AppError('Only managers can broadcast critical alerts', 403));
    }

    // Map severity to AlertPriority
    let priority: any = 'P3';
    if (severity === 'CRITICAL') priority = 'P1';
    else if (severity === 'HIGH') priority = 'P2';

    const alert = await prisma.alert.create({
      data: {
        propertyId,
        priority,
        title: `[${type}] ${title}`,
        body: message,
        channel: 'PUSH',
        targetRoles: targetRoles || ['RESIDENT', 'GUARD', 'MANAGER', 'COMMITTEE']
      }
    });

    // 1. Broadcast via WebSocket scoped to this property only
    io?.to(`property:${propertyId}`).emit('new_alert', alert);

    // 2. Fetch users scoped to this property only to prevent cross-tenant notification
    const targetUsers = await prisma.user.findMany({
      where: {
        role: { in: targetRoles || ['RESIDENT', 'GUARD', 'MANAGER', 'COMMITTEE'] },
        isActive: true,
        OR: [
          { guard: { propertyId } },
          { manager: { propertyId } },
          { resident: { unit: { propertyId } } },
        ],
      }
    });

    // 3. Send SMS if Critical
    if (severity === 'CRITICAL') {
      const phones = targetUsers.map(u => u.phone);
      // In production, we'd batch these SMS calls or send to an SNS topic.
      // For now, we simulate sending critical SMS.
      if (env.NODE_ENV !== 'test') {
         // await Promise.all(phones.map(p => sendSMS(p, `[URGENT] ${title}: ${message}`)));
      }
    }

    // 4. Send Firebase FCM Pushes via the sendPush utility (batches 500 tokens, cleans invalid ones)
    const fcmTokens = targetUsers.flatMap(u => u.fcmTokens);
    if (fcmTokens.length > 0) {
      const { sendPush } = await import('../../utils/push.util');
      await sendPush(fcmTokens, { title: `[${type}] ${title}`, body: message });
    }

    await auditLog(req.user!.userId, 'BROADCAST_ALERT', 'Alert', alert.id);
    return sendSuccess(res, 201, 'Alert broadcasted successfully', alert);
  } catch (err) { next(err); }
};

export const triggerDuress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // This is typically triggered silently by a resident or guard
    const { latitude, longitude } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { resident: { include: { unit: true } }, guard: true }
    });

    if (!user) return next(new AppError('User not found', 404));

    let propertyId = user.guard?.propertyId || user.resident?.unit.propertyId;
    let senderName = user.resident?.name || user.guard?.name || 'Unknown User';

    const alert = await prisma.alert.create({
      data: {
        propertyId: propertyId!,
        priority: 'P1',
        title: 'SILENT DURESS ALARM',
        body: `${senderName} has triggered a silent duress alarm. Immediate assistance required.`,
        channel: 'PUSH',
        targetRoles: ['GUARD', 'MANAGER']
      }
    });

    // Notify Guards and Managers immediately via sockets — scoped to this property
    io?.to(`property:${propertyId}`).emit('duress_alert', alert);

    // Send SMS to Emergency Contact if Resident
    if (user.resident?.emergencyContact) {
       await sendSMS(
          user.resident.emergencyContact, 
          `URGENT: ${senderName} has triggered a duress alarm via Apartment Security.`
       );
    }

    // Send SMS to Property Emergency Number
    if (env.EMERGENCY_SMS_NUMBER) {
       await sendSMS(
         env.EMERGENCY_SMS_NUMBER,
         `DURESS ALARM: User ID ${user.id} at Property ${propertyId}.`
       );
    }

    await auditLog(req.user!.userId, 'TRIGGER_DURESS', 'Alert', alert.id);
    
    // Send 200 silently to not tip off anyone monitoring the app UI
    return sendSuccess(res, 200, 'Ok', { received: true });
  } catch (err) { next(err); }
};

export const getAlerts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Caller's propertyId — already resolved by auth middleware — scopes alerts
    // to prevent cross-tenant data exposure.
    const propertyId = req.user!.propertyId;

    if (!propertyId) return next(new AppError('No property context found', 403));

    // Managers/committee run the property's Alerts & Escalation dashboard —
    // they need oversight of everything happening on the property (a
    // resident's own broadcast, a guard's vehicle alert), not just alerts
    // some triggerAlert() call happened to target at their role. Guards and
    // residents keep the narrower "alerts addressed to me" feed.
    const isOversightRole = req.user!.role === 'MANAGER' || req.user!.role === 'COMMITTEE';

    const alerts = await prisma.alert.findMany({
      where: {
        propertyId,
        // Role-wide broadcasts (targetRoles) and alerts aimed at this specific
        // user (targetUserIds — e.g. a visitor-approval request for one
        // resident) are both valid ways an alert can be "for" this caller;
        // matching only targetRoles meant any targetUserIds-only alert
        // (walk-in requests, visitor QR approvals) was never fetchable here.
        ...(isOversightRole ? {} : {
          OR: [
            { targetRoles: { has: req.user!.role as any } },
            { targetUserIds: { has: req.user!.userId } },
          ],
        }),
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return sendSuccess(res, 200, 'Alerts fetched', alerts);
  } catch (err) { next(err); }
};

export const broadcastVehicleAlert = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { photoBase64, plateNumber, vehicleDetails, location, notes } = req.body;

    const propertyId = req.user!.propertyId;
    if (!propertyId) return next(new AppError('Guard profile not found', 404));

    const { uploadBuffer } = await import('../../utils/objectStorage.util');
    const buffer = Buffer.from(photoBase64, 'base64');
    const imageUrl = await uploadBuffer(buffer, `vehicle-alerts/${Date.now()}.jpg`, 'image/jpeg');

    const body = `${vehicleDetails} — Plate ${plateNumber} — spotted at ${location}.${notes ? ` ${notes}` : ''}`;

    const { triggerAlert } = await import('../../utils/alert.util');
    const alert = await triggerAlert({
      priority: 'P2',
      title: 'Unknown Vehicle Alert',
      body,
      targetRoles: ['RESIDENT'],
      propertyId,
      imageUrl,
    });

    io?.to(`property:${propertyId}`).emit('new_alert', alert);

    await auditLog(req.user!.userId, 'BROADCAST_VEHICLE_ALERT', 'Alert', alert.id);
    return sendSuccess(res, 201, 'Vehicle alert sent to all residents', alert);
  } catch (err) { next(err); }
};

export const claimVehicleAlert = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const alert = await prisma.alert.findUnique({ where: { id } });
    if (!alert) return next(new AppError('Alert not found', 404));
    // First claim wins — this is a broadcast to many residents, only one of
    // them actually owns the vehicle.
    if (alert.claimedByUserId) return next(new AppError('This vehicle has already been claimed by another resident', 400));

    const resident = await prisma.resident.findUnique({
      where: { userId: req.user!.userId },
      include: { unit: true },
    });
    if (!resident) return next(new AppError('Resident context not found', 404));
    if (resident.unit.propertyId !== alert.propertyId) return next(new AppError('Unauthorized', 403));

    const updated = await prisma.alert.update({
      where: { id },
      data: {
        claimedByUserId: req.user!.userId,
        claimedByName: resident.name,
        claimedAt: new Date(),
      },
    });

    const { triggerAlert } = await import('../../utils/alert.util');
    const guardAlert = await triggerAlert({
      priority: 'P3',
      title: 'Vehicle Claimed',
      body: `${resident.name} (Unit ${resident.unit.unitNumber}) says this vehicle is theirs: ${alert.body}`,
      targetRoles: ['GUARD'],
      propertyId: alert.propertyId,
      imageUrl: alert.imageUrl ?? undefined,
    });
    io?.to(`property:${alert.propertyId}`).emit('new_alert', guardAlert);

    await auditLog(req.user!.userId, 'CLAIM_VEHICLE_ALERT', 'Alert', id);
    return sendSuccess(res, 200, 'Vehicle claim recorded', updated);
  } catch (err) { next(err); }
};

export const acknowledgeAlertRoute = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const alert = await prisma.alert.findFirst({
      where: {
        OR: [
          { id },
          { entryId: id }
        ]
      }
    });
    if (!alert) return next(new AppError('Alert not found', 404));

    // Same propertyId-scoping as getAlerts — a caller can only acknowledge
    // an alert that belongs to their own property.
    const propertyId = req.user!.propertyId;

    if (!propertyId || alert.propertyId !== propertyId) {
      return next(new AppError('Unauthorized', 403));
    }

    const updated = await acknowledgeAlert(id, req.user!.userId);
    return sendSuccess(res, 200, 'Alert acknowledged', updated);
  } catch (err) { next(err); }
};
