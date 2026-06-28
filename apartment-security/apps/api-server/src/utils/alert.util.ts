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
    },
  });

  const allFcmTokens = users.flatMap((u) => u.fcmTokens);

  // P1: push + SMS simultaneously, no waiting
  if (priority === 'P1') {
    const pushPromise = allFcmTokens.length
      ? sendPush(allFcmTokens, { title, body, data: { alertId: alert.id, priority } })
      : Promise.resolve();

    const smsPromises = users.map((u) =>
      sendSMS(u.phone, `🚨 URGENT: ${title}. ${body}`)
    );

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
  return prisma.alert.update({
    where: { id: alertId },
    data: { status: 'ACKNOWLEDGED', acknowledgedAt: new Date(), acknowledgedBy: userId },
  });
};
