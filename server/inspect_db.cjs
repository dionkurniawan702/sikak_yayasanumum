const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- DATABASE INSPECTION ---');
    
    // 1. List all tables
    const tables = await prisma.$queryRaw`SHOW TABLES`;
    console.log('Tables:', JSON.stringify(tables, null, 2));

    // 2. Describe Units table
    try {
        const columns = await prisma.$queryRaw`DESCRIBE units`;
        console.log('Units Columns:', JSON.stringify(columns, null, 2));
    } catch (e) {
        console.log('Units Columns fetch failed (maybe table case is different)');
    }

    // 3. Describe Field table
    try {
        const columns = await prisma.$queryRaw`DESCRIBE fields`;
        console.log('Fields Columns:', JSON.stringify(columns, null, 2));
    } catch (e) {
        console.log('Fields Columns fetch failed');
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
