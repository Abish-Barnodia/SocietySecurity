require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

(async () => {
  const entries = await prisma.entry.findMany({
    where: { method: 'MANUAL_GUARD' },
    orderBy: { createdAt: 'desc' },
    take: 3,
    include: { unit: { select: { unitNumber: true, tower: true } }, alerts: true },
  });
  console.log(JSON.stringify(entries, null, 2));
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
