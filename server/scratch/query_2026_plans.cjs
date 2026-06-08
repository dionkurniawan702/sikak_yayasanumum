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

        console.log(`=== Plans in year 2026-2027 ===`);
        yearPlans.forEach(p => {
            const unitName = p.unitId ? (unitMap[p.unitId] || p.unitId) : 'N/A';
            const fieldName = p.fieldId ? (fieldMap[p.fieldId] || p.fieldId) : 'N/A';
            
            let componentCount = 0;
            let approvedComponentCount = 0;
            let pendingComponentCount = 0;
            
            if (p.expense) {
                Object.entries(p.expense).forEach(([itemId, rawItemPlans]) => {
                    const itemPlans = Array.isArray(rawItemPlans) ? rawItemPlans : [rawItemPlans];
                    itemPlans.forEach(ip => {
                        if (ip && ip.components) {
                            ip.components.forEach(comp => {
                                componentCount++;
                                const status = comp.status || (comp.isApproved ? 'APPROVED' : 'PENDING');
                                if (status === 'APPROVED') approvedComponentCount++;
                                if (status === 'PENDING') pendingComponentCount++;
                            });
                        }
                    });
                });
            }
            
            console.log(`- Plan ID: ${p.id}
  Unit: ${unitName} (${p.unitId})
  Field: ${fieldName} (${p.fieldId})
  Plan Status: ${p.status}
  Total Components: ${componentCount} (Approved: ${approvedComponentCount}, Pending: ${pendingComponentCount})`);
        });

    } catch (err) {
        console.error('Error:', err.message);
    }
}
main();
