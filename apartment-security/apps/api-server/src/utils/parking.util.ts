import { prisma } from '../config/prisma';

// Called from every place an Entry with a vehicleNumber is created (gate
// scan/manual log, walk-in request) — silently a no-op if there's no vehicle
// or no free slot, since parking assignment is a bonus on top of entry
// logging, never a reason to block it.
export const assignParkingSlot = async (entryId: string, propertyId: string, vehicleNumber?: string | null) => {
  if (!vehicleNumber) return;
  const freeSlot = await prisma.parkingSlot.findFirst({
    where: { propertyId, entryId: null },
    orderBy: { code: 'asc' },
  });
  if (!freeSlot) return;
  await prisma.parkingSlot.update({ where: { id: freeSlot.id }, data: { entryId } });
};

// Called on exit — frees whichever slot (if any) was holding this entry.
export const releaseParkingSlot = async (entryId: string) => {
  await prisma.parkingSlot.updateMany({ where: { entryId }, data: { entryId: null } });
};

// Regenerates the flat B1-01..B1-NN slot list to match the configured total,
// growing by appending and shrinking by removing only currently-free slots
// from the end — never orphans a slot an entry is actively parked in.
export const syncParkingSlots = async (propertyId: string, totalSlots: number) => {
  const existing = await prisma.parkingSlot.findMany({ where: { propertyId }, orderBy: { code: 'asc' } });

  if (existing.length < totalSlots) {
    const toCreate = [];
    for (let i = existing.length + 1; i <= totalSlots; i++) {
      toCreate.push({ propertyId, zone: 'B1', code: `B1-${String(i).padStart(2, '0')}` });
    }
    await prisma.parkingSlot.createMany({ data: toCreate });
  } else if (existing.length > totalSlots) {
    const removable = existing.filter((s) => !s.entryId).slice(-(existing.length - totalSlots));
    await prisma.parkingSlot.deleteMany({ where: { id: { in: removable.map((s) => s.id) } } });
  }
};
