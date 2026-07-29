/**
 * Seed script to create test users for development.
 * Run with: node prisma/seed.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  // 1. Create a Property
  const property = await prisma.property.upsert({
    where: { id: 'prop-dev-001' },
    update: {},
    create: {
      id: 'prop-dev-001',
      name: 'Green Valley Apartments',
      address: '123 Main Street',
      city: 'Bangalore',
      pincode: '560001',
      totalUnits: 100,
      totalTowers: 4,
    },
  });
  console.log('Property:', property.name);

  // 2. Create an Entry Point
  const entryPoint = await prisma.entryPoint.upsert({
    where: { id: 'ep-dev-001' },
    update: {},
    create: {
      id: 'ep-dev-001',
      propertyId: property.id,
      name: 'Main Gate',
      type: 'MAIN_GATE',
    },
  });
  console.log('Entry Point:', entryPoint.name);

  // 3. Create a Unit
  const unit = await prisma.unit.upsert({
    where: {
      propertyId_unitNumber: {
        propertyId: property.id,
        unitNumber: 'A-101',
      },
    },
    update: {},
    create: {
      id: 'unit-dev-001',
      propertyId: property.id,
      unitNumber: 'A-101',
      floor: 1,
      tower: 'A',
      isOccupied: true,
    },
  });
  console.log('Unit:', unit.tower + '-' + unit.unitNumber);

  // 4. Create a Resident User (email + password login)
  const passwordHash = await bcrypt.hash('resident123', 10);

  const residentUser = await prisma.user.upsert({
    where: { email: 'resident@test.com' },
    update: { passwordHash },
    create: {
      id: 'user-resident-001',
      phone: '+919876543210',
      email: 'resident@test.com',
      passwordHash,
      role: 'RESIDENT',
      isActive: true,
    },
  });
  console.log('Resident User:', residentUser.email);

  // 5. Create Resident profile
  const resident = await prisma.resident.upsert({
    where: { userId: residentUser.id },
    update: {},
    create: {
      id: 'res-dev-001',
      userId: residentUser.id,
      unitId: unit.id,
      name: 'Test Resident',
      isPrimary: true,
    },
  });
  console.log('Resident Profile:', resident.name);

  // 6. Create a Guard User
  const guardPasswordHash = await bcrypt.hash('guard123', 10);

  const guardUser = await prisma.user.upsert({
    where: { email: 'guard@test.com' },
    update: { passwordHash: guardPasswordHash },
    create: {
      id: 'user-guard-001',
      phone: '+919876543211',
      email: 'guard@test.com',
      passwordHash: guardPasswordHash,
      role: 'GUARD',
      isActive: true,
    },
  });
  console.log('Guard User:', guardUser.email);

  // 7. Create Guard profile
  const guard = await prisma.guard.upsert({
    where: { userId: guardUser.id },
    update: {},
    create: {
      id: 'guard-dev-001',
      userId: guardUser.id,
      propertyId: property.id,
      name: 'Test Guard',
      badgeNumber: 'G-001',
    },
  });
  console.log('Guard Profile:', guard.name);

  console.log('\nSeed completed!');
  console.log('Test Credentials:');
  console.log('  Resident: resident@test.com / resident123');
  console.log('  Guard:    guard@test.com    / guard123');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
