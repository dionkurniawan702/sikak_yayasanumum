process.env.DATABASE_URL = "mysql://mysql:7dff32cee8db81c86c80@127.0.0.1:3306/dion";
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const units = await prisma.unit.findMany({ where: { name: { contains: 'TKIT' } } });
  console.log('Units:', units);

  const allReqs = await prisma.budgetRequest.findMany({
    include: { reports: true }
  });
  console.log('Total BudgetRequests:', allReqs.length);
  const targetReqs = allReqs.filter(r => {
    const str = JSON.stringify(r);
    return str.includes('MS8D') || str.includes('Konsumsi') || str.includes('TKIT');
  });
  console.log('Target BudgetRequests count:', targetReqs.length);
  console.log('Target Reqs:', JSON.stringify(targetReqs, null, 2));

  const allReports = await prisma.budgetReport.findMany();
  const targetReports = allReports.filter(r => {
    const str = JSON.stringify(r);
    return str.includes('MS8D') || str.includes('Konsumsi') || (r.budgetRequestId && targetReqs.some(tr => tr.id === r.budgetRequestId));
  });
  console.log('Target Reports count:', targetReports.length);
  console.log('Target Reports:', JSON.stringify(targetReports, null, 2));

  const rabPlans = await prisma.rabPlan.findMany();
  for (const r of rabPlans) {
    const str = JSON.stringify(r);
    if (str.includes('MS8D') || str.includes('Konsumsi')) {
      console.log('RAB Plan matching MS8D/Konsumsi ID:', r.id);
      // Let's inspect details
      const exp = typeof r.expense === 'string' ? JSON.parse(r.expense) : r.expense;
      console.log('RAB Plan expense matching items:');
      if (Array.isArray(exp)) {
        exp.forEach(item => {
          if (JSON.stringify(item).includes('Konsumsi') || JSON.stringify(item).includes('MS8D')) {
            console.log(JSON.stringify(item, null, 2));
          }
        });
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
