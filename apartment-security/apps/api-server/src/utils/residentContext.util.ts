import { prisma } from '../config/prisma';
import { AppError } from '../middlewares/error.middleware';

// Resolves the caller's Resident -> Unit -> Property context from the DB
// (never from the JWT, which today only carries { userId, role }). Shared by
// every resident-facing module that needs to scope reads/writes to the
// caller's own unit/property (community chat, complaints, domestic workers).
export const getResidentContext = async (userId: string) => {
  const resident = await prisma.resident.findUnique({
    where: { userId },
    select: { id: true, name: true, unitId: true, unit: { select: { propertyId: true } } },
  });
  if (!resident) throw new AppError('Resident profile not found', 404);
  return { residentId: resident.id, name: resident.name, unitId: resident.unitId, propertyId: resident.unit.propertyId };
};
