const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    try {
        const loginRes = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'adminpdk', password: 'admin123' })
        });
        const loginJson = await loginRes.json();
        console.log('Login Response:', loginJson);
        if (!loginJson.data) {
            console.error('Login failed!');
            return;
        }
        const token = loginJson.data.token;

        const dataRes = await fetch(`${API_URL}/all-data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataJson = await dataRes.json();
        const state = dataJson.data;

        const rabPlans = state.rabPlans || [];
        
        const plans = rabPlans.filter(p => 
            p.academicYearId === 'AY-ID-MO8GWIG3-JDK' && 
            (p.fieldId === '23dfc180-eccb-4e44-aace-702eab3705ed' || p.fieldId === '7af86f5b-c9a8-4c14-9fd6-86a12e2a5c77')
        );

        plans.forEach(p => {
            const fieldName = p.fieldId === '23dfc180-eccb-4e44-aace-702eab3705ed' ? 'Bidang Pembangunan' : 'Bidang Sarana Prasarana';
            console.log(`\n--------------------------------------------`);
            console.log(`Plan ID: ${p.id}`);
            console.log(`Field Name: ${fieldName}`);
            console.log(`Plan Status: ${p.status}`);
            console.log(`Updated At: ${p.updatedAt}`);
            console.log(`Updated By: ${p.updatedBy}`);
            console.log(`Notified: ${p.notified}`);
            
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

    } catch (err) {
        console.error('Error:', err.message);
    }
}
main();
