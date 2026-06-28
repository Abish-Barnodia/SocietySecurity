"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.respondWalkin = exports.requestWalkin = void 0;
const prisma_1 = require("../../config/prisma");
const response_util_1 = require("../../utils/response.util");
const error_middleware_1 = require("../../middlewares/error.middleware");
const audit_util_1 = require("../../utils/audit.util");
const server_1 = require("../../server"); // Socket.io instance
const requestWalkin = async (req, res, next) => {
    try {
        const { unitId, entryPointId, visitorName, visitorPhone, purpose, gatePhotoUrl } = req.body;
        const guard = await prisma_1.prisma.guard.findUnique({ where: { userId: req.user.userId } });
        if (!guard || !guard.isOnDuty)
            return next(new error_middleware_1.AppError('Guard must be on an active shift', 400));
        // Create a pending entry
        const entry = await prisma_1.prisma.entry.create({
            data: {
                unitId,
                guardId: guard.id,
                entryPointId,
                method: 'MANUAL_GUARD',
                status: 'PENDING_APPROVAL',
                visitorName,
                visitorPhone,
                notes: purpose,
                gatePhotoUrl
            }
        });
        await (0, audit_util_1.auditLog)(req.user.userId, 'REQUEST_WALKIN', 'Entry', entry.id);
        // Broadcast to unit room via Socket.io
        server_1.io?.to(`unit_${unitId}`).emit('walkin_request', {
            entryId: entry.id,
            visitorName,
            purpose,
            gatePhotoUrl
        });
        // TODO: Send Push Notification to all residents in unit
        return (0, response_util_1.sendSuccess)(res, 201, 'Walk-in request sent to residents', entry);
    }
    catch (err) {
        next(err);
    }
};
exports.requestWalkin = requestWalkin;
const respondWalkin = async (req, res, next) => {
    try {
        const id = req.params.id;
        const { status, notes } = req.body;
        const currentResident = await prisma_1.prisma.resident.findUnique({
            where: { userId: req.user.userId }
        });
        if (!currentResident)
            return next(new error_middleware_1.AppError('Resident context not found', 404));
        const entry = await prisma_1.prisma.entry.findUnique({ where: { id } });
        if (!entry)
            return next(new error_middleware_1.AppError('Entry not found', 404));
        if (entry.unitId !== currentResident.unitId) {
            return next(new error_middleware_1.AppError('Unauthorized to respond to this request', 403));
        }
        if (entry.status !== 'PENDING_APPROVAL') {
            return next(new error_middleware_1.AppError(`Request already ${entry.status.toLowerCase()}`, 400));
        }
        const updatedEntry = await prisma_1.prisma.entry.update({
            where: { id },
            data: {
                status, // 'APPROVED' or 'DENIED'
                notes: notes ? `${entry.notes || ''} | Res: ${notes}` : entry.notes
            }
        });
        await (0, audit_util_1.auditLog)(req.user.userId, 'RESPOND_WALKIN', 'Entry', id);
        // Notify Guard App
        server_1.io?.to(`guard_${entry.guardId}`).emit('walkin_response', {
            entryId: entry.id,
            status
        });
        return (0, response_util_1.sendSuccess)(res, 200, `Walk-in ${status.toLowerCase()}`, updatedEntry);
    }
    catch (err) {
        next(err);
    }
};
exports.respondWalkin = respondWalkin;
//# sourceMappingURL=walkin.controller.js.map