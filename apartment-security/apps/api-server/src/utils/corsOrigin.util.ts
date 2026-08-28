import { env } from '../config/env';

// Shared allowlist check for a browser Origin header — used by both the
// Express `cors()` middleware (app.ts) and the Socket.io server (server.ts).
// They used to keep separate copies of this list and drifted apart: the
// Socket.io copy was missing the *.vercel.app fallback, so every socket.io
// handshake from the manager dashboard got silently CORS-rejected whenever
// CLIENT_MANAGER_URL didn't exactly match the dashboard's current deploy URL.
export function isKnownOrigin(origin: string): boolean {
  if (env.NODE_ENV === 'development' && /^http:\/\/localhost:\d+$/.test(origin)) {
    return true;
  }
  const allowed = [env.CLIENT_RESIDENT_APP_URL, env.CLIENT_GUARD_APP_URL, env.CLIENT_MANAGER_URL];
  return allowed.includes(origin) || origin.endsWith('.vercel.app');
}
