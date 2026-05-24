import { PrismaClient } from '@prisma/client';
process.env.DATABASE_URL = 'mysql://mysql:7dff32cee8db81c86c80@127.0.0.1:3306/dion';
const prisma = new PrismaClient();
async function main() {
    const settings = await prisma.distributionSetting.findMany();
    console.log(JSON.stringify(settings, null, 2));
}
main().finally(() => prisma.$disconnect());
