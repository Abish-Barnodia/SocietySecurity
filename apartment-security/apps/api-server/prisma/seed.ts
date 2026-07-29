import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const pool = new Pool({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const DEMO_PASSWORD = 'Password123';

async function main() {
  // ── Property ────────────────────────────────────────────────
  let property = await prisma.property.findFirst();
  if (!property) {
    property = await prisma.property.create({
      data: {
        name: 'Green Valley Apartments',
        address: '12 Green Valley Road',
        city: 'Bengaluru',
        pincode: '560001',
        totalUnits: 120,
        totalTowers: 3,
      },
    });
  }

  // ── Entry points ────────────────────────────────────────────
  for (const name of ['Main Gate', 'East Gate', 'Service Gate']) {
    const existing = await prisma.entryPoint.findFirst({ where: { name, propertyId: property.id } });
    if (!existing) {
      await prisma.entryPoint.create({
        data: { name, type: 'GATE', propertyId: property.id },
      });
    }
  }

  // ── Units across towers (gives the onboarding tower dropdown real options).
  // Unit numbers are unique per property (@@unique([propertyId, unitNumber])),
  // so each tower gets its own number range rather than repeating 101/201.
  const unitsByTower: Record<string, string[]> = {
    'Tower A': ['101', '201', '301', '402'],
    'Tower B': ['B101', 'B201', 'B301', 'B402'],
    'Tower C': ['C101', 'C201', 'C301', 'C402'],
  };

  for (const [tower, unitNumbers] of Object.entries(unitsByTower)) {
    for (const unitNumber of unitNumbers) {
      await prisma.unit.upsert({
        where: { propertyId_unitNumber: { propertyId: property.id, unitNumber } },
        update: { tower },
        create: {
          unitNumber,
          tower,
          floor: Number(unitNumber.replace(/\D/g, '')[0]),
          propertyId: property.id,
        },
      });
    }
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // ── Resident (already onboarded — lands straight on Home) ───
  const unit = await prisma.unit.findFirstOrThrow({
    where: { tower: 'Tower A', unitNumber: '402', propertyId: property.id },
  });

  const residentUser = await prisma.user.upsert({
    where: { email: 'resident@demo.com' },
    update: { passwordHash },
    create: {
      email: 'resident@demo.com',
      phone: '+919876543210',
      passwordHash,
      role: 'RESIDENT',
    },
  });

  const existingResident = await prisma.resident.findUnique({ where: { userId: residentUser.id } });
  if (!existingResident) {
    await prisma.resident.create({
      data: {
        userId: residentUser.id,
        unitId: unit.id,
        name: 'Abish Barnodia',
        isPrimary: true,
      },
    });
  }

  // ── Fresh resident (no profile yet — exercises the onboarding screen) ──
  await prisma.user.upsert({
    where: { email: 'newuser@demo.com' },
    update: { passwordHash },
    create: {
      email: 'newuser@demo.com',
      passwordHash,
      role: 'RESIDENT',
    },
  });

  // ── Guard ───────────────────────────────────────────────────
  const guardUser = await prisma.user.upsert({
    where: { email: 'guard@demo.com' },
    update: { passwordHash },
    create: {
      email: 'guard@demo.com',
      phone: '+919876500001',
      passwordHash,
      role: 'GUARD',
    },
  });

  const existingGuard = await prisma.guard.findUnique({ where: { userId: guardUser.id } });
  if (!existingGuard) {
    await prisma.guard.create({
      data: {
        userId: guardUser.id,
        propertyId: property.id,
        name: 'Ravi Singh',
        badgeNumber: 'G-001',
      },
    });
  }

  console.log(`
✅ Seed complete. Login with:

   Resident (onboarded)  resident@demo.com  / ${DEMO_PASSWORD}
   Resident (new)        newuser@demo.com   / ${DEMO_PASSWORD}
   Guard                 guard@demo.com     / ${DEMO_PASSWORD}
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
