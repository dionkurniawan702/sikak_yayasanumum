const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const keys = Object.keys(prisma).filter(k => !k.startsWith('_') && !k.startsWith('$'));
    console.log("Prisma Client Models:", JSON.stringify(keys, null, 2));
    await prisma.$disconnect();
}

main();
