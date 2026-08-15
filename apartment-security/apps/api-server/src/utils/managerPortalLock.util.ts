import crypto from 'crypto';
import { prisma } from '../config/prisma';

// Idle timeout for a Manager Portal session. Refreshed on every authenticated
// request (see auth.middleware.ts) so only genuine inactivity releases the lock.
export const MANAGER_SESSION_IDLE_MS = 15 * 60 * 1000;

// Atomically claims the single-active-manager slot for a property. Returns the
// session token on success, or null if a DIFFERENT manager already holds it.
// The WHERE clause makes this safe under concurrent claims: Postgres
// serializes concurrent UPDATEs to the same row, so only one caller's WHERE
// still matches once the first commits.
//
// The manager who already holds the slot can always reclaim it (browser
// refresh, new tab, re-login after their access token expired) — the block
// is for a genuinely different manager, not the legitimate current holder.
export const claimManagerPortalLock = async (propertyId: string, managerId: string): Promise<string | null> => {
  await prisma.managerPortalLock.upsert({
    where: { propertyId },
    update: {},
    create: { propertyId },
  });

  const now = new Date();
  const sessionToken = crypto.randomUUID();

  const claim = await prisma.managerPortalLock.updateMany({
    where: {
      propertyId,
      OR: [{ activeManagerId: null }, { activeManagerId: managerId }, { expiresAt: { lt: now } }],
    },
    data: {
      activeManagerId: managerId,
      sessionToken,
      loginAt: now,
      lastActivityAt: now,
      expiresAt: new Date(now.getTime() + MANAGER_SESSION_IDLE_MS),
    },
  });

  return claim.count === 1 ? sessionToken : null;
};

// Releases the lock only if it's still held by this exact manager/session —
// a stale or already-superseded release call can't clobber a newer holder.
export const releaseManagerPortalLock = async (propertyId: string, managerId: string, sessionToken?: string) => {
  await prisma.managerPortalLock.updateMany({
    where: {
      propertyId,
      activeManagerId: managerId,
      ...(sessionToken ? { sessionToken } : {}),
    },
    data: { activeManagerId: null, sessionToken: null, loginAt: null, lastActivityAt: null, expiresAt: null },
  });
};
