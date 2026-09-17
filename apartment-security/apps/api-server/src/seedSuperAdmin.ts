import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from './config/prisma';
import { Role } from '@prisma/client';

async function seed() {
  const email = process.env.SUPER_ADMIN_EMAIL || 'admin@societysecurity.com';
  const phone = process.env.SUPER_ADMIN_PHONE || '9999999999';
  const password = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123';

  console.log(`Searching for existing user with email: ${email}...`);

  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { email },
        { phone },
      ],
    },
  });

  const passwordHash = await bcrypt.hash(password, 10);

  if (existing) {
    console.log(`User found with ID: ${existing.id}. Updating role to SUPER_ADMIN and refreshing password...`);
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: Role.SUPER_ADMIN,
        passwordHash,
        isActive: true,
        isEmailVerified: true,
      },
    });
    console.log(`✅ Updated existing user to SUPER_ADMIN!`);
  } else {
    console.log(`Creating new Super Admin user...`);
    const superAdmin = await prisma.user.create({
      data: {
        email,
        phone,
        passwordHash,
        role: Role.SUPER_ADMIN,
        isEmailVerified: true,
        isActive: true,
      },
    });
    console.log(`✅ Created Super Admin with ID: ${superAdmin.id}`);
  }

  console.log('-------------------------------------------');
  console.log('Super Admin Credentials:');
  console.log(`Email:    ${email}`);
  console.log(`Password: ${password}`);
  console.log('-------------------------------------------');
}

seed()
  .catch((e) => {
    console.error('❌ Failed to seed super admin:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
