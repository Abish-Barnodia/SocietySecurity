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
exports.getAlerts = exports.triggerDuress = exports.broadcastAlert = void 0;
const prisma_1 = require("../../config/prisma");
const response_util_1 = require("../../utils/response.util");
const error_middleware_1 = require("../../middlewares/error.middleware");
const audit_util_1 = require("../../utils/audit.util");
const server_1 = require("../../server");
const sms_util_1 = require("../../utils/sms.util");
const env_1 = require("../../config/env");
const broadcastAlert = async (req, res, next) => {
    try {
        const { type, severity, title, message, targetRoles } = req.body;
        let propertyId = undefined;
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: req.user.userId },
            include: { manager: true, committee: true, guard: true }
        });
        if (user?.manager)
            propertyId = user.manager.propertyId;
        else if (user?.guard)
            propertyId = user.guard.propertyId;
        if (!propertyId)
            return next(new error_middleware_1.AppError('No property context found for alert broadcast', 400));
        if (severity === 'CRITICAL' && req.user.role !== 'MANAGER') {
            return next(new error_middleware_1.AppError('Only managers can broadcast critical alerts', 403));
        }
        // Map severity to AlertPriority
        let priority = 'P3';
        if (severity === 'CRITICAL')
            priority = 'P1';
        else if (severity === 'HIGH')
            priority = 'P2';
        const alert = await prisma_1.prisma.alert.create({
            data: {
                propertyId,
                priority,
                title: `[${type}] ${title}`,
                body: message,
                channel: 'PUSH',
                targetRoles: targetRoles || ['RESIDENT', 'GUARD', 'MANAGER', 'COMMITTEE']
            }
        });
        // 1. Broadcast via WebSocket scoped to this property only
        server_1.io?.to(`property:${propertyId}`).emit('new_alert', alert);
        // 2. Fetch users scoped to this property only to prevent cross-tenant notification
        const targetUsers = await prisma_1.prisma.user.findMany({
            where: {
                role: { in: targetRoles || ['RESIDENT', 'GUARD', 'MANAGER', 'COMMITTEE'] },
                isActive: true,
                OR: [
                    { guard: { propertyId } },
                    { manager: { propertyId } },
                    { resident: { unit: { propertyId } } },
                ],
            }
        });
        // 3. Send SMS if Critical
        if (severity === 'CRITICAL') {
            const phones = targetUsers.map(u => u.phone);
            // In production, we'd batch these SMS calls or send to an SNS topic.
            // For now, we simulate sending critical SMS.
            if (env_1.env.NODE_ENV !== 'test') {
                // await Promise.all(phones.map(p => sendSMS(p, `[URGENT] ${title}: ${message}`)));
            }
        }
        // 4. Send Firebase FCM Pushes via the sendPush utility (batches 500 tokens, cleans invalid ones)
        const fcmTokens = targetUsers.flatMap(u => u.fcmTokens);
        if (fcmTokens.length > 0) {
            const { sendPush } = await Promise.resolve().then(() => __importStar(require('../../utils/push.util')));
            await sendPush(fcmTokens, { title: `[${type}] ${title}`, body: message });
        }
        await (0, audit_util_1.auditLog)(req.user.userId, 'BROADCAST_ALERT', 'Alert', alert.id);
        return (0, response_util_1.sendSuccess)(res, 201, 'Alert broadcasted successfully', alert);
    }
    catch (err) {
        next(err);
    }
};
exports.broadcastAlert = broadcastAlert;
const triggerDuress = async (req, res, next) => {
    try {
        // This is typically triggered silently by a resident or guard
        const { latitude, longitude } = req.body;
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: req.user.userId },
            include: { resident: { include: { unit: true } }, guard: true }
        });
        if (!user)
            return next(new error_middleware_1.AppError('User not found', 404));
        let propertyId = user.guard?.propertyId || user.resident?.unit.propertyId;
        let senderName = user.resident?.name || user.guard?.name || 'Unknown User';
        const alert = await prisma_1.prisma.alert.create({
            data: {
                propertyId: propertyId,
                priority: 'P1',
                title: 'SILENT DURESS ALARM',
                body: `${senderName} has triggered a silent duress alarm. Immediate assistance required.`,
                channel: 'PUSH',
                targetRoles: ['GUARD', 'MANAGER']
            }
        });
        // Notify Guards and Managers immediately via sockets — scoped to this property
        server_1.io?.to(`property:${propertyId}`).emit('duress_alert', alert);
        // Send SMS to Emergency Contact if Resident
        if (user.resident?.emergencyContact) {
            await (0, sms_util_1.sendSMS)(user.resident.emergencyContact, `URGENT: ${senderName} has triggered a duress alarm via Apartment Security.`);
        }
        // Send SMS to Property Emergency Number
        if (env_1.env.EMERGENCY_SMS_NUMBER) {
            await (0, sms_util_1.sendSMS)(env_1.env.EMERGENCY_SMS_NUMBER, `DURESS ALARM: User ID ${user.id} at Property ${propertyId}.`);
        }
        await (0, audit_util_1.auditLog)(req.user.userId, 'TRIGGER_DURESS', 'Alert', alert.id);
        // Send 200 silently to not tip off anyone monitoring the app UI
        return (0, response_util_1.sendSuccess)(res, 200, 'Ok', { received: true });
    }
    catch (err) {
        next(err);
    }
};
exports.triggerDuress = triggerDuress;
const getAlerts = async (req, res, next) => {
    try {
        // Resolve the caller's propertyId to scope alerts — prevents cross-tenant data exposure
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: req.user.userId },
            include: {
                manager: true,
                guard: true,
                resident: { include: { unit: true } },
            },
        });
        const propertyId = user?.manager?.propertyId ??
            user?.guard?.propertyId ??
            user?.resident?.unit.propertyId;
        if (!propertyId)
            return next(new error_middleware_1.AppError('No property context found', 403));
        const alerts = await prisma_1.prisma.alert.findMany({
            where: {
                propertyId,
                targetRoles: { has: req.user.role },
            },
            orderBy: { createdAt: 'desc' },
            take: 50
        });
        return (0, response_util_1.sendSuccess)(res, 200, 'Alerts fetched', alerts);
    }
    catch (err) {
        next(err);
    }
};
exports.getAlerts = getAlerts;
//# sourceMappingURL=alert.controller.js.map