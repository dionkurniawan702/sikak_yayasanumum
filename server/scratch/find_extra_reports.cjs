const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

function resolveReportRequest(report, budgetRequests, academicYearId) {
    if (!report) return null;
    const reqId = report.budgetRequestId || report.requestId;
    if (reqId) {
        const found = budgetRequests.find(r => r.id === reqId);
        if (found) return found;
    }
    // Fallback: match by date month and unit
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

    const juneReq = budgetRequests.find(r => r.unitId === myUnitId && (r.month === '2026-06' || r.month === 'Juni 2026'));

    const baseReports = (budgetReports || []).filter(rel => {
        if (rel.academicYearId && globalAcademicYearId && rel.academicYearId !== globalAcademicYearId) return false;
        const isBosReport = rel.source === 'BOS' || rel.planId?.endsWith('-BOS');
        if (isBosReport) return false;
        return rel.unitId === myUnitId;
    });

    const pendingMonthFilter = '2026-06';

    const feReportsJune = baseReports.filter(r => {
        if (r.kategoriAset === 'PENGEMBALIAN' || r.status === 'REJECTED' || r.isDeleted) return false;
        if (pendingMonthFilter !== 'ALL') {
            const req = resolveReportRequest(r, budgetRequests, globalAcademicYearId);
            if (req) {
                return req.month === pendingMonthFilter;
            }
            return r.date ? r.date.startsWith(pendingMonthFilter) : false;
        }
        return true;
    });

    const totalPengeluaranFE = feReportsJune.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
    console.log(`FE Calculated totalPengeluaran for 2026-06: ${totalPengeluaranFE}`);

    console.log('\n--- Reports in FE totalPengeluaran that are NOT tied to June REQ (REQ-MPLVQKEG-U8C) ---');
    const extraReports = feReportsJune.filter(r => {
        const reqId = r.budgetRequestId || r.requestId;
        return reqId !== juneReq.id;
    });

    console.log(`Found ${extraReports.length} extra reports:`);
    let extraSum = 0;
    extraReports.forEach(r => {
        const req = resolveReportRequest(r, budgetRequests, globalAcademicYearId);
        const amt = parseFloat(r.amount || 0);
        extraSum += amt;
        console.log(`- [${r.id}] Status: ${r.status} | Amt: ${amt} | Date: ${r.date?.slice(0,10)} | ReqId: ${r.budgetRequestId||r.requestId} (ReqMonth: ${req?.month}) | Cat: ${r.category} | Desc: ${r.description}`);
    });
    console.log(`Extra Reports Sum: ${extraSum}`);
}

main();
