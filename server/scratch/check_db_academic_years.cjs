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

        console.log('--- Academic Years in API ---');
        console.log(state.academicYears.map(y => ({ id: y.id, name: y.name, isCurrent: y.isCurrent })));

        console.log('\n--- Plans AcademicYearId Distinct in API ---');
        const rabPlans = state.rabPlans || [];
        const planYears = new Set(rabPlans.map(p => p.academicYearId));
        console.log(Array.from(planYears));

    } catch (err) {
        console.error('Error:', err.message);
    }
}
main();
