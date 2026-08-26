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

    const { budgetRequests = [], budgetReports = [] } = state;

    const req1 = budgetRequests.find(r => r.id === 'REQ-MS5CRZJ3-U0Z');
    const req2 = budgetRequests.find(r => r.id === 'REQ-MSMN7I26-ZQ9');

    console.log('=== REQ 1: REQ-MS5CRZJ3-U0Z (Juli 2026) ===');
    console.log(`Month: ${req1.month} TotalAmount: ${req1.totalAmount}`);

    console.log('\n=== REQ 2: REQ-MSMN7I26-ZQ9 ===');
    console.log(`Month: ${req2.month} TotalAmount: ${req2.totalAmount}`);

    const priorReqIds = ['REQ-MS5CRZJ3-U0Z', 'REQ-MSMN7I26-ZQ9'];

    const reportsForReqs = budgetReports.filter(r => priorReqIds.includes(r.budgetRequestId) || priorReqIds.includes(r.requestId));

    console.log(`\nTotal reports for prior requests: ${reportsForReqs.length}`);

    let totalExpense = 0;
    let totalRefund = 0;

    reportsForReqs.forEach(r => {
        if (r.status === 'APPROVED' && !r.isDeleted) {
            const amt = parseFloat(r.amount || 0);
            if (r.kategoriAset === 'PENGEMBALIAN') {
                totalRefund += amt;
                console.log(`- REFUND Report [${r.id}] Amt: ${amt} Desc: "${r.description}"`);
            } else {
                totalExpense += amt;
            }
        }
    });

    console.log(`\nTotal Cair: ${parseFloat(req1.totalAmount) + parseFloat(req2.totalAmount)}`);
    console.log(`Total Expense (APPROVED): ${totalExpense}`);
    console.log(`Total Refund (APPROVED): ${totalRefund}`);
    console.log(`Remaining Unreturned Balance: ${(parseFloat(req1.totalAmount) + parseFloat(req2.totalAmount)) - totalExpense - totalRefund}`);
}

main().catch(console.error);
