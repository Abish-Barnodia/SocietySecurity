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
exports.acknowledgeAlert = exports.triggerAlert = void 0;
const prisma_1 = require("../config/prisma");
const push_util_1 = require("./push.util");
const sms_util_1 = require("./sms.util");
const env_1 = require("../config/env");
const triggerAlert = async (params) => {
    const { priority, title, body, targetUserIds = [], targetRoles = [], entryId, incidentId, propertyId, imageUrl, dataOnly, extraData, } = params;
    // Determine all target users
    let userIds = [...targetUserIds];
    if (targetRoles.length > 0) {
        const users = await prisma_1.prisma.user.findMany({
            where: {
                role: { in: targetRoles },
                isActive: true,
                OR: [
                    { guard: { propertyId } },
                    { manager: { propertyId } },
                    { resident: { unit: { propertyId } } },
                ],
            },
            select: { id: true },
        });
        userIds.push(...users.map((u) => u.id));
    }
    userIds = [...new Set(userIds)]; // deduplicate
    // Fetch FCM tokens for all targets
    const users = await prisma_1.prisma.user.findMany({
        where: { id: { in: userIds }, isActive: true },
        select: { id: true, phone: true, fcmTokens: true, role: true },
    });
    // Create alert record
    const alert = await prisma_1.prisma.alert.create({
        data: {
            entryId,
            incidentId,
            propertyId,
            priority,
            title,
            body,
            targetRoles: targetRoles,
            targetUserIds: userIds,
            channel: 'PUSH',
            status: 'SENT',
            imageUrl,
        },
    });
    // Emit live socket event to every target user's personal room so the
    // resident app receives the alert instantly without relying on FCM push.
    // Also broadcast to the whole property room — managers get oversight of
    // every alert (see getAlerts), not just ones that happened to target
    // their own user id, and their Alerts & Escalation badge count needs a
    // live signal regardless of who the alert was actually for.
    try {
        const { io } = await Promise.resolve().then(() => __importStar(require('../server')));
        for (const uid of userIds) {
            io?.to(`user:${uid}`).emit('new_alert', alert);
        }
        io?.to(`property:${propertyId}`).emit('new_alert', alert);
    }
    catch { /* server not yet ready during tests */ }
    const allFcmTokens = users.flatMap((u) => u.fcmTokens);
    const pushData = { alertId: alert.id, priority, ...(entryId ? { entryId } : {}), ...(extraData ?? {}) };
    // P1: push + SMS simultaneously, no waiting
    if (priority === 'P1') {
        const pushPromise = allFcmTokens.length
            ? (0, push_util_1.sendPush)(allFcmTokens, { title, body, data: pushData, dataOnly })
            : Promise.resolve();
        const smsPromises = users
            .filter((u) => u.phone)
            .map((u) => (0, sms_util_1.sendSMS)(u.phone, `🚨 URGENT: ${title}. ${body}`));
        // Emergency services for P1 incidents
        if (incidentId && env_1.env.EMERGENCY_SMS_NUMBER) {
            smsPromises.push((0, sms_util_1.sendSMS)(env_1.env.EMERGENCY_SMS_NUMBER, `P1 ALERT at property ${propertyId}: ${title}. ${body}`));
        }
        await Promise.allSettled([pushPromise, ...smsPromises]);
    }
    else {
        // P2 and P3: push only; SMS fallback via escalation job
        if (allFcmTokens.length) {
            await (0, push_util_1.sendPush)(allFcmTokens, { title, body, data: pushData, dataOnly });
        }
    }
    return alert;
};
exports.triggerAlert = triggerAlert;
const acknowledgeAlert = async (alertId, userId) => {
    const alert = await prisma_1.prisma.alert.findFirst({
        where: {
            OR: [
                { id: alertId },
                { entryId: alertId }
            ]
        }
    });
    if (!alert)
        return null;
    const updated = await prisma_1.prisma.alert.update({
        where: { id: alert.id },
        data: { status: 'ACKNOWLEDGED', acknowledgedAt: new Date(), acknowledgedBy: userId },
    });
    try {
        const { io } = await Promise.resolve().then(() => __importStar(require('../server')));
        // Notify whoever raised this alert (currently only set for duress
        // alarms) that staff has responded — otherwise the sender never learns
        // a manager acted on it beyond the one-time "SOS sent" toast at trigger
        // time.
        if (updated.triggeredByUserId) {
            io?.to(`user:${updated.triggeredByUserId}`).emit('alert_acknowledged', updated);
        }
        // Every manager watching Alerts & Escalation needs to see this flip to
        // ACKNOWLEDGED live too — whichever one of them (or another channel)
        // just acknowledged it, everyone's unread badge should drop together.
        io?.to(`property:${updated.propertyId}`).emit('alert_updated', updated);
    }
    catch { /* server not yet ready during tests */ }
    return updated;
};
exports.acknowledgeAlert = acknowledgeAlert;
//# sourceMappingURL=alert.util.js.map