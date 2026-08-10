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
    const julyReq = budgetRequests.find(r => r.unitId === unitId && (r.month === '2026-07' || r.month === 'Juli 2026'));
    const augustReq = budgetRequests.find(r => r.unitId === unitId && (r.month === '2026-08' || r.month === 'Agustus 2026'));

    console.log(`June REQ: ${juneReq?.id} (Cair: ${juneReq?.totalAmount})`);
    console.log(`July REQ: ${julyReq?.id} (Cair: ${julyReq?.totalAmount})`);
    console.log(`August REQ: ${augustReq?.id} (Cair: ${augustReq?.totalAmount})`);

    const tkit2Reports = budgetReports.filter(r => r.unitId === unitId && !r.isDeleted && r.status !== 'REJECTED');

    // Let's check reports that have dates in July (2026-07) vs June (2026-06) vs August (2026-08)
    const juneDateReports = tkit2Reports.filter(r => r.date && r.date.startsWith('2026-06'));
    const julyDateReports = tkit2Reports.filter(r => r.date && r.date.startsWith('2026-07'));
    const augustDateReports = tkit2Reports.filter(r => r.date && r.date.startsWith('2026-08'));

    console.log(`Reports by Date: June=${juneDateReports.length}, July=${julyDateReports.length}, August=${augustDateReports.length}`);

    // Let's check total amounts by Date:
    const juneExpDate = juneDateReports.filter(r => r.kategoriAset !== 'PENGEMBALIAN').reduce((s, r) => s + parseFloat(r.amount || 0), 0);
    const julyExpDate = julyDateReports.filter(r => r.kategoriAset !== 'PENGEMBALIAN').reduce((s, r) => s + parseFloat(r.amount || 0), 0);
    const augustExpDate = augustDateReports.filter(r => r.kategoriAset !== 'PENGEMBALIAN').reduce((s, r) => s + parseFloat(r.amount || 0), 0);

    const juneRefDate = juneDateReports.filter(r => r.kategoriAset === 'PENGEMBALIAN').reduce((s, r) => s + parseFloat(r.amount || 0), 0);
    const julyRefDate = julyDateReports.filter(r => r.kategoriAset === 'PENGEMBALIAN').reduce((s, r) => s + parseFloat(r.amount || 0), 0);
    const augustRefDate = augustDateReports.filter(r => r.kategoriAset === 'PENGEMBALIAN').reduce((s, r) => s + parseFloat(r.amount || 0), 0);

    console.log(`\nBy Date Breakdown:`);
    console.log(`June Date (2026-06): Exp = ${juneExpDate}, Ref = ${juneRefDate}`);
    console.log(`July Date (2026-07): Exp = ${julyExpDate}, Ref = ${julyRefDate}`);
    console.log(`August Date (2026-08): Exp = ${augustExpDate}, Ref = ${augustRefDate}`);

    console.log('\n--- REFUND REPORTS IN TKIT 2 ---');
    tkit2Reports.filter(r => r.kategoriAset === 'PENGEMBALIAN').forEach(r => {
        console.log(`[${r.id}] Amt: ${r.amount} | Date: ${r.date?.slice(0,10)} | LinkedToReq: ${r.budgetRequestId} | Desc: ${r.description}`);
    });
}

main();
