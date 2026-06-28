import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { sendSuccess, sendError } from '../../utils/response.util';
import { AppError } from '../../middlewares/error.middleware';
import { auditLog } from '../../utils/audit.util';
import { io } from '../../server';
import { sendSMS } from '../../utils/sms.util';
import { env } from '../../config/env';

export const broadcastAlert = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, severity, title, message, targetRoles } = req.body;
    
    let propertyId = undefined;
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { manager: true, committee: true, guard: true }
    });

    if (user?.manager) propertyId = user.manager.propertyId;
    else if (user?.guard) propertyId = user.guard.propertyId;
    
    if (!propertyId) return next(new AppError('No property context found for alert broadcast', 400));

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

    // 1. Broadcast via WebSocket (Global to property or specific rooms based on roles)
    io?.emit('new_alert', alert);

    // 2. Fetch users to notify based on roles
    const targetUsers = await prisma.user.findMany({
      where: {
        role: { in: targetRoles || ['RESIDENT', 'GUARD', 'MANAGER', 'COMMITTEE'] },
        isActive: true
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

    // 4. Send Firebase FCM Pushes
    const fcmTokens = targetUsers.flatMap(u => u.fcmTokens);
    if (fcmTokens.length > 0) {
       // TODO: Implement FCM Push bulk send
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

    // Notify Guards and Managers immediately via sockets
    io?.emit('duress_alert', alert);

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
    const alerts = await prisma.alert.findMany({
      where: {
        targetRoles: {
          has: req.user!.role as any
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return sendSuccess(res, 200, 'Alerts fetched', alerts);
  } catch (err) { next(err); }
};
