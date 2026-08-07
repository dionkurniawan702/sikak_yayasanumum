const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const reqs = await prisma.budgetRequest.findMany({
    where: {
      unitId: 'TKIT2',
      month: '2026-08',
      status: 'APPROVED'
    }
  });
  console.log('=== REQUESTS FOR TKIT2 IN AUGUST 2026 ===');
  console.log('Requests found:', reqs.length);
  for (const r of reqs) {
    console.log('\nRequest ID:', r.id, '| Month:', r.month, '| Source:', r.source);
    let items = typeof r.items === 'string' ? JSON.parse(r.items) : (r.items || []);
    console.log('Total items in request:', items.length);
    items.forEach((item, idx) => {
      console.log(`${idx+1}. ${item.name || item.category || 'Unnamed'} | Amt: ${item.amount} | compId: ${item.componentId || 'none'} | planId: ${item.planId || 'none'} | isClosed: ${item.isClosed}`);
    });
  }

  const reports = await prisma.budgetReport.findMany({
    where: {
      unitId: 'TKIT2',
      isDeleted: false
    }
  });
  console.log('\n=== REPORTS FOR TKIT2 ===');
  console.log('Total reports:', reports.length);
  reports.forEach((rep, idx) => {
    console.log(`${idx+1}. Report ID: ${rep.id} | Status: ${rep.status} | Name: ${rep.category || rep.description} | Amt: ${rep.amount} | reqId: ${rep.budgetRequestId} | compId: ${rep.componentId} | planId: ${rep.planId} | date: ${rep.date}`);
  });

  await prisma.$disconnect();
}

check().catch(console.error);
