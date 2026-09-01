import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        const taudUnit = await prisma.unit.findFirst({
            where: { name: { contains: 'TAUD' } }
        });
        console.log('TAUD Unit in DB:', taudUnit);

        if (!taudUnit) {
            console.log('TAUD unit not found');
            return;
        }

        const reqs = await prisma.budgetRequest.findMany({
            where: { unitId: taudUnit.id, isDeleted: false }
        });

        console.log(`Found ${reqs.length} budget requests for TAUD:`);
        reqs.forEach(r => {
            console.log(`\nREQ ID: ${r.id} | Month: ${r.month} | Total: ${r.totalAmount} | Status: ${r.status} | Items count: ${Array.isArray(r.items) ? r.items.length : 0}`);
            if (Array.isArray(r.items)) {
                r.items.forEach((item, i) => {
                    console.log(`  [Item ${i}] name="${item.name}", vol=${item.volume}, harga=${item.harga}, amount=${item.amount}, componentId="${item.componentId}"`);
                });
            }
        });

        const reports = await prisma.budgetReport.findMany({
            where: { unitId: taudUnit.id, isDeleted: false }
        });

        console.log(`\nFound ${reports.length} budget reports for TAUD:`);
        reports.forEach(rep => {
            console.log(`Report ID: ${rep.id} | reqId: ${rep.budgetRequestId} | componentId: ${rep.componentId} | category: "${rep.category}" | desc: "${rep.description}" | amount: ${rep.amount}`);
        });

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
