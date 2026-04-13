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
    { name: 'Student', table: 'Student' }
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
    } catch (err) {
      console.error(`ERROR on ${m.table}:`, err.message);
    }
  }

  console.log('--- SCHEMA FIX COMPLETE ---');
  await prisma.$disconnect();
}

fixSchema();
