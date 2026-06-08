const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    try {
        const loginRes = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'adminpdk', password: 'admin123' })
        });
        const loginJson = await loginRes.json();
        const token = loginJson.data.token;

        const dataRes = await fetch(`${API_URL}/all-data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataJson = await dataRes.json();
        const state = dataJson.data;

        const rabPlans = state.rabPlans || [];
        
        // Find Bidang Pembangunan plan: FIELD-23dfc180-eccb-4e44-aace-702eab3705ed
        // Find Bidang Sarpras plan: FIELD-7af86f5b-c9a8-4c14-9fd6-86a12e2a5c77
        const plans = rabPlans.filter(p => 
            p.academicYearId === 'AY-ID-MO8GWIG3-JDK' && 
            (p.fieldId === '23dfc180-eccb-4e44-aace-702eab3705ed' || p.fieldId === '7af86f5b-c9a8-4c14-9fd6-86a12e2a5c77')
        );

        plans.forEach(plan => {
            const fieldName = plan.fieldId === '23dfc180-eccb-4e44-aace-702eab3705ed' ? 'Bidang Pembangunan' : 'Bidang Sarana Prasarana';
            console.log(`\n==================================================`);
            console.log(`Plan ID: ${plan.id}`);
            console.log(`Field Name: ${fieldName}`);
            console.log(`Plan Status: ${plan.status}`);
            console.log(`==================================================`);
            
            let totalCompCount = 0;
            let approvedComps = [];
            let pendingComps = [];
            let draftComps = [];

            if (plan.expense) {
                Object.entries(plan.expense).forEach(([itemId, rawItemPlans]) => {
                    const itemPlans = Array.isArray(rawItemPlans) ? rawItemPlans : [rawItemPlans];
                    itemPlans.forEach(ip => {
                        if (ip && ip.components) {
                            ip.components.forEach(comp => {
                                totalCompCount++;
                                const status = comp.status || (comp.isApproved ? 'APPROVED' : 'PENDING');
                                const info = {
                                    itemId,
                                    label: comp.name || comp.label,
                                    status,
                                    isApproved: comp.isApproved,
                                    total: (parseFloat(comp.volume) || 0) * (parseFloat(comp.kali) || 0) * (parseFloat(comp.harga) || 0)
                                };
                                if (status === 'APPROVED') approvedComps.push(info);
                                else if (status === 'PENDING') pendingComps.push(info);
                                else draftComps.push(info);
                            });
                        }
                    });
                });
            }

            console.log(`Total Components: ${totalCompCount}`);
            console.log(`Approved count: ${approvedComps.length}`);
            console.log(`Pending count: ${pendingComps.length}`);
            console.log(`Draft/other count: ${draftComps.length}`);
            
            if (approvedComps.length > 0) {
                console.log(`Sample Approved Components (first 10):`);
                approvedComps.slice(0, 10).forEach(c => {
                    console.log(`  - ItemId: ${c.itemId} | Label: "${c.label}" | Status: ${c.status} | isApproved: ${c.isApproved} | Total: ${c.total}`);
                });
            }
            if (pendingComps.length > 0) {
                console.log(`Pending Components:`);
                pendingComps.forEach(c => {
                    console.log(`  - ItemId: ${c.itemId} | Label: "${c.label}" | Status: ${c.status} | isApproved: ${c.isApproved}`);
                });
            }
            if (draftComps.length > 0) {
                console.log(`Sample Draft Components (first 10):`);
                draftComps.slice(0, 10).forEach(c => {
                    console.log(`  - ItemId: ${c.itemId} | Label: "${c.label}" | Status: ${c.status} | isApproved: ${c.isApproved}`);
                });
            }
        });

    } catch (err) {
        console.error('Error:', err.message);
    }
}
main();
