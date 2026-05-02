
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('--- DISTRIBUTION SETTINGS DEDUPLICATION ---');
        
        const allSettings = await prisma.distributionSetting.findMany({
            where: { isDeleted: false }
        });
        
        console.log(`Found total ${allSettings.length} active settings.`);
        
        const groups = {};
        allSettings.forEach(s => {
            // Group by unit, income, expense, and destination
            const key = `${s.unitId}|${s.incomeItemId}|${s.expenseItemId}|${s.destId}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(s);
        });
        
        let deletedCount = 0;
        const toDelete = [];
        
        for (const key in groups) {
            const list = groups[key];
            if (list.length > 1) {
                console.log(`Found ${list.length} duplicates for key: ${key}`);
                // Keep the first one, delete the rest
                const keep = list[0];
                const others = list.slice(1);
                others.forEach(o => toDelete.push(o.id));
            }
        }
        
        if (toDelete.length > 0) {
            console.log(`Deleting ${toDelete.length} duplicate records...`);
            await prisma.distributionSetting.deleteMany({
                where: { id: { in: toDelete } }
            });
            console.log('Deletion successful.');
        } else {
            console.log('No exact duplicates found based on fields.');
            
            // SECOND CHECK: Check if the sum for each (unit, income) is exactly 200%
            const sumGroups = {};
            allSettings.forEach(s => {
                const key = `${s.unitId}|${s.incomeItemId}`;
                if (!sumGroups[key]) sumGroups[key] = { sum: 0, items: [] };
                sumGroups[key].sum += parseFloat(s.percentage);
                sumGroups[key].items.push(s);
            });
            
            for (const key in sumGroups) {
                const g = sumGroups[key];
                if (g.sum > 105) { // More than 100% (allowing for some float issues)
                    console.log(`Unit/Income ${key} has total percentage: ${g.sum}% (${g.items.length} items)`);
                }
            }
        }

    } catch (error) {
        console.error('Error during deduplication:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
