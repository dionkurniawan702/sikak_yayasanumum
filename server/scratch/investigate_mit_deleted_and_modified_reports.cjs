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

    const { budgetReports = [], budgetRequests = [], units = [] } = state;
    const mitUnit = units.find(u => u.name && u.name.toLowerCase().includes('mit'));

    console.log('=== ALL REPORTS FOR MIT UNIT (INCLUDING DELETED) ===');
    const mitReports = budgetReports.filter(r => r.unitId === mitUnit.id);
    console.log(`Total MIT reports count in state: ${mitReports.length}`);

    const deletedMitReports = mitReports.filter(r => r.isDeleted);
    console.log(`Total DELETED MIT reports count: ${deletedMitReports.length}`);
    deletedMitReports.forEach(r => {
        console.log(`[DELETED] ID: ${r.id} | Amt: ${r.amount} | Date: ${r.date} | Cat: ${r.category} | Desc: "${r.description}" | ReqId: ${r.budgetRequestId || r.requestId}`);
    });

    const juneReq = budgetRequests.find(r => r.unitId === mitUnit.id && (r.month === '2026-06' || r.month === 'Juni 2026'));
    console.log('\n=== JUNE REQ ITEMS AND THEIR REPORTED AMOUNTS ===');
    let totalReqItemsPagu = 0;
    let totalItemsReported = 0;

    (juneReq.items || []).forEach((item, idx) => {
        const pagu = parseFloat(item.amount || 0);
        totalReqItemsPagu += pagu;

        // Matching reports for this item
        const matchingReports = mitReports.filter(r => !r.isDeleted && r.status !== 'REJECTED' && r.kategoriAset !== 'PENGEMBALIAN' && (
            r.componentId ? r.componentId === item.componentId : (
                (r.budgetRequestId === juneReq.id || r.requestId === juneReq.id) &&
                (r.category === item.name || r.category?.toLowerCase() === item.name?.toLowerCase() || r.description?.toLowerCase() === item.name?.toLowerCase())
            )
        ));

        const reported = matchingReports.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
        totalItemsReported += reported;

        const diff = pagu - reported;
        if (diff !== 0) {
            console.log(`Item ${idx+1}: "${item.name}" | Pagu: ${pagu} | Reported: ${reported} | Diff: ${diff}`);
        }
    });

    console.log(`\nTotal REQ Pagu: ${totalReqItemsPagu}`);
    console.log(`Total Reported: ${totalItemsReported}`);
    console.log(`Unreported Diff (Pagu - Reported): ${totalReqItemsPagu - totalItemsReported}`);

    // Check if any report amount is near 445555 or 455000
    const near455 = mitReports.filter(r => Math.abs(parseFloat(r.amount) - 445555) < 20000 || Math.abs(parseFloat(r.amount) - 455000) < 20000);
    console.log('\nReports with amount near 445k/455k:', near455);
}

main().catch(console.error);
