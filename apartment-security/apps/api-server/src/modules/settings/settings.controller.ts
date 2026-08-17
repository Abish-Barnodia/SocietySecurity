import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { sendSuccess } from '../../utils/response.util';
import { AppError } from '../../middlewares/error.middleware';

// ponytail: Fetch all settings as a dictionary for the property
export const getSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    let propertyId = user.propertyId;
    
    // We will just fetch the manager's property
    if (!propertyId && user.role === 'MANAGER') {
       const manager = await prisma.manager.findUnique({ where: { userId: user.id } });
       if (manager) propertyId = manager.propertyId;
    }

    if (!propertyId) {
      return next(new AppError('Property context missing for this user', 400));
    }

    const settings = await prisma.propertySetting.findMany({
      where: { propertyId }
    });

    const settingsDict: Record<string, any> = {};
    settings.forEach(s => {
      settingsDict[s.key] = s.value;
    });

    return sendSuccess(res, 200, 'Settings retrieved', settingsDict);
  } catch (err) {
    next(err);
  }
};

// Real counts from the DB per fixed role — this app's RBAC is a 4-value enum
// (RESIDENT/GUARD/MANAGER/COMMITTEE) checked by requireRole(), not a
// configurable permissions system, so this is read-only reporting rather
// than an editor. CommitteeMember has no propertyId in the schema today, so
// its count is global rather than property-scoped (matches the same gap
// documented for getCallerPropertyId).
export const getRoleSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    let propertyId = user.propertyId;
    if (!propertyId && user.role === 'MANAGER') {
      const manager = await prisma.manager.findUnique({ where: { userId: user.id } });
      if (manager) propertyId = manager.propertyId;
    }
    if (!propertyId) {
      return next(new AppError('Property context missing for this user', 400));
    }

    const [residentCount, guardCount, managerCount, committeeCount] = await Promise.all([
      prisma.resident.count({ where: { unit: { propertyId } } }),
      prisma.guard.count({ where: { propertyId } }),
      prisma.manager.count({ where: { propertyId } }),
      prisma.committeeMember.count(),
    ]);

    const roles = [
      {
        id: 'MANAGER',
        title: 'Facility Manager',
        count: managerCount,
        desc: 'Full operational control — guards, residents, maintenance billing, incidents, and reports, plus manager-only actions like generating monthly reports and removing a resident.',
      },
      {
        id: 'COMMITTEE',
        title: 'Committee Member',
        count: committeeCount,
        desc: 'Same day-to-day access as a manager for guards, residents, incidents, and reports — without a few manager-only actions.',
      },
      {
        id: 'GUARD',
        title: 'Guard',
        count: guardCount,
        desc: 'Gate operations — visitor entries and exits, shift and post check-ins, incident logging, and walk-in approvals.',
      },
      {
        id: 'RESIDENT',
        title: 'Resident',
        count: residentCount,
        desc: 'Self-service access — their own passes, complaints, maintenance payments, community chat, amenity bookings, and event RSVPs.',
      },
    ];

    return sendSuccess(res, 200, 'Role summary retrieved', roles);
  } catch (err) {
    next(err);
  }
};

// ponytail: Upsert setting values from an object map
export const updateSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    let propertyId = user.propertyId;
    
    if (!propertyId && user.role === 'MANAGER') {
       const manager = await prisma.manager.findUnique({ where: { userId: user.id } });
       if (manager) propertyId = manager.propertyId;
    }

    if (!propertyId) {
      return next(new AppError('Property context missing for this user', 400));
    }

    const updates = req.body; // e.g. { "roles": [...], "hardware_cctv": true }
    
    for (const [key, value] of Object.entries(updates)) {
      await prisma.propertySetting.upsert({
        where: {
          propertyId_key: { propertyId, key }
        },
        update: { value: value as any },
        create: { propertyId, key, value: value as any }
      });
    }

    return sendSuccess(res, 200, 'Settings updated successfully');
  } catch (err) {
    next(err);
  }
};
