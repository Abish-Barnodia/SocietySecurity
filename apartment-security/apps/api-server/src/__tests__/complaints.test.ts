import request from 'supertest';
import express from 'express';
import { errorHandler } from '../middlewares/error.middleware';
import { createComplaintSchema, updateStatusSchema, assignComplaintSchema } from '../modules/complaints/complaint.schema';
import { signAccessToken } from '../utils/jwt.util';

// complaint.controller.ts pulls in `io` from ../server for realtime broadcast —
// stub it out before the router (which transitively imports the controller) is
// required, same reasoning as community.test.ts.
jest.mock('../server', () => ({ io: { to: () => ({ emit: () => {} }) } }));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { complaintRouter } = require('../modules/complaints/complaint.routes');

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/complaints', complaintRouter);
  app.use(errorHandler);
  return app;
}

describe('complaint.schema — createComplaintSchema', () => {
  it('accepts a minimal valid complaint', () => {
    const result = createComplaintSchema.safeParse({
      body: { category: 'MAINTENANCE', title: 'Leaking tap', description: 'The kitchen tap has been leaking for two days.' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown category', () => {
    const result = createComplaintSchema.safeParse({
      body: { category: 'ALIENS', title: 'x', description: 'yyyyy' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects a title that is too short', () => {
    const result = createComplaintSchema.safeParse({
      body: { category: 'NOISE', title: 'x', description: 'yyyyy' },
    });
    expect(result.success).toBe(false);
  });
});

describe('complaint.schema — updateStatusSchema / assignComplaintSchema', () => {
  it('accepts a known status', () => {
    expect(updateStatusSchema.safeParse({ body: { status: 'IN_PROGRESS' } }).success).toBe(true);
  });

  it('rejects an unknown status', () => {
    expect(updateStatusSchema.safeParse({ body: { status: 'VANISHED' } }).success).toBe(false);
  });

  it('requires assignedTo and assignedToName', () => {
    expect(assignComplaintSchema.safeParse({ body: { assignedTo: 'u1' } }).success).toBe(false);
    expect(assignComplaintSchema.safeParse({ body: { assignedTo: 'u1', assignedToName: 'Jane' } }).success).toBe(true);
  });
});

describe('complaint routes — auth/role gating', () => {
  const app = buildTestApp();

  it('returns 401 for GET /complaints with no token', async () => {
    const res = await request(app).get('/complaints');
    expect(res.status).toBe(401);
  });

  it('returns 403 for a GUARD trying to create a complaint', async () => {
    const token = signAccessToken({ userId: 'guard-1', role: 'GUARD' });
    const res = await request(app).post('/complaints').set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(403);
  });

  it('returns 403 for a RESIDENT trying to update complaint status', async () => {
    const token = signAccessToken({ userId: 'resident-1', role: 'RESIDENT' });
    const res = await request(app)
      .post('/complaints/some-id/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'RESOLVED' });
    expect(res.status).toBe(403);
  });

  it('returns 400 for an invalid complaint payload before hitting the DB', async () => {
    const token = signAccessToken({ userId: 'resident-1', role: 'RESIDENT' });
    const res = await request(app)
      .post('/complaints')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'NOT_REAL', title: 'x', description: 'x' });
    expect(res.status).toBe(400);
  });
});
