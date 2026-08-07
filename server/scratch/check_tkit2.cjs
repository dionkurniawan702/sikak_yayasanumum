const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const reports = await prisma.budgetReport.findMany({
    where: { unitId: 'TKIT2', isDeleted: false }
  });
  console.log('--- REPORTS FOR TKIT2 (' + reports.length + ') ---');
  reports.forEach(r => {
    console.log({
      id: r.id,
      category: r.category,
      amount: r.amount,
      status: r.status,
      budgetRequestId: r.budgetRequestId,
      componentId: r.componentId,
      date: r.date
    });
  });

  const requests = await prisma.budgetRequest.findMany({
    where: { unitId: 'TKIT2', status: 'APPROVED' }
  });
  console.log('\n--- APPROVED REQUESTS FOR TKIT2 (' + requests.length + ') ---');
  requests.forEach(req => {
    console.log('Request ID:', req.id, 'Month:', req.month, 'Status:', req.status);
    const items = typeof req.items === 'string' ? JSON.parse(req.items) : req.items;
    if (items) {
      items.forEach(i => console.log('   Item:', i.name, 'Amount:', i.amount, 'ComponentId:', i.componentId));
    }
  });
}
main().catch(console.error).finally(() => prisma.$disconnect());
