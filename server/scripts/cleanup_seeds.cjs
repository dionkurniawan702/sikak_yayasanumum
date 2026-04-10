const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Cleaning Up Seed Data ---');

  // Placeholder IDs
  const fieldIds = ['fld-1', 'fld-2', 'fld-3', 'fld-4'];
  const unitIds = ['unt-1', 'unt-2', 'unt-3', 'unt-4', 'unt-5', 'unt-6'];

  try {
    // Soft delete units
    const units = await prisma.unit.updateMany({
      where: { id: { in: unitIds } },
      data: { isDeleted: true }
    });
    console.log(`Updated ${units.count} units to isDeleted: true`);

    // Soft delete fields
    const fields = await prisma.field.updateMany({
      where: { id: { in: fieldIds } },
      data: { isDeleted: true }
    });
    console.log(`Updated ${fields.count} fields to isDeleted: true`);

    console.log('Cleanup complete.');
  } catch (err) {
    console.error('Error during cleanup:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
