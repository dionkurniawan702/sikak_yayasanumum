const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const units = await prisma.unit.findMany({
            where: {
                name: { contains: 'tkit' }
            }
        });
        console.log('Found TKIT units:', units);

        if (units.length === 0) {
            console.log('No TKIT units found.');
            return;
        }

        const unitIds = units.map(u => u.id);

        const plans = await prisma.rabPlan.findMany({
            where: {
                unitId: { in: unitIds }
            }
        });
        
        console.log(`Found ${plans.length} RAB plans for TKIT.`);
        
        for (const plan of plans) {
            console.log(`\nPlan ID: ${plan.id}, Status: ${plan.status}`);
            const expense = typeof plan.expense === 'string' ? JSON.parse(plan.expense) : plan.expense;
            console.log('Expense Keys:', Object.keys(expense || {}));
            
            let hasApprovedComp = false;
            let totalJuneAmount = 0;
            
            if (expense) {
                Object.values(expense).forEach((itemPlans) => {
                    itemPlans.forEach(p => {
                        (p.components || []).forEach(comp => {
                            if (comp.isApproved) hasApprovedComp = true;
                            // check June 2026 (assuming current global year contains it)
                            const juneAlloc = comp.months?.['2026-06'];
                            if (juneAlloc && juneAlloc.m) {
                                totalJuneAmount += parseFloat(juneAlloc.jumlah) || 0;
                            }
                        });
                    });
                });
            }
            console.log(`Has Approved Components? ${hasApprovedComp}`);
            console.log(`Total June 2026 Allocation: ${totalJuneAmount}`);
        }
        
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
