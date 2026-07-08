process.env.DATABASE_URL = "mysql://mysql:7dff32cee8db81c86c80@127.0.0.1:3306/dion";
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        console.log('--- UNITS education ---');
        const units = await prisma.unit.findMany({ where: { isDeleted: false } });
        console.table(units.map(u => ({ id: u.id, name: u.name })));

        console.log('\n--- INCOME ITEMS ---');
        const incomeItems = await prisma.incomeItem.findMany({ where: { isDeleted: false } });
        console.table(incomeItems.map(i => ({ id: i.id, name: i.name })));

        console.log('\n--- EXPENSE ITEMS ---');
        const expenseItems = await prisma.expenseItem.findMany({ where: { isDeleted: false } });
        console.table(expenseItems.map(e => ({ id: e.id, name: e.name, fieldId: e.fieldId, unitId: e.unitId })));

        console.log('\n--- CURRENT DISTRIBUTION SETTINGS ---');
        const settings = await prisma.distributionSetting.findMany({ where: { isDeleted: false } });
        console.table(settings.map(s => ({
            id: s.id,
            unitId: s.unitId,
            academicYearId: s.academicYearId,
            incomeItemId: s.incomeItemId,
            expenseItemId: s.expenseItemId,
            destId: s.destId,
            destType: s.destType,
            percentage: s.percentage.toString()
        })));

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

check();
