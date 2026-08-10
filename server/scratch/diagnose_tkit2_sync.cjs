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

    console.log('=== TKIT 2 ALL REQUESTS ===');
    const reqs = budgetRequests.filter(r => r.unitId === unitId);
    reqs.forEach(r => {
        console.log(`REQ [${r.id}] Month: ${r.month} | Total Cair: ${r.totalAmount}`);
    });

    const juneReq = reqs.find(r => r.month === '2026-06' || r.month === 'Juni 2026');
    const julyReq = reqs.find(r => r.month === '2026-07' || r.month === 'Juli 2026');
    const augustReq = reqs.find(r => r.month === '2026-08' || r.month === 'Agustus 2026');

    console.log('\n=== REPORTS LINKED TO JUNE REQ [REQ-MQERNJL9-GNQ] ===');
    const juneReports = budgetReports.filter(r => (r.budgetRequestId === juneReq.id || r.requestId === juneReq.id) && !r.isDeleted && r.status !== 'REJECTED');

    let sumExpense = 0;
    let sumRefund = 0;

    juneReports.forEach(r => {
        const amt = parseFloat(r.amount || 0);
        if (r.kategoriAset === 'PENGEMBALIAN') {
            sumRefund += amt;
            console.log(`- REFUND: [${r.id}] Amt: ${amt} | Date: ${r.date?.slice(0,10)} | Desc: ${r.description}`);
        } else {
            sumExpense += amt;
        }
    });

    console.log(`\nJune REQ Total Cair: ${juneReq.totalAmount}`);
    console.log(`June REQ Expense Sum: ${sumExpense}`);
    console.log(`June REQ Refund Sum: ${sumRefund}`);
    console.log(`Total Pertanggungjawaban (Expense + Refund): ${sumExpense + sumRefund}`);
    console.log(`Over-budget Difference: ${juneReq.totalAmount - (sumExpense + sumRefund)}`);

    // Let's inspect the Refund Reports linked to June REQ in detail:
    console.log('\n--- REFUND REPORTS IN DETAIL ---');
    const refundReports = juneReports.filter(r => r.kategoriAset === 'PENGEMBALIAN');
    refundReports.forEach(r => {
        console.log(`ID: ${r.id} | Amt: ${r.amount} | Date: ${r.date?.slice(0,10)} | Desc: ${r.description}`);
    });

    // Let's inspect reports by original creation / date or category
    console.log('\n--- CHECKING JULY AND AUGUST REQS LINKED REPORTS ---');
    [julyReq, augustReq].forEach(req => {
        if (!req) return;
        const linked = budgetReports.filter(r => (r.budgetRequestId === req.id || r.requestId === req.id) && !r.isDeleted && r.status !== 'REJECTED');
        const exp = linked.filter(r => r.kategoriAset !== 'PENGEMBALIAN').reduce((s, r) => s + parseFloat(r.amount || 0), 0);
        const ref = linked.filter(r => r.kategoriAset === 'PENGEMBALIAN').reduce((s, r) => s + parseFloat(r.amount || 0), 0);
        console.log(`REQ [${req.id}] (${req.month}): Total Cair: ${req.totalAmount} | Reports count: ${linked.length} | Expense: ${exp} | Refund: ${ref}`);
    });
}

main();
