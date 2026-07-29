import { Redis } from 'ioredis';
import { env } from './env';
import { logger } from '../utils/logger.util';

export const redis = new Redis(env.REDIS_URL || 'redis://localhost:6379', {
  retryStrategy: (times) => {
    if (times > 5) {
      logger.error('Redis connection failed after 5 retries');
      return null;
    }
    return Math.min(times * 200, 2000);
  },
  enableOfflineQueue: false,
});

redis.on('connect', () => {
  logger.info('Connected to Redis');
});

redis.on('error', (err) => {
  logger.error('Redis connection error', { err });
});
