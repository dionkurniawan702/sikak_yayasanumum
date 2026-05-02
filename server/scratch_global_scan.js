
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('--- GLOBAL DISTRIBUTION SCAN ---');
        
        const all = await prisma.distributionSetting.findMany({
            include: { incomeItem: true, expenseItem: true }
        });
        
        console.log(`Total records in DB: ${all.length}`);
        
        const orphaned = all.filter(s => s.isDeleted);
        console.log(`Soft-deleted records: ${orphaned.length}`);
        
        // Find any active records that are not 100%
        const groups = {};
        all.filter(s => !s.isDeleted).forEach(s => {
            const key = `${s.unitId}|${s.incomeItem?.name || 'Unknown'}`;
            if (!groups[key]) groups[key] = { sum: 0, items: [] };
            groups[key].sum += parseFloat(s.percentage);
            groups[key].items.push(s);
        });
        
        for (const key in groups) {
            if (groups[key].sum !== 100) {
                console.log(`Unit/Income ${key}: ${groups[key].sum}%`);
                groups[key].items.forEach(i => {
                    console.log(`  - ${i.expenseItem?.name}: ${i.percentage}%`);
                });
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
