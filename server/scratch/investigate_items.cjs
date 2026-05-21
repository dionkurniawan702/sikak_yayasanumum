const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const fields = await prisma.field.findMany({
        where: { isDeleted: false },
        orderBy: { createdAt: 'asc' }
    });
    console.log("Fields:");
    fields.forEach((f, idx) => console.log(`[${idx}] ${f.id} - ${f.name}`));

    const expenseItems = await prisma.expenseItem.findMany({
        where: {
            OR: [
                { name: { contains: 'Penggajian' } },
                { name: { contains: 'Pengembangan' } }
            ],
            isDeleted: false
        }
    });
    console.log("\nExpense Items:");
    expenseItems.forEach(e => console.log(`${e.id} - ${e.name} (fieldId: ${e.fieldId}, unitId: ${e.unitId})`));

    const distributionSettings = await prisma.distributionSetting.findMany({
        where: {
            expenseItemId: { in: expenseItems.map(e => e.id) },
        },
        include: {
            unit: true,
            incomeItem: true
        }
    });
    console.log("\nDistribution Settings:");
    distributionSettings.forEach(d => {
        console.log(`From Unit ${d.unit.name} (Income: ${d.incomeItem.name}) -> DestType: ${d.destType}, DestId: ${d.destId}, ExpenseItem: ${d.expenseItemId}, Percent: ${d.percentage}%`);
    });

  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
