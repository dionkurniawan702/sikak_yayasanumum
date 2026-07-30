process.env.DATABASE_URL = "mysql://mysql:7dff32cee8db81c86c80@127.0.0.1:3306/dion";
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addDiskonColumn() {
    try {
        console.log('Checking budget_reports table schema...');
        const columns = await prisma.$queryRawUnsafe(`DESCRIBE \`budget_reports\``);
        const hasDiskon = columns.some(c => c.Field === 'diskon');

        if (!hasDiskon) {
            console.log('Adding diskon column to budget_reports...');
            await prisma.$executeRawUnsafe(`ALTER TABLE \`budget_reports\` ADD COLUMN diskon DECIMAL(15,2) NULL`);
            console.log('SUCCESS: Column diskon added to budget_reports table.');
        } else {
            console.log('Column diskon already exists in budget_reports table.');
        }
    } catch (err) {
        console.error('Error modifying budget_reports schema:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

addDiskonColumn();
