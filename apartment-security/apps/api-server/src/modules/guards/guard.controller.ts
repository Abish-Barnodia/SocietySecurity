import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { sendSuccess, sendError } from '../../utils/response.util';
import { AppError } from '../../middlewares/error.middleware';
import { auditLog } from '../../utils/audit.util';

export const getMyProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const guard = await prisma.guard.findUnique({
      where: { userId: req.user!.userId },
      include: {
        user: { select: { phone: true, email: true } },
        property: { select: { name: true } },
      },
    });
    if (!guard) return next(new AppError('Guard profile not found', 404));

    const activeShift = guard.isOnDuty
      ? await prisma.shift.findFirst({ where: { guardId: guard.id, endedAt: null }, orderBy: { startedAt: 'desc' } })
      : null;

    const currentPost = activeShift
      ? await prisma.guardPost.findFirst({
          where: { shiftId: activeShift.id },
          orderBy: { checkedInAt: 'desc' },
          include: { entryPoint: { select: { name: true } } },
        })
      : null;

    return sendSuccess(res, 200, 'Guard profile', {
      id: guard.id,
      name: guard.name,
      badgeNumber: guard.badgeNumber,
      phone: guard.user.phone,
      email: guard.user.email,
      isOnDuty: guard.isOnDuty,
      propertyName: guard.property.name,
      shiftStartedAt: activeShift?.startedAt ?? null,
      currentPostName: currentPost?.entryPoint.name ?? null,
    });
  } catch (err) { next(err); }
};

export const getDirectory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const guards = await prisma.guard.findMany({
      include: {
        user: { select: { phone: true } },
        shifts: {
          orderBy: { startedAt: 'desc' },
          take: 1
        },
        postCheckIns: {
          orderBy: { checkedInAt: 'desc' },
          take: 1,
          include: { entryPoint: true }
        }
      }
    });

    const formatted = guards.map(g => ({
      id: g.id,
      name: g.name,
      phone: g.user.phone,
      badgeNumber: g.badgeNumber,
      isOnDuty: g.isOnDuty,
      lastShift: g.shifts[0] || null,
      lastPost: g.postCheckIns[0] || null
    }));

    return sendSuccess(res, 200, 'Guard directory', formatted);
  } catch (err) { next(err); }
};

export const getActiveGuards = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const guards = await prisma.guard.findMany({
      where: { isOnDuty: true },
      include: {
        user: { select: { phone: true } },
        postCheckIns: {
          orderBy: { checkedInAt: 'desc' },
          take: 1,
          include: { entryPoint: true }
        }
      }
    });

    const formatted = guards.map(g => ({
      id: g.id,
      name: g.name,
      phone: g.user.phone,
      badgeNumber: g.badgeNumber,
      status: 'On Post', // default, could be computed based on time
      entryPoint: g.postCheckIns[0]?.entryPoint || null,
      checkedInAt: g.postCheckIns[0]?.checkedInAt || null
    }));

    return sendSuccess(res, 200, 'Active guards', formatted);
  } catch (err) { next(err); }
};

export const startShift = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entryPointId, latitude, longitude } = req.body;
    
    const guard = await prisma.guard.findUnique({ where: { userId: req.user!.userId } });
    if (!guard) return next(new AppError('Guard profile not found', 404));

    // Check if already on duty
    if (guard.isOnDuty) return next(new AppError('You are already on an active shift', 400));

    // Verify entry point
    const entryPoint = await prisma.entryPoint.findUnique({ where: { id: entryPointId } });
    if (!entryPoint || entryPoint.propertyId !== guard.propertyId) {
      return next(new AppError('Invalid entry point', 400));
    }

    const shift = await prisma.$transaction(async (tx) => {
      // 1. Create shift
      const newShift = await tx.shift.create({
        data: { guardId: guard.id }
      });

      // 2. Create post check-in
      await tx.guardPost.create({
        data: {
          guardId: guard.id,
          shiftId: newShift.id,
          entryPointId,
          latitude,
          longitude
        }
      });

      // 3. Mark guard as on duty
      await tx.guard.update({
        where: { id: guard.id },
        data: { isOnDuty: true }
      });

      return newShift;
    });

    await auditLog(req.user!.userId, 'START_SHIFT', 'Shift', shift.id);
    return sendSuccess(res, 201, 'Shift started successfully', shift);
  } catch (err) { next(err); }
};

