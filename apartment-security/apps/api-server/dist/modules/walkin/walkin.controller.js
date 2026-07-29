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
        // Validate the unit belongs to the guard's property
        const targetUnit = await prisma_1.prisma.unit.findUnique({ where: { id: unitId } });
        if (!targetUnit || targetUnit.propertyId !== guard.propertyId) {
            return next(new error_middleware_1.AppError('Forbidden: Unit does not belong to your assigned property', 403));
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
        // Notify all residents in the unit via push using the shared alert utility
        const unit = await prisma_1.prisma.unit.findUnique({ where: { id: unitId }, include: { residents: { include: { user: true } } } });
        if (unit) {
            const { triggerAlert } = await Promise.resolve().then(() => __importStar(require('../../utils/alert.util')));
            await triggerAlert({
                priority: 'P2',
                title: 'Visitor at your gate',
                body: `${visitorName} is requesting entry. Please approve or deny.`,
                targetUserIds: unit.residents.map((r) => r.userId),
                propertyId: (await prisma_1.prisma.entryPoint.findUnique({ where: { id: entryPointId } }))?.propertyId ?? '',
                entryId: entry.id,
            });
        }
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