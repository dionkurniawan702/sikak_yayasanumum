const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Connecting to database via Prisma...');
        
        // Find TKIT 2 unit
        const units = await prisma.$queryRaw`SELECT * FROM units WHERE LOWER(name) LIKE '%tkit 2%'`;
        if (!units || units.length === 0) {
            console.error('TKIT 2 unit not found');
            return;
        }
        const unitId = units[0].id;
        console.log(`TKIT 2 Unit ID: ${unitId}`);

        // Find June REQ ID for TKIT 2
        const juneReqs = await prisma.$queryRaw`SELECT * FROM budget_requests WHERE unitId = ${unitId} AND (month = '2026-06' OR month = 'Juni 2026')`;
        if (!juneReqs || juneReqs.length === 0) {
            console.error('June REQ not found');
            return;
        }
        const juneReqId = juneReqs[0].id;
        const juneItemsJson = juneReqs[0].items;
        let juneItems = [];
        try {
            juneItems = typeof juneItemsJson === 'string' ? JSON.parse(juneItemsJson) : (juneItemsJson || []);
        } catch (e) {}

        const juneItemNames = new Set(juneItems.map(i => (i.name || '').trim().toLowerCase()));
        console.log(`June REQ ID: ${juneReqId} (${juneItemNames.size} items)`);

        // Find all budget reports for TKIT 2 that are not linked to juneReqId and not deleted
        const allReports = await prisma.$queryRaw`SELECT * FROM budget_reports WHERE unitId = ${unitId} AND isDeleted = 0`;
        console.log(`Total active TKIT 2 reports in DB: ${allReports.length}`);

        const misplacedIds = [];
        allReports.forEach(r => {
            if (r.budgetRequestId === juneReqId || r.requestId === juneReqId) return;
            const catName = (r.category || r.description || '').trim().toLowerCase();
            if (juneItemNames.has(catName)) {
                misplacedIds.push(r.id);
            }
        });

        console.log(`Found ${misplacedIds.length} misplaced reports in DB to relink to June REQ [${juneReqId}].`);

        if (misplacedIds.length > 0) {
            for (const id of misplacedIds) {
                await prisma.$executeRaw`UPDATE budget_reports SET budgetRequestId = ${juneReqId}, requestId = ${juneReqId} WHERE id = ${id}`;
            }
            console.log('Successfully updated budget_reports table in DB!');
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
