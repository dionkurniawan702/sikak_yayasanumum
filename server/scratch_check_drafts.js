import { PrismaClient } from '@prisma/client';

process.env.DATABASE_URL = "mysql://mysql:7dff32cee8db81c86c80@127.0.0.1:3306/dion";
const prisma = new PrismaClient();

async function main() {
    console.log('--- Checking Budget Reports in Database ---');
    try {
        const reports = await prisma.budgetReport.findMany();
        console.log(`Total Reports: ${reports.length}`);
        
        const drafts = reports.filter(r => r.status === 'DRAFT');
        console.log(`Draft Reports (${drafts.length}):`);
        drafts.forEach(r => {
            console.log(`- [${r.id}] Category: ${r.category}, Description: ${r.description}, Amount: ${r.amount}, Unit: ${r.unitId}`);
        });

        const pending = reports.filter(r => r.status === 'PENDING');
        console.log(`\nPending Reports (${pending.length}):`);
        pending.forEach(r => {
            console.log(`- [${r.id}] Category: ${r.category}, Description: ${r.description}, Amount: ${r.amount}, Unit: ${r.unitId}`);
        });

    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
