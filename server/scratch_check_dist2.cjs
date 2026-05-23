const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const units = await prisma.unit.findMany({
            where: { isDeleted: false },
            include: { field: true }
        });
        console.log(`Found ${units.length} units.`);

        const settings = await prisma.distributionSetting.findMany({
            where: { isDeleted: false },
            include: { incomeItem: true, expenseItem: true }
        });
        console.log(`Found ${settings.length} distribution settings.`);

        // Find the "Perawatan Sarpras" income item settings
        const sarprasSettings = settings.filter(s => s.incomeItem && s.incomeItem.name.includes("Perawatan Sarpras"));
        console.log(`Settings for 'Perawatan Sarpras':`);
        sarprasSettings.forEach(s => {
            console.log(`- Unit: ${s.unitId}, Expense: ${s.expenseItem?.name}, %: ${s.percentage}`);
        });

    } catch (e) {
        console.error("Error", e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
