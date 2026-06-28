import cron from 'node-cron';
import { prisma } from '../config/prisma';
import { logger } from '../utils/logger.util';

export const passExpiryJob = cron.schedule('*/15 * * * *', async () => {
  try {
    const expired = await prisma.pass.updateMany({
      where: {
        status: 'ACTIVE',
        validUntil: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    });
    if (expired.count > 0) {
      logger.info(`Pass expiry job: expired ${expired.count} passes`);
    }

    // Also reactivate passes where suspendedUntil has passed
    const reactivated = await prisma.pass.updateMany({
      where: {
        status: 'SUSPENDED',
        suspendedUntil: { lt: new Date() },
        validUntil: { gt: new Date() },
      },
      data: { status: 'ACTIVE', suspendedAt: null, suspendedUntil: null },
    });
    if (reactivated.count > 0) {
      logger.info(`Pass expiry job: reactivated ${reactivated.count} suspended passes`);
    }
  } catch (err) {
    logger.error('passExpiryJob failed', { err });
  }
});
