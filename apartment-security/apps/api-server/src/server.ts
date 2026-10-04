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

// ponytail: only attach Redis adapter if an external REDIS_URL is explicitly configured
if (process.env.REDIS_URL) {
  try {
    const pubClient = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 500, 2000)),
    });
    const subClient = pubClient.duplicate();

    pubClient.on('error', (err) => logger.warn('Socket.io Redis pub client notice:', { message: err?.message || err }));
    subClient.on('error', (err) => logger.warn('Socket.io Redis sub client notice:', { message: err?.message || err }));

    Promise.all([pubClient.connect(), subClient.connect()])
      .then(() => {
        io.adapter(createAdapter(pubClient, subClient));
        logger.info('Socket.io Redis adapter initialized for multi-instance clustering');
      })
      .catch((err) => {
        logger.warn('Socket.io Redis connection not established, running with default adapter:', {
          message: err?.message || err,
        });
      });
  } catch (err: any) {
    logger.warn('Socket.io Redis adapter setup skipped:', { message: err?.message || err });
  }
}

app.set('io', io);

import { registerSocketHandlers } from './modules/realtime/socket.handler';

registerSocketHandlers(io);

import { startAllJobs } from './jobs';

const startServer = async () => {
  try {
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

// Handle unhandled promise rejections safely without crashing on non-fatal background errors
process.on('unhandledRejection', (err: any) => {
  const errMsg = err?.message || String(err);
  const isIgnorable =
    errMsg.includes('ECONNREFUSED') ||
    errMsg.includes('Redis') ||
    errMsg.includes('getaddrinfo') ||
    errMsg.includes('Socket.io CORS');

  if (isIgnorable) {
    logger.warn('Non-fatal unhandled rejection caught (server remains active):', {
      error: errMsg,
    });
    return;
  }

  logger.error('FATAL UNHANDLED REJECTION! 💥 Shutting down...', {
    name: err?.name,
    message: errMsg,
    stack: err?.stack,
  });

  const forceKill = setTimeout(() => {
    logger.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 5000);
  forceKill.unref();

  server.close(() => {
    process.exit(1);
  });
});
