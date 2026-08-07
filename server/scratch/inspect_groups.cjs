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

    console.log('=== ALL MIT REPORTS (NOT DELETED) ===');
    const mitReports = budgetReports.filter(r => r.unitId === myUnitId && !r.isDeleted);
    console.log(`Total MIT active reports: ${mitReports.length}`);

    // Group reports by r.budgetRequestId || r.requestId
    const reqGroups = {};
    mitReports.forEach(r => {
        const reqId = r.budgetRequestId || r.requestId || 'NO_REQ_ID';
        if (!reqGroups[reqId]) reqGroups[reqId] = [];
        reqGroups[reqId].push(r);
    });

    for (const [reqId, reps] of Object.entries(reqGroups)) {
        const req = budgetRequests.find(b => b.id === reqId);
        let sumExpense = 0;
        let sumRefund = 0;
        reps.forEach(r => {
            if (r.status === 'REJECTED') return;
            const amt = parseFloat(r.amount || 0);
            if (r.kategoriAset === 'PENGEMBALIAN') sumRefund += amt;
            else sumExpense += amt;
        });
        console.log(`\nREQ ID: ${reqId} (Month: ${req?.month}, TotalCair: ${req?.totalAmount})`);
        console.log(`  Reports count: ${reps.length} | Expense Sum: ${sumExpense} | Refund Sum: ${sumRefund}`);
        if (reps.some(r => r.date && req?.month && !r.date.startsWith(req.month))) {
            console.log('  [NOTE] Contains reports with dates outside req.month!');
            reps.filter(r => r.date && req?.month && !r.date.startsWith(req.month)).forEach(r => {
                console.log(`    - Report [${r.id}] Date: ${r.date} | Kat: ${r.kategoriAset} | Amount: ${r.amount} | Cat: ${r.category}`);
            });
        }
    }
}

main();
