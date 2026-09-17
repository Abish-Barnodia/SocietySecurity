import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from './config/prisma';

async function migrate() {
  console.log('Running non-destructive schema sync...');

  try {
    // 1. Add SUPER_ADMIN to Role enum if not exists
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type t 
          JOIN pg_enum e ON t.oid = e.enumtypid 
          WHERE t.typname = 'Role' AND e.enumlabel = 'SUPER_ADMIN'
        ) THEN
          ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN';
        END IF;
      END
      $$;
    `);
    console.log('✓ Added SUPER_ADMIN to Role enum');

    // 2. Create SocietyStatus enum if not exists
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SocietyStatus') THEN
          CREATE TYPE "SocietyStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'EXPIRED');
        END IF;
      END
      $$;
    `);
    console.log('✓ Created SocietyStatus enum');

    // 3. Create DemoRequestStatus enum if not exists
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DemoRequestStatus') THEN
          CREATE TYPE "DemoRequestStatus" AS ENUM ('PENDING', 'CONTACTED', 'APPROVED', 'REJECTED', 'CONVERTED');
        END IF;
      END
      $$;
    `);
    console.log('✓ Created DemoRequestStatus enum');

    // 4. Add columns to Property table
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Property" 
      ADD COLUMN IF NOT EXISTS "slug" TEXT,
      ADD COLUMN IF NOT EXISTS "status" "SocietyStatus" DEFAULT 'ACTIVE',
      ADD COLUMN IF NOT EXISTS "email" TEXT,
      ADD COLUMN IF NOT EXISTS "phone" TEXT,
      ADD COLUMN IF NOT EXISTS "subscriptionPlan" TEXT DEFAULT 'STANDARD',
      ADD COLUMN IF NOT EXISTS "subscriptionExpiresAt" TIMESTAMP(3);
    `);
    
    // Add unique index on slug if not exists
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "Property_slug_key" ON "Property"("slug");
    `);
    console.log('✓ Updated Property table columns');

    // 5. Create DemoRequest table if not exists
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "DemoRequest" (
        "id" TEXT NOT NULL,
        "contactName" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "phone" TEXT NOT NULL,
        "societyName" TEXT NOT NULL,
        "city" TEXT,
        "numberOfUnits" INTEGER,
        "message" TEXT,
        "status" "DemoRequestStatus" NOT NULL DEFAULT 'PENDING',
        "notes" TEXT,
        "createdPropertyId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "DemoRequest_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "DemoRequest_createdPropertyId_fkey" FOREIGN KEY ("createdPropertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE
      );
    `);
    console.log('✓ Created DemoRequest table');

    // 6. Create PlatformAuditLog table if not exists
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PlatformAuditLog" (
        "id" TEXT NOT NULL,
        "actorUserId" TEXT NOT NULL,
        "actorEmail" TEXT,
        "action" TEXT NOT NULL,
        "targetType" TEXT NOT NULL,
        "targetId" TEXT,
        "metadata" JSONB,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PlatformAuditLog_pkey" PRIMARY KEY ("id")
      );
      CREATE INDEX IF NOT EXISTS "PlatformAuditLog_createdAt_idx" ON "PlatformAuditLog"("createdAt");
    `);
    console.log('✓ Created PlatformAuditLog table');

    // 6.1 Create PlatformSetting table if not exists
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PlatformSetting" (
        "id" TEXT NOT NULL,
        "key" TEXT NOT NULL,
        "value" JSONB NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("id")
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "PlatformSetting_key_key" ON "PlatformSetting"("key");
    `);
    console.log('✓ Created PlatformSetting table');

    // 7. Seed / Update Super Admin user
    const email = 'admin@societysecurity.com';
    const phone = '9999999999';
    const password = 'SuperAdmin@123';
    const passwordHash = await bcrypt.hash(password, 10);

    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { phone }],
      },
    });

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          role: 'SUPER_ADMIN' as any,
          passwordHash,
          isActive: true,
          isEmailVerified: true,
        },
      });
      console.log(`✓ Updated existing account (${email}) to SUPER_ADMIN`);
    } else {
      const created = await prisma.user.create({
        data: {
          email,
          phone,
          passwordHash,
          role: 'SUPER_ADMIN' as any,
          isEmailVerified: true,
          isActive: true,
        },
      });
      console.log(`✓ Created Super Admin account: id=${created.id}`);
    }

    console.log('🎉 Database sync & Super Admin setup complete!');
    console.log('==================================================');
    console.log('Super Admin Credentials:');
    console.log(`Email:    ${email}`);
    console.log(`Password: ${password}`);
    console.log('==================================================');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

migrate();
