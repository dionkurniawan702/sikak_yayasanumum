
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Checking Unit table...');
        const units = await prisma.unit.findMany({
            include: { field: true }
        });
        console.log(`Found ${units.length} units.`);
        
        const orphans = units.filter(u => !u.field);
        if (orphans.length > 0) {
            console.warn(`Found ${orphans.length} units with missing fieldId references!`);
            orphans.forEach(u => console.log(`- Unit: ${u.name} (ID: ${u.id}, FieldID: ${u.fieldId})`));
        } else {
            console.log('No orphaned units found.');
        }

        console.log('Checking for unique constraint violations...');
        const duplicates = await prisma.$queryRaw`
            SELECT fieldId, name, COUNT(*) as count 
            FROM units 
            WHERE isDeleted = 0 
            GROUP BY fieldId, name 
            HAVING count > 1
        `;
        console.log('Duplicates (should be empty):', duplicates);

    } catch (error) {
        console.error('Error during diagnostic:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
