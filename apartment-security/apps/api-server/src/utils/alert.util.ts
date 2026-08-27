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
  // Data-only push (see push.util.ts) — used when the client needs to build
  // its own actionable notification (e.g. Approve/Deny buttons) rather than
  // just display title/body.
  dataOnly?: boolean;
  // Extra fields folded into the push's data payload alongside alertId/entryId
  // — e.g. visitorName/timeoutAt for a visitor-approval push, so the client
  // can render/act on it without an extra round trip.
  extraData?: Record<string, string>;
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
    dataOnly,
    extraData,
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
  // Also broadcast to the whole property room — managers get oversight of
  // every alert (see getAlerts), not just ones that happened to target
  // their own user id, and their Alerts & Escalation badge count needs a
  // live signal regardless of who the alert was actually for.
  try {
    const { io } = await import('../server');
    for (const uid of userIds) {
      io?.to(`user:${uid}`).emit('new_alert', alert);
    }
    io?.to(`property:${propertyId}`).emit('new_alert', alert);
  } catch { /* server not yet ready during tests */ }

  const allFcmTokens = users.flatMap((u) => u.fcmTokens);
  const pushData = { alertId: alert.id, priority, ...(entryId ? { entryId } : {}), ...(extraData ?? {}) };

  // P1: push + SMS simultaneously, no waiting
  if (priority === 'P1') {
    const pushPromise = allFcmTokens.length
      ? sendPush(allFcmTokens, { title, body, data: pushData, dataOnly })
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
      await sendPush(allFcmTokens, { title, body, data: pushData, dataOnly });
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

  const updated = await prisma.alert.update({
    where: { id: alert.id },
    data: { status: 'ACKNOWLEDGED', acknowledgedAt: new Date(), acknowledgedBy: userId },
  });

  try {
    const { io } = await import('../server');
    // Notify whoever raised this alert (currently only set for duress
    // alarms) that staff has responded — otherwise the sender never learns
    // a manager acted on it beyond the one-time "SOS sent" toast at trigger
    // time.
    if (updated.triggeredByUserId) {
      io?.to(`user:${updated.triggeredByUserId}`).emit('alert_acknowledged', updated);
    }
    // Every manager watching Alerts & Escalation needs to see this flip to
    // ACKNOWLEDGED live too — whichever one of them (or another channel)
    // just acknowledged it, everyone's unread badge should drop together.
    io?.to(`property:${updated.propertyId}`).emit('alert_updated', updated);
  } catch { /* server not yet ready during tests */ }

  return updated;
};
