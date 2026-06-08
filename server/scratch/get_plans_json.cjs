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
        const unitMap = {};
        units.forEach(u => { unitMap[u.id] = u.name; });

        const targetYearId = 'AY-ID-MO8HTDXB-FJU'; // "2025-2026"
        const yearPlans = rabPlans.filter(p => p.academicYearId === targetYearId);

        console.log(`Plans in year 2025-2026:`);
        yearPlans.forEach(p => {
            const unitName = p.unitId ? (unitMap[p.unitId] || p.unitId) : 'N/A';
            console.log(`- Plan ID: ${p.id}, Unit: ${unitName} (${p.unitId}), Status: ${p.status}`);
        });

    } catch (err) {
        console.error('Error:', err.message);
    }
}
main();
