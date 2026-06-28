"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
const ioredis_1 = require("ioredis");
const env_1 = require("./env");
const logger_util_1 = require("../utils/logger.util");
exports.redis = new ioredis_1.Redis(env_1.env.REDIS_URL || 'redis://localhost:6379');
exports.redis.on('connect', () => {
    logger_util_1.logger.info('Connected to Redis');
});
exports.redis.on('error', (err) => {
    logger_util_1.logger.error('Redis connection error', { err });
});
//# sourceMappingURL=redis.js.map