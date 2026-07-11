import http from 'http';
import app from './app';
import { env } from './config/env';
import { logger } from './utils/logger.util';
import { prisma } from './config/prisma';
import { Server } from 'socket.io';

const server = http.createServer(app);

// Attach Socket.io for Real-time alerts
export const io = new Server(server, {
  cors: {
    // Mobile apps send no Origin header — allow them alongside browser dashboards
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // mobile / server-to-server
      const allowed = [
        env.CLIENT_RESIDENT_APP_URL,
        env.CLIENT_GUARD_APP_URL,
        env.CLIENT_MANAGER_URL,
      ];
      if (allowed.includes(origin)) return callback(null, true);
      callback(new Error(`Socket.io CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  },
});

import { registerSocketHandlers } from './modules/realtime/socket.handler';

registerSocketHandlers(io);

import { startAllJobs } from './jobs';

const startServer = async () => {
  try {
    // We do not strictly await prisma connect because Prisma connects lazily
    // But we can do a dummy query to ensure it's up before serving traffic if needed
    // await prisma.$connect();
    
    // Start cron jobs
    startAllJobs();

    server.listen(env.PORT, '0.0.0.0', () => {
      logger.info(`🚀 Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  logger.error('UNHANDLED REJECTION! 💥 Shutting down...');
  logger.error(err.name, err.message);
  // Force-kill after 5 seconds in case keep-alive connections block server.close()
  const forceKill = setTimeout(() => {
    logger.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 5000);
  forceKill.unref(); // Don't let this timer keep the event loop alive
  server.close(() => {
    process.exit(1);
  });
});
