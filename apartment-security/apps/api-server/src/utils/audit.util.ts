import { prisma } from '../config/prisma';
import { logger } from './logger.util';

export const auditLog = async (
  userId: string,
  action: string,
  entity: string,
  entityId: string,
  before?: any,
  after?: any,
  ipAddress?: string,
  userAgent?: string
) => {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId,
        before: before ? before : undefined,
        after: after ? after : undefined,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    // We don't want audit log failures to crash the main request, just log it.
    logger.error('Failed to create audit log:', error);
  }
};
