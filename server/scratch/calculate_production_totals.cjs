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
        const units = state.units || [];
        const fields = state.fields || [];
        const unitMap = {};
        units.forEach(u => { unitMap[u.id] = u.name; });
        const fieldMap = {};
        fields.forEach(f => { fieldMap[f.id] = f.name; });

        const targetYearId = 'AY-ID-MO8GWIG3-JDK'; // "2026-2027"
        const yearPlans = rabPlans.filter(p => p.academicYearId === targetYearId);

        console.log(`=== PRODUCTION PLAN DETAILS FOR 2026-2027 ===`);
        let grandTotalExpense = 0;
        let grandTotalExpenseBos = 0;

        yearPlans.forEach(p => {
            const unitName = p.unitId ? (unitMap[p.unitId] || p.unitId) : 'N/A';
            const fieldName = p.fieldId ? (fieldMap[p.fieldId] || p.fieldId) : 'N/A';

            let totalExpense = 0;
            let totalExpenseBos = 0;

            if (p.expense) {
                Object.entries(p.expense).forEach(([itemId, rawItemPlans]) => {
                    const itemPlans = Array.isArray(rawItemPlans) ? rawItemPlans : [rawItemPlans];
                    itemPlans.forEach(ip => {
                        totalExpense += parseFloat(ip.total || 0);
                        if (ip.useBos) {
                            totalExpenseBos += parseFloat(ip.bosAmount || 0);
                        }
                    });
                });
            }

            grandTotalExpense += totalExpense;
            grandTotalExpenseBos += totalExpenseBos;

            console.log(`- Plan: ${p.id}
  Name: ${p.unitId ? unitName : fieldName}
  Status: ${p.status}
  Total Expense: Rp ${totalExpense.toLocaleString('id-ID')}
  Total Expense BOS: Rp ${totalExpenseBos.toLocaleString('id-ID')}`);
        });

        console.log(`\nGrand Total Expense: Rp ${grandTotalExpense.toLocaleString('id-ID')}`);
        console.log(`Grand Total Expense BOS: Rp ${grandTotalExpenseBos.toLocaleString('id-ID')}`);

    } catch (err) {
        console.error('Error:', err.message);
    }
}
main();
