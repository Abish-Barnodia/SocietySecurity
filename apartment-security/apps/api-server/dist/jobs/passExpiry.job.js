"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.passExpiryJob = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const prisma_1 = require("../config/prisma");
const logger_util_1 = require("../utils/logger.util");
exports.passExpiryJob = node_cron_1.default.schedule('*/15 * * * *', async () => {
    try {
        const expired = await prisma_1.prisma.pass.updateMany({
            where: {
                status: 'ACTIVE',
                validUntil: { lt: new Date() },
            },
            data: { status: 'EXPIRED' },
        });
        if (expired.count > 0) {
            logger_util_1.logger.info(`Pass expiry job: expired ${expired.count} passes`);
        }
        // Also reactivate passes where suspendedUntil has passed
        const reactivated = await prisma_1.prisma.pass.updateMany({
            where: {
                status: 'SUSPENDED',
                suspendedUntil: { lt: new Date() },
                validUntil: { gt: new Date() },
            },
            data: { status: 'ACTIVE', suspendedAt: null, suspendedUntil: null },
        });
        if (reactivated.count > 0) {
            logger_util_1.logger.info(`Pass expiry job: reactivated ${reactivated.count} suspended passes`);
        }
    }
    catch (err) {
        logger_util_1.logger.error('passExpiryJob failed', { err });
    }
});
//# sourceMappingURL=passExpiry.job.js.map