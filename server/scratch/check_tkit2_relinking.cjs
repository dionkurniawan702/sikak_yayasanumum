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

    const { budgetRequests = [], budgetReports = [], units = [] } = state;
    const tkit2 = units.find(u => u.name && u.name.toLowerCase().includes('tkit 2'));
    const unitId = tkit2.id;

    const juneReq = budgetRequests.find(r => r.unitId === unitId && (r.month === '2026-06' || r.month === 'Juni 2026'));
    const augustReq = budgetRequests.find(r => r.unitId === unitId && (r.month === '2026-08' || r.month === 'Agustus 2026'));

    console.log('June REQ ID:', juneReq?.id);
    console.log('August REQ ID:', augustReq?.id);

    console.log('\n--- REPORTS IN OTHER REQS THAT MATCH JUNE REQ ITEM NAMES ---');
    const nonJuneReports = budgetReports.filter(r => r.unitId === unitId && r.budgetRequestId !== juneReq.id && !r.isDeleted);

    nonJuneReports.forEach(r => {
        const catName = (r.category || r.description || '').trim().toLowerCase();
        const matchesJuneItem = (juneReq.items || []).find(i => (i.name || '').trim().toLowerCase() === catName);

        if (matchesJuneItem) {
            console.log(`Report [${r.id}] Amt: ${r.amount} | Date: ${r.date?.slice(0,10)} | LinkedToReq: ${r.budgetRequestId} | Matched June Item: "${matchesJuneItem.name}"`);
        }
    });

}

main();
