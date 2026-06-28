"use strict";
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
        // 1. Broadcast via WebSocket (Global to property or specific rooms based on roles)
        server_1.io?.emit('new_alert', alert);
        // 2. Fetch users to notify based on roles
        const targetUsers = await prisma_1.prisma.user.findMany({
            where: {
                role: { in: targetRoles || ['RESIDENT', 'GUARD', 'MANAGER', 'COMMITTEE'] },
                isActive: true
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
        // 4. Send Firebase FCM Pushes
        const fcmTokens = targetUsers.flatMap(u => u.fcmTokens);
        if (fcmTokens.length > 0) {
            // TODO: Implement FCM Push bulk send
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
        // Notify Guards and Managers immediately via sockets
        server_1.io?.emit('duress_alert', alert);
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
        const alerts = await prisma_1.prisma.alert.findMany({
            where: {
                targetRoles: {
                    has: req.user.role
                }
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