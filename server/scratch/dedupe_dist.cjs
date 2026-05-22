const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    console.log('Starting deduplication...');
    const settings = await prisma.distributionSetting.findMany({
        where: { isDeleted: false }
    });
    
    const seen = new Set();
    const toDelete = [];
    
    for (const s of settings) {
        const key = `${s.unitId}|${s.incomeItemId}|${s.destId}|${s.destType}|${s.expenseItemId}|${s.percentage}`;
        if (seen.has(key)) {
            toDelete.push(s.id);
        } else {
            seen.add(key);
        }
    }
    
    console.log(`Found ${toDelete.length} duplicates.`);
    if (toDelete.length > 0) {
        const res = await prisma.distributionSetting.deleteMany({
            where: { id: { in: toDelete } }
        });
        console.log(`Deleted ${res.count} duplicates.`);
    }
}

run()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
