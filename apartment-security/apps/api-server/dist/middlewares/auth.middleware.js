"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = void 0;
const jwt_util_1 = require("../utils/jwt.util");
const error_middleware_1 = require("./error.middleware");
const prisma_1 = require("../config/prisma");
const redis_1 = require("../config/redis");
const managerPortalLock_util_1 = require("../utils/managerPortalLock.util");
// Resident/guard/committee auth context (isActive + propertyId/residentId) rarely
// changes mid-session, but every request needs it, so it's cached instead of
// re-running a 3-table join per request. Managers are excluded — they already pay
// for a live DB roundtrip every request for the portal-lock heartbeat below, and
// their permissions must stay fresh, so there's nothing to gain from caching them.
// ponytail: flat TTL, no explicit cache invalidation on deactivation (same tradeoff
// as the pass cache in offline.controller.ts). Bounds "deactivated user keeps API
// access" to ~45s; add redis.del(authCacheKey(userId)) at deactivation call sites
// if that window ever needs to be tighter.
const AUTH_CACHE_TTL_SECONDS = 45;
const authCacheKey = (userId) => `auth:ctx:${userId}`;
async function getAuthContext(userId) {
    try {
        const cached = await redis_1.redis.get(authCacheKey(userId));
        if (cached)
            return JSON.parse(cached);
    }
    catch {
        // Redis unavailable — fall through to the DB lookup below.
    }
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
        select: {
            isActive: true,
            resident: { select: { id: true, unitId: true, unit: { select: { propertyId: true } } } },
            guard: { select: { id: true, propertyId: true } },
        },
    });
    if (!user)
        return null;
    const ctx = {
        isActive: user.isActive,
        propertyId: user.resident?.unit.propertyId ?? user.guard?.propertyId,
        residentId: user.resident?.id,
        guardId: user.guard?.id,
        unitId: user.resident?.unitId,
    };
    redis_1.redis.setex(authCacheKey(userId), AUTH_CACHE_TTL_SECONDS, JSON.stringify(ctx)).catch(() => { });
    return ctx;
}
const authenticate = async (req, res, next) => {
    try {
        let token;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }
        if (!token) {
            return next(new error_middleware_1.AppError('You are not logged in. Please log in to get access.', 401));
        }
        const decoded = (0, jwt_util_1.verifyAccessToken)(token);
        // Super Admin platform owner - bypasses property tenant context
        if (decoded.role === 'SUPER_ADMIN') {
            const user = await prisma_1.prisma.user.findUnique({
                where: { id: decoded.userId },
                select: { id: true, email: true, isActive: true, role: true },
            });
            if (!user || !user.isActive || user.role !== 'SUPER_ADMIN') {
                return next(new error_middleware_1.AppError('The super admin account no longer exists or is deactivated.', 401));
            }
            req.user = {
                ...decoded,
            };
            return next();
        }
        // Managers get exactly one active Manager Portal session per property, checked
        // live on every request (not cached — see note above).
        if (decoded.role === 'MANAGER') {
            const user = await prisma_1.prisma.user.findUnique({
                where: { id: decoded.userId },
                include: { manager: true },
            });
            if (!user || !user.isActive || !user.manager) {
                return next(new error_middleware_1.AppError('The user belonging to this token no longer exists or is deactivated.', 401));
            }
            // Every request re-checks that this token's session still holds the
            // lock (so a force-logout or expiry takes effect immediately, not just
            // on next login) and, if so, extends the idle timeout — a heartbeat
            // that rides on normal request traffic instead of a dedicated endpoint.
            const lock = await prisma_1.prisma.managerPortalLock.findUnique({ where: { propertyId: user.manager.propertyId } });
            const now = new Date();
            const holdsLock = lock
                && lock.activeManagerId === user.manager.id
                && lock.sessionToken === decoded.managerSessionToken
                && lock.expiresAt && lock.expiresAt > now;
            if (!holdsLock) {
                return next(new error_middleware_1.AppError('Your Manager Portal session has ended. Please log in again.', 401));
            }
            // Re-extending the idle timeout on literally every request means a write on
            // every manager API call. Only re-extend once the previous extension is more
            // than 2 minutes old — well inside the idle window (MANAGER_SESSION_IDLE_MS),
            // so the session never actually expires early, but a manager clicking around
            // the portal no longer serializes every request behind a DB write.
            const idleRefreshBufferMs = 2 * 60 * 1000;
            if (!lock.expiresAt || lock.expiresAt.getTime() - now.getTime() < managerPortalLock_util_1.MANAGER_SESSION_IDLE_MS - idleRefreshBufferMs) {
                await prisma_1.prisma.managerPortalLock.update({
                    where: { propertyId: user.manager.propertyId },
                    data: { lastActivityAt: now, expiresAt: new Date(now.getTime() + managerPortalLock_util_1.MANAGER_SESSION_IDLE_MS) },
                });
            }
            req.user = {
                ...decoded,
                propertyId: user.manager.propertyId,
                managerId: user.manager.id,
                managerPermissions: user.manager.permissions,
            };
            return next();
        }
        const ctx = await getAuthContext(decoded.userId);
        if (!ctx || !ctx.isActive) {
            return next(new error_middleware_1.AppError('The user belonging to this token no longer exists or is deactivated.', 401));
        }
        req.user = {
            ...decoded,
            propertyId: ctx.propertyId,
            residentId: ctx.residentId,
            guardId: ctx.guardId,
            unitId: ctx.unitId,
        };
        next();
    }
    catch (error) {
        return next(new error_middleware_1.AppError('Invalid or expired token', 401));
    }
};
exports.authenticate = authenticate;
//# sourceMappingURL=auth.middleware.js.map