import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const classes = await prisma.class.findMany({ where: { isDeleted: false } });
  console.log('Classes:', JSON.stringify(classes, null, 2));
}
main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
