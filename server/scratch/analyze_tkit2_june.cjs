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

    console.log('=== TKIT 2 REQUESTS ===');
    const tkit2Reqs = budgetRequests.filter(r => r.unitId === unitId);
    tkit2Reqs.forEach(r => {
        console.log(`REQ [${r.id}] Month: ${r.month} | Total Cair: ${r.totalAmount} | Status: ${r.status} | Source: ${r.source}`);
    });

    const juneReq = tkit2Reqs.find(r => r.month === '2026-06' || r.month === 'Juni 2026');
    console.log('\n=== JUNE 2026 REQ DETAIL ===');
    console.log(`REQ ID: ${juneReq.id} | Total Amount: ${juneReq.totalAmount}`);
    console.log('Items in June REQ:');
    (juneReq.items || []).forEach((it, idx) => {
        console.log(`  ${idx+1}. "${it.name}" | Amount: ${it.amount} | CompId: ${it.componentId}`);
    });

    const juneReports = budgetReports.filter(r => (r.budgetRequestId === juneReq.id || r.requestId === juneReq.id) && !r.isDeleted);
    console.log(`\nTotal reports linked to June REQ: ${juneReports.length}`);

    let sumExpense = 0;
    let sumRefund = 0;
    let sumRejected = 0;

    console.log('\n--- ALL REPORTS LINKED TO JUNE REQ ---');
    juneReports.forEach((r, idx) => {
        const amt = parseFloat(r.amount || 0);
        console.log(`${idx+1}. [${r.id}] Status: ${r.status} | Kat: ${r.kategoriAset} | Amount: ${amt} | Date: ${r.date?.slice(0,10)} | Cat: ${r.category} | Desc: ${r.description}`);

        if (r.status === 'REJECTED') {
            sumRejected += amt;
        } else if (r.kategoriAset === 'PENGEMBALIAN') {
            sumRefund += amt;
        } else {
            sumExpense += amt;
        }
    });

    console.log(`\nExpense Sum (Non-Pengembalian, Non-Rejected): ${sumExpense}`);
    console.log(`Refund Sum (PENGEMBALIAN, Non-Rejected): ${sumRefund}`);
    console.log(`Rejected Sum: ${sumRejected}`);
    console.log(`Total Cair: ${juneReq.totalAmount}`);
    console.log(`Total Cair - Expense: ${parseFloat(juneReq.totalAmount) - sumExpense}`);
    console.log(`Total Cair - Expense - Refund: ${parseFloat(juneReq.totalAmount) - (sumExpense + sumRefund)}`);

    // Check Pengembalian Reports linked to June REQ in detail:
    console.log('\n--- DETAIL PENGEMBALIAN REPORTS IN JUNE REQ ---');
    juneReports.filter(r => r.kategoriAset === 'PENGEMBALIAN').forEach(r => {
        console.log(`ID: ${r.id} | Amount: ${r.amount} | Status: ${r.status} | Date: ${r.date} | Desc: ${r.description}`);
    });
}

main();
