const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    try {
        console.log('Logging in...');
        const loginRes = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'adminpdk', password: 'admin123' })
        });
        const loginJson = await loginRes.json();
        const token = loginJson.data?.token;

        if (!token) {
            console.error('Login failed:', loginJson);
            return;
        }

        console.log('Fetching state...');
        const dataRes = await fetch(`${API_URL}/all-data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataJson = await dataRes.json();
        const state = dataJson.data;

        const { budgetRequests = [], units = [] } = state;
        const taudUnit = units.find(u => u.name && u.name.toUpperCase().includes('TAUD'));
        const juneReq = budgetRequests.find(r => r.unitId === taudUnit.id && r.month === '2026-06');

        if (!juneReq) {
            console.error('June REQ not found!');
            return;
        }

        console.log(`June REQ [${juneReq.id}] total items: ${juneReq.items?.length}`);

        // Update all items to have isClosed: true
        const updatedItems = (juneReq.items || []).map(item => ({
            ...item,
            isClosed: true
        }));

        const updatedReqPayload = {
            ...juneReq,
            items: updatedItems
        };

        console.log('Updating via PUT /api/budget-requests/' + juneReq.id + '...');
        const putRes = await fetch(`${API_URL}/budget-requests/${juneReq.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updatedReqPayload)
        });

        const putJson = await putRes.json();
        console.log('Update result status:', putRes.status);

        console.log('\nVerifying update...');
        const verifyRes = await fetch(`${API_URL}/all-data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const verifyJson = await verifyRes.json();
        const verifiedReq = verifyJson.data.budgetRequests.find(r => r.id === juneReq.id);

        const closedCount = verifiedReq.items?.filter(i => i.isClosed)?.length || 0;
        console.log(`AFTER UPDATE: Total items closed: ${closedCount} of ${verifiedReq.items?.length}`);

    } catch (err) {
        console.error('Error:', err);
    }
}

main();
