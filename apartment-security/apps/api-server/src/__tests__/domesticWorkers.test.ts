import request from 'supertest';
import express from 'express';
import { errorHandler } from '../middlewares/error.middleware';
import { domesticWorkerRouter } from '../modules/domesticWorkers/domesticWorker.routes';
import { createWorkerSchema, updateWorkerSchema } from '../modules/domesticWorkers/domesticWorker.schema';
import { signAccessToken } from '../utils/jwt.util';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/domestic-workers', domesticWorkerRouter);
  app.use(errorHandler);
  return app;
}

const validWorker = {
  name: 'Sunita Devi',
  phone: '+919876500001',
  type: 'MAID',
  workingDays: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
  entryTime: '09:00',
  exitTime: '11:00',
};

describe('domesticWorker.schema — createWorkerSchema', () => {
  it('accepts a minimal valid worker', () => {
    expect(createWorkerSchema.safeParse({ body: validWorker }).success).toBe(true);
  });

  it('rejects an unknown worker type', () => {
    const result = createWorkerSchema.safeParse({ body: { ...validWorker, type: 'ASTRONAUT' } });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed entryTime', () => {
    const result = createWorkerSchema.safeParse({ body: { ...validWorker, entryTime: '9am' } });
    expect(result.success).toBe(false);
  });

  it('rejects an empty workingDays array', () => {
    const result = createWorkerSchema.safeParse({ body: { ...validWorker, workingDays: [] } });
    expect(result.success).toBe(false);
  });

  it('updateWorkerSchema allows a partial payload', () => {
    expect(updateWorkerSchema.safeParse({ body: { notes: 'Has a spare key' } }).success).toBe(true);
  });
});

describe('domestic-workers routes — auth/role gating', () => {
  const app = buildTestApp();

  it('returns 401 for GET /domestic-workers with no token', async () => {
    const res = await request(app).get('/domestic-workers');
    expect(res.status).toBe(401);
  });

  it('returns 403 for a GUARD role', async () => {
    const token = signAccessToken({ userId: 'guard-1', role: 'GUARD' });
    const res = await request(app).get('/domestic-workers').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('returns 400 for an invalid create payload before hitting the DB', async () => {
    const token = signAccessToken({ userId: 'resident-1', role: 'RESIDENT' });
    const res = await request(app)
      .post('/domestic-workers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'A' });
    expect(res.status).toBe(400);
  });
});
