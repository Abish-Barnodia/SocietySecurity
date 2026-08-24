import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import path from 'path';
import { env } from './config/env';
import { errorHandler } from './middlewares/error.middleware';
import { notFoundHandler } from './middlewares/notFound.middleware';
import { globalRateLimiter } from './middlewares/rateLimiter.middleware';
import { logger } from './utils/logger.util';

// Routers
import { authRouter } from './modules/auth/auth.routes';
import { residentRouter } from './modules/residents/resident.routes';
import { guardRouter } from './modules/guards/guard.routes';
import { passRouter } from './modules/passes/pass.routes';
import { entryRouter } from './modules/entries/entry.routes';
import { walkinRouter } from './modules/walkin/walkin.routes';
import { alertRouter } from './modules/alerts/alert.routes';
import { incidentRouter } from './modules/incidents/incident.routes';
import { vehicleRouter } from './modules/vehicles/vehicle.routes';
import { amenityRouter } from './modules/amenities/amenity.routes';
import { reportRouter } from './modules/reports/report.routes';
import { offlineRouter } from './modules/offline/offline.routes';
import { broadcastRouter } from './modules/broadcasts/broadcast.routes';
import timelineRouter from './modules/timeline/timeline.routes';
import { communityRouter } from './modules/community/community.routes';
import { complaintRouter } from './modules/complaints/complaint.routes';
import { domesticWorkerRouter } from './modules/domesticWorkers/domesticWorker.routes';
import { escalationRouter } from './modules/escalation/escalation.routes';
import { eventRouter } from './modules/events/event.routes';
import { maintenanceRouter } from './modules/maintenance/maintenance.routes';
import { fundRouter } from './modules/funds/fund.routes';
import { settingsRouter } from './modules/settings/settings.routes';
import { managerAccountsRouter } from './modules/managerAccounts/managerAccounts.routes';

const app = express();

// Security headers. Default CORP is 'same-origin', which silently blocks
// <img>/<video>/<audio> tags on other origins (e.g. the manager web
// dashboard) from loading files served from /uploads — relax it since
// those uploads are public URLs anyway (no auth check on the static route).
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Gzip/br compress JSON responses — mobile clients are on cellular networks,
// so shrinking payloads matters more than the CPU cost of compressing them.
app.use(compression());

// CORS — allow mobile apps (no Origin header) + known browser client origins
app.use(cors({
  origin: (origin, callback) => {
    // Mobile apps (React Native / Expo) send no Origin header
    // In production, this should ideally be locked behind an explicit ALLOW_NO_ORIGIN flag or API key middleware.
    if (!origin) {
      if (process.env.NODE_ENV === 'development' || process.env.ALLOW_NO_ORIGIN === 'true') {
        return callback(null, true);
      }
      return callback(new Error('CORS: missing origin not allowed'));
    }
    // In development, allow any localhost origin regardless of port (Vite assigns dynamic ports)
    if (process.env.NODE_ENV === 'development' && /^http:\/\/localhost:\d+$/.test(origin)) {
      return callback(null, true);
    }
    const allowed = [
      env.CLIENT_RESIDENT_APP_URL,
      env.CLIENT_GUARD_APP_URL,
      env.CLIENT_MANAGER_URL,
    ];
    // Allow configured browser client origins or any vercel.app domain
    if (allowed.includes(origin) || origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// Static uploads directory (support both /uploads and /api/v1/uploads)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use('/api/v1/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Global rate limiter (per IP) — runs before body parsing so oversized/high-volume
// request floods are rejected before we spend CPU/memory parsing their bodies.
app.use(globalRateLimiter);

// Body parsing - limited to 10mb (comfortably covers base64 gate/vehicle-alert
// photos, down from 50mb) to reduce memory exposure from oversized payloads.
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP request logging
app.use(morgan('combined', {
  stream: { write: (msg) => logger.http(msg.trim()) },
}));

// Health check & Root endpoint — no auth required (handles Render health probes)
app.all(['/', '/health'], (_req, res) => {
  res.json({ status: 'ok', service: 'Apartment Security API', timestamp: new Date().toISOString() });
});

// API routes
const API = '/api/v1';
app.use(`${API}/auth`, authRouter);
app.use(`${API}/residents`, residentRouter);
app.use(`${API}/guards`, guardRouter);
app.use(`${API}/passes`, passRouter);
app.use(`${API}/entries`, entryRouter);
app.use(`${API}/walkins`, walkinRouter);
app.use(`${API}/alerts`, alertRouter);
app.use(`${API}/incidents`, incidentRouter);
app.use(`${API}/vehicles`, vehicleRouter);
app.use(`${API}/amenities`, amenityRouter);
app.use(`${API}/reports`, reportRouter);
app.use(`${API}/offline`, offlineRouter);
app.use(`${API}/broadcasts`, broadcastRouter);
app.use(`${API}/timeline`, timelineRouter);
app.use(`${API}/community`, communityRouter);
app.use(`${API}/complaints`, complaintRouter);
app.use(`${API}/domestic-workers`, domesticWorkerRouter);
app.use('/api/v1/escalation', escalationRouter);
app.use('/api/v1/events', eventRouter);
app.use('/api/v1/maintenance', maintenanceRouter);
app.use('/api/v1/funds', fundRouter);
app.use('/api/v1/settings', settingsRouter);
app.use('/api/v1/manager-accounts', managerAccountsRouter);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

export default app;
