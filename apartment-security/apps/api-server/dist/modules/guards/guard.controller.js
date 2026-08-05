"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGuardProfile = exports.assignGuardToPost = exports.createGuard = exports.checkInPost = exports.endShift = exports.getRoster = exports.getShiftSummary = exports.startShift = exports.getActiveGuards = exports.getDirectory = exports.getMyProfile = void 0;
const prisma_1 = require("../../config/prisma");
const response_util_1 = require("../../utils/response.util");
const error_middleware_1 = require("../../middlewares/error.middleware");
const audit_util_1 = require("../../utils/audit.util");
const getMyProfile = async (req, res, next) => {
    try {
        const guard = await prisma_1.prisma.guard.findUnique({
            where: { userId: req.user.userId },
            include: {
                user: { select: { phone: true, email: true } },
                property: { select: { name: true } },
            },
        });
        if (!guard)
            return next(new error_middleware_1.AppError('Guard profile not found', 404));
        const activeShift = guard.isOnDuty
            ? await prisma_1.prisma.shift.findFirst({ where: { guardId: guard.id, endedAt: null }, orderBy: { startedAt: 'desc' } })
            : null;
        const currentPost = activeShift
            ? await prisma_1.prisma.guardPost.findFirst({
                where: { shiftId: activeShift.id },
                orderBy: { checkedInAt: 'desc' },
                include: { entryPoint: { select: { name: true } } },
            })
            : null;
        return (0, response_util_1.sendSuccess)(res, 200, 'Guard profile', {
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
    }
    catch (err) {
        next(err);
    }
};
exports.getMyProfile = getMyProfile;
const getDirectory = async (req, res, next) => {
    try {
        const guards = await prisma_1.prisma.guard.findMany({
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
        return (0, response_util_1.sendSuccess)(res, 200, 'Guard directory', formatted);
    }
    catch (err) {
        next(err);
    }
};
exports.getDirectory = getDirectory;
const getActiveGuards = async (req, res, next) => {
    try {
        const guards = await prisma_1.prisma.guard.findMany({
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
        return (0, response_util_1.sendSuccess)(res, 200, 'Active guards', formatted);
    }
    catch (err) {
        next(err);
    }
};
exports.getActiveGuards = getActiveGuards;
const startShift = async (req, res, next) => {
    try {
        const { entryPointId, latitude, longitude } = req.body;
        const guard = await prisma_1.prisma.guard.findUnique({ where: { userId: req.user.userId } });
        if (!guard)
            return next(new error_middleware_1.AppError('Guard profile not found', 404));
        // Check if already on duty
        if (guard.isOnDuty)
            return next(new error_middleware_1.AppError('You are already on an active shift', 400));
        // Verify entry point
        const entryPoint = await prisma_1.prisma.entryPoint.findUnique({ where: { id: entryPointId } });
        if (!entryPoint || entryPoint.propertyId !== guard.propertyId) {
            return next(new error_middleware_1.AppError('Invalid entry point', 400));
        }
        const shift = await prisma_1.prisma.$transaction(async (tx) => {
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
        await (0, audit_util_1.auditLog)(req.user.userId, 'START_SHIFT', 'Shift', shift.id);
        return (0, response_util_1.sendSuccess)(res, 201, 'Shift started successfully', shift);
    }
    catch (err) {
        next(err);
    }
};
exports.startShift = startShift;
// Shared by getShiftSummary and endShift — both need the same breakdown of
// what happened during the shift, just at different points in its life.
const buildShiftStats = async (guardId, since) => {
    const [entriesByMethod, totalIncidents] = await Promise.all([
        prisma_1.prisma.entry.groupBy({
            by: ['method'],
            where: { guardId, entryAt: { gte: since } },
            _count: true,
        }),
        prisma_1.prisma.incident.count({ where: { guardId, createdAt: { gte: since } } }),
    ]);
    const entryBreakdown = entriesByMethod.map((e) => ({ method: e.method, count: e._count }));
    const totalEntries = entryBreakdown.reduce((sum, e) => sum + e.count, 0);
    return { totalEntries, totalIncidents, entryBreakdown };
};
const getShiftSummary = async (req, res, next) => {
    try {
        const guard = await prisma_1.prisma.guard.findUnique({ where: { userId: req.user.userId } });
        if (!guard)
            return next(new error_middleware_1.AppError('Guard profile not found', 404));
        const activeShift = await prisma_1.prisma.shift.findFirst({
            where: { guardId: guard.id, endedAt: null },
            orderBy: { startedAt: 'desc' },
        });
        if (!activeShift)
            return next(new error_middleware_1.AppError('You are not on an active shift', 400));
        const stats = await buildShiftStats(guard.id, activeShift.startedAt);
        return (0, response_util_1.sendSuccess)(res, 200, 'Shift summary', { startedAt: activeShift.startedAt, ...stats });
    }
    catch (err) {
        next(err);
    }
};
exports.getShiftSummary = getShiftSummary;
const getRoster = async (req, res, next) => {
    try {
        const guard = await prisma_1.prisma.guard.findUnique({ where: { userId: req.user.userId } });
        if (!guard)
            return next(new error_middleware_1.AppError('Guard profile not found', 404));
        const guards = await prisma_1.prisma.guard.findMany({
            where: { propertyId: guard.propertyId, id: { not: guard.id } },
            select: { id: true, name: true, badgeNumber: true, isOnDuty: true },
            orderBy: { name: 'asc' },
        });
        return (0, response_util_1.sendSuccess)(res, 200, 'Guard roster', guards);
    }
    catch (err) {
        next(err);
    }
};
exports.getRoster = getRoster;
const endShift = async (req, res, next) => {
    try {
        const { handoverNote, handedOverToId } = req.body;
        const guard = await prisma_1.prisma.guard.findUnique({ where: { userId: req.user.userId } });
        if (!guard)
            return next(new error_middleware_1.AppError('Guard profile not found', 404));
        if (!guard.isOnDuty)
            return next(new error_middleware_1.AppError('You are not on an active shift', 400));
        const handoverTarget = await prisma_1.prisma.guard.findUnique({ where: { id: handedOverToId } });
        if (!handoverTarget || handoverTarget.propertyId !== guard.propertyId) {
            return next(new error_middleware_1.AppError('Selected guard not found in your property', 400));
        }
        if (handoverTarget.id === guard.id) {
            return next(new error_middleware_1.AppError('Cannot hand over a shift to yourself', 400));
        }
        // Find active shift
        const activeShift = await prisma_1.prisma.shift.findFirst({
            where: { guardId: guard.id, endedAt: null },
            orderBy: { startedAt: 'desc' }
        });
        if (!activeShift)
            return next(new error_middleware_1.AppError('Active shift record not found', 404));
        const { totalEntries, totalIncidents } = await buildShiftStats(guard.id, activeShift.startedAt);
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.shift.update({
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
            prisma_1.prisma.guard.update({
                where: { id: guard.id },
                data: { isOnDuty: false }
            })
        ]);
        await (0, audit_util_1.auditLog)(req.user.userId, 'END_SHIFT', 'Shift', activeShift.id);
        return (0, response_util_1.sendSuccess)(res, 200, 'Shift ended successfully');
    }
    catch (err) {
        next(err);
    }
};
exports.endShift = endShift;
const checkInPost = async (req, res, next) => {
    try {
        const { entryPointId, latitude, longitude } = req.body;
        const guard = await prisma_1.prisma.guard.findUnique({ where: { userId: req.user.userId } });
        if (!guard || !guard.isOnDuty)
            return next(new error_middleware_1.AppError('Not on an active shift', 400));
        const activeShift = await prisma_1.prisma.shift.findFirst({
            where: { guardId: guard.id, endedAt: null }
        });
        if (!activeShift)
            return next(new error_middleware_1.AppError('Active shift not found', 404));
        const post = await prisma_1.prisma.guardPost.create({
            data: {
                guardId: guard.id,
                shiftId: activeShift.id,
                entryPointId,
                latitude,
                longitude
            }
        });
        await (0, audit_util_1.auditLog)(req.user.userId, 'POST_CHECK_IN', 'GuardPost', post.id);
        return (0, response_util_1.sendSuccess)(res, 201, 'Checked into post', post);
    }
    catch (err) {
        next(err);
    }
};
exports.checkInPost = checkInPost;
const createGuard = async (req, res, next) => {
    try {
        const { name, phone, badgeNumber, status, shift, post, dateOfJoining, photoUrl } = req.body;
        // We assume the admin creating the guard belongs to a property
        const manager = await prisma_1.prisma.manager.findUnique({ where: { userId: req.user.userId } });
        const propertyId = manager ? manager.propertyId : (await prisma_1.prisma.property.findFirst())?.id;
        if (!propertyId)
            return next(new error_middleware_1.AppError('No property found to associate guard', 400));
        // Check if badge is already in use
        const existingBadge = await prisma_1.prisma.guard.findUnique({ where: { badgeNumber } });
        if (existingBadge)
            return next(new error_middleware_1.AppError('Badge number already in use', 400));
        // Upsert User
        let user = await prisma_1.prisma.user.findUnique({ where: { phone } });
        if (!user) {
            user = await prisma_1.prisma.user.create({
                data: {
                    phone,
                    role: 'GUARD',
                    passwordHash: '123456', // default password
                    isActive: true
                }
            });
        }
        // Check if guard already exists for this user
        const existingGuard = await prisma_1.prisma.guard.findUnique({ where: { userId: user.id } });
        if (existingGuard)
            return next(new error_middleware_1.AppError('A guard with this phone number already exists', 400));
        // Create Guard
        const guard = await prisma_1.prisma.guard.create({
            data: {
                userId: user.id,
                propertyId,
                name,
                badgeNumber,
                isOnDuty: status === 'On Post'
            }
        });
        await (0, audit_util_1.auditLog)(req.user.userId, 'CREATE_GUARD', 'Guard', guard.id);
        return (0, response_util_1.sendSuccess)(res, 201, 'Guard created successfully', guard);
    }
    catch (err) {
        next(err);
    }
};
exports.createGuard = createGuard;
const assignGuardToPost = async (req, res, next) => {
    try {
        const id = req.params.id;
        const { entryPointId } = req.body;
        const guard = await prisma_1.prisma.guard.findUnique({ where: { id } });
        if (!guard)
            return next(new error_middleware_1.AppError('Guard not found', 404));
        const entryPoint = await prisma_1.prisma.entryPoint.findUnique({ where: { id: entryPointId } });
        if (!entryPoint || entryPoint.propertyId !== guard.propertyId) {
            return next(new error_middleware_1.AppError('Invalid entry point', 400));
        }
        // End current shift if on duty
        if (guard.isOnDuty) {
            const activeShift = await prisma_1.prisma.shift.findFirst({
                where: { guardId: guard.id, endedAt: null },
                orderBy: { startedAt: 'desc' }
            });
            if (activeShift) {
                await prisma_1.prisma.shift.update({
                    where: { id: activeShift.id },
                    data: { endedAt: new Date(), signedOffAt: new Date() }
                });
            }
        }
        const shift = await prisma_1.prisma.$transaction(async (tx) => {
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
        await (0, audit_util_1.auditLog)(req.user.userId, 'ASSIGN_GUARD_TO_POST', 'Guard', guard.id);
        return (0, response_util_1.sendSuccess)(res, 200, 'Guard assigned to post successfully', shift);
    }
    catch (err) {
        next(err);
    }
};
exports.assignGuardToPost = assignGuardToPost;
const getGuardProfile = async (req, res, next) => {
    try {
        const id = req.params.id;
        const guard = await prisma_1.prisma.guard.findUnique({
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
        if (!guard)
            return next(new error_middleware_1.AppError('Guard not found', 404));
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
        return (0, response_util_1.sendSuccess)(res, 200, 'Guard profile', profileData);
    }
    catch (err) {
        next(err);
    }
};
exports.getGuardProfile = getGuardProfile;
//# sourceMappingURL=guard.controller.js.map