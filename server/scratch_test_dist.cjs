const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const units = await prisma.unit.findMany({ take: 1 });
        const incomeItems = await prisma.incomeItem.findMany({ take: 1 });
        const expenseItems = await prisma.expenseItem.findMany({ take: 1 });

        if (!units.length || !incomeItems.length || !expenseItems.length) {
            console.log("Missing data");
            return;
        }

        const unitId = units[0].id;
        const incomeItemId = incomeItems[0].id;
        const expenseItemId = expenseItems[0].id;

        console.log({ unitId, incomeItemId, expenseItemId });

        const result = await prisma.$transaction([
            prisma.distributionSetting.deleteMany({
                where: { unitId }
            }),
            prisma.distributionSetting.createMany({
                data: [{
                    unitId,
                    incomeItemId,
                    expenseItemId,
                    destId: unitId,
                    destType: 'unit',
                    destName: 'Test Unit',
                    percentage: parseFloat("30") || 0
                }]
            })
        ]);
        console.log("Success", result);
    } catch (e) {
        console.error("Error", e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
