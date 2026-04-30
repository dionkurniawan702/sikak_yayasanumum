import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function cleanRabPlans() {
    console.log('=== STARTING RAB_PLANS CLEANUP (ESM) ===');
    
    try {
        const allPlans = await prisma.rabPlan.findMany();
        console.log(`Found ${allPlans.length} total plans.`);

        // Group by Unit and Academic Year
        const groups = {};
        allPlans.forEach(p => {
            const key = `${p.academicYearId}|${p.unitId || 'FIELD-' + p.fieldId}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(p);
        });

        let deletedCount = 0;

        for (const [key, records] of Object.entries(groups)) {
            if (records.length > 1) {
                console.log(`\nDuplicate found for group: ${key}`);
                
                // Sort: 1. APPROVED, 2. RECENT
                const sorted = records.sort((a, b) => {
                    if (a.status === 'APPROVED' && b.status !== 'APPROVED') return -1;
                    if (b.status === 'APPROVED' && a.status !== 'APPROVED') return 1;
                    return new Date(b.updatedAt) - new Date(a.updatedAt);
                });

                const keep = sorted[0];
                const toDelete = sorted.slice(1);

                console.log(`  + KEEPING: ID=${keep.id}, Status=${keep.status}, Updated=${keep.updatedAt}`);
                
                for (const target of toDelete) {
                    console.log(`  - DELETING: ID=${target.id}, Status=${target.status}, Updated=${target.updatedAt}`);
                    await prisma.rabPlan.delete({ where: { id: target.id } });
                    deletedCount++;
                }
            }
        }

        console.log(`\nCleanup finished. Deleted ${deletedCount} duplicate records.`);
    } catch (err) {
        console.error('Error during cleanup:', err);
    } finally {
        await prisma.$disconnect();
    }
}

cleanRabPlans();
