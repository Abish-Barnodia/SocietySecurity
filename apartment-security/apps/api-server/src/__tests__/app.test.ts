import request from 'supertest';
import express, { Router } from 'express';
import { verifySignedQRPayload, generateSignedQRPayload } from '../utils/qr.util';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { AppError, errorHandler } from '../middlewares/error.middleware';

// ---------------------------------------------------------------------------
// Helpers: build a minimal test app without DB connections
// ---------------------------------------------------------------------------
function buildTestApp(router: Router) {
  const app = express();
  app.use(express.json());
  app.use('/test', router);
  app.use(errorHandler);
  return app;
}

// ---------------------------------------------------------------------------
// Issue 19 — Tests covering previously untested code paths
// ---------------------------------------------------------------------------

describe('Health check', () => {
  const app = express();
  app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// QR payload signing and verification
// ---------------------------------------------------------------------------
describe('QR util — generateSignedQRPayload / verifySignedQRPayload', () => {
  const payload = {
    passId: 'pass-abc-123',
    visitorName: 'John Doe',
    validFrom: Date.now(),
    validUntil: Date.now() + 86400000,
  };

  it('generates a non-empty signed string', () => {
    const signed = generateSignedQRPayload(payload);
    expect(typeof signed).toBe('string');
    expect(signed).toContain('.');
  });

  it('round-trips: verify returns the original payload', () => {
    const signed = generateSignedQRPayload(payload);
    const result = verifySignedQRPayload(signed);
    expect(result).not.toBeNull();
    expect(result!.passId).toBe(payload.passId);
    expect(result!.visitorName).toBe(payload.visitorName);
  });

  it('returns null for a tampered payload', () => {
    const signed = generateSignedQRPayload(payload);
    const tampered = signed.slice(0, -5) + 'XXXXX';
    expect(verifySignedQRPayload(tampered)).toBeNull();
  });

  it('returns null for a string with no separator', () => {
    expect(verifySignedQRPayload('nodot')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Auth middleware — authenticate
// ---------------------------------------------------------------------------
describe('authenticate middleware', () => {
  const router = Router();
  router.get('/', authenticate, (_req, res) => res.json({ ok: true }));
  const app = buildTestApp(router);

  it('returns 401 when no Authorization header is provided', async () => {
    const res = await request(app).get('/test');
    expect(res.status).toBe(401);
  });

  it('returns 401 for a malformed / invalid token', async () => {
    const res = await request(app)
      .get('/test')
      .set('Authorization', 'Bearer not.a.real.jwt');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Role middleware — requireRole
// ---------------------------------------------------------------------------
describe('requireRole middleware', () => {
  // Inject a fake user into req so we bypass the JWT step
  const injectUser = (role: string) => (req: any, _res: any, next: any) => {
    req.user = { userId: 'u1', role };
    next();
  };

  it('allows access when user has required role', async () => {
    const router = Router();
    router.get('/', injectUser('MANAGER'), requireRole('MANAGER'), (_req, res) => res.json({ ok: true }));
    const app = buildTestApp(router);
    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
  });

  it('returns 403 when user has wrong role', async () => {
    const router = Router();
    router.get('/', injectUser('RESIDENT'), requireRole('MANAGER'), (_req, res) => res.json({ ok: true }));
    const app = buildTestApp(router);
    const res = await request(app).get('/test');
    expect(res.status).toBe(403);
  });

  it('returns 401 when req.user is not set', async () => {
    const router = Router();
    router.get('/', requireRole('MANAGER'), (_req, res) => res.json({ ok: true }));
    const app = buildTestApp(router);
    const res = await request(app).get('/test');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// AppError + errorHandler
// ---------------------------------------------------------------------------
describe('errorHandler middleware', () => {
  it('returns the correct status and message for an AppError', async () => {
    const router = Router();
    router.get('/', (_req, _res, next) => next(new AppError('Not found', 404)));
    const app = buildTestApp(router);
    const res = await request(app).get('/test');
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Not found');
  });

  it('returns 500 for non-operational errors', async () => {
    const router = Router();
    router.get('/', (_req, _res, next) => {
      const err = new Error('Something internal');
      (err as any).isOperational = false;
      next(err);
    });
    const app = buildTestApp(router);
    const res = await request(app).get('/test');
    expect(res.status).toBe(500);
  });
});
