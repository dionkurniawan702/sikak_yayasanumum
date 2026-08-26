const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    const loginRes = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'adminpdk', password: 'admin123' })
    });
    const loginJson = await loginRes.json();
    const token = loginJson.data?.token;

    const dataRes = await fetch(`${API_URL}/all-data`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const dataJson = await dataRes.json();
    const state = dataJson.data;

    const { budgetReports = [] } = state;

    const r1 = budgetReports.find(r => r.id === 'REL-1783386299120');
    const r2 = budgetReports.find(r => r.id === 'REL-1784172056918');

    console.log('REL-1783386299120:', r1);
    console.log('REL-1784172056918:', r2);

    // Sum of amounts of r1 + r2:
    if (r1) console.log('r1 amount:', r1.amount);
    if (r2) console.log('r2 amount:', r2.amount);

    if (r1 && r2) {
        console.log('Total r1 + r2:', Number(r1.amount) + Number(r2.amount));
    }
}

main();
