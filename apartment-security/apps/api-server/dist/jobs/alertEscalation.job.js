"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.alertEscalationJob = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const prisma_1 = require("../config/prisma");
const sms_util_1 = require("../utils/sms.util");
const push_util_1 = require("../utils/push.util");
const logger_util_1 = require("../utils/logger.util");
const SLA_MINUTES = { P1: 3, P2: 15, P3: 60 };
exports.alertEscalationJob = node_cron_1.default.schedule('*/1 * * * *', async () => {
    try {
        const now = new Date();
        for (const [priority, minutes] of Object.entries(SLA_MINUTES)) {
            const cutoff = new Date(now.getTime() - minutes * 60 * 1000);
            const overdueAlerts = await prisma_1.prisma.alert.findMany({
                where: {
                    priority: priority,
                    status: 'SENT',
                    createdAt: { lt: cutoff },
                },
                include: { incident: true },
            });
            for (const alert of overdueAlerts) {
                // Escalate: find managers and committee for this property
                const escalationTargets = await prisma_1.prisma.user.findMany({
                    where: {
                        role: { in: ['MANAGER', 'COMMITTEE'] },
                        isActive: true,
                        OR: [
                            { manager: { propertyId: alert.propertyId } },
                            { committee: { isNot: null } },
                        ],
                    },
                    select: { id: true, phone: true, fcmTokens: true },
                });
                const allTokens = escalationTargets.flatMap((u) => u.fcmTokens);
                if (allTokens.length) {
                    await (0, push_util_1.sendPush)(allTokens, {
                        title: `⚠️ ESCALATED: ${alert.title}`,
                        body: `Alert unacknowledged for ${minutes} min. ${alert.body}`,
                        data: { alertId: alert.id, type: 'ESCALATION' },
                    });
                }
                if (priority === 'P1') {
                    for (const target of escalationTargets) {
                        if (target.phone) {
                            await (0, sms_util_1.sendSMS)(target.phone, `ESCALATED P1: ${alert.title}. ${alert.body}. Check the app immediately.`);
                        }
                    }
                }
                await prisma_1.prisma.alert.update({
                    where: { id: alert.id },
                    data: { status: 'ESCALATED', escalatedAt: now },
                });
                logger_util_1.logger.warn(`Alert ${alert.id} escalated (${priority}, ${minutes}min SLA breached)`);
            }
        }
    }
    catch (err) {
        logger_util_1.logger.error('alertEscalationJob failed', { err });
    }
});
//# sourceMappingURL=alertEscalation.job.js.map