import cron from 'node-cron';
import { prisma } from '../config/prisma';
import { sendSMS } from '../utils/sms.util';
import { sendPush } from '../utils/push.util';
import { logger } from '../utils/logger.util';
import { AlertPriority } from '@prisma/client';

const SLA_MINUTES = { P1: 3, P2: 15, P3: 60 };

export const alertEscalationJob = cron.schedule('*/1 * * * *', async () => {
  try {
    const now = new Date();

    for (const [priority, minutes] of Object.entries(SLA_MINUTES)) {
      const cutoff = new Date(now.getTime() - minutes * 60 * 1000);

      const overdueAlerts = await prisma.alert.findMany({
        where: {
          priority: priority as AlertPriority,
          status: 'SENT',
          createdAt: { lt: cutoff },
        },
        include: { incident: true },
      });

      for (const alert of overdueAlerts) {
        // Escalate: find managers and committee for this property
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
            body: `Alert unacknowledged for ${minutes} min. ${alert.body}`,
            data: { alertId: alert.id, type: 'ESCALATION' },
          });
        }

        // SMS escalation for P1
        if (priority === 'P1') {
          for (const target of escalationTargets) {
            await sendSMS(target.phone, `ESCALATED P1: ${alert.title}. ${alert.body}. Check the app immediately.`);
          }
        }

        await prisma.alert.update({
          where: { id: alert.id },
          data: { status: 'ESCALATED', escalatedAt: now },
        });

        logger.warn(`Alert ${alert.id} escalated (${priority}, ${minutes}min SLA breached)`);
      }
    }
  } catch (err) {
    logger.error('alertEscalationJob failed', { err });
  }
});
