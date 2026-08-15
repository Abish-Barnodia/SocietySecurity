import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.util';
import { AppError } from './error.middleware';
import { prisma } from '../config/prisma';
import { MANAGER_SESSION_IDLE_MS } from '../utils/managerPortalLock.util';

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
      return next(new AppError('You are not logged in. Please log in to get access.', 401));
    }
    
    const decoded = verifyAccessToken(token);
    
    // Validate user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        resident: { include: { unit: true } },
        guard: true,
        manager: true,
        committee: true,
      }
    });
    if (!user || !user.isActive) {
      return next(new AppError('The user belonging to this token no longer exists or is deactivated.', 401));
    }

    let propertyId: string | undefined;
    if (user.resident) propertyId = user.resident.unit.propertyId;
    else if (user.guard) propertyId = user.guard.propertyId;
    else if (user.manager) propertyId = user.manager.propertyId;

    // Also include residentId if resident
    let residentId: string | undefined;
    if (user.resident) residentId = user.resident.id;

    // Managers get exactly one active Manager Portal session per property.
    // Every request re-checks that this token's session still holds the
    // lock (so a force-logout or expiry takes effect immediately, not just
    // on next login) and, if so, extends the idle timeout — a heartbeat
    // that rides on normal request traffic instead of a dedicated endpoint.
    if (user.manager && decoded.role === 'MANAGER') {
      const lock = await prisma.managerPortalLock.findUnique({ where: { propertyId: user.manager.propertyId } });
      const now = new Date();
      const holdsLock = lock
        && lock.activeManagerId === user.manager.id
        && lock.sessionToken === decoded.managerSessionToken
        && lock.expiresAt && lock.expiresAt > now;

      if (!holdsLock) {
        return next(new AppError('Your Manager Portal session has ended. Please log in again.', 401));
      }

      await prisma.managerPortalLock.update({
        where: { propertyId: user.manager.propertyId },
        data: { lastActivityAt: now, expiresAt: new Date(now.getTime() + MANAGER_SESSION_IDLE_MS) },
      });
    }

    req.user = {
      ...decoded,
      propertyId,
      residentId,
      managerId: user.manager?.id,
      managerPermissions: user.manager ? (user.manager.permissions as string[]) : undefined,
    };

    next();
  } catch (error) {
    return next(new AppError('Invalid or expired token', 401));
  }
};
