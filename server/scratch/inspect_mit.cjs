const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('=== INSPECTING MIT UNIT AND PLANS ===');
    
    // Find MIT unit
    const units = await prisma.unit.findMany({
      where: {
        name: {
          contains: 'MIT'
        }
      }
    });
    console.log('MIT Units in DB:', JSON.stringify(units, null, 2));

    if (units.length === 0) {
      console.log('No unit containing "MIT" found!');
      return;
    }

    const mitUnitId = units[0].id;
    console.log(`Using Unit ID: ${mitUnitId}`);

    // Find all rabPlans for MIT
    const plans = await prisma.rabPlan.findMany({
      where: {
        unitId: mitUnitId
      }
    });

    console.log('RAB Plans for MIT:', JSON.stringify(plans.map(p => ({
      id: p.id,
      academicYearId: p.academicYearId,
      status: p.status,
      hasIncome: !!p.income && Object.keys(p.income).length > 0,
      hasExpense: !!p.expense && Object.keys(p.expense).length > 0,
      updatedAt: p.updatedAt,
      updatedBy: p.updatedBy
    })), null, 2));

    // Print details of the first plan's expense if any
    for (const p of plans) {
      console.log(`\n--- Plan Details for ID: ${p.id} ---`);
      console.log(`Status: ${p.status}`);
      if (p.expense) {
        const expenseObj = typeof p.expense === 'string' ? JSON.parse(p.expense) : p.expense;
        console.log('Expense Categories count:', Object.keys(expenseObj).length);
        
        // Let's inspect component statuses inside expense items
        const pendingComps = [];
        const draftComps = [];
        const approvedComps = [];
        
        Object.entries(expenseObj).forEach(([itemId, itemsList]) => {
          if (Array.isArray(itemsList)) {
            itemsList.forEach(item => {
              if (item.components && Array.isArray(item.components)) {
                item.components.forEach((c, idx) => {
                  const compStatus = c.status || 'DRAFT';
                  if (compStatus === 'PENDING') {
                    pendingComps.push({ itemId, label: c.label, total: c.total, status: compStatus });
                  } else if (compStatus === 'APPROVED') {
                    approvedComps.push({ itemId, label: c.label, total: c.total, status: compStatus });
                  } else {
                    draftComps.push({ itemId, label: c.label, total: c.total, status: compStatus });
                  }
                });
              }
            });
          }
        });

        console.log(`Components stats: PENDING=${pendingComps.length}, APPROVED=${approvedComps.length}, DRAFT=${draftComps.length}`);
        if (pendingComps.length > 0) {
          console.log('Some PENDING components:', JSON.stringify(pendingComps.slice(0, 5), null, 2));
        }
      }
    }
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
