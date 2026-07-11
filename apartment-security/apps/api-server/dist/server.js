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
const server = http_1.default.createServer(app_1.default);
// Attach Socket.io for Real-time alerts
exports.io = new socket_io_1.Server(server, {
    cors: {
        // Mobile apps send no Origin header — allow them alongside browser dashboards
        origin: (origin, callback) => {
            if (!origin)
                return callback(null, true); // mobile / server-to-server
            const allowed = [
                env_1.env.CLIENT_RESIDENT_APP_URL,
                env_1.env.CLIENT_GUARD_APP_URL,
                env_1.env.CLIENT_MANAGER_URL,
            ];
            if (allowed.includes(origin))
                return callback(null, true);
            callback(new Error(`Socket.io CORS: origin ${origin} not allowed`));
        },
        credentials: true,
    },
});
const socket_handler_1 = require("./modules/realtime/socket.handler");
(0, socket_handler_1.registerSocketHandlers)(exports.io);
const jobs_1 = require("./jobs");
const startServer = async () => {
    try {
        // We do not strictly await prisma connect because Prisma connects lazily
        // But we can do a dummy query to ensure it's up before serving traffic if needed
        // await prisma.$connect();
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
// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    logger_util_1.logger.error('UNHANDLED REJECTION! 💥 Shutting down...');
    logger_util_1.logger.error(err.name, err.message);
    // Force-kill after 5 seconds in case keep-alive connections block server.close()
    const forceKill = setTimeout(() => {
        logger_util_1.logger.error('Forced shutdown after timeout.');
        process.exit(1);
    }, 5000);
    forceKill.unref(); // Don't let this timer keep the event loop alive
    server.close(() => {
        process.exit(1);
    });
});
//# sourceMappingURL=server.js.map