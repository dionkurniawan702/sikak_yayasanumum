import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('--- Analyzing Pending Components in RAB Plans ---');
    
    // Fetch all units and fields to map IDs to names
    const units = await prisma.unit.findMany();
    const fields = await prisma.field.findMany();
    
    const unitMap = {};
    units.forEach(u => { unitMap[u.id] = u.name; });
    
    const fieldMap = {};
    fields.forEach(f => { fieldMap[f.id] = f.name; });

    // Fetch all rabPlans
    const plans = await prisma.rabPlan.findMany();
    console.log(`Total RabPlans in DB: ${plans.length}`);

    let totalGlobalPending = 0;
    
    plans.forEach(plan => {
        let planPendingCount = 0;
        let planApprovedCount = 0;
        let planDraftCount = 0;
        
        const exp = plan.expense || {};
        Object.entries(exp).forEach(([itemId, dataArray]) => {
            const planArray = Array.isArray(dataArray) 
                ? dataArray 
                : (dataArray && typeof dataArray === 'object' && Object.keys(dataArray).length > 0 ? [dataArray] : []);
                
            planArray.forEach(p => {
                if (p.components) {
                    p.components.forEach(c => {
                        if (c.status === 'PENDING') {
                            planPendingCount++;
                            totalGlobalPending++;
                        } else if (c.status === 'APPROVED' || c.isApproved) {
                            planApprovedCount++;
                        } else {
                            planDraftCount++;
                        }
                    });
                }
            });
        });
        
        if (planPendingCount > 0 || planApprovedCount > 0 || planDraftCount > 0) {
            const ownerType = plan.unitId ? 'Unit' : (plan.fieldId ? 'Bidang' : 'Unknown');
            const ownerName = plan.unitId 
                ? (unitMap[plan.unitId] || plan.unitId) 
                : (plan.fieldId ? (fieldMap[plan.fieldId] || plan.fieldId) : 'Unknown');
                
            console.log(`Plan ID: ${plan.id}`);
            console.log(`  Owner: [${ownerType}] ${ownerName}`);
            console.log(`  Approved Components: ${planApprovedCount}`);
            console.log(`  Pending Components: ${planPendingCount}`);
            console.log(`  Draft Components: ${planDraftCount}`);
            console.log('--------------------------------------------');
        }
    });
    
    console.log(`Total Pending Components Globally: ${totalGlobalPending}`);
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
