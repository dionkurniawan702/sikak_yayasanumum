const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    try {
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

        const { budgetRequests = [], budgetReports = [], units = [] } = state;
        const taudUnit = units.find(u => u.name && u.name.toUpperCase().includes('TAUD'));

        console.log('TAUD Unit ID:', taudUnit?.id);

        console.log('\n--- TAUD BUDGET REQUESTS ---');
        budgetRequests.filter(r => r.unitId === taudUnit?.id).forEach(r => {
            console.log({
                id: r.id,
                month: r.month,
                status: r.status,
                createdAt: r.createdAt,
                date: r.date
            });
        });

        console.log('\n--- SPECIFIC 2638020 REPORT ---');
        const report = budgetReports.find(r => parseFloat(r.amount) === 2638020 || (r.description && r.description.includes('SPTD')));
        console.log(report);

    } catch (err) {
        console.error(err);
    }
}

main();
