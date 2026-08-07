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
    console.log('=== JUNE 2026 REQ DETAILS ===');
    console.log(`REQ ID: ${juneReq.id}`);
    console.log(`REQ Total Amount: ${juneReq.totalAmount}`);

    const juneReports = budgetReports.filter(r => (r.budgetRequestId === juneReq.id || r.requestId === juneReq.id) && !r.isDeleted && r.status !== 'REJECTED');

    console.log(`Total reports for June REQ: ${juneReports.length}`);

    let totalExpense = 0;
    let totalRefund = 0;

    juneReports.forEach(r => {
        const amt = parseFloat(r.amount || 0);
        if (r.kategoriAset === 'PENGEMBALIAN') {
            totalRefund += amt;
            console.log(`- REFUND REPORT [${r.id}] Amount: ${amt}, Desc: ${r.description}`);
        } else {
            totalExpense += amt;
        }
    });

    console.log(`Total Expense: ${totalExpense}`);
    console.log(`Total Refund: ${totalRefund}`);
    console.log(`Total Expense + Refund: ${totalExpense + totalRefund}`);
    console.log(`Diff (Total Cair - (Expense + Refund)): ${juneReq.totalAmount - (totalExpense + totalRefund)}`);

    // Let's check item by item in juneReq:
    console.log('\n=== ITEM BY ITEM BREAKDOWN IN JUNE REQ ===');
    let sumReqItems = 0;
    let sumReportedItems = 0;

    (juneReq.items || []).forEach((item, idx) => {
        const itemPagu = parseFloat(item.amount || 0);
        sumReqItems += itemPagu;

        const itemReports = juneReports.filter(r => r.kategoriAset !== 'PENGEMBALIAN' && (r.componentId ? r.componentId === item.componentId : (r.category === item.name || r.category?.toLowerCase() === item.name?.toLowerCase())));
        const itemReported = itemReports.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
        sumReportedItems += itemReported;

        const itemDiff = itemPagu - itemReported;
        if (itemDiff !== 0) {
            console.log(`Item ${idx+1}: "${item.name}" | Pagu: ${itemPagu} | Reported: ${itemReported} | Diff: ${itemDiff}`);
        }
    });

    console.log(`\nSum of REQ Items Pagu: ${sumReqItems}`);
    console.log(`Sum of Item Reported: ${sumReportedItems}`);
    console.log(`Unreported / Remaining Pagu before Refund: ${sumReqItems - sumReportedItems}`);
    console.log(`Actual Refund Report Amount: ${totalRefund}`);
    console.log(`Difference between Unreported Pagu and Refund Report: ${(sumReqItems - sumReportedItems) - totalRefund}`);
}

main();
