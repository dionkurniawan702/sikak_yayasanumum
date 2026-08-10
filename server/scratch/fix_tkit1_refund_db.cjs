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

    const { budgetReports = [] } = state;

    const refundReport = budgetReports.find(r => r.id === 'RET-MSIF5MD4');
    if (!refundReport) {
        console.error('Report RET-MSIF5MD4 not found');
        return;
    }

    console.log('Original Refund Report:', refundReport);

    // Relink to July 2026 Request ID: REQ-MQRM2SAA-A3E
    const updatedReport = {
        ...refundReport,
        budgetRequestId: 'REQ-MQRM2SAA-A3E',
        requestId: 'REQ-MQRM2SAA-A3E'
    };

    console.log('\nSyncing updated refund report via /api/sync...');
    const syncRes = await fetch(`${API_URL}/sync`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ budgetReports: [updatedReport] })
    });

    console.log('Response Status:', syncRes.status);
    if (!syncRes.ok) {
        const txt = await syncRes.text();
        console.error('Sync Error:', txt.slice(0, 300));
    } else {
        const syncJson = await syncRes.json();
        console.log('Sync result:', syncJson);
    }
}

main();
