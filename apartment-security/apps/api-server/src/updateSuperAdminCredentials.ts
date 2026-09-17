import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from './config/prisma';

async function updateCredentials() {
  const email = 'superadmin@demo.com';
  const password = 'Password123.';
  const passwordHash = await bcrypt.hash(password, 10);

  console.log(`Setting Super Admin user to ${email} / ${password}...`);

  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { email },
        { role: 'SUPER_ADMIN' as any },
      ],
    },
  });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        email,
        passwordHash,
        role: 'SUPER_ADMIN' as any,
        isActive: true,
        isEmailVerified: true,
      },
    });
    console.log(`✓ Updated existing Super Admin user (id: ${existing.id}) to ${email}`);
  } else {
    const created = await prisma.user.create({
      data: {
        email,
        phone: '9888888888',
        passwordHash,
        role: 'SUPER_ADMIN' as any,
        isActive: true,
        isEmailVerified: true,
      },
    });
    console.log(`✓ Created Super Admin user: id=${created.id}, email=${created.email}`);
  }

  console.log('------------------------------------------------');
  console.log('✅ Updated Super Admin Credentials:');
  console.log(`Email:    ${email}`);
  console.log(`Password: ${password}`);
  console.log('------------------------------------------------');
}

updateCredentials()
  .catch((err) => {
    console.error('Error updating credentials:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
