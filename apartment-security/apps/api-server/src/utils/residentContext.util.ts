import { prisma } from '../config/prisma';
import { redis } from '../config/redis';
import { AppError } from '../middlewares/error.middleware';

// This context (name aside) is the same rarely-changing per-user data the auth
// middleware already resolves and caches — these two helpers are called from
// ~30 sites across 6 modules, each historically re-querying it from scratch, so
// caching here fixes all of them at once instead of touching every call site.
// ponytail: same flat-TTL, no-explicit-invalidation tradeoff as auth.middleware.ts.
const CONTEXT_CACHE_TTL_SECONDS = 45;

async function readThrough<T>(cacheKey: string, resolve: () => Promise<T>): Promise<T> {
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch {
    // Redis unavailable — fall through to the DB lookup below.
  }
  const value = await resolve();
  redis.setex(cacheKey, CONTEXT_CACHE_TTL_SECONDS, JSON.stringify(value)).catch(() => {});
  return value;
}

// Resolves the caller's Resident -> Unit -> Property context from the DB
// (never from the JWT, which today only carries { userId, role }). Shared by
// every resident-facing module that needs to scope reads/writes to the
// caller's own unit/property (community chat, complaints, domestic workers).
export const getResidentContext = async (userId: string) => {
  const cacheKey = `residentCtx:${userId}`;
  const cached = await readThrough(cacheKey, async () => {
    const resident = await prisma.resident.findUnique({
      where: { userId },
      select: { id: true, name: true, unitId: true, mutedFromCommunity: true, unit: { select: { propertyId: true } } },
    });
    if (!resident) return null;
    return {
      residentId: resident.id,
      name: resident.name,
      unitId: resident.unitId,
      propertyId: resident.unit.propertyId,
      mutedFromCommunity: resident.mutedFromCommunity,
    };
  });
  if (!cached) throw new AppError('Resident profile not found', 404);
  return cached;
};

// Resolves propertyId for any role that has one (manager, guard, resident) —
// used by endpoints more than one role can call, e.g. a manager moderating
// community chat. Unlike getResidentContext, this is intentionally not
// resident-only. Committee members have no propertyId in the schema today,
// so they aren't resolvable here.
export const getCallerPropertyId = async (userId: string): Promise<string> => {
  const cacheKey = `callerPropertyId:${userId}`;
  const propertyId = await readThrough(cacheKey, async () => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        manager: { select: { propertyId: true } },
        guard: { select: { propertyId: true } },
        resident: { select: { unit: { select: { propertyId: true } } } },
      },
    });
    return user?.manager?.propertyId ?? user?.guard?.propertyId ?? user?.resident?.unit.propertyId ?? null;
  });
  if (!propertyId) throw new AppError('No property context found', 403);
  return propertyId;
};
