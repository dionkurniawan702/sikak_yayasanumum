
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('--- CHECKING FOR DELETED DISTRIBUTION SETTINGS ---');
        
        const deleted = await prisma.distributionSetting.findMany({
            where: { isDeleted: true },
            include: { incomeItem: true, expenseItem: true }
        });
        
        console.log(`Found ${deleted.length} soft-deleted records.`);
        if (deleted.length > 0) {
            deleted.forEach(d => {
                console.log(`  - Unit: ${d.unitId}, Income: ${d.incomeItem.name}, Expense: ${d.expenseItem.name}, %: ${d.percentage}`);
            });
        }

        console.log('--- CHECKING CURRENT ACTIVE TOTALS ---');
        const active = await prisma.distributionSetting.findMany({
            where: { isDeleted: false },
            include: { incomeItem: true }
        });
        
        const totals = {};
        active.forEach(s => {
            const key = `${s.unitId}|${s.incomeItem.name}`;
            if (!totals[key]) totals[key] = { sum: 0, count: 0 };
            totals[key].sum += parseFloat(s.percentage);
            totals[key].count++;
        });
        
        for (const key in totals) {
            if (totals[key].sum !== 100) {
                console.log(`[ALERT] ${key}: Total = ${totals[key].sum}% (${totals[key].count} rules)`);
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
