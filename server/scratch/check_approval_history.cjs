const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('=== Checking RAB Plan Details in Database ===');
    
    const plans = await prisma.rabPlan.findMany({
        where: {
            academicYearId: 'AY-ID-MO8GWIG3-JDK',
            OR: [
                { fieldId: '23dfc180-eccb-4e44-aace-702eab3705ed' },
                { fieldId: '7af86f5b-c9a8-4c14-9fd6-86a12e2a5c77' }
            ]
        }
    });

    plans.forEach(p => {
        const fieldName = p.fieldId === '23dfc180-eccb-4e44-aace-702eab3705ed' ? 'Bidang Pembangunan' : 'Bidang Sarana Prasarana';
        console.log(`\n--------------------------------------------`);
        console.log(`Plan ID: ${p.id}`);
        console.log(`Field Name: ${fieldName}`);
        console.log(`Plan Status: ${p.status}`);
        console.log(`Updated At: ${p.updatedAt}`);
        console.log(`Updated By: ${p.updatedBy}`);
        console.log(`Notified: ${p.notified}`);
        
        // Let's check total value of approved components
        let totalVal = 0;
        let approvedCount = 0;
        let pendingCount = 0;
        let draftCount = 0;

        if (p.expense) {
            Object.values(p.expense).forEach(plansArr => {
                const arr = Array.isArray(plansArr) ? plansArr : [plansArr];
                arr.forEach(itemPlan => {
                    if (itemPlan && itemPlan.components) {
                        itemPlan.components.forEach(c => {
                            const status = c.status || (c.isApproved ? 'APPROVED' : 'PENDING');
                            if (status === 'APPROVED') {
                                approvedCount++;
                                totalVal += (parseFloat(c.volume) || 0) * (parseFloat(c.kali) || 0) * (parseFloat(c.harga) || 0);
                            } else if (status === 'PENDING') {
                                pendingCount++;
                            } else {
                                draftCount++;
                            }
                        });
                    }
                });
            });
        }
        console.log(`Components Status Breakdown:`);
        console.log(`- APPROVED: ${approvedCount} components (Total Val: Rp ${totalVal.toLocaleString('id-ID')})`);
        console.log(`- PENDING: ${pendingCount} components`);
        console.log(`- DRAFT: ${draftCount} components`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
