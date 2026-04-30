import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkPrograms() {
    try {
        console.log('--- Checking Programs ---');
        const programs = await prisma.program.findMany();
        console.log(`Total Programs found: ${programs.length}`);
        programs.forEach(p => {
            console.log(`ID: "${p.id}", Name: "${p.name}"`);
        });
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkPrograms();
