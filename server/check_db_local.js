import { PrismaClient } from '@prisma/client';

process.env.DATABASE_URL = "mysql://mysql:7dff32cee8db81c86c80@127.0.0.1:3306/dion";
const prisma = new PrismaClient();

async function main() {
    console.log('--- Analyzing Local DB (via localhost:3306) ---');
    try {
        const units = await prisma.unit.findMany();
        console.log(`Units found: ${units.length}`);
        
        const fields = await prisma.field.findMany();
        const rabPlans = await prisma.rabPlan.findMany();
        
        const unitMap = {};
        units.forEach(u => { unitMap[u.id] = u.name; });
        
        const fieldMap = {};
        fields.forEach(f => { fieldMap[f.id] = f.name; });

        let totalGlobalPending = 0;
        const pendingByOwner = [];

        rabPlans.forEach(plan => {
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
                            let compStatus = c.status;
                            if (!compStatus) {
                                if (c.isApproved === true) compStatus = 'APPROVED';
                                else compStatus = plan.status === 'APPROVED' ? 'APPROVED' : (plan.status === 'PENDING' ? 'PENDING' : 'DRAFT');
                            }
                            
                            if (compStatus === 'PENDING') {
                                planPendingCount++;
                                totalGlobalPending++;
                            } else if (compStatus === 'APPROVED') {
                                planApprovedCount++;
                            } else {
                                planDraftCount++;
                            }
                        });
                    }
                });
            });
            
            if (planPendingCount > 0) {
                const ownerType = plan.unitId ? 'Unit' : (plan.fieldId ? 'Bidang' : 'Unknown');
                const ownerName = plan.unitId 
                    ? (unitMap[plan.unitId] || plan.unitId) 
                    : (plan.fieldId ? (fieldMap[plan.fieldId] || plan.fieldId) : 'Unknown');
                
                pendingByOwner.push({
                    ownerType,
                    ownerName,
                    pendingCount: planPendingCount,
                    approvedCount: planApprovedCount,
                    draftCount: planDraftCount,
                    planId: plan.id
                });
            }
        });
        
        console.log(`\nFound ${pendingByOwner.length} plans with pending components:`);
        pendingByOwner.forEach(item => {
            console.log(`- [${item.ownerType}] ${item.ownerName}: ${item.pendingCount} MENUNGGU (Approved: ${item.approvedCount}, Draft: ${item.draftCount})`);
        });
        
        console.log(`\nTotal Pending Components: ${totalGlobalPending}`);
    } catch (err) {
        console.error("Local database error:", err.message);
    }
}

main()
    .finally(() => prisma.$disconnect());