// Shared by getShiftSummary and endShift — both need the same breakdown of
// what happened during the shift, just at different points in its life.
const buildShiftStats = async (guardId: string, since: Date) => {
  const [entriesByMethod, totalIncidents] = await Promise.all([
    prisma.entry.groupBy({
      by: ['method'],
      where: { guardId, entryAt: { gte: since } },
      _count: true,
    }),
    prisma.incident.count({ where: { guardId, createdAt: { gte: since } } }),
  ]);

  const entryBreakdown = entriesByMethod.map((e) => ({ method: e.method, count: e._count }));
  const totalEntries = entryBreakdown.reduce((sum, e) => sum + e.count, 0);

  return { totalEntries, totalIncidents, entryBreakdown };
};

export const getShiftSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const guard = await prisma.guard.findUnique({ where: { userId: req.user!.userId } });
    if (!guard) return next(new AppError('Guard profile not found', 404));

    const activeShift = await prisma.shift.findFirst({
      where: { guardId: guard.id, endedAt: null },
      orderBy: { startedAt: 'desc' },
    });
    if (!activeShift) return next(new AppError('You are not on an active shift', 400));

    const stats = await buildShiftStats(guard.id, activeShift.startedAt);
    return sendSuccess(res, 200, 'Shift summary', { startedAt: activeShift.startedAt, ...stats });
  } catch (err) { next(err); }
};

export const getRoster = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const guard = await prisma.guard.findUnique({ where: { userId: req.user!.userId } });
    if (!guard) return next(new AppError('Guard profile not found', 404));

    const guards = await prisma.guard.findMany({
      where: { propertyId: guard.propertyId, id: { not: guard.id } },
      select: { id: true, name: true, badgeNumber: true, isOnDuty: true },
      orderBy: { name: 'asc' },
    });
    return sendSuccess(res, 200, 'Guard roster', guards);
  } catch (err) { next(err); }
};

export const endShift = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { handoverNote, handedOverToId } = req.body;

    const guard = await prisma.guard.findUnique({ where: { userId: req.user!.userId } });
    if (!guard) return next(new AppError('Guard profile not found', 404));

    if (!guard.isOnDuty) return next(new AppError('You are not on an active shift', 400));

    const handoverTarget = await prisma.guard.findUnique({ where: { id: handedOverToId } });
    if (!handoverTarget || handoverTarget.propertyId !== guard.propertyId) {
      return next(new AppError('Selected guard not found in your property', 400));
    }
    if (handoverTarget.id === guard.id) {
      return next(new AppError('Cannot hand over a shift to yourself', 400));
    }

    // Find active shift
    const activeShift = await prisma.shift.findFirst({
      where: { guardId: guard.id, endedAt: null },
      orderBy: { startedAt: 'desc' }
    });

    if (!activeShift) return next(new AppError('Active shift record not found', 404));

    const { totalEntries, totalIncidents } = await buildShiftStats(guard.id, activeShift.startedAt);

    await prisma.$transaction([
      prisma.shift.update({
        where: { id: activeShift.id },
        data: {
          endedAt: new Date(),
          signedOffAt: new Date(),
          handoverNote,
          handedOverToId: handoverTarget.id,
          handedOverToName: handoverTarget.name,
          totalEntries,
          totalIncidents,
        }
      }),
      prisma.guard.update({
        where: { id: guard.id },
        data: { isOnDuty: false }
      })
    ]);

    await auditLog(req.user!.userId, 'END_SHIFT', 'Shift', activeShift.id);
    return sendSuccess(res, 200, 'Shift ended successfully');
  } catch (err) { next(err); }
};

export const checkInPost = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entryPointId, latitude, longitude } = req.body;
    
    const guard = await prisma.guard.findUnique({ where: { userId: req.user!.userId } });
    if (!guard || !guard.isOnDuty) return next(new AppError('Not on an active shift', 400));

    const activeShift = await prisma.shift.findFirst({
      where: { guardId: guard.id, endedAt: null }
    });
    if (!activeShift) return next(new AppError('Active shift not found', 404));

    const post = await prisma.guardPost.create({
      data: {
        guardId: guard.id,
        shiftId: activeShift.id,
        entryPointId,
        latitude,
        longitude
      }
    });

    await auditLog(req.user!.userId, 'POST_CHECK_IN', 'GuardPost', post.id);
    return sendSuccess(res, 201, 'Checked into post', post);
  } catch (err) { next(err); }
};

