const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixSchema() {
  const models = [
    { name: 'AcademicYear', table: 'AcademicYear' },
    { name: 'ClassGroup', table: 'class_groups' },
    { name: 'Position', table: 'positions' },
    { name: 'StudentStatus', table: 'StudentStatus' },
    { name: 'ParentStatus', table: 'ParentStatus' },
    { name: 'BosStage', table: 'bos_stages' },
    { name: 'BosPos', table: 'bos_pos' },
    { name: 'Unit', table: 'units' },
    { name: 'Field', table: 'fields' },
    { name: 'Class', table: 'Class' },
    { name: 'Student', table: 'Student' },
    { name: 'BosAllocation', table: 'bos_allocations' }
  ];

  console.log('--- STARTING DATABASE SCHEMA FIX ---');

  for (const m of models) {
    try {
      console.log(`Checking table: ${m.table}...`);
      const columns = await prisma.$queryRawUnsafe(`DESCRIBE \`${m.table}\``);
      const hasIsDeleted = columns.some(c => c.Field === 'isDeleted');

      if (!hasIsDeleted) {
        console.log(`Adding isDeleted to ${m.table}...`);
        await prisma.$executeRawUnsafe(`ALTER TABLE \`${m.table}\` ADD COLUMN isDeleted BOOLEAN DEFAULT FALSE`);
        console.log(`SUCCESS: isDeleted added to ${m.table}`);
      } else {
        console.log(`Table ${m.table} already has isDeleted column.`);
      }

      // Special check for AcademicYear Dates
      if (m.name === 'AcademicYear') {
        const hasStartDate = columns.some(c => c.Field === 'startDate');
        const hasEndDate = columns.some(c => c.Field === 'endDate');

        if (!hasStartDate) {
          console.log(`Adding startDate to ${m.table}...`);
          await prisma.$executeRawUnsafe(`ALTER TABLE \`${m.table}\` ADD COLUMN startDate DATETIME NULL`);
          console.log(`SUCCESS: startDate added to ${m.table}`);
        }
        if (!hasEndDate) {
          console.log(`Adding endDate to ${m.table}...`);
          await prisma.$executeRawUnsafe(`ALTER TABLE \`${m.table}\` ADD COLUMN endDate DATETIME NULL`);
          console.log(`SUCCESS: endDate added to ${m.table}`);
        }
      }
    } catch (err) {
      console.error(`ERROR on ${m.table}:`, err.message);
    }
  }

  console.log('--- SCHEMA FIX COMPLETE ---');
  await prisma.$disconnect();
}

fixSchema();
