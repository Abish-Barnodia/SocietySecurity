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
import { isKnownOrigin } from './utils/corsOrigin.util';

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
import demoRequestRouter from './modules/demoRequests/demoRequest.routes';
import superAdminRouter from './modules/superAdmin/superAdmin.routes';

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
    // Mobile apps (React Native / Expo) and API clients send no Origin header
    if (!origin) {
      return callback(null, true);
    }
    if (isKnownOrigin(origin)) return callback(null, true);
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
app.use('/api/v1/demo-requests', demoRequestRouter);
app.use('/api/v1/super-admin', superAdminRouter);

// Diagnostic: test email delivery and network connectivity directly from the deployed server
app.get('/api/v1/test-email', async (req, res) => {
  const dns = await import('dns');
  const net = await import('net');

  // Force IPv4 first in Node DNS resolution
  if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
  }

  // 1. Resolve smtp.gmail.com IPv4
  let ipv4Addresses: string[] = [];
  try {
    const addresses = await dns.promises.resolve4('smtp.gmail.com');
    ipv4Addresses = addresses;
  } catch (e: any) {
    ipv4Addresses = [`DNS error: ${e.message}`];
  }

  // 2. Test raw TCP connection to Gmail IPv4 on port 465 and 587
  const testTcp = (host: string, port: number, timeoutMs = 4000): Promise<string> => {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(timeoutMs);
      socket.on('connect', () => {
        socket.destroy();
        resolve(`OPEN: Connected to ${host}:${port} successfully!`);
      });
      socket.on('timeout', () => {
        socket.destroy();
        resolve(`BLOCKED/TIMEOUT: Connection to ${host}:${port} timed out after ${timeoutMs}ms (Render firewall blocking port)`);
      });
      socket.on('error', (err) => {
        socket.destroy();
        resolve(`ERROR on ${host}:${port}: ${err.message}`);
      });
      socket.connect(port, host);
    });
  };

  const primaryIp = ipv4Addresses[0] && !ipv4Addresses[0].startsWith('DNS') ? ipv4Addresses[0] : 'smtp.gmail.com';
  const tcp465 = await testTcp(primaryIp, 465);
  const tcp587 = await testTcp(primaryIp, 587);

  // 3. Test actual email send
  const { sendEmail } = await import('./utils/email.service');
  const targetEmail = (req.query.to as string) || 'abishbarnodia2018@gmail.com';
  let emailResult: any = null;
  let emailError: any = null;

  try {
    const info = await sendEmail(
      targetEmail,
      '✅ Society Security Live Cloud Test',
      `Automated diagnostic test at ${new Date().toISOString()}`,
      `<div style="font-family:sans-serif;padding:20px"><h2 style="color:#00A67C">✅ Email System Operational</h2><p>Delivered from cloud server at <strong>${new Date().toISOString()}</strong>.</p></div>`
    );
    emailResult = { success: true, messageId: info.messageId };
  } catch (err: any) {
    emailError = {
      message: err.message,
      code: err.code,
      command: err.command,
      response: err.response,
    };
  }

  res.json({
    diagnostics: {
      dns_ipv4: ipv4Addresses,
      tcp_port_465: tcp465,
      tcp_port_587: tcp587,
    },
    targetEmail,
    emailResult,
    emailError,
  });
});

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

export default app;
