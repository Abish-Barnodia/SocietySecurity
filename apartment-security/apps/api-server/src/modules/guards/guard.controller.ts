import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../config/prisma';
import { razorpay } from '../../config/razorpay';
import { env } from '../../config/env';
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
    const dateQuery = req.query.date as string;
    const startOfDay = dateQuery ? new Date(dateQuery) : new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setHours(23, 59, 59, 999);

    const guards = await prisma.guard.findMany({
      where: { propertyId: req.user!.propertyId },
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
        },
        _count: {
          select: {
            entries: {
              where: {
                entryAt: {
                  gte: startOfDay,
                  lte: endOfDay
                }
              }
            }
          }
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
      lastPost: g.postCheckIns[0] || null,
      entriesCount: g._count?.entries || 0
    }));

    return sendSuccess(res, 200, 'Guard directory', formatted);
  } catch (err) { next(err); }
};

export const getActiveGuards = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const guards = await prisma.guard.findMany({
      where: { isOnDuty: true, propertyId: req.user!.propertyId },
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
    const guardId = req.user!.guardId;
    if (!guardId) return next(new AppError('Guard profile not found', 404));

    const activeShift = await prisma.shift.findFirst({
      where: { guardId, endedAt: null },
      orderBy: { startedAt: 'desc' },
    });
    if (!activeShift) return next(new AppError('You are not on an active shift', 400));

    const stats = await buildShiftStats(guardId, activeShift.startedAt);
    return sendSuccess(res, 200, 'Shift summary', { startedAt: activeShift.startedAt, ...stats });
  } catch (err) { next(err); }
};

export const getRoster = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const guardId = req.user!.guardId;
    const propertyId = req.user!.propertyId;
    if (!guardId || !propertyId) return next(new AppError('Guard profile not found', 404));

    const guards = await prisma.guard.findMany({
      where: { propertyId, id: { not: guardId } },
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
    const { name, phone, email, password, badgeNumber, status, shift, post, dateOfJoining, photoUrl } = req.body;

    // We assume the admin creating the guard belongs to a property
    const manager = await prisma.manager.findUnique({ where: { userId: req.user!.userId } });
    const propertyId = manager ? manager.propertyId : (await prisma.property.findFirst())?.id;

    if (!propertyId) return next(new AppError('No property found to associate guard', 400));

    // Check if badge is already in use
    const existingBadge = await prisma.guard.findUnique({ where: { badgeNumber } });
    if (existingBadge) return next(new AppError('Badge number already in use', 400));

    const existingUser = await prisma.user.findFirst({ where: { OR: [{ email }, { phone }] } });
    if (existingUser) return next(new AppError('An account with this email or phone already exists', 400));

    // Create the login credential the guard uses in the guard app
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        phone,
        email,
        role: 'GUARD',
        passwordHash,
        isActive: true
      }
    });

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

// ── Leave Management ─────────────────────────────────────────────────────────

export const createLeave = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { guardId, startDate, endDate, reason } = req.body;

    if (!guardId || !startDate || !endDate || !reason) {
      return next(new AppError('guardId, startDate, endDate, and reason are required', 400));
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return next(new AppError('Invalid date format', 400));
    }
    if (start > end) {
      return next(new AppError('startDate cannot be after endDate', 400));
    }

    const guard = await prisma.guard.findUnique({ where: { id: guardId } });
    if (!guard) return next(new AppError('Guard not found', 404));

    // Conflict check: no overlapping APPROVED leaves
    const conflict = await prisma.guardLeave.findFirst({
      where: {
        guardId,
        status: 'APPROVED',
        startDate: { lte: end },
        endDate: { gte: start },
      },
    });
    if (conflict) return next(new AppError('Guard already has an approved leave overlapping these dates', 409));

    const leave = await prisma.guardLeave.create({
      data: { guardId, startDate: start, endDate: end, reason, createdById: req.user!.userId },
    });

    await auditLog(req.user!.userId, 'CREATE_GUARD_LEAVE', 'GuardLeave', leave.id);
    return sendSuccess(res, 201, 'Leave assigned successfully', leave);
  } catch (err) { next(err); }
};

export const getLeaves = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const guardId = typeof req.query.guardId === 'string' ? req.query.guardId : undefined;
    const where = guardId ? { guardId } : {};

    const leaves = await prisma.guardLeave.findMany({
      where,
      include: { guard: { select: { name: true, badgeNumber: true } } },
      orderBy: { startDate: 'desc' },
    });

    return sendSuccess(res, 200, 'Guard leaves', leaves);
  } catch (err) { next(err); }
};

export const cancelLeave = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const leave = await prisma.guardLeave.findUnique({ where: { id } });
    if (!leave) return next(new AppError('Leave record not found', 404));
    if (leave.status === 'CANCELLED') return next(new AppError('Leave is already cancelled', 400));

    const updated = await prisma.guardLeave.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    await auditLog(req.user!.userId, 'CANCEL_GUARD_LEAVE', 'GuardLeave', id);
    return sendSuccess(res, 200, 'Leave cancelled', updated);
  } catch (err) { next(err); }
};

