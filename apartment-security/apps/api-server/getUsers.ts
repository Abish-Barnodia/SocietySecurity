import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany({ select: { email: true, role: true, phone: true }, take: 10 });
  console.log(users);
}
main().catch(console.error).finally(() => prisma.$disconnect());
