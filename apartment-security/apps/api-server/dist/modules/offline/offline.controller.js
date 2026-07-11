"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPassCache = exports.syncOfflineEntries = void 0;
const prisma_1 = require("../../config/prisma");
const response_util_1 = require("../../utils/response.util");
const error_middleware_1 = require("../../middlewares/error.middleware");
const redis_1 = require("../../config/redis");
const syncOfflineEntries = async (req, res, next) => {
    try {
        const { entries } = req.body; // Array of locally queued entry records
        // Resolve guard via userId (guardId is NOT in the JWT payload)
        const guard = await prisma_1.prisma.guard.findUnique({ where: { userId: req.user.userId } });
        if (!guard)
            return next(new error_middleware_1.AppError('Guard record not found', 404));
        const guardId = guard.id;
        const results = [];
        // Bulk fetch validation data
        const unitIds = [...new Set(entries.map((e) => e.unitId))];
        const units = await prisma_1.prisma.unit.findMany({ where: { id: { in: unitIds } } });
        const validUnitIds = new Set(units.filter(u => u.propertyId === guard.propertyId).map(u => u.id));
        const entryTimestamps = entries.map((e) => new Date(e.entryAt));
        const existingEntries = await prisma_1.prisma.entry.findMany({
            where: { guardId, entryAt: { in: entryTimestamps } }
        });
        const transactions = [];
        const localIdToTxIndex = new Map();
        for (const e of entries) {
            if (!validUnitIds.has(e.unitId)) {
                results.push({ localId: e.localId, synced: false, reason: 'FORBIDDEN_PROPERTY' });
                continue;
            }
            const passId = e.passId || null;
            const isDuplicate = existingEntries.some(ex => ex.entryAt.getTime() === new Date(e.entryAt).getTime() && ex.passId === passId);
            if (isDuplicate) {
                results.push({ localId: e.localId, synced: false, reason: 'DUPLICATE' });
                continue;
            }
            transactions.push(prisma_1.prisma.entry.create({
                data: {
                    unitId: e.unitId,
                    passId,
                    guardId,
                    entryPointId: e.entryPointId,
                    visitorName: e.visitorName,
                    visitorPhone: e.visitorPhone,
                    vehicleNumber: e.vehicleNumber,
                    method: e.method,
                    status: e.status,
                    gatePhotoUrl: e.gatePhotoUrl,
                    entryAt: new Date(e.entryAt),
                }
            }));
            localIdToTxIndex.set(transactions.length - 1, e.localId);
        }
        if (transactions.length > 0) {
            const createdEntries = await prisma_1.prisma.$transaction(transactions);
            createdEntries.forEach((created, index) => {
                results.push({ localId: localIdToTxIndex.get(index), synced: true, serverId: created.id });
            });
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
        // Resolve guard via userId (guardId is NOT in the JWT payload)
        const guard = await prisma_1.prisma.guard.findUnique({ where: { userId: req.user.userId } });
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