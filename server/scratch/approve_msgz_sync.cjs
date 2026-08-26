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

    const { budgetRequests = [] } = state;
    const req = budgetRequests.find(r => r.id === 'REQ-MSGZQ7RE-MJX');

    if (!req) {
        console.error('Request REQ-MSGZQ7RE-MJX not found');
        return;
    }

    console.log('Approving REQ-MSGZQ7RE-MJX via /sync...');
    const updated = { ...req, status: 'APPROVED', notified: false };
    const newRequests = budgetRequests.map(r => r.id === 'REQ-MSGZQ7RE-MJX' ? updated : r);

    const syncRes = await fetch(`${API_URL}/sync`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ budgetRequests: newRequests })
    });

    console.log('Sync status:', syncRes.status, await syncRes.json());

    // Verify status
    const freshRes = await fetch(`${API_URL}/all-data`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const freshState = (await freshRes.json()).data;
    const freshReq = (freshState.budgetRequests || []).find(r => r.id === 'REQ-MSGZQ7RE-MJX');
    console.log('Fresh Status of REQ-MSGZQ7RE-MJX:', freshReq?.status);
}

main().catch(console.error);
