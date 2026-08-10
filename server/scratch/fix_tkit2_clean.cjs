const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    console.log('Logging in...');
    const loginRes = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'adminpdk', password: 'admin123' })
    });
    const loginJson = await loginRes.json();
    const token = loginJson.data?.token;

    if (!token) {
        console.error('Login failed');
        return;
    }

    const dataRes = await fetch(`${API_URL}/all-data`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const dataJson = await dataRes.json();
    const state = dataJson.data;

    const { budgetRequests = [], budgetReports = [], units = [] } = state;
    const tkit2 = units.find(u => u.name && u.name.toLowerCase().includes('tkit 2'));
    const unitId = tkit2.id;

    const juneReq = budgetRequests.find(r => r.unitId === unitId && (r.month === '2026-06' || r.month === 'Juni 2026'));
    const julyReq = budgetRequests.find(r => r.unitId === unitId && (r.month === '2026-07' || r.month === 'Juli 2026'));

    console.log(`Fixing Pengembalian linking:`);
    console.log(`- RET-MRUDU2JY (Rp 7.283.103) -> June REQ [${juneReq.id}]`);
    console.log(`- RET-MS8DE75L (Rp 231.900) -> July REQ [${julyReq.id}]`);
    console.log(`- RET-MS8CY7BY (Rp 231.900) -> July REQ [${julyReq.id}]`);

    const retUpdates = [
        { id: 'RET-MRUDU2JY', reqId: juneReq.id },
        { id: 'RET-MS8DE75L', reqId: julyReq.id },
        { id: 'RET-MS8CY7BY', reqId: julyReq.id }
    ];

    for (const update of retUpdates) {
        const report = budgetReports.find(r => r.id === update.id);
        if (report) {
            const updated = {
                ...report,
                budgetRequestId: update.reqId,
                requestId: update.reqId
            };
            const putRes = await fetch(`${API_URL}/budget-reports/${report.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updated)
            });
            console.log(`Updated ${update.id}: ${putRes.status}`);
        }
    }
}

main();
