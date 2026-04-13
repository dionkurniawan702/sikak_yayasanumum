const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- FETCHING ALL UNITS FROM DATABASE ---');
    const units = await prisma.unit.findMany({
        include: {
            field: true
        }
    });
    console.log(JSON.stringify(units, null, 2));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
