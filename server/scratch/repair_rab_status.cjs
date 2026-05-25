require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL.replace('dion_db_sikakyayasanumum', 'localhost')
        }
    }
});

async function main() {
    try {
        console.log('Starting DB Repair for APPROVED RAB Plans...');
        const plans = await prisma.rabPlan.findMany({
            where: { status: 'APPROVED' }
        });
        
        let fixedCount = 0;

        for (const plan of plans) {
            let hasPendingComp = false;
            
            // Check expense components
            const updatedExpense = typeof plan.expense === 'string' ? JSON.parse(plan.expense) : (plan.expense || {});
            const updatedIncome = typeof plan.income === 'string' ? JSON.parse(plan.income) : (plan.income || {});
            
            Object.keys(updatedExpense).forEach(itemId => {
                const rawPlans = updatedExpense[itemId];
                const plansArr = Array.isArray(rawPlans) ? rawPlans : (rawPlans && typeof rawPlans === 'object' && Object.keys(rawPlans).length > 0 ? [{ id: `P-${itemId}-LEGACY`, itemId, ...rawPlans }] : []);
                
                updatedExpense[itemId] = plansArr.map(p => {
                    const comps = p.components || [];
                    const updatedComps = comps.map(c => {
                        if (c.status === 'PENDING' || !c.status || !c.isApproved) {
                            hasPendingComp = true;
                        }
                        return {
                            ...c,
                            status: 'APPROVED',
                            isApproved: true
                        };
                    });
                    return { ...p, components: updatedComps };
                });
            });

            Object.keys(updatedIncome).forEach(itemId => {
                const rawPlans = updatedIncome[itemId];
                const plansArr = Array.isArray(rawPlans) ? rawPlans : (rawPlans && typeof rawPlans === 'object' && Object.keys(rawPlans).length > 0 ? [{ id: `P-${itemId}-LEGACY`, itemId, ...rawPlans }] : []);
                
                updatedIncome[itemId] = plansArr.map(p => {
                    const comps = p.components || [];
                    const updatedComps = comps.map(c => {
                        if (c.status === 'PENDING' || !c.status || !c.isApproved) {
                            hasPendingComp = true;
                        }
                        return {
                            ...c,
                            status: 'APPROVED',
                            isApproved: true
                        };
                    });
                    return { ...p, components: updatedComps };
                });
            });

            if (hasPendingComp) {
                console.log(`Fixing plan: ${plan.id}`);
                await prisma.rabPlan.update({
                    where: { id: plan.id },
                    data: {
                        expense: updatedExpense,
                        income: updatedIncome
                    }
                });
                fixedCount++;
            }
        }
        
        console.log(`Repair finished. Fixed ${fixedCount} plans.`);
    } catch (e) {
        console.error('ERROR:', e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
