"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSocketHandlers = void 0;
const jwt_util_1 = require("../../utils/jwt.util");
const prisma_1 = require("../../config/prisma");
const logger_util_1 = require("../../utils/logger.util");
const redis_1 = require("../../config/redis");
const registerSocketHandlers = (io) => {
    // Auth middleware for every socket connection
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token)
            return next(new Error('No token'));
        try {
            const payload = (0, jwt_util_1.verifyAccessToken)(token);
            socket.data.user = payload;
            next();
        }
        catch {
            next(new Error('Invalid token'));
        }
    });
    io.on('connection', async (socket) => {
        const user = socket.data.user;
        // Fetch propertyId dynamically from DB or Cache since it's not in the JWT
        let propertyId;
        try {
            const cacheKey = `user_property:${user.userId}`;
            const cached = await redis_1.redis.get(cacheKey);
            if (cached) {
                propertyId = cached;
            }
            else {
                const dbUser = await prisma_1.prisma.user.findUnique({
                    where: { id: user.userId },
                    include: { resident: { include: { unit: true } }, guard: true, manager: true, committee: true }
                });
                if (dbUser) {
                    if (dbUser.resident)
                        propertyId = dbUser.resident.unit.propertyId;
                    else if (dbUser.guard)
                        propertyId = dbUser.guard.propertyId;
                    else if (dbUser.manager)
                        propertyId = dbUser.manager.propertyId;
                    else if (dbUser.committee)
                        propertyId = dbUser.committee.propertyId;
                    if (propertyId) {
                        await redis_1.redis.setex(cacheKey, 3600, propertyId); // Cache for 1 hour
                    }
                }
            }
        }
        catch (e) {
            logger_util_1.logger.error('Failed to fetch user in socket connection', e);
        }
        logger_util_1.logger.info('WebSocket connected', { userId: user.userId, role: user.role, propertyId });
        // Personal room for direct messages
        socket.join(`user:${user.userId}`);
        // Role-based rooms
        if (propertyId) {
            socket.join(`property:${propertyId}`);
        }
        if (user.guardId) {
            socket.join(`guard:${user.guardId}`);
        }
        socket.on('disconnect', () => {
            logger_util_1.logger.info('WebSocket disconnected', { userId: user.userId });
        });
    });
};
exports.registerSocketHandlers = registerSocketHandlers;
//# sourceMappingURL=socket.handler.js.map