import { prisma } from '../config/prisma';
import { AppError } from '../middlewares/error.middleware';

// Resolves the caller's Resident -> Unit -> Property context from the DB
// (never from the JWT, which today only carries { userId, role }). Shared by
// every resident-facing module that needs to scope reads/writes to the
// caller's own unit/property (community chat, complaints, domestic workers).
export const getResidentContext = async (userId: string) => {
  const resident = await prisma.resident.findUnique({
    where: { userId },
    select: { id: true, name: true, unitId: true, mutedFromCommunity: true, unit: { select: { propertyId: true } } },
  });
  if (!resident) throw new AppError('Resident profile not found', 404);
  return {
    residentId: resident.id,
    name: resident.name,
    unitId: resident.unitId,
    propertyId: resident.unit.propertyId,
    mutedFromCommunity: resident.mutedFromCommunity,
  };
};

// Resolves propertyId for any role that has one (manager, guard, resident) —
// used by endpoints more than one role can call, e.g. a manager moderating
// community chat. Unlike getResidentContext, this is intentionally not
// resident-only. Committee members have no propertyId in the schema today,
// so they aren't resolvable here.
export const getCallerPropertyId = async (userId: string): Promise<string> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      manager: { select: { propertyId: true } },
      guard: { select: { propertyId: true } },
      resident: { select: { unit: { select: { propertyId: true } } } },
    },
  });
  const propertyId = user?.manager?.propertyId ?? user?.guard?.propertyId ?? user?.resident?.unit.propertyId;
  if (!propertyId) throw new AppError('No property context found', 403);
  return propertyId;
};
