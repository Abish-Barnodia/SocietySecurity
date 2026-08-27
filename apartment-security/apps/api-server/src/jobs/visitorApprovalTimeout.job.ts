import cron from 'node-cron';
import { prisma } from '../config/prisma';
import { logger } from '../utils/logger.util';
import { io } from '../server';

// 120-second approval SLA needs a much tighter poll than the other jobs
// (which run every 1-15 minutes) to keep the perceived timeout close to real.
export const visitorApprovalTimeoutJob = cron.schedule('*/15 * * * * *', async () => {
  try {
    const timedOut = await prisma.walkinApproval.findMany({
      where: { respondedAt: null, decision: null, timeoutAt: { lt: new Date() } },
      include: { entry: true },
    });

    for (const wa of timedOut) {
      await prisma.walkinApproval.update({
        where: { id: wa.id },
        data: { decision: 'TIMEOUT' }, // respondedAt stays null — the resident never actually responded
      });
      await prisma.entry.update({
        where: { id: wa.entryId },
        data: { status: 'NO_RESPONSE' },
      });
      await prisma.passUsageHistory.updateMany({
        where: { entryId: wa.entryId },
        data: { outcome: 'TIMEOUT' },
      });

      io?.to(`guard:${wa.entry.guardId}`).emit('visitor_approval_timeout', { entryId: wa.entryId });
      io?.to(`unit_${wa.entry.unitId}`).emit('visitor_approval_timeout', { entryId: wa.entryId });

      // Silence the ringing alert on household devices that missed the
      // socket broadcast (app backgrounded/killed) — same data-only push
      // respondWalkin sends when a family member actually answers.
      const householdUsers = await prisma.user.findMany({
        where: { resident: { unitId: wa.entry.unitId } },
        select: { fcmTokens: true },
      });
      const resolveTokens = householdUsers.flatMap((u) => u.fcmTokens);
      if (resolveTokens.length) {
        const { sendPush } = await import('../utils/push.util');
        sendPush(resolveTokens, {
          title: '',
          body: '',
          dataOnly: true,
          data: { type: 'VISITOR_APPROVAL_RESOLVED', entryId: wa.entryId, status: 'NO_RESPONSE' },
        }).catch(() => {});
      }

      logger.warn(`Visitor approval timed out: entry ${wa.entryId}`);
    }
  } catch (err) {
    logger.error('visitorApprovalTimeoutJob failed', { err });
  }
});
