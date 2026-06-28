"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSocketHandlers = void 0;
const jwt_util_1 = require("../../utils/jwt.util");
const logger_util_1 = require("../../utils/logger.util");
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
    io.on('connection', (socket) => {
        const user = socket.data.user;
        logger_util_1.logger.info('WebSocket connected', { userId: user.userId, role: user.role });
        // Personal room for direct messages
        socket.join(`user:${user.userId}`);
        // Role-based rooms
        if (user.propertyId) {
            socket.join(`property:${user.propertyId}`);
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