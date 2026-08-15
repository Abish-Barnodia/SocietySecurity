import { Request, Response, NextFunction } from 'express';
import { AppError } from './error.middleware';

// Gates a route by manager permission module (e.g. 'guards', 'maintenance').
// Only applies to MANAGER — other roles sharing the same route (COMMITTEE,
// GUARD, RESIDENT) are unaffected, since granular permissions are a
// manager-account concept, not a general RBAC replacement. An empty
// permissions array means "full access" (the default for every manager
// created before this feature existed, and for unrestricted managers).
export const requireManagerPermission = (moduleId: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.role !== 'MANAGER') return next();

    const permissions = req.user.managerPermissions ?? [];
    if (permissions.length === 0 || permissions.includes(moduleId)) return next();

    return next(new AppError(`You don't have access to ${moduleId}. Ask a manager with full access to grant it.`, 403));
  };
};
