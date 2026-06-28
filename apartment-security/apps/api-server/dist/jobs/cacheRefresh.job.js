"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheRefreshJob = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const prisma_1 = require("../config/prisma");
const redis_1 = require("../config/redis");
const logger_util_1 = require("../utils/logger.util");
exports.cacheRefreshJob = node_cron_1.default.schedule('*/15 * * * *', async () => {
    try {
        const properties = await prisma_1.prisma.property.findMany({ select: { id: true } });
        for (const property of properties) {
            const passes = await prisma_1.prisma.pass.findMany({
                where: {
                    unit: { propertyId: property.id },
                    status: 'ACTIVE',
                    validUntil: { gt: new Date() },
                },
                select: {
                    id: true,
                    qrPayload: true,
                    otpCode: true,
                    visitorName: true,
                    unitId: true,
                    type: true,
                    validFrom: true,
                    validUntil: true,
                    entryPointIds: true,
                    recurringRule: true,
                },
            });
            await redis_1.redis.setex(`pass_cache:property:${property.id}`, 900, // 15 minutes
            JSON.stringify(passes));
        }
        logger_util_1.logger.info(`Cache refresh job: refreshed ${properties.length} property caches`);
    }
    catch (err) {
        logger_util_1.logger.error('cacheRefreshJob failed', { err });
    }
});
//# sourceMappingURL=cacheRefresh.job.js.map