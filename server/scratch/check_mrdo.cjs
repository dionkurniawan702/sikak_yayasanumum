const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const req = await prisma.budgetRequest.findFirst({
        where: { id: { contains: 'MRDO' } }
    });
    console.log('REQUEST:', req?.id, 'Month:', req?.month, 'Status:', req?.status, 'UnitId:', req?.unitId);

    const reports = await prisma.budgetReport.findMany({
        where: { budgetRequestId: req?.id }
    });
    console.log('REPORTS COUNT:', reports.length);
    console.log('REPORTS STATUSES:', reports.map(r => ({ id: r.id, status: r.status, isDeleted: r.isDeleted, date: r.date, amount: r.amount })));
}

main().finally(() => prisma.$disconnect());
