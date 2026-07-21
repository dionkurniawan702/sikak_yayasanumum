const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Connecting to database...');
        // Alter proof column to TEXT
        console.log('Altering journals.proof column to TEXT...');
        await prisma.$executeRawUnsafe('ALTER TABLE `journals` MODIFY COLUMN `proof` TEXT');
        console.log('SUCCESS: journals.proof has been altered to TEXT.');
    } catch (error) {
        console.error('ERROR altering journals.proof:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
