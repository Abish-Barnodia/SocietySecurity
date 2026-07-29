import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.util';
import { AppError } from './error.middleware';
import { prisma } from '../config/prisma';

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
    else if (user.committee) propertyId = user.committee.propertyId;
    
    // Also include residentId if resident
    let residentId: string | undefined;
    if (user.resident) residentId = user.resident.id;
    
    req.user = {
      ...decoded,
      propertyId,
      residentId,
    };
    
    next();
  } catch (error) {
    return next(new AppError('Invalid or expired token', 401));
  }
};
