"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.alertEscalationJob = exports.SLA_MINUTES = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const prisma_1 = require("../config/prisma");
const sms_util_1 = require("../utils/sms.util");
const push_util_1 = require("../utils/push.util");
const logger_util_1 = require("../utils/logger.util");
exports.SLA_MINUTES = { P1: 3, P2: 15, P3: 60 };
// Notifies a single configured escalation step's target — a real registered
// user (push/SMS/email via their own contact info) or an external contact
// (SMS-only, since that's all a phone-only contact supports).
const notifyStep = async (step, title, body) => {
    const user = step.userId
        ? await prisma_1.prisma.user.findUnique({ where: { id: step.userId }, select: { phone: true, fcmTokens: true } })
        : null;
    const wantsPush = step.channel === 'PUSH' || step.channel === 'ALL';
    const wantsSms = step.channel === 'SMS' || step.channel === 'ALL';
    if (wantsPush && user?.fcmTokens.length) {
        await (0, push_util_1.sendPush)(user.fcmTokens, { title, body });
    }
    if (wantsSms) {
        const phone = user?.phone ?? step.contactPhone;
        if (phone)
            await (0, sms_util_1.sendSMS)(phone, `${title}. ${body}`);
    }
};
exports.alertEscalationJob = node_cron_1.default.schedule('*/1 * * * *', async () => {
    try {
        const now = new Date();
        for (const [priority, slaMinutes] of Object.entries(exports.SLA_MINUTES)) {
            const cutoff = new Date(now.getTime() - slaMinutes * 60 * 1000);
            const overdueAlerts = await prisma_1.prisma.alert.findMany({
                where: {
                    priority: priority,
                    status: { in: ['SENT', 'ESCALATED'] },
                    createdAt: { lt: cutoff },
                },
            });
            for (const alert of overdueAlerts) {
                const chain = await prisma_1.prisma.escalationChain.findUnique({
                    where: { propertyId_priority: { propertyId: alert.propertyId, priority: priority } },
                    include: { steps: { orderBy: { order: 'asc' } } },
                });
                const elapsedMinutes = Math.floor((now.getTime() - alert.createdAt.getTime()) / 60000);
                if (chain) {
                    // Fire every step that's now due and hasn't fired yet, in order.
                    const dueSteps = chain.steps.filter((s) => s.order > alert.escalationStep && elapsedMinutes >= s.delayMinutes);
                    if (dueSteps.length === 0)
                        continue;
                    for (const step of dueSteps) {
                        await notifyStep(step, `⚠️ ESCALATED: ${alert.title}`, `Alert unacknowledged for ${elapsedMinutes} min. ${alert.body}`);
                    }
                    await prisma_1.prisma.alert.update({
                        where: { id: alert.id },
                        data: {
                            status: 'ESCALATED',
                            escalatedAt: alert.escalatedAt ?? now,
                            escalationStep: dueSteps[dueSteps.length - 1].order,
                        },
                    });
                    logger_util_1.logger.warn(`Alert ${alert.id} escalated to step ${dueSteps[dueSteps.length - 1].order} (${priority})`);
                    continue;
                }
                // No configured chain for this property/priority — fall back to the
                // old flat behavior (notify every manager/committee member at once).
                if (alert.status === 'ESCALATED')
                    continue;
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
                        body: `Alert unacknowledged for ${slaMinutes} min. ${alert.body}`,
                        data: { alertId: alert.id, type: 'ESCALATION' },
                    });
                }
                if (priority === 'P1') {
                    for (const target of escalationTargets) {
                        if (!target.phone)
                            continue;
                        await (0, sms_util_1.sendSMS)(target.phone, `ESCALATED P1: ${alert.title}. ${alert.body}. Check the app immediately.`);
                    }
                }
                await prisma_1.prisma.alert.update({
                    where: { id: alert.id },
                    data: { status: 'ESCALATED', escalatedAt: now },
                });
                logger_util_1.logger.warn(`Alert ${alert.id} escalated (${priority}, ${slaMinutes}min SLA breached, no chain configured)`);
            }
        }
    }
    catch (err) {
        logger_util_1.logger.error('alertEscalationJob failed', { err });
    }
});
//# sourceMappingURL=alertEscalation.job.js.map