// ── Salary Management ────────────────────────────────────────────────────────

const BASE_SALARY = 15000; // ₹ per month
const LEAVE_DEDUCTION_PER_DAY = 500; // ₹ per approved leave day

// Calculates overlap days between a leave and the given month
const overlapDays = (leaveStart: Date, leaveEnd: Date, monthStart: Date, monthEnd: Date): number => {
  const start = leaveStart < monthStart ? monthStart : leaveStart;
  const end = leaveEnd > monthEnd ? monthEnd : leaveEnd;
  if (start > end) return 0;
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
};

export const getSalarySlip = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string; // guard id
    const month = typeof req.query.month === 'string' ? req.query.month : undefined; // e.g. "2026-08", defaults to current month

    const guard = await prisma.guard.findUnique({
      where: { id },
      select: { id: true, name: true, badgeNumber: true },
    });
    if (!guard) return next(new AppError('Guard not found', 404));

    const monthYear = month || new Date().toISOString().slice(0, 7);
    const [year, mon] = monthYear.split('-').map(Number);
    const monthStart = new Date(year, mon - 1, 1);
    const monthEnd = new Date(year, mon, 0, 23, 59, 59, 999); // last ms of month

    // Find any existing PAID record — don't recalculate if already paid
    const existing = await prisma.guardSalary.findUnique({ where: { guardId_monthYear: { guardId: id, monthYear } } });
    if (existing?.status === 'PAID') {
      return sendSuccess(res, 200, 'Salary slip', { ...existing, guard });
    }

    // Calculate leave deductions for this month
    const leaves = await prisma.guardLeave.findMany({
      where: { guardId: id, status: 'APPROVED', startDate: { lte: monthEnd }, endDate: { gte: monthStart } },
    });
    const leaveDays = leaves.reduce((sum, l) => sum + overlapDays(l.startDate, l.endDate, monthStart, monthEnd), 0);
    const deductions = Math.min(leaveDays * LEAVE_DEDUCTION_PER_DAY, BASE_SALARY);
    const netAmount = BASE_SALARY - deductions;

    // Upsert a PENDING record so we have a stable ID for payment
    const salary = await prisma.guardSalary.upsert({
      where: { guardId_monthYear: { guardId: id, monthYear } },
      update: { baseSalary: BASE_SALARY, deductions, netAmount },
      create: { guardId: id, monthYear, baseSalary: BASE_SALARY, deductions, netAmount },
    });

    return sendSuccess(res, 200, 'Salary slip', {
      ...salary,
      guard,
      leaveDays,
      deductionPerDay: LEAVE_DEDUCTION_PER_DAY,
    });
  } catch (err) { next(err); }
};

export const createSalaryOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!razorpay) return next(new AppError('Payment gateway not configured', 500));

    const id = req.params.id as string; // guardSalary id
    const salary = await prisma.guardSalary.findUnique({ where: { id }, include: { guard: { select: { name: true } } } });
    if (!salary) return next(new AppError('Salary record not found', 404));
    if (salary.status === 'PAID') return next(new AppError('Salary already paid', 400));

    // ponytail: use UI-edited amount if provided, else fall back to stored netAmount
    const finalAmount = (req.body?.overrideAmount && Number(req.body.overrideAmount) > 0)
      ? Number(req.body.overrideAmount)
      : salary.netAmount;

    const amountPaise = Math.round(finalAmount * 100);
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: salary.id,
      notes: { guardSalaryId: salary.id, guard: (salary as any).guard?.name || 'Guard' },
    });

    await prisma.guardSalary.update({ where: { id }, data: { razorpayOrderId: order.id } });

    return sendSuccess(res, 201, 'Order created', {
      orderId: order.id,
      amount: amountPaise,
      currency: 'INR',
      keyId: env.RAZORPAY_KEY_ID,
      salaryId: salary.id,
    });
  } catch (err) { next(err); }
};

export const verifySalaryPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!env.RAZORPAY_KEY_SECRET) return next(new AppError('Payment gateway not configured', 500));

    const id = req.params.id as string; // guardSalary id
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return next(new AppError('Missing Razorpay payment fields', 400));
    }

    const salary = await prisma.guardSalary.findUnique({ where: { id } });
    if (!salary) return next(new AppError('Salary record not found', 404));
    if (salary.razorpayOrderId !== razorpay_order_id) return next(new AppError('Order ID mismatch', 400));
    if (salary.status === 'PAID') return sendSuccess(res, 200, 'Already paid', salary);

    const expectedSig = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSig !== razorpay_signature) {
      return next(new AppError('Payment signature verification failed', 400));
    }

    const updated = await prisma.guardSalary.update({
      where: { id },
      data: { status: 'PAID', transactionId: razorpay_payment_id, paidAt: new Date() },
    });

    await auditLog(req.user!.userId, 'PAY_GUARD_SALARY', 'GuardSalary', id);
    return sendSuccess(res, 200, 'Salary payment verified', updated);
  } catch (err) { next(err); }
};
