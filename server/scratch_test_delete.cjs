const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testDelete() {
    try {
        // Try to delete a parent status that might have relations
        const status = await prisma.parentStatus.findFirst();
        if (!status) {
            console.log('No parent status found to test.');
            return;
        }
        
        console.log(`Attempting to delete parent status: ${status.name} (${status.id})`);
        
        try {
            await prisma.parentStatus.delete({ where: { id: status.id } });
            console.log('Delete successful!');
        } catch (e) {
            console.error('Delete failed as expected (if relations exist):', e.message);
        }
    } catch (err) {
        console.error('Test error:', err);
    } finally {
        await prisma.$disconnect();
    }
}

testDelete();
