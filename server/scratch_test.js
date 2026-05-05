import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function test() {
  try {
    const existing = await prisma.user.findFirst({
        where: { 
            username: 'adminsdm', 
            isDeleted: false,
            id: { not: 'USR-xyz' }
        }
    });
    console.log('Result:', existing);
  } catch(e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}
test();
