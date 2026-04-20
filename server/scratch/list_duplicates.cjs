const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const items = await prisma.expenseItem.findMany({
    where: {
      name: { contains: 'Operasional Bulanan' },
      isDeleted: false
    },
    select: {
      id: true,
      name: true,
      unitId: true,
      fieldId: true,
      sourceOfFunds: true
    }
  });

  console.log(JSON.stringify(items, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
