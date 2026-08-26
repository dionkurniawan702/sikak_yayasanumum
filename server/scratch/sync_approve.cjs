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
    const reqAgustus = budgetRequests.find(r => r.id === 'REQ-MSR5S6GC-R93');

    if (!reqAgustus) {
        console.error('REQ-MSR5S6GC-R93 not found');
        return;
    }

    console.log('Current status of REQ-MSR5S6GC-R93:', reqAgustus.status);

    const updatedAgustus = {
        ...reqAgustus,
        status: 'APPROVED',
        notified: false
    };

    const newRequests = budgetRequests.map(r => r.id === 'REQ-MSR5S6GC-R93' ? updatedAgustus : r);

    console.log('Syncing state with REQ-MSR5S6GC-R93 APPROVED via POST /sync...');
    const syncRes = await fetch(`${API_URL}/sync`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            budgetRequests: newRequests
        })
    });

    const syncJson = await syncRes.json();
    console.log('Sync status:', syncRes.status);
    console.log('Sync response:', syncJson);

    // Verify
    const checkRes = await fetch(`${API_URL}/all-data`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const checkState = (await checkRes.json()).data;
    const checkReq = (checkState.budgetRequests || []).find(r => r.id === 'REQ-MSR5S6GC-R93');
    console.log('\nVerified REQ-MSR5S6GC-R93 status on server:', checkReq?.status);
}

main().catch(console.error);
