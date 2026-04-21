const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runRepair() {
    console.log('--- STARTING DATABASE REPAIR SCRIPT ---');
    
    try {
        // 1. Identify AcademicYear table variation
        const rawTables = await prisma.$queryRawUnsafe('SHOW TABLES');
        const tables = rawTables.map(t => Object.values(t)[0]);
        const targetTable = tables.find(t => 
            t.toLowerCase() === 'academicyear' || 
            t.toLowerCase() === 'academic_year'
        );

        if (!targetTable) {
            console.error('CRITICAL: AcademicYear table not found in database!');
            return;
        }

        console.log(`Target table identified: ${targetTable}`);

        // 2. Check for columns
        const columns = await prisma.$queryRawUnsafe(`DESCRIBE \`${targetTable}\``);
        const hasStartDate = columns.some(c => c.Field.toLowerCase() === 'startdate');
        const hasEndDate = columns.some(c => c.Field.toLowerCase() === 'enddate');

        // 3. Add columns if missing
        if (!hasStartDate) {
            console.log(`Adding startDate column to ${targetTable}...`);
            await prisma.$executeRawUnsafe(`ALTER TABLE \`${targetTable}\` ADD COLUMN startDate DATETIME NULL`);
            console.log('SUCCESS: startDate column added.');
        } else {
            console.log('Column startDate already exists.');
        }

        if (!hasEndDate) {
            console.log(`Adding endDate column to ${targetTable}...`);
            await prisma.$executeRawUnsafe(`ALTER TABLE \`${targetTable}\` ADD COLUMN endDate DATETIME NULL`);
            console.log('SUCCESS: endDate column added.');
        } else {
            console.log('Column endDate already exists.');
        }

        console.log('--- DATABASE REPAIR COMPLETE ---');
    } catch (error) {
        console.error('FATAL REPAIR ERROR:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

// Export for inclusion in index.js or direct execution
if (require.main === module) {
    runRepair();
}

module.exports = { runRepair };
