import request from 'supertest';
import express from 'express';
import { errorHandler } from '../middlewares/error.middleware';
import { createMessageSchema, reactionSchema, voteSchema } from '../modules/community/community.schema';
import { signAccessToken } from '../utils/jwt.util';

// community.controller.ts pulls in `io` from ../server for realtime broadcast,
// but importing the real server.ts starts an actual HTTP listener, connects to
// Postgres, and kicks off cron jobs as import-time side effects — not
// something a unit test should trigger. Stub it out before the router (which
// transitively imports the controller) is required below.
jest.mock('../server', () => ({ io: { to: () => ({ emit: () => {} }) } }));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { communityRouter } = require('../modules/community/community.routes');

// ---------------------------------------------------------------------------
// Community chat — schema validation (pure, no DB) + route-level auth/role
// gating (fails before ever reaching prisma, so no DB dependency here either).
// ---------------------------------------------------------------------------

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/community', communityRouter);
  app.use(errorHandler);
  return app;
}

describe('community.schema — createMessageSchema', () => {
  it('accepts a minimal valid TEXT message', () => {
    const result = createMessageSchema.safeParse({ body: { type: 'TEXT', body: 'hello everyone' } });
    expect(result.success).toBe(true);
  });

  it('accepts a POLL message with 2+ options', () => {
    const result = createMessageSchema.safeParse({
      body: { type: 'POLL', poll: { question: 'Pool open?', options: ['Yes', 'No'] } },
    });
    expect(result.success).toBe(true);
  });

  it('rejects a POLL with fewer than 2 options', () => {
    const result = createMessageSchema.safeParse({
      body: { type: 'POLL', poll: { question: 'Pool open?', options: ['Yes'] } },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown message type', () => {
    const result = createMessageSchema.safeParse({ body: { type: 'GIF', body: 'hi' } });
    expect(result.success).toBe(false);
  });
});

describe('community.schema — reactionSchema / voteSchema', () => {
  it('rejects an empty emoji', () => {
    expect(reactionSchema.safeParse({ body: { emoji: '' } }).success).toBe(false);
  });

  it('accepts a valid emoji', () => {
    expect(reactionSchema.safeParse({ body: { emoji: '👍' } }).success).toBe(true);
  });

  it('requires optionId for a vote', () => {
    expect(voteSchema.safeParse({ body: {} }).success).toBe(false);
    expect(voteSchema.safeParse({ body: { optionId: 'opt_1' } }).success).toBe(true);
  });
});

describe('community routes — auth/role gating', () => {
  const app = buildTestApp();

  it('returns 401 for GET /community/messages with no token', async () => {
    const res = await request(app).get('/community/messages');
    expect(res.status).toBe(401);
  });

  it('returns 403 for a non-RESIDENT role (e.g. MANAGER)', async () => {
    const token = signAccessToken({ userId: 'manager-1', role: 'MANAGER' });
    const res = await request(app).get('/community/messages').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('returns 400 for a validation failure before hitting the DB', async () => {
    const token = signAccessToken({ userId: 'resident-1', role: 'RESIDENT' });
    const res = await request(app)
      .post('/community/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'GIF' });
    expect(res.status).toBe(400);
  });
});
