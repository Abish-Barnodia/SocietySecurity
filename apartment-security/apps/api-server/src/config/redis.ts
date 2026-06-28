import { Redis } from 'ioredis';
import { env } from './env';
import { logger } from '../utils/logger.util';

export const redis = new Redis(env.REDIS_URL || 'redis://localhost:6379');

redis.on('connect', () => {
  logger.info('Connected to Redis');
});

redis.on('error', (err) => {
  logger.error('Redis connection error', { err });
});
