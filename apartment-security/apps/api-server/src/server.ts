import http from 'http';
import app from './app';
import { env } from './config/env';
import { logger } from './utils/logger.util';
import { prisma } from './config/prisma';
import { Server } from 'socket.io';
import { isKnownOrigin } from './utils/corsOrigin.util';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import './queues/notification.queue';

const server = http.createServer(app);

// Attach Socket.io for Real-time alerts
export const io = new Server(server, {
  cors: {
    // Mobile apps send no Origin header — allow them alongside browser dashboards
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // mobile / server-to-server
      if (isKnownOrigin(origin)) return callback(null, true);
      callback(new Error(`Socket.io CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  },
});

// ponytail: attach Redis adapter for multi-instance Socket.io clustering
if (env.REDIS_URL) {
  try {
    const pubClient = new Redis(env.REDIS_URL, {
      retryStrategy: (times) => (times > 5 ? null : Math.min(times * 200, 2000)),
      enableOfflineQueue: false,
    });
    const subClient = pubClient.duplicate();

    pubClient.on('error', (err) => logger.warn('Socket.io Redis pub client error:', { err: err?.message || err }));
    subClient.on('error', (err) => logger.warn('Socket.io Redis sub client error:', { err: err?.message || err }));

    io.adapter(createAdapter(pubClient, subClient));
    logger.info('Socket.io Redis adapter initialized for multi-instance clustering');
  } catch (err: any) {
    logger.warn('Socket.io Redis adapter setup skipped:', { err: err?.message || err });
  }
}

app.set('io', io);

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
