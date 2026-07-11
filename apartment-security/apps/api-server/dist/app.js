"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const morgan_1 = __importDefault(require("morgan"));
const env_1 = require("./config/env");
const error_middleware_1 = require("./middlewares/error.middleware");
const notFound_middleware_1 = require("./middlewares/notFound.middleware");
const rateLimiter_middleware_1 = require("./middlewares/rateLimiter.middleware");
const logger_util_1 = require("./utils/logger.util");
// Routers
const auth_routes_1 = require("./modules/auth/auth.routes");
const resident_routes_1 = require("./modules/residents/resident.routes");
const guard_routes_1 = require("./modules/guards/guard.routes");
const pass_routes_1 = require("./modules/passes/pass.routes");
const entry_routes_1 = require("./modules/entries/entry.routes");
const walkin_routes_1 = require("./modules/walkin/walkin.routes");
const alert_routes_1 = require("./modules/alerts/alert.routes");
const incident_routes_1 = require("./modules/incidents/incident.routes");
const vehicle_routes_1 = require("./modules/vehicles/vehicle.routes");
const amenity_routes_1 = require("./modules/amenities/amenity.routes");
const report_routes_1 = require("./modules/reports/report.routes");
const offline_routes_1 = require("./modules/offline/offline.routes");
const community_routes_1 = __importDefault(require("./modules/community/community.routes"));
const app = (0, express_1.default)();
// Serve static files from public directory
app.use('/public', express_1.default.static(path_1.default.join(__dirname, '../public')));
// Security headers
app.use((0, helmet_1.default)());
// CORS — allow mobile apps (no Origin header) + known browser client origins
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Mobile apps (React Native / Expo) send no Origin header — always allow
        if (!origin)
            return callback(null, true);
        // Allow configured browser client origins
        const allowed = [
            env_1.env.CLIENT_RESIDENT_APP_URL,
            env_1.env.CLIENT_GUARD_APP_URL,
            env_1.env.CLIENT_MANAGER_URL,
        ];
        if (allowed.includes(origin))
            return callback(null, true);
        callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
}));
// Body parsing
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// HTTP request logging
app.use((0, morgan_1.default)('combined', {
    stream: { write: (msg) => logger_util_1.logger.http(msg.trim()) },
}));
// Global rate limiter (per IP)
app.use(rateLimiter_middleware_1.globalRateLimiter);
// Health check — no auth required
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// API routes
const API = '/api/v1';
app.use(`${API}/auth`, auth_routes_1.authRouter);
app.use(`${API}/residents`, resident_routes_1.residentRouter);
app.use(`${API}/guards`, guard_routes_1.guardRouter);
app.use(`${API}/passes`, pass_routes_1.passRouter);
app.use(`${API}/entries`, entry_routes_1.entryRouter);
app.use(`${API}/walkins`, walkin_routes_1.walkinRouter);
app.use(`${API}/alerts`, alert_routes_1.alertRouter);
app.use(`${API}/incidents`, incident_routes_1.incidentRouter);
app.use(`${API}/vehicles`, vehicle_routes_1.vehicleRouter);
app.use(`${API}/amenities`, amenity_routes_1.amenityRouter);
app.use(`${API}/reports`, report_routes_1.reportRouter);
app.use(`${API}/offline`, offline_routes_1.offlineRouter);
app.use(`${API}/community`, community_routes_1.default);
// 404 handler
app.use(notFound_middleware_1.notFoundHandler);
// Global error handler
app.use(error_middleware_1.errorHandler);
exports.default = app;
//# sourceMappingURL=app.js.map