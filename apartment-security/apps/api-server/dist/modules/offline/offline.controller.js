"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPassCache = exports.syncOfflineEntries = void 0;
const prisma_1 = require("../../config/prisma");
const response_util_1 = require("../../utils/response.util");
const redis_1 = require("../../config/redis");
const syncOfflineEntries = async (req, res, next) => {
    try {
        const { entries } = req.body; // Array of locally queued entry records
        const guardId = req.user.guardId;
        const results = [];
        for (const e of entries) {
            // Idempotency: skip if already synced (use client-generated localId)
            // Usually you'd store localId on the Entry model to check this easily, 
            // but here we just check for identical entries near this time
            const exists = await prisma_1.prisma.entry.findFirst({
                where: { guardId, entryAt: new Date(e.entryAt), passId: e.passId ?? undefined },
            });
            if (exists) {
                results.push({ localId: e.localId, synced: false, reason: 'DUPLICATE' });
                continue;
            }
            const created = await prisma_1.prisma.entry.create({
                data: {
                    unitId: e.unitId,
                    passId: e.passId,
                    guardId,
                    entryPointId: e.entryPointId,
                    visitorName: e.visitorName,
                    visitorPhone: e.visitorPhone,
                    vehicleNumber: e.vehicleNumber,
                    method: e.method,
                    status: e.status,
                    gatePhotoUrl: e.gatePhotoUrl,
                    entryAt: new Date(e.entryAt),
                },
            });
            results.push({ localId: e.localId, synced: true, serverId: created.id });
        }
        (0, response_util_1.sendSuccess)(res, 200, 'Synced successfully', { results, total: entries.length });
    }
    catch (err) {
        next(err);
    }
};
exports.syncOfflineEntries = syncOfflineEntries;
const getPassCache = async (req, res, next) => {
    try {
        // Returns the active pass set for this property — used to seed guard's offline cache
        const guardId = req.user.guardId;
        const guard = await prisma_1.prisma.guard.findUnique({ where: { id: guardId } });
        const propertyId = guard?.propertyId;
        if (!propertyId)
            return (0, response_util_1.sendSuccess)(res, 400, 'Property not found', []);
        const cacheKey = `pass_cache:property:${propertyId}`;
        const cached = await redis_1.redis.get(cacheKey);
        if (cached) {
            return (0, response_util_1.sendSuccess)(res, 200, 'From cache', JSON.parse(cached));
        }
        const passes = await prisma_1.prisma.pass.findMany({
            where: {
                unit: { propertyId },
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
        await redis_1.redis.setex(cacheKey, 900, JSON.stringify(passes)); // 15 min TTL
        (0, response_util_1.sendSuccess)(res, 200, 'From database', passes);
    }
    catch (err) {
        next(err);
    }
};
exports.getPassCache = getPassCache;
//# sourceMappingURL=offline.controller.js.map