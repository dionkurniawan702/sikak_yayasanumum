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

    console.log('State keys:', Object.keys(state));
    console.log('academicYears:', state.academicYears);
    console.log('globalAcademicYearId:', state.globalAcademicYearId);

    const { budgetRequests = [], budgetReports = [], units = [] } = state;
    const activeYear = (state.academicYears || []).find(y => y.isCurrent || y.status === 'Aktif');
    const academicYearId = activeYear ? activeYear.id : (state.globalAcademicYearId || null);
    console.log('Resolved academicYearId:', academicYearId);

    const mitUnit = units.find(u => u.name && u.name.toLowerCase().includes('mit'));
    const myUnitId = mitUnit.id;

    // Filter budgetReports for MIT:
    const mitReports = budgetReports.filter(r => r.unitId === myUnitId && !r.isDeleted);
    console.log(`Total active MIT reports in state: ${mitReports.length}`);

    // Print breakdown of academicYearId on mitReports:
    const yearCounts = {};
    mitReports.forEach(r => {
        const y = r.academicYearId || 'NO_YEAR';
        yearCounts[y] = (yearCounts[y] || 0) + 1;
    });
    console.log('Report counts by academicYearId:', yearCounts);

    // Print breakdown of requests by month for MIT:
    const mitReqs = budgetRequests.filter(r => r.unitId === myUnitId);
    console.log('\nMIT Requests:');
    mitReqs.forEach(r => {
        console.log(`REQ [${r.id}] Month: ${r.month}, YearId: ${r.academicYearId}, Status: ${r.status}, Amount: ${r.totalAmount}`);
    });

    const juneReq = mitReqs.find(r => r.month === '2026-06' || r.month === 'Juni 2026');
    console.log('\nJune 2026 REQ resolved:', juneReq);

    // Let's check reports for June REQ:
    const reportsForJuneReq = mitReports.filter(r => {
        const reqId = r.budgetRequestId || r.requestId;
        return juneReq && reqId === juneReq.id;
    });

    console.log(`\nReports tied to REQ ${juneReq?.id}: ${reportsForJuneReq.length}`);
    let sumExpenseForJuneReq = 0;
    let sumRefundForJuneReq = 0;
    reportsForJuneReq.forEach(r => {
        if (r.status === 'REJECTED') return;
        const amt = parseFloat(r.amount || 0);
        console.log(`- [${r.id}] Status: ${r.status}, Kat: ${r.kategoriAset}, Amount: ${amt}, Cat: ${r.category}`);
        if (r.kategoriAset === 'PENGEMBALIAN') {
            sumRefundForJuneReq += amt;
        } else {
            sumExpenseForJuneReq += amt;
        }
    });

    console.log(`\nSum Expense for June REQ: ${sumExpenseForJuneReq}`);
    console.log(`Sum Refund for June REQ: ${sumRefundForJuneReq}`);
    console.log(`Sum Expense + Refund for June REQ: ${sumExpenseForJuneReq + sumRefundForJuneReq}`);
    console.log(`June REQ Total Cair: ${juneReq?.totalAmount}`);
    console.log(`Difference (Total Cair - (Expense + Refund)): ${parseFloat(juneReq?.totalAmount || 0) - (sumExpenseForJuneReq + sumRefundForJuneReq)}`);
}

main();
