import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from './config/prisma';

async function check() {
  const users = await prisma.user.findMany();
  console.log('All users in DB:');
  for (const u of users) {
    const isPassword123 = u.passwordHash ? await bcrypt.compare('Password123.', u.passwordHash) : false;
    const isSuperAdmin123 = u.passwordHash ? await bcrypt.compare('SuperAdmin@123', u.passwordHash) : false;
    console.log({
      id: u.id,
      email: u.email,
      phone: u.phone,
      role: u.role,
      isActive: u.isActive,
      matches_Password123: isPassword123,
      matches_SuperAdmin123: isSuperAdmin123,
    });
  }
}

check()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
