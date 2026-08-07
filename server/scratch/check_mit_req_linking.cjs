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
    const mitUnit = units.find(u => u.name && u.name.toLowerCase().includes('mit'));
    const myUnitId = mitUnit.id;

    const juneReq = budgetRequests.find(r => r.unitId === myUnitId && (r.month === '2026-06' || r.month === 'Juni 2026'));
    console.log('June REQ ID:', juneReq.id);
    console.log('June REQ Total Cair:', juneReq.totalAmount);

    // Find all reports explicitly linked via budgetRequestId or requestId to juneReq.id
    const explicitJuneReports = budgetReports.filter(r => (r.budgetRequestId === juneReq.id || r.requestId === juneReq.id) && !r.isDeleted);
    console.log(`Explicit reports linked to June REQ: ${explicitJuneReports.length}`);

    let totalExpenseExplicit = 0;
    let totalRefundExplicit = 0;

    explicitJuneReports.forEach(r => {
        if (r.status === 'REJECTED') return;
        const amt = parseFloat(r.amount || 0);
        if (r.kategoriAset === 'PENGEMBALIAN') totalRefundExplicit += amt;
        else totalExpenseExplicit += amt;
    });

    console.log(`Explicit Expense Total: ${totalExpenseExplicit}`);
    console.log(`Explicit Refund Total: ${totalRefundExplicit}`);

    // Check if there are any reports for MIT that DO NOT have budgetRequestId set, but might belong to June REQ
    const unlinkedReports = budgetReports.filter(r => r.unitId === myUnitId && !r.budgetRequestId && !r.requestId && !r.isDeleted);
    console.log(`Unlinked reports for MIT (no budgetRequestId): ${unlinkedReports.length}`);

    // Check if there are any reports with budgetRequestId pointing to another REQ or null
    console.log('\n--- CHECKING ALL MIT REQS AND THEIR LINKED REPORTS ---');
    const mitReqs = budgetRequests.filter(r => r.unitId === myUnitId);
    mitReqs.forEach(req => {
        const reqReports = budgetReports.filter(r => (r.budgetRequestId === req.id || r.requestId === req.id) && !r.isDeleted && r.status !== 'REJECTED');
        const expSum = reqReports.filter(r => r.kategoriAset !== 'PENGEMBALIAN').reduce((s, r) => s + parseFloat(r.amount || 0), 0);
        const refSum = reqReports.filter(r => r.kategoriAset === 'PENGEMBALIAN').reduce((s, r) => s + parseFloat(r.amount || 0), 0);
        console.log(`REQ [${req.id}] Month: ${req.month} | Total Cair: ${req.totalAmount} | Reports: ${reqReports.length} | Exp: ${expSum} | Ref: ${refSum} | Sisa: ${parseFloat(req.totalAmount) - (expSum + refSum)}`);
    });
}

main();
