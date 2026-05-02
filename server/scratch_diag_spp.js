
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('--- DIAGNOSING SPP DISTRIBUTION ---');
        
        const sppItem = await prisma.incomeItem.findFirst({ where: { name: 'SPP' } });
        if (!sppItem) {
            console.log('Income Item "SPP" not found.');
            return;
        }
        
        const dists = await prisma.distributionSetting.findMany({
            where: { incomeItemId: sppItem.id, isDeleted: false },
            include: { incomeItem: true, expenseItem: true }
        });
        
        console.log(`Found ${dists.length} rules for SPP across all units.`);
        
        // Group by unit
        const byUnit = {};
        dists.forEach(d => {
            if (!byUnit[d.unitId]) byUnit[d.unitId] = [];
            byUnit[d.unitId].push(d);
        });
        
        for (const unitId in byUnit) {
            const rules = byUnit[unitId];
            const sum = rules.reduce((s, r) => s + parseFloat(r.percentage), 0);
            console.log(`Unit ${unitId}: Sum = ${sum}% (${rules.length} rules)`);
            rules.forEach(r => {
                console.log(`  - ID: ${r.id}, Expense: ${r.expenseItem.name}, Dest: ${r.destId}, %: ${r.percentage}`);
            });
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
