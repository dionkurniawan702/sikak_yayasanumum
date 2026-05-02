
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Checking for Duplicate Distribution Settings...');
        
        // Find duplicates based on unitId, incomeItemId, and expenseItemId
        const dists = await prisma.distributionSetting.findMany({
            where: { isDeleted: false }
        });
        
        const counts = {};
        const duplicates = [];
        
        dists.forEach(d => {
            const key = `${d.unitId}-${d.incomeItemId}-${d.expenseItemId}-${d.destId}`;
            if (!counts[key]) {
                counts[key] = [];
            }
            counts[key].push(d);
        });
        
        for (const key in counts) {
            if (counts[key].length > 1) {
                duplicates.push({
                    key,
                    count: counts[key].length,
                    ids: counts[key].map(d => d.id)
                });
            }
        }
        
        console.log(`Found ${duplicates.length} duplicate sets.`);
        if (duplicates.length > 0) {
            console.log('First 5 duplicates:', duplicates.slice(0, 5));
            
            // OPTIONAL: Cleanup logic (commented out for safety)
            /*
            console.log('Cleaning up...');
            for (const dup of duplicates) {
                const toKeep = dup.ids[0];
                const toDelete = dup.ids.slice(1);
                await prisma.distributionSetting.deleteMany({
                    where: { id: { in: toDelete } }
                });
            }
            console.log('Cleanup complete.');
            */
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
