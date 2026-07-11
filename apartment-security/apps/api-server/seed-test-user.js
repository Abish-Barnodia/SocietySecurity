const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function seed() {
  try {
    const hash = await bcrypt.hash('password123', 10);
    
    let property = await prisma.property.findFirst();
    if (!property) {
      property = await prisma.property.create({
        data: {
          name: 'Test Property',
          address: '123 Test St',
          city: 'Testville',
          pincode: '12345',
          totalUnits: 100
        }
      });
    }

    let unit = await prisma.unit.findFirst({ where: { propertyId: property.id } });
    if (!unit) {
      unit = await prisma.unit.create({
        data: {
          propertyId: property.id,
          unitNumber: '101',
          floor: 1,
          tower: 'A',
          isOccupied: true
        }
      });
    }

    const user = await prisma.user.upsert({
      where: { email: 'test@example.com' },
      update: { passwordHash: hash, isEmailVerified: true },
      create: {
        email: 'test@example.com',
        passwordHash: hash,
        role: 'RESIDENT',
        isEmailVerified: true
      }
    });

    await prisma.resident.upsert({
      where: { userId: user.id },
      update: { unitId: unit.id, name: 'Test Resident' },
      create: {
        userId: user.id,
        unitId: unit.id,
        name: 'Test Resident',
        isPrimary: true
      }
    });

    console.log('Test user created successfully!');
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
