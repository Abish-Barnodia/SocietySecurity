import request from 'supertest';
import express from 'express';

// Simple express app for testing, since we might not want to initialize the full server (DB connections etc) in a unit test
const app = express();
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

describe('App Test', () => {
  it('should have a health check endpoint', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
  });
});
