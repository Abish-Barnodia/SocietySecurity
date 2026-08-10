import { prisma } from '../config/prisma';
import { sendPush } from './push.util';
import { sendSMS } from './sms.util';
import { AlertPriority, Role } from '@prisma/client';
import { env } from '../config/env';

interface TriggerAlertParams {
  priority: AlertPriority;
  title: string;
  body: string;
  targetUserIds?: string[];
  targetRoles?: Role[];
  entryId?: string;
  incidentId?: string;
  propertyId: string;
  imageUrl?: string;
}

export const triggerAlert = async (params: TriggerAlertParams) => {
  const {
    priority,
    title,
    body,
    targetUserIds = [],
    targetRoles = [],
    entryId,
    incidentId,
    propertyId,
    imageUrl,
  } = params;

  // Determine all target users
  let userIds = [...targetUserIds];

  if (targetRoles.length > 0) {
    const users = await prisma.user.findMany({
      where: {
        role: { in: targetRoles },
        isActive: true,
        OR: [
          { guard: { propertyId } },
          { manager: { propertyId } },
          { resident: { unit: { propertyId } } },
        ],
      },
      select: { id: true },
    });
    userIds.push(...users.map((u) => u.id));
  }

  userIds = [...new Set(userIds)]; // deduplicate

  // Fetch FCM tokens for all targets
  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, isActive: true },
    select: { id: true, phone: true, fcmTokens: true, role: true },
  });

  // Create alert record
  const alert = await prisma.alert.create({
    data: {
      entryId,
      incidentId,
      propertyId,
      priority,
      title,
      body,
      targetRoles: targetRoles,
      targetUserIds: userIds,
      channel: 'PUSH',
      status: 'SENT',
      imageUrl,
    },
  });

  // Emit live socket event to every target user's personal room so the
  // resident app receives the alert instantly without relying on FCM push.
  try {
    const { io } = await import('../server');
    for (const uid of userIds) {
      io?.to(`user:${uid}`).emit('new_alert', alert);
    }
  } catch { /* server not yet ready during tests */ }

  const allFcmTokens = users.flatMap((u) => u.fcmTokens);

  // P1: push + SMS simultaneously, no waiting
  if (priority === 'P1') {
    const pushPromise = allFcmTokens.length
      ? sendPush(allFcmTokens, { title, body, data: { alertId: alert.id, priority } })
      : Promise.resolve();

    const smsPromises = users
      .filter((u) => u.phone)
      .map((u) => sendSMS(u.phone as string, `🚨 URGENT: ${title}. ${body}`));

    // Emergency services for P1 incidents
    if (incidentId && env.EMERGENCY_SMS_NUMBER) {
      smsPromises.push(
        sendSMS(env.EMERGENCY_SMS_NUMBER, `P1 ALERT at property ${propertyId}: ${title}. ${body}`)
      );
    }

    await Promise.allSettled([pushPromise, ...smsPromises]);
  } else {
    // P2 and P3: push only; SMS fallback via escalation job
    if (allFcmTokens.length) {
      await sendPush(allFcmTokens, {
        title,
        body,
        data: { alertId: alert.id, priority },
      });
    }
  }

  return alert;
};

export const acknowledgeAlert = async (alertId: string, userId: string) => {
  const alert = await prisma.alert.findFirst({
    where: {
      OR: [
        { id: alertId },
        { entryId: alertId }
      ]
    }
  });
  if (!alert) return null;

  return prisma.alert.update({
    where: { id: alert.id },
    data: { status: 'ACKNOWLEDGED', acknowledgedAt: new Date(), acknowledgedBy: userId },
  });
};
