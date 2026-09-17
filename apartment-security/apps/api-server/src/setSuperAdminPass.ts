import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from './config/prisma';

async function fixPassword() {
  const email = 'superadmin@demo.com';
  const password = 'Password123';
  const passwordHash = await bcrypt.hash(password, 10);

  console.log(`Setting password to "${password}" for ${email}...`);

  await prisma.user.updateMany({
    where: {
      email: { equals: email, mode: 'insensitive' },
    },
    data: {
      email: 'superadmin@demo.com',
      passwordHash,
      role: 'SUPER_ADMIN' as any,
      isActive: true,
      isEmailVerified: true,
    },
  });

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  });

  console.log('User in DB:', {
    id: user?.id,
    email: user?.email,
    role: user?.role,
    isActive: user?.isActive,
  });

  console.log('Test "Password123":', await bcrypt.compare('Password123', user?.passwordHash || ''));
  console.log('Test "Password123.":', await bcrypt.compare('Password123.', user?.passwordHash || ''));
}

fixPassword()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
