process.env.DATABASE_URL = "mysql://mysql:7dff32cee8db81c86c80@127.0.0.1:3306/dion";
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testDiskon() {
    try {
        console.log('Testing budget_reports diskon column...');
        const report = await prisma.budgetReport.findFirst({
            where: { isDeleted: false }
        });
        console.log('Sample BudgetReport from DB:', report ? { id: report.id, amount: report.amount, diskon: report.diskon } : 'No reports found');
    } catch (err) {
        console.error('Error querying BudgetReport:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

testDiskon();
