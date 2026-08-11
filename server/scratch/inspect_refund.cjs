process.env.DATABASE_URL = "mysql://mysql:7dff32cee8db81c86c80@127.0.0.1:3306/dion";
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    console.log("Searching for refund reports...");
    const reports = await prisma.budgetReport.findMany({
        where: {
            OR: [
                { amount: 2638020 },
                { description: { contains: 'SPTD' } },
                { kategoriAset: 'PENGEMBALIAN' }
            ]
        }
    });
    console.log("Reports found:", JSON.stringify(reports, null, 2));

    const reqs = await prisma.budgetRequest.findMany({
        select: {
            id: true,
            month: true,
            title: true,
            createdAt: true,
            unitId: true,
            fieldId: true,
            status: true
        }
    });
    console.log("All budget requests:", JSON.stringify(reqs, null, 2));
}

run()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
