import cron from 'node-cron';
import { prisma } from '../config/prisma';
import { redis } from '../config/redis';
import { logger } from '../utils/logger.util';

export const cacheRefreshJob = cron.schedule('*/15 * * * *', async () => {
  try {
    const properties = await prisma.property.findMany({ select: { id: true } });

    for (const property of properties) {
      const passes = await prisma.pass.findMany({
        where: {
          unit: { propertyId: property.id },
          status: 'ACTIVE',
          validUntil: { gt: new Date() },
        },
        select: {
          id: true,
          qrPayload: true,
          otpCode: true,
          visitorName: true,
          unitId: true,
          type: true,
          validFrom: true,
          validUntil: true,
          entryPointIds: true,
          recurringRule: true,
        },
      });

      await redis.setex(
        `pass_cache:property:${property.id}`,
        900, // 15 minutes
        JSON.stringify(passes)
      );
    }

    logger.info(`Cache refresh job: refreshed ${properties.length} property caches`);
  } catch (err) {
    logger.error('cacheRefreshJob failed', { err });
  }
});
