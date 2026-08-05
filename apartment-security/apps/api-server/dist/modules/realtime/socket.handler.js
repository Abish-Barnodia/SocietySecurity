"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSocketHandlers = void 0;
const jwt_util_1 = require("../../utils/jwt.util");
const logger_util_1 = require("../../utils/logger.util");
const prisma_1 = require("../../config/prisma");
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
        logger_util_1.logger.info('WebSocket connected', { userId: user.userId, role: user.role });
        // Personal room for direct messages
        socket.join(`user:${user.userId}`);
        let resolvedPropertyId = undefined;
        try {
            if (user.role === 'RESIDENT') {
                const resident = await prisma_1.prisma.resident.findUnique({
                    where: { userId: user.userId },
                    select: { unitId: true, unit: { select: { propertyId: true } } },
                });
                resolvedPropertyId = resident?.unit.propertyId;
                if (resolvedPropertyId)
                    socket.join(`property:${resolvedPropertyId}`);
                if (resident?.unitId)
                    socket.join(`unit_${resident.unitId}`);
            }
            else if (user.role === 'GUARD') {
                const guard = await prisma_1.prisma.guard.findUnique({
                    where: { userId: user.userId },
                    select: { id: true, propertyId: true },
                });
                resolvedPropertyId = guard?.propertyId;
                if (resolvedPropertyId)
                    socket.join(`property:${resolvedPropertyId}`);
                if (guard?.id)
                    socket.join(`guard:${guard.id}`);
            }
            else if (user.role === 'MANAGER' || user.role === 'COMMITTEE') {
                const manager = await prisma_1.prisma.manager.findUnique({
                    where: { userId: user.userId },
                    select: { propertyId: true },
                });
                resolvedPropertyId = manager?.propertyId;
                if (resolvedPropertyId)
                    socket.join(`property:${resolvedPropertyId}`);
            }
        }
        catch (err) {
            logger_util_1.logger.error('Failed to resolve context for socket room join', { err });
        }
        // Community chat typing indicator — relayed to everyone else in the room.
        socket.on('community:typing', () => {
            if (!resolvedPropertyId)
                return;
            socket.to(`property:${resolvedPropertyId}`).emit('community:typing', { userId: user.userId });
        });
        socket.on('disconnect', () => {
            logger_util_1.logger.info('WebSocket disconnected', { userId: user.userId });
        });
    });
};
exports.registerSocketHandlers = registerSocketHandlers;
//# sourceMappingURL=socket.handler.js.map