const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        // Find MIT Unit
        const unit = await prisma.unit.findFirst({
            where: { name: { contains: 'MIT' } }
        });
        
        if (!unit) {
            console.log('MIT Unit not found');
            return;
        }
        
        console.log(`MIT Unit ID: ${unit.id}`);
        
        // Find pending budget requests for MIT
        const reqs = await prisma.budgetRequest.findMany({
            where: { unitId: unit.id, status: 'PENDING' }
        });
        
        console.log(`Found ${reqs.length} PENDING budget requests for MIT`);
        
        if (reqs.length > 0) {
            const req = reqs[0];
            console.log(`Attempting to update ${req.id} to APPROVED...`);
            
            // Replicate exactly what the PUT route does
            const data = {
                status: 'APPROVED',
                notified: false
            };
            
            const updated = await prisma.budgetRequest.update({
                where: { id: req.id },
                data
            });
            
            console.log(`Update successful! New status: ${updated.status}`);
            
            // Revert back for safety
            await prisma.budgetRequest.update({
                where: { id: req.id },
                data: { status: 'PENDING' }
            });
            console.log(`Reverted back to PENDING`);
        }
    } catch (e) {
        console.error('ERROR:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}
main();
