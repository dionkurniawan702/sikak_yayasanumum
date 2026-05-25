const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const unit = await prisma.unit.findFirst({
            where: { name: { contains: 'MIT' } }
        });
        
        if (!unit) {
            console.log('MIT Unit not found');
            return;
        }
        
        console.log(`MIT Unit ID: ${unit.id}`);
        
        const reqs = await prisma.rabPlan.findMany({
            where: { unitId: unit.id }
        });
        
        console.log(`Found ${reqs.length} RAB Plans for MIT`);
        for (let req of reqs) {
            console.log(`Plan ID: ${req.id} - Status: ${req.status}`);
            if (req.status !== 'APPROVED') {
                console.log(`Updating ${req.id} to APPROVED...`);
                try {
                    const updated = await prisma.rabPlan.update({
                        where: { id: req.id },
                        data: { status: 'APPROVED', notified: false }
                    });
                    console.log(`Update successful! New status: ${updated.status}`);
                    
                    // Revert
                    await prisma.rabPlan.update({
                        where: { id: req.id },
                        data: { status: req.status }
                    });
                } catch (err) {
                    console.error(`Error updating ${req.id}:`, err.message);
                }
            }
        }
    } catch (e) {
        console.error('ERROR:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}
main();
