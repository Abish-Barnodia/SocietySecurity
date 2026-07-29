import { Server, Socket } from 'socket.io';
import { verifyAccessToken } from '../../utils/jwt.util';
import { logger } from '../../utils/logger.util';
import { prisma } from '../../config/prisma';

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

    // Residents' access tokens don't carry propertyId today, so resolve it
    // from the DB (Resident -> Unit -> Property) instead — this is what puts
    // a resident's socket into the room the Community chat broadcasts to.
    // Kept in a local var (not trusting client-supplied input) so the typing
    // relay below always targets the socket's own real property room.
    let residentPropertyId: string | undefined = user.propertyId;
    if (user.role === 'RESIDENT') {
      try {
        const resident = await prisma.resident.findUnique({
          where: { userId: user.userId },
          select: { unitId: true, unit: { select: { propertyId: true } } },
        });
        residentPropertyId = residentPropertyId ?? resident?.unit.propertyId;
        if (!user.propertyId && resident?.unit.propertyId) {
          socket.join(`property:${resident.unit.propertyId}`);
        }
        // Matches the `unit_${unitId}` room the walk-in module broadcasts
        // guard-initiated approval requests to (see walkin.controller.ts).
        if (resident?.unitId) {
          socket.join(`unit_${resident.unitId}`);
        }
      } catch (err) {
        logger.error('Failed to resolve resident unit/property for socket room join', { err });
      }
    }

    // Community chat typing indicator — relayed to everyone else in the room.
    socket.on('community:typing', () => {
      if (!residentPropertyId) return;
      socket.to(`property:${residentPropertyId}`).emit('community:typing', { userId: user.userId });
    });

    socket.on('disconnect', () => {
      logger.info('WebSocket disconnected', { userId: user.userId });
    });
  });
};
