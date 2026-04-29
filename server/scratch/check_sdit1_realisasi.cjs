const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // 1. Cari semua unit yang namanya mengandung "SDIT"
    const units = await prisma.unit.findMany({
        where: { name: { contains: 'SDIT' } }
    });
    console.log('Units SDIT:', JSON.stringify(units.map(u => ({ id: u.id, name: u.name })), null, 2));

    if (units.length === 0) {
        console.log('Tidak ada unit SDIT ditemukan!');
        return;
    }

    const unitIds = units.map(u => u.id);

    // 2. Cari semua BudgetReport milik unit-unit SDIT tersebut
    const reports = await prisma.budgetReport.findMany({
        where: { unitId: { in: unitIds } },
        select: {
            id: true,
            unitId: true,
            status: true,
            totalAmount: true,
            createdAt: true,
            academicYearId: true,
        }
    });

    console.log(`\nTotal BudgetReport SDIT: ${reports.length}`);
    console.log(JSON.stringify(reports, null, 2));

    // 3. Cari BudgetRequest milik unit-unit SDIT
    const requests = await prisma.budgetRequest.findMany({
        where: { unitId: { in: unitIds } },
        select: {
            id: true,
            unitId: true,
            status: true,
            totalAmount: true,
            createdAt: true,
        }
    });

    console.log(`\nTotal BudgetRequest SDIT: ${requests.length}`);
    console.log(JSON.stringify(requests, null, 2));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
