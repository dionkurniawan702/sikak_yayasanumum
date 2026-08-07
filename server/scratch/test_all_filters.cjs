const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

function resolveReportRequest(report, budgetRequests, academicYearId) {
    if (!report) return null;
    const reqId = report.budgetRequestId || report.requestId;
    if (reqId) {
        const found = budgetRequests.find(r => r.id === reqId);
        if (found) return found;
    }
    if (report.date) {
        const reportMonth = report.date.slice(0, 7);
        const match = budgetRequests.find(r => {
            if (academicYearId && r.academicYearId !== academicYearId) return false;
            const isSameUnit = (r.unitId && r.unitId === report.unitId) || (r.fieldId && r.fieldId === report.fieldId);
            return isSameUnit && r.month === reportMonth;
        });
        if (match) return match;
    }
    return null;
}

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
    const activeYear = (state.academicYears || []).find(y => y.isCurrent || y.status === 'Aktif');
    const globalAcademicYearId = activeYear ? activeYear.id : state.globalAcademicYearId;

    const mitUnit = units.find(u => u.name && u.name.toLowerCase().includes('mit'));
    const myUnitId = mitUnit.id;

    const baseReports = (budgetReports || []).filter(rel => {
        if (rel.academicYearId && globalAcademicYearId && rel.academicYearId !== globalAcademicYearId) return false;
        const isBosReport = rel.source === 'BOS' || rel.planId?.endsWith('-BOS');
        if (isBosReport) return false;
        return rel.unitId === myUnitId;
    });

    console.log(`Total baseReports: ${baseReports.length}`);

    // Let's test all distinct months in budgetRequests & budgetReports
    const allMonths = new Set();
    budgetRequests.forEach(r => r.month && allMonths.add(r.month));
    budgetReports.forEach(r => r.date && allMonths.add(r.date.slice(0, 7)));

    console.log('\n--- TESTING TOTALS FOR DIFFERENT MONTH FILTERS ---');
    for (const filter of ['ALL', ...Array.from(allMonths)]) {
        const approvedReqsInFilter = budgetRequests
            .filter(r => r.academicYearId === globalAcademicYearId || !r.academicYearId)
            .filter(r => r.unitId === myUnitId)
            .filter(r => r.status === 'APPROVED')
            .filter(r => filter === 'ALL' || r.month === filter);

        const totalCair = approvedReqsInFilter.reduce((s, r) => s + parseFloat(r.totalAmount || 0), 0);

        const totalPengeluaran = baseReports.filter(r => {
            if (r.kategoriAset === 'PENGEMBALIAN' || r.status === 'REJECTED' || r.isDeleted) return false;
            if (filter !== 'ALL') {
                const req = resolveReportRequest(r, budgetRequests, globalAcademicYearId);
                if (req) {
                    return req.month === filter;
                }
                return r.date ? r.date.startsWith(filter) : false;
            }
            return true;
        }).reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

        const totalPengembalian = baseReports.filter(r => {
            if (r.kategoriAset !== 'PENGEMBALIAN' || r.status === 'REJECTED' || r.isDeleted) return false;
            if (filter !== 'ALL') {
                const req = resolveReportRequest(r, budgetRequests, globalAcademicYearId);
                if (req) {
                    return req.month === filter;
                }
                return r.date ? r.date.startsWith(filter) : false;
            }
            return true;
        }).reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

        const totalSisa = Math.max(0, totalCair - totalPengeluaran);

        console.log(`Filter [${filter}]: TotalCair=${totalCair} | TotalPengeluaran=${totalPengeluaran} | TotalSisa=${totalSisa} | TotalPengembalian=${totalPengembalian}`);
    }
}

main();
