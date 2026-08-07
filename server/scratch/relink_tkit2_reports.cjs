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
    const juneItemNames = new Set((juneReq.items || []).map(i => (i.name || '').trim().toLowerCase()));

    const otherReports = budgetReports.filter(r => r.unitId === unitId && r.budgetRequestId !== juneReq.id && !r.isDeleted && r.status !== 'REJECTED');

    const misplacedReports = otherReports.filter(r => {
        const catName = (r.category || r.description || '').trim().toLowerCase();
        return juneItemNames.has(catName);
    });

    console.log(`Relinking ${misplacedReports.length} misplaced reports for TKIT 2 to June REQ [${juneReq.id}]...`);

    const misplacedIds = new Set(misplacedReports.map(r => r.id));

    const updatedBudgetReports = budgetReports.map(r => {
        if (misplacedIds.has(r.id)) {
            return {
                ...r,
                budgetRequestId: juneReq.id,
                requestId: juneReq.id
            };
        }
        return r;
    });

    const newState = {
        ...state,
        budgetReports: updatedBudgetReports
    };

    console.log('Pushing updated state to remote server...');
    const syncRes = await fetch(`${API_URL}/sync-state`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ state: newState })
    });

    const syncJson = await syncRes.json();
    console.log('Sync result:', syncJson.success ? 'SUCCESS!' : syncJson);
}

main();
