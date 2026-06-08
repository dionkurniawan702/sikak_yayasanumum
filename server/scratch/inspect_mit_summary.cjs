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

        // Find MIT Unit
        const units = state.units || [];
        const mitUnit = units.find(u => u.name && u.name.toUpperCase().includes('MIT'));
        if (!mitUnit) {
            console.log('MIT Unit not found!');
            return;
        }
        console.log(`Unit: ${mitUnit.name} (ID: ${mitUnit.id})`);

        // Find BOS Allocations for this unit in AY-ID-MO8GWIG3-JDK
        const bosAllocations = state.bosAllocations || [];
        const mitBosAllocations = bosAllocations.filter(a => a.unitId === mitUnit.id && a.academicYearId === 'AY-ID-MO8GWIG3-JDK' && !a.isDeleted);
        console.log('\n--- MIT BOS ALLOCATIONS ---');
        console.log(mitBosAllocations);

        // Sum allocations by expenseItemId
        const expenseItems = state.expenseItems || [];
        console.log('\n--- SUM BY EXPENSE ITEM ---');
        const map = {};
        mitBosAllocations.forEach(a => {
            const item = expenseItems.find(ei => ei.id === a.expenseItemId);
            const name = item ? item.name : a.expenseItemId;
            if (!map[name]) map[name] = 0;
            map[name] += parseFloat(a.amount) || 0;
        });
        console.log(map);

        // Calculate total
        const total = mitBosAllocations.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
        console.log(`\nTotal BOS Allocation for MIT: Rp ${total.toLocaleString('id-ID')}`);

    } catch (err) {
        console.error('Error:', err.message);
    }
}
main();
