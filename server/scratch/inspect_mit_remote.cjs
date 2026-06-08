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
        if (!loginJson.data) {
            console.error('Login failed!', loginJson);
            return;
        }
        const token = loginJson.data.token;

        console.log('Fetching all remote data...');
        const dataRes = await fetch(`${API_URL}/all-data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataJson = await dataRes.json();
        const state = dataJson.data;

        // Find MIT Unit
        const units = state.units || [];
        const mitUnit = units.find(u => u.name && u.name.toUpperCase().includes('MIT'));
        if (!mitUnit) {
            console.log('MIT Unit not found! Available units:', units.map(u => u.name));
            return;
        }
        console.log(`\n=== UNIT FOUND ===`);
        console.log(`ID: ${mitUnit.id}`);
        console.log(`Name: ${mitUnit.name}`);
        console.log(`Receives BOS: ${mitUnit.receivesBos}`);

        // Find BOS Allocations for this unit
        const bosAllocations = state.bosAllocations || [];
        const mitBosAllocations = bosAllocations.filter(a => a.unitId === mitUnit.id);
        console.log(`\n=== BOS ALLOCATIONS FOR MIT ===`);
        console.log(JSON.stringify(mitBosAllocations, null, 2));

        // Find Distribution Settings
        const distSettings = state.distributionSettings || [];
        console.log(`\n=== DISTRIBUTION SETTINGS ===`);
        console.log(JSON.stringify(distSettings, null, 2));

        // Find RAB Plans for MIT
        const rabPlans = state.rabPlans || [];
        const mitPlans = rabPlans.filter(p => p.unitId === mitUnit.id && p.academicYearId === 'AY-ID-MO8GWIG3-JDK');
        console.log(`\n=== RAB PLANS FOR MIT ===`);
        mitPlans.forEach(p => {
            console.log(`- Plan ID: ${p.id}, Status: ${p.status}, UpdatedAt: ${p.updatedAt}, UpdatedBy: ${p.updatedBy}`);
        });

        // Let's inspect the BOS plan specifically
        const mitBosPlan = mitPlans.find(p => p.id.endsWith('-BOS'));
        if (!mitBosPlan) {
            console.log('No MIT BOS Plan found!');
            return;
        }

        console.log(`\n=== MIT BOS PLAN EXPENSE DETAILS ===`);
        const expense = mitBosPlan.expense || {};
        const expenseItems = state.expenseItems || [];
        
        Object.entries(expense).forEach(([itemId, rawItemPlans]) => {
            const item = expenseItems.find(ei => ei.id === itemId);
            const itemName = item ? item.name : itemId;
            const itemPlans = Array.isArray(rawItemPlans) ? rawItemPlans : [rawItemPlans];
            
            console.log(`\nCategory: ${itemName} (${itemId})`);
            
            itemPlans.forEach((ip, idx) => {
                console.log(`  Sub-plan total: Rp ${(ip.total || 0).toLocaleString('id-ID')}`);
                if (ip.components) {
                    ip.components.forEach((c, cIdx) => {
                        const status = c.status || (c.isApproved ? 'APPROVED' : 'PENDING');
                        console.log(`    - Comp #${cIdx+1}: [${status}] "${c.label}" -> Rp ${(c.total || 0).toLocaleString('id-ID')} (${c.volume} ${c.satuan} x ${c.kali} x Rp ${c.harga.toLocaleString('id-ID')})`);
                    });
                }
            });
        });

    } catch (err) {
        console.error('Error:', err.message);
    }
}
main();
