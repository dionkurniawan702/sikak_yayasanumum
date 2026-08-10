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
    if (rabPlans.length > 0) {
        const sample = rabPlans[0];
        console.log('\n=== SAMPLE RAB PLAN KEYS ===');
        console.log(Object.keys(sample));
        console.log('\n=== SAMPLE RAB PLAN DETAIL ===');
        console.log(`ID: ${sample.id} | title: ${sample.title} | status: ${sample.status} | academicYearId: ${sample.academicYearId}`);
        console.log(`items length: ${sample.items ? sample.items.length : 'undefined'}`);
        console.log(`components length: ${sample.components ? sample.components.length : 'undefined'}`);

        const list = sample.items || sample.components || [];
        if (list.length > 0) {
            console.log('\n=== SAMPLE ITEM KEYS ===');
            console.log(Object.keys(list[0]));
            console.log('\n=== SAMPLE ITEM OBJECT ===');
            console.log(list[0]);
        }
    }
}

main();
