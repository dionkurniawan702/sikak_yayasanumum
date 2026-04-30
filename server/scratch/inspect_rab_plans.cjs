const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const plans = await prisma.rabPlan.findMany({
      where: {
        id: {
          contains: 'Ekskul',
        }
      }
    });
    console.log('--- RAB Plans with "Ekskul" in ID ---');
    console.log(JSON.stringify(plans, null, 2));

    const allPlans = await prisma.rabPlan.findMany();
    console.log('\n--- All RAB Plans ---');
    allPlans.forEach(p => {
        console.log(`ID: ${p.id}, Status: ${p.status}`);
    });
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
