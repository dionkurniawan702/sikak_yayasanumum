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

    const { budgetRequests = [], budgetReports = [], units = [], globalAcademicYearId } = state;

    const tkit2 = units.find(u => u.name && u.name.toLowerCase().includes('tkit 2'));
    if (!tkit2) {
        console.log('TKIT 2 unit not found!');
        return;
    }
    const unitId = tkit2.id;
    console.log(`TKIT 2 Unit ID: ${unitId}`);

    console.log('\n======================================================');
    console.log('1. ALL TKIT 2 BUDGET REQUESTS (SURAT PERMINTAAN DANA)');
    console.log('======================================================');
    const reqs = budgetRequests.filter(r => r.unitId === unitId);
    reqs.forEach((r, idx) => {
        console.log(`\n[REQ ${idx+1}] ID: ${r.id} | Month: ${r.month} | AcademicYear: ${r.academicYearId} | Status: ${r.status} | Source: ${r.source} | Total Cair: ${r.totalAmount}`);
        console.log(`  Description: ${r.description}`);
        if (r.items) {
            console.log(`  Items count: ${r.items.length}`);
            r.items.forEach((item, itemIdx) => {
                console.log(`    - Item ${itemIdx+1}: "${item.name}" | Amount: ${item.amount} | CompId: ${item.componentId}`);
            });
        }
    });

    console.log('\n======================================================');
    console.log('2. ALL TKIT 2 BUDGET REPORTS (NOTA-NOTA PENGELUARAN)');
    console.log('======================================================');
    const reports = budgetReports.filter(r => r.unitId === unitId && !r.isDeleted);
    console.log(`Total active reports for TKIT 2: ${reports.length}`);

    // Group reports by r.budgetRequestId || r.requestId
    const reportsByReqId = {};
    const unlinkedReports = [];

    reports.forEach(r => {
        const reqId = r.budgetRequestId || r.requestId;
        if (reqId) {
            if (!reportsByReqId[reqId]) reportsByReqId[reqId] = [];
            reportsByReqId[reqId].push(r);
        } else {
            unlinkedReports.push(r);
        }
    });

    console.log(`\nUnlinked reports (no budgetRequestId): ${unlinkedReports.length}`);
    unlinkedReports.forEach(r => {
        console.log(`  - [${r.id}] Amt: ${r.amount} | Date: ${r.date} | Kat: ${r.kategoriAset} | Cat: ${r.category} | Desc: ${r.description}`);
    });

    console.log('\n======================================================');
    console.log('3. LINKED REPORTS BREAKDOWN PER REQUEST');
    console.log('======================================================');

    reqs.forEach(req => {
        const linked = reportsByReqId[req.id] || [];
        console.log(`\n>>> REQUEST [${req.id}] Month: ${req.month} | Total Cair: ${req.totalAmount} <<<`);
        console.log(`    Total Linked Reports: ${linked.length}`);

        let expSum = 0;
        let refSum = 0;
        let rejectedSum = 0;

        linked.forEach((r, idx) => {
            const amt = parseFloat(r.amount || 0);
            if (r.status === 'REJECTED') {
                rejectedSum += amt;
            } else if (r.kategoriAset === 'PENGEMBALIAN') {
                refSum += amt;
            } else {
                expSum += amt;
            }
            console.log(`    - Report ${idx+1} [${r.id}] Status: ${r.status} | Kat: ${r.kategoriAset} | Amt: ${amt} | Date: ${r.date?.slice(0,10)} | Cat: ${r.category} | Desc: ${r.description}`);
        });

        console.log(`    SUMMARY FOR REQ ${req.id} (${req.month}):`);
        console.log(`      Total Cair: ${req.totalAmount}`);
        console.log(`      Total Expense (ACC/DRAFT/PENDING): ${expSum}`);
        console.log(`      Total Refund (PENGEMBALIAN): ${refSum}`);
        console.log(`      Total Sisa (Total Cair - Expense - Refund): ${parseFloat(req.totalAmount||0) - (expSum + refSum)}`);
    });

    console.log('\n======================================================');
    console.log('4. CHECKING DATE MISMATCHES OR ITEM MISMATCHES');
    console.log('======================================================');
    reports.forEach(r => {
        const reqId = r.budgetRequestId || r.requestId;
        const linkedReq = reqs.find(b => b.id === reqId);
        const reportMonth = r.date ? r.date.slice(0, 7) : 'NO_DATE';
        
        if (linkedReq && reportMonth !== linkedReq.month) {
            console.log(`[DATE DIFFERENCE] Report [${r.id}] Date is "${reportMonth}" BUT linked to REQ [${linkedReq.id}] Month "${linkedReq.month}"!`);
            console.log(`   Amount: ${r.amount} | Cat: ${r.category} | Desc: ${r.description}`);
        }
    });

}

main();
