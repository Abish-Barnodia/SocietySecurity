import { env } from '../config/env';

// Shared allowlist check for a browser Origin header — used by both the
// Express `cors()` middleware (app.ts) and the Socket.io server (server.ts).
// They used to keep separate copies of this list and drifted apart: the
// Socket.io copy was missing the *.vercel.app fallback, so every socket.io
// handshake from the manager dashboard got silently CORS-rejected whenever
// CLIENT_MANAGER_URL didn't exactly match the dashboard's current deploy URL.
// ponytail: permit localhost/127.0.0.1/LAN in dev, vercel deploys, and configured URLs
export function isKnownOrigin(origin: string): boolean {
  if (
    env.NODE_ENV === 'development' &&
    (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
     /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(origin))
  ) {
    return true;
  }

  try {
    const { hostname } = new URL(origin);
    if (hostname.endsWith('.vercel.app')) return true;
  } catch {}

  const customOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
  const allowed = [
    env.CLIENT_RESIDENT_APP_URL,
    env.CLIENT_GUARD_APP_URL,
    env.CLIENT_MANAGER_URL,
    ...customOrigins,
  ].filter(Boolean);

  return allowed.includes(origin);
}

