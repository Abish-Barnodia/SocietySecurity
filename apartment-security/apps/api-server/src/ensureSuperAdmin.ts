import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from './config/prisma';

async function main() {
  const email = 'superadmin@demo.com';
  const password = 'Password123.';
  const passwordHash = await bcrypt.hash(password, 10);

  console.log(`Updating password for ${email} to ${password}...`);

  const updated = await prisma.user.updateMany({
    where: { email },
    data: {
      passwordHash,
      role: 'SUPER_ADMIN' as any,
      isActive: true,
      isEmailVerified: true,
    },
  });

  console.log('Updated count:', updated.count);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error('User not found after update!');
    return;
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash!);
  console.log('Verification check for Password123.:', isMatch ? 'PASSED ✅' : 'FAILED ❌');
  console.log('User status:', { id: user.id, email: user.email, role: user.role, isActive: user.isActive });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
