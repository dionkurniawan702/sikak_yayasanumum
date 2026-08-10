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

    const { rabPlans = [] } = state;

    console.log(`Total RAB Plans: ${rabPlans.length}`);
    const sample = rabPlans.find(p => p.expense);
    if (sample) {
        console.log('typeof sample.expense:', typeof sample.expense);
        console.log('Array.isArray(sample.expense):', Array.isArray(sample.expense));
        console.log('sample.expense value:', JSON.stringify(sample.expense).slice(0, 500));
    }
}

main();
