"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
const ioredis_1 = require("ioredis");
const env_1 = require("./env");
const logger_util_1 = require("../utils/logger.util");
// ponytail: Graceful Redis client that never crashes the server if Redis is absent
exports.redis = new ioredis_1.Redis(env_1.env.REDIS_URL || 'redis://localhost:6379', {
    lazyConnect: true,
    enableOfflineQueue: true,
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => {
        if (times > 3 && env_1.env.NODE_ENV === 'production' && !process.env.REDIS_URL) {
            return null; // Stop polling localhost in production if REDIS_URL was never provided
        }
        return Math.min(times * 500, 3000);
    },
});
exports.redis.on('connect', () => {
    logger_util_1.logger.info('Connected to Redis');
});
exports.redis.on('error', (err) => {
    // Silent / warning log so unhandled event emitter errors don't trigger fatal process exits
    logger_util_1.logger.warn('Redis connection notice (running in fallback mode if unavailable):', {
        message: err?.message || err,
    });
});
//# sourceMappingURL=redis.js.map