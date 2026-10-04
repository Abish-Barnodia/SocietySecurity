"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = void 0;
const http_1 = __importDefault(require("http"));
const app_1 = __importDefault(require("./app"));
const env_1 = require("./config/env");
const logger_util_1 = require("./utils/logger.util");
const socket_io_1 = require("socket.io");
const corsOrigin_util_1 = require("./utils/corsOrigin.util");
const redis_adapter_1 = require("@socket.io/redis-adapter");
const ioredis_1 = require("ioredis");
require("./queues/notification.queue");
const server = http_1.default.createServer(app_1.default);
// Attach Socket.io for Real-time alerts
exports.io = new socket_io_1.Server(server, {
    cors: {
        // Mobile apps send no Origin header — allow them alongside browser dashboards
        origin: (origin, callback) => {
            if (!origin)
                return callback(null, true); // mobile / server-to-server
            if ((0, corsOrigin_util_1.isKnownOrigin)(origin))
                return callback(null, true);
            callback(new Error(`Socket.io CORS: origin ${origin} not allowed`));
        },
        credentials: true,
    },
});
// ponytail: only attach Redis adapter if an external REDIS_URL is explicitly configured
if (process.env.REDIS_URL) {
    try {
        const pubClient = new ioredis_1.Redis(process.env.REDIS_URL, {
            lazyConnect: true,
            enableOfflineQueue: false,
            maxRetriesPerRequest: 1,
            retryStrategy: (times) => (times > 3 ? null : Math.min(times * 500, 2000)),
        });
        const subClient = pubClient.duplicate();
        pubClient.on('error', (err) => logger_util_1.logger.warn('Socket.io Redis pub client notice:', { message: err?.message || err }));
        subClient.on('error', (err) => logger_util_1.logger.warn('Socket.io Redis sub client notice:', { message: err?.message || err }));
        Promise.all([pubClient.connect(), subClient.connect()])
            .then(() => {
            exports.io.adapter((0, redis_adapter_1.createAdapter)(pubClient, subClient));
            logger_util_1.logger.info('Socket.io Redis adapter initialized for multi-instance clustering');
        })
            .catch((err) => {
            logger_util_1.logger.warn('Socket.io Redis connection not established, running with default adapter:', {
                message: err?.message || err,
            });
        });
    }
    catch (err) {
        logger_util_1.logger.warn('Socket.io Redis adapter setup skipped:', { message: err?.message || err });
    }
}
app_1.default.set('io', exports.io);
const socket_handler_1 = require("./modules/realtime/socket.handler");
(0, socket_handler_1.registerSocketHandlers)(exports.io);
const jobs_1 = require("./jobs");
const startServer = async () => {
    try {
        // Start cron jobs
        (0, jobs_1.startAllJobs)();
        server.listen(env_1.env.PORT, '0.0.0.0', () => {
            logger_util_1.logger.info(`🚀 Server running in ${env_1.env.NODE_ENV} mode on port ${env_1.env.PORT}`);
        });
    }
    catch (error) {
        logger_util_1.logger.error('Failed to start server:', error);
        process.exit(1);
    }
};
startServer();
// Handle unhandled promise rejections safely without crashing on non-fatal background errors
process.on('unhandledRejection', (err) => {
    const errMsg = err?.message || String(err);
    const isIgnorable = errMsg.includes('ECONNREFUSED') ||
        errMsg.includes('Redis') ||
        errMsg.includes('getaddrinfo') ||
        errMsg.includes('Socket.io CORS');
    if (isIgnorable) {
        logger_util_1.logger.warn('Non-fatal unhandled rejection caught (server remains active):', {
            error: errMsg,
        });
        return;
    }
    logger_util_1.logger.error('FATAL UNHANDLED REJECTION! 💥 Shutting down...', {
        name: err?.name,
        message: errMsg,
        stack: err?.stack,
    });
    const forceKill = setTimeout(() => {
        logger_util_1.logger.error('Forced shutdown after timeout.');
        process.exit(1);
    }, 5000);
    forceKill.unref();
    server.close(() => {
        process.exit(1);
    });
});
//# sourceMappingURL=server.js.map