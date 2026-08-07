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
    const mitUnit = units.find(u => u.name && u.name.toLowerCase().includes('mit'));
    const unitId = mitUnit.id;

    console.log('=== MIT REQUESTS FOR JUNE 2026 ===');
    const juneReqs = budgetRequests.filter(r => r.unitId === unitId && (r.month === '2026-06' || r.month === 'Juni 2026'));
    juneReqs.forEach(r => {
        console.log(`REQ ID: ${r.id} | Month: ${r.month} | TotalAmount: ${r.totalAmount} | Status: ${r.status}`);
    });

    console.log('\n=== MIT REPORTS FOR JUNE 2026 (BY REQ OR DATE) ===');
    const juneReports = budgetReports.filter(r => {
        if (r.unitId !== unitId || r.isDeleted || r.status === 'REJECTED') return false;
        const req = budgetRequests.find(br => br.id === (r.budgetRequestId || r.requestId));
        const reqMonth = req ? req.month : null;
        const isJuneReq = reqMonth === '2026-06' || reqMonth === 'Juni 2026';
        const isJuneDate = r.date && r.date.startsWith('2026-06');
        return isJuneReq || isJuneDate;
    });

    console.log(`Found ${juneReports.length} reports in June 2026:`);
    let totalNonRefund = 0;
    let totalRefund = 0;
    juneReports.forEach(r => {
        const amt = parseFloat(r.amount || 0);
        const req = budgetRequests.find(br => br.id === (r.budgetRequestId || r.requestId));
        console.log(`- [${r.id}] Status: ${r.status} | Kat: ${r.kategoriAset} | Amount: ${amt} | Date: ${r.date?.slice(0,10)} | ReqId: ${r.budgetRequestId || r.requestId} (${req?.month}) | Cat: ${r.category} | Desc: ${r.description}`);
        if (r.kategoriAset === 'PENGEMBALIAN') {
            totalRefund += amt;
        } else {
            totalNonRefund += amt;
        }
    });

    console.log('\n--- SUMMARY IN SCRIPT ---');
    console.log(`Total Non-Pengembalian (Pengeluaran): ${totalNonRefund}`);
    console.log(`Total Pengembalian: ${totalRefund}`);

    // Now let's check how MonthlyReport.jsx filters `baseReports` and calculates totalPengeluaran in frontend:
    // In MonthlyReport.jsx:
    // baseReports = budgetReports.filter(rel => rel.academicYearId === globalAcademicYearId && rel.unitId === unitId)
    // totalPengeluaran = baseReports.filter(r => {
    //    if (r.kategoriAset === 'PENGEMBALIAN' || r.status === 'REJECTED' || r.isDeleted) return false;
    //    if (pendingMonthFilter !== 'ALL') {
    //        const req = resolveReportRequest(r, budgetRequests, globalAcademicYearId);
    //        if (req) return req.month === pendingMonthFilter;
    //        return r.date ? r.date.startsWith(pendingMonthFilter) : false;
    //    }
    //    return true;
    // }).reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

    const baseReports = budgetReports.filter(r => r.academicYearId === globalAcademicYearId && r.unitId === unitId);
    const pendingMonthFilter = '2026-06';

    const feTotalPengeluaran = baseReports.filter(r => {
        if (r.kategoriAset === 'PENGEMBALIAN' || r.status === 'REJECTED' || r.isDeleted) return false;
        if (pendingMonthFilter !== 'ALL') {
            const req = budgetRequests.find(br => br.id === (r.budgetRequestId || r.requestId));
            if (req) {
                return req.month === pendingMonthFilter;
            }
            return r.date ? r.date.startsWith(pendingMonthFilter) : false;
        }
        return true;
    }).reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

    console.log(`Frontend simulated totalPengeluaran for 2026-06: ${feTotalPengeluaran}`);
}

main();
