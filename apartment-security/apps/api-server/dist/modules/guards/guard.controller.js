"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkInPost = exports.endShift = exports.startShift = void 0;
const prisma_1 = require("../../config/prisma");
const response_util_1 = require("../../utils/response.util");
const error_middleware_1 = require("../../middlewares/error.middleware");
const audit_util_1 = require("../../utils/audit.util");
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
const endShift = async (req, res, next) => {
    try {
        const { handoverNote } = req.body;
        const guard = await prisma_1.prisma.guard.findUnique({ where: { userId: req.user.userId } });
        if (!guard)
            return next(new error_middleware_1.AppError('Guard profile not found', 404));
        if (!guard.isOnDuty)
            return next(new error_middleware_1.AppError('You are not on an active shift', 400));
        // Find active shift
        const activeShift = await prisma_1.prisma.shift.findFirst({
            where: { guardId: guard.id, endedAt: null },
            orderBy: { startedAt: 'desc' }
        });
        if (!activeShift)
            return next(new error_middleware_1.AppError('Active shift record not found', 404));
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.shift.update({
                where: { id: activeShift.id },
                data: { endedAt: new Date(), signedOffAt: new Date(), handoverNote }
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
//# sourceMappingURL=guard.controller.js.map