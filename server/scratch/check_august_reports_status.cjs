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

    const { budgetReports = [], units = [] } = state;
    const tkit2 = units.find(u => u.name && u.name.toLowerCase().includes('tkit 2'));
    const unitId = tkit2.id;

    const tkitReports = budgetReports.filter(r => (r.unitId === unitId || r.fieldId === unitId) && !r.isDeleted);
    console.log(`=== TKIT 2 BUDGET REPORTS IN DB (${tkitReports.length} total) ===\n`);

    const augReports = tkitReports.filter(r => {
        const d = r.date || '';
        return r.budgetRequestId === 'REQ-MS8DMK30-P58' || r.requestId === 'REQ-MS8DMK30-P58' || d.startsWith('2026-08');
    });

    console.log(`Found ${augReports.length} reports associated with August / August request:`);
    augReports.forEach((r, idx) => {
        console.log(`${idx+1}. [${r.id}] Tgl: ${r.date?.slice(0,10)} | No Nota: "${r.nomorNota || '-'}" | Category: "${r.category}" | Desc: "${r.description}" | Amt: Rp ${parseFloat(r.amount).toLocaleString('id-ID')} | Status: ${r.status} | ReqId: ${r.budgetRequestId || r.requestId}`);
    });
}

main();
