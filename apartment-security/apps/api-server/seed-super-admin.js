const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function seedSuperAdmin() {
  const email = process.env.SUPER_ADMIN_EMAIL || 'admin@societysecurity.com';
  const phone = process.env.SUPER_ADMIN_PHONE || '9999999999';
  const password = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123';

  console.log(`Checking for existing Super Admin account (${email})...`);

  try {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { phone },
          { role: 'SUPER_ADMIN' },
        ],
      },
    });

    if (existing) {
      console.log(`Super Admin found: id=${existing.id}, email=${existing.email}, role=${existing.role}`);
      if (existing.role !== 'SUPER_ADMIN') {
        await prisma.user.update({
          where: { id: existing.id },
          data: { role: 'SUPER_ADMIN' },
        });
        console.log(`Updated user ${existing.email} to SUPER_ADMIN.`);
      }
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const superAdmin = await prisma.user.create({
      data: {
        email,
        phone,
        passwordHash,
        role: 'SUPER_ADMIN',
        isEmailVerified: true,
        isActive: true,
      },
    });

    console.log('✅ Created Super Admin account:');
    console.log(`   Email: ${email}`);
    console.log(`   Phone: ${phone}`);
    console.log(`   Password: ${password}`);
    console.log(`   ID: ${superAdmin.id}`);
  } catch (err) {
    console.error('Error in seedSuperAdmin:', err);
  } finally {
    await prisma.$disconnect();
  }
}

seedSuperAdmin();
