import cron from 'node-cron';
import { prisma } from '../config/prisma';
import { sendSMS } from '../utils/sms.util';
import { sendPush } from '../utils/push.util';
import { logger } from '../utils/logger.util';
import { AlertPriority } from '@prisma/client';

export const SLA_MINUTES = { P1: 3, P2: 15, P3: 60 };

// Notifies a single configured escalation step's target — a real registered
// user (push/SMS/email via their own contact info) or an external contact
// (SMS-only, since that's all a phone-only contact supports).
const notifyStep = async (
  step: { channel: string; contactPhone: string | null; contactName: string | null; userId: string | null },
  title: string,
  body: string
) => {
  const user = step.userId
    ? await prisma.user.findUnique({ where: { id: step.userId }, select: { phone: true, fcmTokens: true } })
    : null;

  const wantsPush = step.channel === 'PUSH' || step.channel === 'ALL';
  const wantsSms = step.channel === 'SMS' || step.channel === 'ALL';

  if (wantsPush && user?.fcmTokens.length) {
    await sendPush(user.fcmTokens, { title, body });
  }
  if (wantsSms) {
    const phone = user?.phone ?? step.contactPhone;
    if (phone) await sendSMS(phone, `${title}. ${body}`);
  }
};

export const alertEscalationJob = cron.schedule('*/1 * * * *', async () => {
  try {
    const now = new Date();

    for (const [priority, slaMinutes] of Object.entries(SLA_MINUTES)) {
      const cutoff = new Date(now.getTime() - slaMinutes * 60 * 1000);

      const overdueAlerts = await prisma.alert.findMany({
        where: {
          priority: priority as AlertPriority,
          status: { in: ['SENT', 'ESCALATED'] },
          createdAt: { lt: cutoff },
        },
      });

      for (const alert of overdueAlerts) {
        const chain = await prisma.escalationChain.findUnique({
          where: { propertyId_priority: { propertyId: alert.propertyId, priority: priority as AlertPriority } },
          include: { steps: { orderBy: { order: 'asc' } } },
        });

        const elapsedMinutes = Math.floor((now.getTime() - alert.createdAt.getTime()) / 60000);

        if (chain) {
          // Fire every step that's now due and hasn't fired yet, in order.
          const dueSteps = chain.steps.filter(
            (s) => s.order > alert.escalationStep && elapsedMinutes >= s.delayMinutes
          );
          if (dueSteps.length === 0) continue;

          for (const step of dueSteps) {
            await notifyStep(step, `⚠️ ESCALATED: ${alert.title}`, `Alert unacknowledged for ${elapsedMinutes} min. ${alert.body}`);
          }

          await prisma.alert.update({
            where: { id: alert.id },
            data: {
              status: 'ESCALATED',
              escalatedAt: alert.escalatedAt ?? now,
              escalationStep: dueSteps[dueSteps.length - 1].order,
            },
          });
          logger.warn(`Alert ${alert.id} escalated to step ${dueSteps[dueSteps.length - 1].order} (${priority})`);
          continue;
        }

        // No configured chain for this property/priority — fall back to the
        // old flat behavior (notify every manager/committee member at once).
        if (alert.status === 'ESCALATED') continue;

        const escalationTargets = await prisma.user.findMany({
          where: {
            role: { in: ['MANAGER', 'COMMITTEE'] },
            isActive: true,
            OR: [
              { manager: { propertyId: alert.propertyId } },
              { committee: { isNot: null } },
            ],
          },
          select: { id: true, phone: true, fcmTokens: true },
        });

        const allTokens = escalationTargets.flatMap((u) => u.fcmTokens);
        if (allTokens.length) {
          await sendPush(allTokens, {
            title: `⚠️ ESCALATED: ${alert.title}`,
            body: `Alert unacknowledged for ${slaMinutes} min. ${alert.body}`,
            data: { alertId: alert.id, type: 'ESCALATION' },
          });
        }

        if (priority === 'P1') {
          for (const target of escalationTargets) {
            if (!target.phone) continue;
            await sendSMS(target.phone, `ESCALATED P1: ${alert.title}. ${alert.body}. Check the app immediately.`);
          }
        }

        await prisma.alert.update({
          where: { id: alert.id },
          data: { status: 'ESCALATED', escalatedAt: now },
        });

        logger.warn(`Alert ${alert.id} escalated (${priority}, ${slaMinutes}min SLA breached, no chain configured)`);
      }
    }
  } catch (err) {
    logger.error('alertEscalationJob failed', { err });
  }
});
