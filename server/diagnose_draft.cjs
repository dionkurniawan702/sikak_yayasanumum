const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- DIAGNOSIS: BudgetReport Status ---');
    
    // 1. Check Columns in budget_reports
    try {
        const columns = await prisma.$queryRaw`DESCRIBE budget_reports`;
        console.log('BudgetReport Columns:', JSON.stringify(columns, null, 2));
        
        const hasStatus = columns.some(c => c.Field === 'status');
        if (hasStatus) {
            console.log('✅ Status field exists in SQL database.');
        } else {
            console.log('❌ Status field IS MISSING from SQL database.');
        }
    } catch (e) {
        console.log('Error fetching columns:', e.message);
    }

    // 2. Check Data in budget_reports
    try {
        const reports = await prisma.budgetReport.findMany({
            take: 10,
            orderBy: { createdAt: 'desc' }
        });
        console.log('Recent 10 Reports Data (Raw):', JSON.stringify(reports, null, 2));
    } catch (e) {
        console.log('Error fetching data:', e.message);
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
