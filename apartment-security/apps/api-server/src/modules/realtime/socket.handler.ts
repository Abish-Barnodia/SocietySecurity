import { Server, Socket } from 'socket.io';
import { verifyAccessToken } from '../../utils/jwt.util';
import { logger } from '../../utils/logger.util';

export const registerSocketHandlers = (io: Server) => {
  // Auth middleware for every socket connection
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('No token'));

    try {
      const payload = verifyAccessToken(token);
      socket.data.user = payload;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user;
    logger.info('WebSocket connected', { userId: user.userId, role: user.role });

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
      logger.info('WebSocket disconnected', { userId: user.userId });
    });
  });
};
