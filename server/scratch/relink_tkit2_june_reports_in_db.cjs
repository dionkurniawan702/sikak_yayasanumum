const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    console.log('Logging in to relink TKIT 2 June reports in server DB...');
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

    const juneReq = budgetRequests.find(r => r.id === 'REQ-MQERNJL9-GNQ');
    const juneItemMap = new Map();
    (juneReq.items || []).forEach(item => {
        const cleanName = (item.name || '').trim().toLowerCase();
        if (cleanName) juneItemMap.set(cleanName, item);
    });

    console.log(`June REQ has ${juneItemMap.size} item names.`);

    const relinkedReportsOnly = [];
    budgetReports.forEach(r => {
        if ((r.unitId === unitId || r.fieldId === unitId) && !r.isDeleted && r.kategoriAset !== 'PENGEMBALIAN') {
            const catName = (r.category || r.description || '').trim().toLowerCase();
            const matchingItem = juneItemMap.get(catName);
            if (matchingItem) {
                if (r.budgetRequestId !== juneReq.id || r.requestId !== juneReq.id) {
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

    console.log(`Relinking ${relinkedReportsOnly.length} TKIT 2 reports to June REQ [${juneReq.id}]...`);
    relinkedReportsOnly.forEach((r, idx) => {
        console.log(`${idx+1}. [${r.id}] Cat: "${r.category}" | Amt: Rp ${parseFloat(r.amount).toLocaleString('id-ID')} -> Set budgetRequestId: ${juneReq.id}`);
    });

    console.log('\nSending relinked reports to /api/sync...');
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
        console.error('Sync Error:', txt.slice(0, 300));
    } else {
        const syncJson = await syncRes.json();
        console.log('Sync result:', syncJson);
    }
}

main();
