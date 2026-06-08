const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    try {
        console.log('Logging in to retrieve token...');
        const loginRes = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'adminpdk', password: 'admin123' })
        });
        const loginJson = await loginRes.json();
        const token = loginJson.data.token;

        console.log('Fetching all remote data...');
        const dataRes = await fetch(`${API_URL}/all-data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataJson = await dataRes.json();
        const state = dataJson.data;

        const rabPlans = state.rabPlans || [];
        const plan = rabPlans.find(p => p.id === 'AY-ID-MO8GWIG3-JDK-mo7zeqb1gtuh9-BOS');
        if (!plan) {
            console.error('MIT BOS Plan not found!');
            return;
        }

        console.log('Plan found! Current Status:', plan.status);

        // 1. Repair EXP-003 (Lokal)
        if (plan.expense['EXP-003']) {
            plan.expense['EXP-003'] = plan.expense['EXP-003'].map(p => ({
                ...p,
                useBos: true,
                bosAmount: p.total
            }));
            console.log('Updated EXP-003 with useBos: true and bosAmount');
        }

        // 2. Repair EXP-004 (Perlengkapan)
        if (plan.expense['EXP-004']) {
            plan.expense['EXP-004'] = plan.expense['EXP-004'].map(p => {
                // Keep only the components that fit within the Rp 11.400.000 limit
                const allowedLabels = [
                    'Bola Lampu',
                    'Karpet Halaqah',
                    'Media Pembelajaran',
                    'HVS A4',
                    'Tinta Printer Brother Black',
                    'Tinta Printer Brother Yellow',
                    'Tinta Printer Brother Magenta',
                    'Tinta Printer Brother Cyan',
                    'Tinta Printer Epson 003 Black'
                ];

                const filteredComponents = (p.components || []).filter(c => 
                    allowedLabels.some(label => c.label && c.label.trim().toLowerCase() === label.trim().toLowerCase())
                );

                const newTotal = filteredComponents.reduce((sum, c) => sum + (parseFloat(c.total) || 0), 0);
                console.log(`Filtered Perlengkapan components count from ${p.components.length} to ${filteredComponents.length}`);
                console.log(`New Perlengkapan total: Rp ${newTotal.toLocaleString('id-ID')}`);

                // Recalculate monthly distribution
                const aggregatedMonths = {};
                filteredComponents.forEach(c => {
                    Object.entries(c.months || {}).forEach(([mId, mData]) => {
                        if (!mData.m) return;
                        if (!aggregatedMonths[mId]) aggregatedMonths[mId] = { m: true, jumlah: 0 };
                        aggregatedMonths[mId].jumlah += (parseFloat(mData.jumlah) || 0);
                    });
                });

                return {
                    ...p,
                    components: filteredComponents,
                    total: newTotal,
                    useBos: true,
                    bosAmount: newTotal,
                    months: aggregatedMonths,
                    description: filteredComponents.map(c => c.label).join(', ')
                };
            });
        }

        // Update overall updated info
        plan.updatedAt = new Date().toISOString();
        plan.updatedBy = 'adminpdk_diag_fix';

        console.log('Sending updated plan to server...');
        const updateRes = await fetch(`${API_URL}/rab-plans`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(plan)
        });

        const updateJson = await updateRes.json();
        console.log('Server response:', updateJson);

    } catch (err) {
        console.error('Error:', err.message);
    }
}
main();
