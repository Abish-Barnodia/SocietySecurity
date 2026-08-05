"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPendingWalkins = exports.callResident = exports.respondWalkin = exports.getWalkin = exports.requestWalkin = void 0;
const prisma_1 = require("../../config/prisma");
const response_util_1 = require("../../utils/response.util");
const error_middleware_1 = require("../../middlewares/error.middleware");
const audit_util_1 = require("../../utils/audit.util");
const requestWalkin = async (req, res, next) => {
    try {
        const { unitId, entryPointId, visitorName, visitorPhone, purpose, gatePhotoUrl, gatePhotoBase64, vehicleNumber } = req.body;
        let finalPhotoUrl = gatePhotoUrl;
        if (gatePhotoBase64) {
            const { uploadBuffer } = await Promise.resolve().then(() => __importStar(require('../../utils/objectStorage.util')));
            const buffer = Buffer.from(gatePhotoBase64, 'base64');
            finalPhotoUrl = await uploadBuffer(buffer, `entries/${Date.now()}.jpg`, 'image/jpeg');
        }
        const guard = await prisma_1.prisma.guard.findUnique({ where: { userId: req.user.userId } });
        if (!guard || !guard.isOnDuty)
            return next(new error_middleware_1.AppError('Guard must be on an active shift', 400));
        // Validate the unit belongs to the guard's property
        const targetUnit = await prisma_1.prisma.unit.findUnique({
            where: { id: unitId },
            include: { residents: { include: { user: true } } },
        });
        if (!targetUnit || targetUnit.propertyId !== guard.propertyId) {
            return next(new error_middleware_1.AppError('Forbidden: Unit does not belong to your assigned property', 403));
        }
        // No resident to notify — creating the entry anyway would leave a
        // PENDING_APPROVAL request nobody can ever approve or deny.
        if (targetUnit.residents.length === 0) {
            return next(new error_middleware_1.AppError('This unit has no registered resident to approve the request', 400));
        }
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
                notes: vehicleNumber ? `${purpose || ''} (Vehicle: ${vehicleNumber})`.trim() : purpose,
                gatePhotoUrl: finalPhotoUrl
            }
        });
        await (0, audit_util_1.auditLog)(req.user.userId, 'REQUEST_WALKIN', 'Entry', entry.id);
        // Broadcast to unit room via Socket.io
        const io = req.app.get('io');
        io?.to(`unit_${unitId}`).emit('walkin_request', {
            entryId: entry.id,
            visitorName,
            purpose: vehicleNumber ? `${purpose || ''} (Vehicle: ${vehicleNumber})`.trim() : purpose,
            gatePhotoUrl: finalPhotoUrl
        });
        // Notify all residents in the unit via push using the shared alert utility
        await prisma_1.prisma.walkinApproval.create({
            data: {
                entryId: entry.id,
                residentId: targetUnit.residents[0].id, // Assign to the first resident (usually primary)
                visitorName,
                purpose: vehicleNumber ? `${purpose || ''} (Vehicle: ${vehicleNumber})`.trim() : (purpose || ''),
                timeoutAt: new Date(Date.now() + 2 * 60 * 1000) // 2 minutes timeout
            }
        });
        const { triggerAlert } = await Promise.resolve().then(() => __importStar(require('../../utils/alert.util')));
        await triggerAlert({
            priority: 'P2',
            title: 'Visitor at your gate',
            body: `${visitorName} is requesting entry. Please approve or deny.`,
            targetUserIds: targetUnit.residents.map((r) => r.userId),
            propertyId: targetUnit.propertyId,
            entryId: entry.id,
        });
        return (0, response_util_1.sendSuccess)(res, 201, 'Walk-in request sent to residents', entry);
    }
    catch (err) {
        next(err);
    }
};
exports.requestWalkin = requestWalkin;
const getWalkin = async (req, res, next) => {
    try {
        const id = req.params.id;
        const resident = await prisma_1.prisma.resident.findUnique({ where: { userId: req.user.userId } });
        if (!resident)
            return next(new error_middleware_1.AppError('Resident context not found', 404));
        const entry = await prisma_1.prisma.entry.findUnique({
            where: { id },
            include: {
                walkinApproval: true,
                unit: { select: { unitNumber: true, tower: true } },
                entryPoint: { select: { name: true } },
            }
        });
        if (!entry)
            return next(new error_middleware_1.AppError('Entry not found', 404));
        if (entry.unitId !== resident.unitId)
            return next(new error_middleware_1.AppError('Unauthorized', 403));
        return (0, response_util_1.sendSuccess)(res, 200, 'Entry fetched', entry);
    }
    catch (err) {
        next(err);
    }
};
exports.getWalkin = getWalkin;
const respondWalkin = async (req, res, next) => {
    try {
        const id = req.params.id;
        const { status, notes } = req.body;
        const currentResident = await prisma_1.prisma.resident.findUnique({
            where: { userId: req.user.userId }
        });
        if (!currentResident)
            return next(new error_middleware_1.AppError('Resident context not found', 404));
        const entry = await prisma_1.prisma.entry.findUnique({ where: { id }, include: { walkinApproval: true } });
        if (!entry)
            return next(new error_middleware_1.AppError('Entry not found', 404));
        if (entry.unitId !== currentResident.unitId) {
            return next(new error_middleware_1.AppError('Unauthorized to respond to this request', 403));
        }
        if (entry.status !== 'PENDING_APPROVAL') {
            return next(new error_middleware_1.AppError(`Request already ${entry.status.toLowerCase()}`, 400));
        }
        // A QR-scan approval ticket can still show Entry.status === 'PENDING_APPROVAL'
        // in the brief window between its deadline passing and the next timeout-job
        // tick — this closes that race, independent of the job's polling interval.
        if (entry.walkinApproval && (entry.walkinApproval.decision || entry.walkinApproval.timeoutAt < new Date())) {
            return next(new error_middleware_1.AppError('Request already resolved or timed out', 400));
        }
        const updatedEntry = await prisma_1.prisma.entry.update({
            where: { id },
            data: {
                status, // 'APPROVED' or 'DENIED'
                notes: notes ? `${entry.notes || ''} | Res: ${notes}` : entry.notes
            }
        });
        if (entry.walkinApproval) {
            await prisma_1.prisma.walkinApproval.update({
                where: { entryId: id },
                data: { decision: status, respondedAt: new Date() }
            });
            await prisma_1.prisma.passUsageHistory.updateMany({
                where: { entryId: id },
                data: { outcome: status === 'APPROVED' ? 'CLEARED' : 'DENIED' }
            });
        }
        await (0, audit_util_1.auditLog)(req.user.userId, 'RESPOND_WALKIN', 'Entry', id);
        // Notify Guard App — room is `guard:${id}` (colon), matching what
        // socket.handler.ts actually joins guards to on connect.
        const io = req.app.get('io');
        io?.to(`guard:${entry.guardId}`).emit(entry.walkinApproval ? 'visitor_approval_response' : 'walkin_response', { entryId: entry.id, status });
        return (0, response_util_1.sendSuccess)(res, 200, `Walk-in ${status.toLowerCase()}`, updatedEntry);
    }
    catch (err) {
        next(err);
    }
};
exports.respondWalkin = respondWalkin;
const callResident = async (req, res, next) => {
    try {
        const id = req.params.id;
        const guard = await prisma_1.prisma.guard.findUnique({ where: { userId: req.user.userId } });
        if (!guard)
            return next(new error_middleware_1.AppError('Guard profile not found', 404));
        const entry = await prisma_1.prisma.entry.findUnique({ where: { id }, include: { walkinApproval: true } });
        if (!entry)
            return next(new error_middleware_1.AppError('Entry not found', 404));
        if (entry.guardId !== guard.id)
            return next(new error_middleware_1.AppError('Unauthorized: not your entry', 403));
        if (!entry.walkinApproval || entry.walkinApproval.decision !== 'TIMEOUT') {
            return next(new error_middleware_1.AppError('Call Resident is only available after the approval window times out', 400));
        }
        const guardCalledAt = new Date();
        await prisma_1.prisma.walkinApproval.update({ where: { entryId: id }, data: { guardCalledAt } });
        await (0, audit_util_1.auditLog)(req.user.userId, 'CALL_RESIDENT', 'WalkinApproval', entry.walkinApproval.id);
        return (0, response_util_1.sendSuccess)(res, 200, 'Call recorded', { guardCalledAt });
    }
    catch (err) {
        next(err);
    }
};
exports.callResident = callResident;
const getPendingWalkins = async (req, res, next) => {
    try {
        let propertyId;
        if (req.user.role === 'GUARD') {
            const guard = await prisma_1.prisma.guard.findUnique({ where: { userId: req.user.userId } });
            if (guard)
                propertyId = guard.propertyId;
        }
        else {
            const user = await prisma_1.prisma.user.findUnique({
                where: { id: req.user.userId },
                include: { manager: true, committee: true }
            });
            propertyId = user?.manager?.propertyId;
        }
        if (!propertyId && req.user.role !== 'COMMITTEE') {
            return next(new error_middleware_1.AppError('No property context found', 400));
        }
        const where = { status: 'PENDING_APPROVAL' };
        if (propertyId) {
            where.unit = { propertyId };
        }
        const pendingWalkins = await prisma_1.prisma.entry.findMany({
            where,
            include: {
                unit: { select: { unitNumber: true, tower: true } },
                entryPoint: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        return (0, response_util_1.sendSuccess)(res, 200, 'Pending walk-ins retrieved', pendingWalkins);
    }
    catch (err) {
        next(err);
    }
};
exports.getPendingWalkins = getPendingWalkins;
//# sourceMappingURL=walkin.controller.js.map