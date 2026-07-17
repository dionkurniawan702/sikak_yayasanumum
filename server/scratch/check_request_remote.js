const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    try {
        console.log('Logging in to remote API...');
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

        const { budgetReports = [], units = [] } = state;

        const tkit2Unit = units.find(u => u.name.includes('TKIT 2'));
        const unitId = tkit2Unit.id;

        console.log('--- FINDING ACTIVE APPROVED REPORTS ---');
        const approved = budgetReports.filter(r => r.unitId === unitId && r.status === 'APPROVED' && !r.isDeleted);
        console.log(`Total APPROVED reports in DB right now: ${approved.length}`);
        approved.forEach(r => {
            console.log(`- Report [${r.id}] Category: "${r.category}", Amount: ${r.amount}, Status: ${r.status}`);
        });

    } catch (err) {
        console.error('Error:', err.message);
    }
}
main();
