const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const planId = 'P-EXP-013-1777531586636';
  try {
    console.log(`Checking plan: ${planId}`);
    const plan = await prisma.rabPlan.findFirst({
      where: {
        OR: [
          { id: planId },
          { id: { contains: planId } }
        ]
      }
    });

    if (plan) {
      console.log('--- Plan Found ---');
      console.log('ID:', plan.id);
      console.log('Status:', plan.status);
      
      const expense = typeof plan.expense === 'string' ? JSON.parse(plan.expense) : plan.expense;
      console.log('\n--- Expense Structure ---');
      Object.entries(expense || {}).forEach(([itemId, data]) => {
          console.log(`Item ID: ${itemId}`);
          if (Array.isArray(data)) {
              data.forEach((p, i) => {
                  console.log(`  Plan ${i} (ID: ${p.id}): ${p.components?.length || 0} components`);
                  (p.components || []).forEach(c => {
                      console.log(`    - ${c.label} (${c.total})`);
                  });
              });
          } else {
              console.log(`  Single Plan: ${data.components?.length || 0} components`);
              (data.components || []).forEach(c => {
                  console.log(`    - ${c.label} (${c.total})`);
              });
          }
      });
    } else {
      console.log('Plan not found in database.');
      
      // Look for any plan that might contain "Raket" or "Alat main"
      const allPlans = await prisma.rabPlan.findMany();
      console.log('\nSearching for components in all plans...');
      allPlans.forEach(p => {
          const exp = typeof p.expense === 'string' ? JSON.parse(p.expense) : p.expense;
          Object.values(exp || {}).forEach(data => {
              const plans = Array.isArray(data) ? data : [data];
              plans.forEach(plan => {
                  const hasMatch = (plan.components || []).some(c => 
                      c.label.includes('Raket') || c.label.includes('Alat main') || c.label.includes('Konsumsi')
                  );
                  if (hasMatch) {
                      console.log(`Found in Plan ID: ${p.id}`);
                      plan.components.forEach(c => console.log(`  - ${c.label}`));
                  }
              });
          });
      });
    }
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
