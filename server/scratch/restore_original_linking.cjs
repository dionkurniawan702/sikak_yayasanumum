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
    const augustReq = budgetRequests.find(r => r.unitId === unitId && (r.month === '2026-08' || r.month === 'Agustus 2026'));

    console.log('Restoring reports to match their actual request month / receipt date...');

    const tkit2Reports = budgetReports.filter(r => r.unitId === unitId && !r.isDeleted);

    let updatedCount = 0;

    for (const r of tkit2Reports) {
        let targetReqId = null;

        // Fix RET-MS8DE75L to July REQ
        if (r.id === 'RET-MS8DE75L' || r.id === 'RET-MS8CY7BY') {
            targetReqId = julyReq.id;
        } else if (r.date && r.date.startsWith('2026-07')) {
            targetReqId = julyReq ? julyReq.id : juneReq.id;
        } else if (r.date && r.date.startsWith('2026-08')) {
            targetReqId = augustReq ? augustReq.id : juneReq.id;
        } else if (r.date && r.date.startsWith('2026-06')) {
            targetReqId = juneReq.id;
        }

        if (targetReqId && r.budgetRequestId !== targetReqId) {
            const updated = {
                ...r,
                budgetRequestId: targetReqId,
                requestId: targetReqId
            };

            const putRes = await fetch(`${API_URL}/budget-reports/${r.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updated)
            });

            if (putRes.ok) {
                updatedCount++;
            }
        }
    }

    console.log(`Successfully updated ${updatedCount} reports!`);
}

main();
