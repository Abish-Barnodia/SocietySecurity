import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
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

const app = express();

// Security headers
app.use(helmet());

// CORS — only allow known client origins
app.use(cors({
  origin: [
    env.CLIENT_RESIDENT_APP_URL,
    env.CLIENT_GUARD_APP_URL,
    env.CLIENT_MANAGER_URL,
  ],
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// HTTP request logging
app.use(morgan('combined', {
  stream: { write: (msg) => logger.http(msg.trim()) },
}));

// Global rate limiter (per IP)
app.use(globalRateLimiter);

// Health check — no auth required
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
const API = '/api/v1';
app.use(`${API}/auth`,      authRouter);
app.use(`${API}/residents`, residentRouter);
app.use(`${API}/guards`,    guardRouter);
app.use(`${API}/passes`,    passRouter);
app.use(`${API}/entries`,   entryRouter);
app.use(`${API}/walkins`,   walkinRouter);
app.use(`${API}/alerts`,    alertRouter);
app.use(`${API}/incidents`, incidentRouter);
app.use(`${API}/vehicles`,  vehicleRouter);
app.use(`${API}/amenities`, amenityRouter);
app.use(`${API}/reports`,   reportRouter);
app.use(`${API}/offline`,   offlineRouter);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

export default app;
