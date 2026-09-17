"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const compression_1 = __importDefault(require("compression"));
const morgan_1 = __importDefault(require("morgan"));
const path_1 = __importDefault(require("path"));
const error_middleware_1 = require("./middlewares/error.middleware");
const notFound_middleware_1 = require("./middlewares/notFound.middleware");
const rateLimiter_middleware_1 = require("./middlewares/rateLimiter.middleware");
const logger_util_1 = require("./utils/logger.util");
const corsOrigin_util_1 = require("./utils/corsOrigin.util");
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
const broadcast_routes_1 = require("./modules/broadcasts/broadcast.routes");
const timeline_routes_1 = __importDefault(require("./modules/timeline/timeline.routes"));
const community_routes_1 = require("./modules/community/community.routes");
const complaint_routes_1 = require("./modules/complaints/complaint.routes");
const domesticWorker_routes_1 = require("./modules/domesticWorkers/domesticWorker.routes");
const escalation_routes_1 = require("./modules/escalation/escalation.routes");
const event_routes_1 = require("./modules/events/event.routes");
const maintenance_routes_1 = require("./modules/maintenance/maintenance.routes");
const fund_routes_1 = require("./modules/funds/fund.routes");
const settings_routes_1 = require("./modules/settings/settings.routes");
const managerAccounts_routes_1 = require("./modules/managerAccounts/managerAccounts.routes");
const demoRequest_routes_1 = __importDefault(require("./modules/demoRequests/demoRequest.routes"));
const superAdmin_routes_1 = __importDefault(require("./modules/superAdmin/superAdmin.routes"));
const app = (0, express_1.default)();
// Security headers. Default CORP is 'same-origin', which silently blocks
// <img>/<video>/<audio> tags on other origins (e.g. the manager web
// dashboard) from loading files served from /uploads — relax it since
// those uploads are public URLs anyway (no auth check on the static route).
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
// Gzip/br compress JSON responses — mobile clients are on cellular networks,
// so shrinking payloads matters more than the CPU cost of compressing them.
app.use((0, compression_1.default)());
// CORS — allow mobile apps (no Origin header) + known browser client origins
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Mobile apps (React Native / Expo) send no Origin header
        // In production, this should ideally be locked behind an explicit ALLOW_NO_ORIGIN flag or API key middleware.
        if (!origin) {
            if (process.env.NODE_ENV === 'development' || process.env.ALLOW_NO_ORIGIN === 'true') {
                return callback(null, true);
            }
            return callback(new Error('CORS: missing origin not allowed'));
        }
        if ((0, corsOrigin_util_1.isKnownOrigin)(origin))
            return callback(null, true);
        callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
}));
// Static uploads directory (support both /uploads and /api/v1/uploads)
app.use('/uploads', express_1.default.static(path_1.default.join(process.cwd(), 'uploads')));
app.use('/api/v1/uploads', express_1.default.static(path_1.default.join(process.cwd(), 'uploads')));
// Global rate limiter (per IP) — runs before body parsing so oversized/high-volume
// request floods are rejected before we spend CPU/memory parsing their bodies.
app.use(rateLimiter_middleware_1.globalRateLimiter);
// Body parsing - limited to 10mb (comfortably covers base64 gate/vehicle-alert
// photos, down from 50mb) to reduce memory exposure from oversized payloads.
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// HTTP request logging
app.use((0, morgan_1.default)('combined', {
    stream: { write: (msg) => logger_util_1.logger.http(msg.trim()) },
}));
// Health check & Root endpoint — no auth required (handles Render health probes)
app.all(['/', '/health'], (_req, res) => {
    res.json({ status: 'ok', service: 'Apartment Security API', timestamp: new Date().toISOString() });
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
app.use(`${API}/broadcasts`, broadcast_routes_1.broadcastRouter);
app.use(`${API}/timeline`, timeline_routes_1.default);
app.use(`${API}/community`, community_routes_1.communityRouter);
app.use(`${API}/complaints`, complaint_routes_1.complaintRouter);
app.use(`${API}/domestic-workers`, domesticWorker_routes_1.domesticWorkerRouter);
app.use('/api/v1/escalation', escalation_routes_1.escalationRouter);
app.use('/api/v1/events', event_routes_1.eventRouter);
app.use('/api/v1/maintenance', maintenance_routes_1.maintenanceRouter);
app.use('/api/v1/funds', fund_routes_1.fundRouter);
app.use('/api/v1/settings', settings_routes_1.settingsRouter);
app.use('/api/v1/manager-accounts', managerAccounts_routes_1.managerAccountsRouter);
app.use('/api/v1/demo-requests', demoRequest_routes_1.default);
app.use('/api/v1/super-admin', superAdmin_routes_1.default);
// 404 handler
app.use(notFound_middleware_1.notFoundHandler);
// Global error handler
app.use(error_middleware_1.errorHandler);
exports.default = app;
//# sourceMappingURL=app.js.map