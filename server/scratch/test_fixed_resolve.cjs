const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

// FIXED resolveReportRequest function: check budgetRequestId FIRST!
function resolveReportRequestFixed(report, budgetRequests, globalAcademicYearId) {
    if (!report || !budgetRequests || budgetRequests.length === 0) return null;

    // 1. Check exact budgetRequestId / requestId FIRST!
    const rReqId = report.budgetRequestId || report.requestId;
    if (rReqId) {
        const found = budgetRequests.find(r => r.id === rReqId);
        if (found) return found;
    }

    // 2. Check matching componentId in approved budgetRequests
    if (report.componentId) {
        const found = budgetRequests.find(r => 
            r.status === 'APPROVED' && 
            r.items && 
            r.items.some(i => i.componentId === report.componentId)
        );
        if (found) return found;
    }

    // 3. Search for approved budgetRequest that actually contains this item by name (category or description)
    const reportItemName = (report.category || report.description || '').trim().toLowerCase();
    if (reportItemName) {
        const foundByName = budgetRequests.find(r => 
            r.status === 'APPROVED' &&
            (report.unitId ? (r.unitId === report.unitId || r.fieldId === report.unitId) : true) &&
            r.items &&
            r.items.some(i => (i.name || '').trim().toLowerCase() === reportItemName)
        );
        if (foundByName) return foundByName;
    }

    // 4. Fallback: match by date month and unit
    if (report.date) {
        const reportMonth = report.date.slice(0, 7);
        const match = budgetRequests.find(r => {
            if (globalAcademicYearId && r.academicYearId !== globalAcademicYearId) return false;
            const isSameUnit = (r.unitId && r.unitId === report.unitId) || (r.fieldId && r.fieldId === report.fieldId);
            return isSameUnit && r.month === reportMonth;
        });
        if (match) return match;
    }

    return null;
}

// ORIGINAL resolveReportRequest function (buggy)
function resolveReportRequestBuggy(report, budgetRequests, globalAcademicYearId) {
    if (!report || !budgetRequests || budgetRequests.length === 0) return null;

    if (report.componentId) {
        const found = budgetRequests.find(r => 
            r.status === 'APPROVED' && 
            r.items && 
            r.items.some(i => i.componentId === report.componentId)
        );
        if (found) return found;
    }

    const reportItemName = (report.category || report.description || '').trim().toLowerCase();
    if (reportItemName) {
        const foundByName = budgetRequests.find(r => 
            r.status === 'APPROVED' &&
            (report.unitId ? (r.unitId === report.unitId || r.fieldId === report.unitId) : true) &&
            r.items &&
            r.items.some(i => (i.name || '').trim().toLowerCase() === reportItemName)
        );
        if (foundByName) return foundByName;
    }

    const rReqId = report.budgetRequestId || report.requestId;
    if (rReqId) {
        const found = budgetRequests.find(r => r.id === rReqId);
        if (found) return found;
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

    const pendingMonthFilter = '2026-06';

    const baseReports = (budgetReports || []).filter(rel => {
        if (rel.academicYearId && globalAcademicYearId && rel.academicYearId !== globalAcademicYearId) return false;
        const isBosReport = rel.source === 'BOS' || rel.planId?.endsWith('-BOS');
        if (isBosReport) return false;
        return rel.unitId === myUnitId;
    });

    console.log('=== BUGGY RESOLVE OUTPUT FOR JUNE 2026 ===');
    const totalPengeluaranBuggy = baseReports.filter(r => {
        if (r.kategoriAset === 'PENGEMBALIAN' || r.status === 'REJECTED' || r.isDeleted) return false;
        if (pendingMonthFilter !== 'ALL') {
            const req = resolveReportRequestBuggy(r, budgetRequests, globalAcademicYearId);
            if (req) return req.month === pendingMonthFilter;
            return r.date ? r.date.startsWith(pendingMonthFilter) : false;
        }
        return true;
    }).reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

    const totalPengembalianBuggy = baseReports.filter(r => {
        if (r.kategoriAset !== 'PENGEMBALIAN' || r.status === 'REJECTED' || r.isDeleted) return false;
        if (pendingMonthFilter !== 'ALL') {
            const req = resolveReportRequestBuggy(r, budgetRequests, globalAcademicYearId);
            if (req) return req.month === pendingMonthFilter;
            return r.date ? r.date.startsWith(pendingMonthFilter) : false;
        }
        return true;
    }).reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

    console.log(`Buggy totalPengeluaran: ${totalPengeluaranBuggy}`);
    console.log(`Buggy totalPengembalian: ${totalPengembalianBuggy}`);

    console.log('\n=== FIXED RESOLVE OUTPUT FOR JUNE 2026 ===');
    const totalPengeluaranFixed = baseReports.filter(r => {
        if (r.kategoriAset === 'PENGEMBALIAN' || r.status === 'REJECTED' || r.isDeleted) return false;
        if (pendingMonthFilter !== 'ALL') {
            const req = resolveReportRequestFixed(r, budgetRequests, globalAcademicYearId);
            if (req) return req.month === pendingMonthFilter;
            return r.date ? r.date.startsWith(pendingMonthFilter) : false;
        }
        return true;
    }).reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

    const totalPengembalianFixed = baseReports.filter(r => {
        if (r.kategoriAset !== 'PENGEMBALIAN' || r.status === 'REJECTED' || r.isDeleted) return false;
        if (pendingMonthFilter !== 'ALL') {
            const req = resolveReportRequestFixed(r, budgetRequests, globalAcademicYearId);
            if (req) return req.month === pendingMonthFilter;
            return r.date ? r.date.startsWith(pendingMonthFilter) : false;
        }
        return true;
    }).reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

    const juneReq = budgetRequests.find(r => r.unitId === myUnitId && (r.month === '2026-06' || r.month === 'Juni 2026'));
    const totalCair = juneReq ? parseFloat(juneReq.totalAmount || 0) : 0;
    const totalSisaFixed = Math.max(0, totalCair - totalPengeluaranFixed - totalPengembalianFixed);

    console.log(`Fixed Total Cair: ${totalCair}`);
    console.log(`Fixed Total Pengeluaran: ${totalPengeluaranFixed}`);
    console.log(`Fixed Total Pengembalian: ${totalPengembalianFixed}`);
    console.log(`Fixed Total Sisa (Total Cair - Total Pengeluaran - Total Pengembalian): ${totalSisaFixed}`);
}

main();
