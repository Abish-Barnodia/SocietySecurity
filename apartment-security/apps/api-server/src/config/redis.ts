import { Redis } from 'ioredis';
import { env } from './env';
import { logger } from '../utils/logger.util';

// ponytail: Graceful Redis client that never crashes the server if Redis is absent
export const redis = new Redis(env.REDIS_URL || 'redis://localhost:6379', {
  lazyConnect: true,
  enableOfflineQueue: true,
  maxRetriesPerRequest: 1,
  retryStrategy: (times) => {
    if (times > 3 && env.NODE_ENV === 'production' && !process.env.REDIS_URL) {
      return null; // Stop polling localhost in production if REDIS_URL was never provided
    }
    return Math.min(times * 500, 3000);
  },
});

redis.on('connect', () => {
  logger.info('Connected to Redis');
});

redis.on('error', (err) => {
  // Silent / warning log so unhandled event emitter errors don't trigger fatal process exits
  logger.warn('Redis connection notice (running in fallback mode if unavailable):', {
    message: err?.message || err,
  });
});
