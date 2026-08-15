import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../config/prisma';
import { sendSuccess } from '../../utils/response.util';
import { AppError } from '../../middlewares/error.middleware';
import { auditLog } from '../../utils/audit.util';
import { releaseManagerPortalLock } from '../../utils/managerPortalLock.util';

// Finds a manager and confirms it belongs to the caller's own property —
// every action below is scoped this way so one property's managers can't
// touch another's accounts.
const findOwnPropertyManager = async (managerId: string, propertyId: string) => {
  const manager = await prisma.manager.findUnique({ where: { id: managerId }, include: { user: true } });
  if (!manager || manager.propertyId !== propertyId) return null;
  return manager;
};

export const listManagers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const propertyId = req.user!.propertyId!;
    const [managers, lock] = await Promise.all([
      prisma.manager.findMany({
        where: { propertyId },
        include: { user: { select: { email: true, isActive: true, lastLoginAt: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.managerPortalLock.findUnique({ where: { propertyId } }),
    ]);

    const now = new Date();
    const activeManagerId = lock && lock.expiresAt && lock.expiresAt > now ? lock.activeManagerId : null;

    const data = managers.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.user.email,
      isActive: m.user.isActive,
      permissions: m.permissions as string[],
      lastLoginAt: m.user.lastLoginAt,
      createdAt: m.createdAt,
      isCurrentlyActive: m.id === activeManagerId,
      sessionLoginAt: m.id === activeManagerId ? lock!.loginAt : null,
      sessionLastActivityAt: m.id === activeManagerId ? lock!.lastActivityAt : null,
      sessionExpiresAt: m.id === activeManagerId ? lock!.expiresAt : null,
    }));

    return sendSuccess(res, 200, 'Managers retrieved', data);
  } catch (err) { next(err); }
};

export const createManager = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const propertyId = req.user!.propertyId!;
    const { name, email, password, permissions } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return next(new AppError('Email already in use', 400));

    const passwordHash = await bcrypt.hash(password, 10);
    const manager = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email, passwordHash, role: 'MANAGER' } });
      return tx.manager.create({ data: { userId: user.id, propertyId, name, permissions } });
    });

    await auditLog(req.user!.userId, 'CREATE_MANAGER', 'Manager', manager.id, undefined, { name, email, permissions });
    return sendSuccess(res, 201, 'Manager account created', { id: manager.id, name: manager.name, email, permissions: manager.permissions });
  } catch (err) { next(err); }
};

export const updateManager = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const propertyId = req.user!.propertyId!;
    const manager = await findOwnPropertyManager(req.params.id as string, propertyId);
    if (!manager) return next(new AppError('Manager not found', 404));

    const { name, permissions } = req.body;
    const updated = await prisma.manager.update({
      where: { id: manager.id },
      data: { ...(name !== undefined ? { name } : {}), ...(permissions !== undefined ? { permissions } : {}) },
    });

    await auditLog(req.user!.userId, 'UPDATE_MANAGER', 'Manager', manager.id, { name: manager.name, permissions: manager.permissions }, { name, permissions });
    return sendSuccess(res, 200, 'Manager updated', { id: updated.id, name: updated.name, permissions: updated.permissions });
  } catch (err) { next(err); }
};

export const resetManagerPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const propertyId = req.user!.propertyId!;
    const manager = await findOwnPropertyManager(req.params.id as string, propertyId);
    if (!manager) return next(new AppError('Manager not found', 404));

    const passwordHash = await bcrypt.hash(req.body.password, 10);
    await prisma.user.update({ where: { id: manager.userId }, data: { passwordHash } });
    // A password reset should end any session signed in under the old credentials.
    await prisma.refreshToken.updateMany({ where: { userId: manager.userId, revokedAt: null }, data: { revokedAt: new Date() } });

    await auditLog(req.user!.userId, 'RESET_MANAGER_PASSWORD', 'Manager', manager.id);
    return sendSuccess(res, 200, 'Password reset');
  } catch (err) { next(err); }
};

const setManagerActive = (isActive: boolean, action: string) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const propertyId = req.user!.propertyId!;
      const manager = await findOwnPropertyManager(req.params.id as string, propertyId);
      if (!manager) return next(new AppError('Manager not found', 404));
      if (manager.userId === req.user!.userId) return next(new AppError("You can't change your own account status", 400));

      await prisma.user.update({ where: { id: manager.userId }, data: { isActive } });

      if (!isActive) {
        // Free the portal slot immediately rather than making others wait
        // out the idle timeout, and cut off any session already in flight.
        await releaseManagerPortalLock(propertyId, manager.id);
        await prisma.refreshToken.updateMany({ where: { userId: manager.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      }

      await auditLog(req.user!.userId, action, 'Manager', manager.id);
      return sendSuccess(res, 200, isActive ? 'Manager activated' : 'Manager deactivated');
    } catch (err) { next(err); }
  };

export const activateManager = setManagerActive(true, 'ACTIVATE_MANAGER');
export const deactivateManager = setManagerActive(false, 'DEACTIVATE_MANAGER');

export const forceLogoutActiveManager = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const propertyId = req.user!.propertyId!;
    const lock = await prisma.managerPortalLock.findUnique({ where: { propertyId } });
    if (!lock || !lock.activeManagerId) return next(new AppError('No active manager session to release', 400));

    const releasedManagerId = lock.activeManagerId;
    await prisma.managerPortalLock.update({
      where: { propertyId },
      data: { activeManagerId: null, sessionToken: null, loginAt: null, lastActivityAt: null, expiresAt: null },
    });

    await auditLog(req.user!.userId, 'FORCE_LOGOUT_MANAGER', 'ManagerPortalLock', propertyId, { activeManagerId: releasedManagerId });
    return sendSuccess(res, 200, 'Active manager session released');
  } catch (err) { next(err); }
};
