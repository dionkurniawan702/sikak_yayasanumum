import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkRequests() {
    try {
        console.log('--- Checking Budget Requests ---');
        const requests = await prisma.budgetRequest.findMany({
            include: { reports: true }
        });
        console.log(`Total Requests found: ${requests.length}`);
        requests.forEach(r => {
            console.log(`[${r.id}] Unit: ${r.unitId}, Year: ${r.academicYearId}, Status: ${r.status}, Amount: ${r.totalAmount}`);
            console.log(`    Items: ${JSON.stringify(r.items)}`);
        });

        console.log('\n--- Checking Budget Reports ---');
        const reports = await prisma.budgetReport.findMany();
        console.log(`Total Reports found: ${reports.length}`);
        reports.forEach(r => {
            console.log(`[${r.id}] Request: ${r.budgetRequestId}, Amount: ${r.amount}`);
        });

    } catch (error) {
        console.error('Error checking database:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkRequests();
