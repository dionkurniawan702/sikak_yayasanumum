const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    console.log('Logging in...');
    const loginRes = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'superadmin', password: 'password' })
    });
    let loginJson = await loginRes.json();
    let token = loginJson.data?.token || loginJson.token;

    if (!token) {
        // try adminpdk
        const res2 = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'adminpdk', password: 'admin123' })
        });
        const json2 = await res2.json();
        token = json2.data?.token || json2.token;
        console.log('adminpdk login result token:', !!token);
    }

    if (!token) {
        console.error('Login failed, loginJson:', loginJson);
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

    const juneReq = budgetRequests.find(r => r.id === 'REQ-MQERNJL9-GNQ');
    const juneItemMap = new Map();
    (juneReq.items || []).forEach(item => {
        const cleanName = (item.name || '').trim().toLowerCase();
        if (cleanName) juneItemMap.set(cleanName, item);
    });

    const relinkedReportsOnly = [];
    budgetReports.forEach(r => {
        if ((r.unitId === unitId || r.fieldId === unitId) && !r.isDeleted && r.kategoriAset !== 'PENGEMBALIAN') {
            const catName = (r.category || r.description || '').trim().toLowerCase();
            const matchingItem = juneItemMap.get(catName);
            if (matchingItem) {
                if (r.budgetRequestId !== juneReq.id || r.requestId !== juneReq.id || (matchingItem.componentId && r.componentId !== matchingItem.componentId)) {
                    relinkedReportsOnly.push({
                        ...r,
                        budgetRequestId: juneReq.id,
                        requestId: juneReq.id,
                        componentId: matchingItem.componentId || r.componentId
                    });
                }
            }
        }
    });

    console.log(`Sending ONLY ${relinkedReportsOnly.length} relinked reports to /api/sync...`);

    const syncRes = await fetch(`${API_URL}/sync`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ budgetReports: relinkedReportsOnly })
    });

    console.log('Response Status:', syncRes.status);
    if (!syncRes.ok) {
        const txt = await syncRes.text();
        console.error('Sync Error text snippet:', txt.slice(0, 300));
    } else {
        const syncJson = await syncRes.json();
        console.log('Sync result:', JSON.stringify(syncJson, null, 2));
    }
}

main();
