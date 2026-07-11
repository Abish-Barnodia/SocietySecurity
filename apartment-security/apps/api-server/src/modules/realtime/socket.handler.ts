import { Server, Socket } from 'socket.io';
import { verifyAccessToken } from '../../utils/jwt.util';
import { prisma } from '../../config/prisma';
import { logger } from '../../utils/logger.util';
import { redis } from '../../config/redis';

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

  io.on('connection', async (socket: Socket) => {
    const user = socket.data.user;
    
    // Fetch propertyId dynamically from DB or Cache since it's not in the JWT
    let propertyId: string | undefined;
    try {
      const cacheKey = `user_property:${user.userId}`;
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        propertyId = cached;
      } else {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.userId },
          include: { resident: { include: { unit: true } }, guard: true, manager: true, committee: true }
        });
        if (dbUser) {
          if (dbUser.resident) propertyId = dbUser.resident.unit.propertyId;
          else if (dbUser.guard) propertyId = dbUser.guard.propertyId;
          else if (dbUser.manager) propertyId = dbUser.manager.propertyId;
          else if (dbUser.committee) propertyId = dbUser.committee.propertyId;

          if (propertyId) {
            await redis.setex(cacheKey, 3600, propertyId); // Cache for 1 hour
          }
        }
      }
    } catch (e) {
      logger.error('Failed to fetch user in socket connection', e);
    }
    
    logger.info('WebSocket connected', { userId: user.userId, role: user.role, propertyId });

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
      logger.info('WebSocket disconnected', { userId: user.userId });
    });
  });
};
