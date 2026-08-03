process.env.DATABASE_URL = "mysql://mysql:7dff32cee8db81c86c80@127.0.0.1:3306/dion";
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const units = await prisma.unit.findMany();
    console.log('Units:', units.map(u => ({ id: u.id, name: u.name })));

    const mit = units.find(u => u.name.toLowerCase().includes('mit'));
    if (!mit) {
        console.log('No unit found matching "mit"');
    } else {
        console.log('\nFound MIT Unit:', mit);
    }

    const requests = await prisma.budgetRequest.findMany({
        orderBy: { date: 'desc' }
    });
    console.log('\n--- BUDGET REQUESTS (Total: ' + requests.length + ') ---');
    requests.forEach(r => {
        console.log(`ID: ${r.id} | Unit: ${r.unitId} | Month: ${r.month} | Status: ${r.status} | Total: ${r.totalAmount || r.amount}`);
        if (r.items) {
            console.log('  Items:', JSON.stringify(r.items, null, 2));
        }
    });

    const reports = await prisma.budgetReport.findMany({
        orderBy: { date: 'desc' }
    });
    console.log('\n--- BUDGET REPORTS (Total: ' + reports.length + ') ---');
    reports.forEach(r => {
        console.log(`ID: ${r.id} | ReqID: ${r.budgetRequestId} | Unit: ${r.unitId} | Date: ${r.date} | Category: ${r.category} | Desc: ${r.description} | Status: ${r.status}`);
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