export const createGuard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, phone, badgeNumber, status, shift, post, dateOfJoining, photoUrl } = req.body;
    
    // We assume the admin creating the guard belongs to a property
    const manager = await prisma.manager.findUnique({ where: { userId: req.user!.userId } });
    const propertyId = manager ? manager.propertyId : (await prisma.property.findFirst())?.id;
    
    if (!propertyId) return next(new AppError('No property found to associate guard', 400));

    // Check if badge is already in use
    const existingBadge = await prisma.guard.findUnique({ where: { badgeNumber } });
    if (existingBadge) return next(new AppError('Badge number already in use', 400));

    // Upsert User
    let user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          phone,
          role: 'GUARD',
          passwordHash: '123456', // default password
          isActive: true
        }
      });
    }

    // Check if guard already exists for this user
    const existingGuard = await prisma.guard.findUnique({ where: { userId: user.id } });
    if (existingGuard) return next(new AppError('A guard with this phone number already exists', 400));

    // Create Guard
    const guard = await prisma.guard.create({
      data: {
        userId: user.id,
        propertyId,
        name,
        badgeNumber,
        isOnDuty: status === 'On Post'
      }
    });

    await auditLog(req.user!.userId, 'CREATE_GUARD', 'Guard', guard.id);
    return sendSuccess(res, 201, 'Guard created successfully', guard);
  } catch (err) { next(err); }
};

export const assignGuardToPost = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { entryPointId } = req.body;

    const guard = await prisma.guard.findUnique({ where: { id } });
    if (!guard) return next(new AppError('Guard not found', 404));

    const entryPoint = await prisma.entryPoint.findUnique({ where: { id: entryPointId } });
    if (!entryPoint || entryPoint.propertyId !== guard.propertyId) {
      return next(new AppError('Invalid entry point', 400));
    }

    // End current shift if on duty
    if (guard.isOnDuty) {
      const activeShift = await prisma.shift.findFirst({
        where: { guardId: guard.id, endedAt: null },
        orderBy: { startedAt: 'desc' }
      });
      if (activeShift) {
        await prisma.shift.update({
          where: { id: activeShift.id },
          data: { endedAt: new Date(), signedOffAt: new Date() }
        });
      }
    }

    const shift = await prisma.$transaction(async (tx) => {
      const newShift = await tx.shift.create({
        data: { guardId: guard.id }
      });

      await tx.guardPost.create({
        data: {
          guardId: guard.id,
          shiftId: newShift.id,
          entryPointId
        }
      });

      await tx.guard.update({
        where: { id: guard.id },
        data: { isOnDuty: true }
      });

      return newShift;
    });

    await auditLog(req.user!.userId, 'ASSIGN_GUARD_TO_POST', 'Guard', guard.id);
    return sendSuccess(res, 200, 'Guard assigned to post successfully', shift);
  } catch (err) { next(err); }
};

export const getGuardProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    
    const guard = await prisma.guard.findUnique({
      where: { id },
      include: {
        user: { select: { phone: true, email: true } },
        property: { select: { name: true } },
        shifts: {
          orderBy: { startedAt: 'desc' },
          take: 3
        },
        postCheckIns: {
          orderBy: { checkedInAt: 'desc' },
          take: 5,
          include: { entryPoint: true }
        },
        incidents: {
          orderBy: { createdAt: 'desc' },
          take: 5
        },
        entries: {
          orderBy: { entryAt: 'desc' },
          take: 5,
          include: { entryPoint: true }
        }
      }
    });

    if (!guard) return next(new AppError('Guard not found', 404));

    // Compute basic timeline from post check-ins and entries
    const timeline = [
      ...guard.postCheckIns.map(p => ({
        type: 'check_in',
        title: 'Post Check-in',
        description: `Regular check-in at ${p.entryPoint.name}`,
        timestamp: p.checkedInAt
      })),
      ...guard.entries.map(e => ({
        type: 'entry_scan',
        title: `Entry Scan — ${e.visitorName || 'Visitor'}`,
        description: `Processed at ${e.entryPoint.name}`,
        timestamp: e.entryAt
      })),
      ...guard.incidents.map(i => ({
        type: 'incident',
        title: `Incident: ${i.type}`,
        description: i.description,
        timestamp: i.createdAt
      }))
    ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const profileData = {
      id: guard.id,
      name: guard.name,
      badgeNumber: guard.badgeNumber,
      isOnDuty: guard.isOnDuty,
      phone: guard.user.phone,
      createdAt: guard.createdAt,
      lastPost: guard.postCheckIns[0] || null,
      lastShift: guard.shifts[0] || null,
      recentShifts: guard.shifts,
      timeline,
      stats: {
        monthlyScans: 1247, // could be computed dynamically
        compliance: 98,
        rating: 4.5,
        incidents: guard.incidents.length
      }
    };

    return sendSuccess(res, 200, 'Guard profile', profileData);
  } catch (err) { next(err); }
};
