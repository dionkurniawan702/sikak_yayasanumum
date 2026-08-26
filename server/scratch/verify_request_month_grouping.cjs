const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

function resolveReportRequest(report, budgetRequests, globalAcademicYearId) {
    if (!report || !budgetRequests || budgetRequests.length === 0) return null;

    if (report.componentId) {
        const found = budgetRequests.find(r => 
            r.status === 'APPROVED' && 
            (report.unitId ? (r.unitId === report.unitId || r.fieldId === report.unitId) : true) &&
            r.items && 
            r.items.some(i => i.componentId === report.componentId)
        );
        if (found) return found;
    }

    const rReqId = report.budgetRequestId || report.requestId;
    const reportItemName = (report.category || report.description || '').trim().toLowerCase();

    if (rReqId) {
        const found = budgetRequests.find(r => r.id === rReqId);
        if (found) {
            if (!reportItemName || !found.items || found.items.length === 0) {
                if (report.kategoriAset !== 'PENGEMBALIAN') return found;
            } else {
                const hasItem = found.items.some(i => (i.name || '').trim().toLowerCase() === reportItemName);
                if (hasItem) return found;
            }
        }
    }

    if (reportItemName) {
        const foundByName = budgetRequests.find(r => 
            r.status === 'APPROVED' &&
            (report.unitId ? (r.unitId === report.unitId || r.fieldId === report.unitId) : true) &&
            r.items &&
            r.items.some(i => (i.name || '').trim().toLowerCase() === reportItemName)
        );
        if (foundByName) return foundByName;
    }

    if (report.kategoriAset === 'PENGEMBALIAN' && report.date) {
        if (rReqId) {
            const found = budgetRequests.find(r => r.id === rReqId);
            if (found) return found;
        }

        const reportMonth = report.date.substring(0, 7);
        const approvedReqs = budgetRequests.filter(r => {
            const isSameUnit = (r.unitId && (r.unitId === report.unitId || r.unitId === report.fieldId)) ||
                               (r.fieldId && (r.fieldId === report.unitId || r.fieldId === report.fieldId));
            return isSameUnit && r.status === 'APPROVED' && (!globalAcademicYearId || r.academicYearId === globalAcademicYearId);
        }).sort((a, b) => (b.month || '').localeCompare(a.month || ''));

        const prevMonthReq = approvedReqs.find(r => r.month < reportMonth);
        if (prevMonthReq) return prevMonthReq;
    }

    if (rReqId) {
        const found = budgetRequests.find(r => r.id === rReqId);
        if (found) return found;
    }

    if (report.date) {
        const reportMonth = report.date.substring(0, 7);
        const foundByDate = budgetRequests.find(r => {
            const isSameUnit = (r.unitId && (r.unitId === report.unitId || r.unitId === report.fieldId)) ||
                               (r.fieldId && (r.fieldId === report.unitId || r.fieldId === report.fieldId));
            return isSameUnit && r.status === 'APPROVED' && r.month === reportMonth;
        });
        if (foundByDate) return foundByDate;
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

    const { budgetRequests = [], budgetReports = [], units = [], globalAcademicYearId } = state;
    const mitUnit = units.find(u => u.name && u.name.toLowerCase().includes('mit'));

    const juneReq = budgetRequests.find(r => r.unitId === mitUnit.id && (r.month === '2026-06' || r.month === 'Juni 2026'));
    console.log('=== JUNE REQUEST DETAILS ===');
    console.log(`REQ ID: ${juneReq.id} | Month: ${juneReq.month} | Total Cair (Pagu): ${juneReq.totalAmount}`);

    // Filter reports by resolveReportRequest -> match req.month === '2026-06' / 'Juni 2026'
    const mitActiveReports = budgetReports.filter(r => r.unitId === mitUnit.id && !r.isDeleted && r.status !== 'REJECTED');

    let totalExpenseByReqMonth = 0;
    let totalRefundByReqMonth = 0;
    const reportsForJuneReq = [];

    mitActiveReports.forEach(r => {
        const resolvedReq = resolveReportRequest(r, budgetRequests, globalAcademicYearId);
        if (resolvedReq && resolvedReq.id === juneReq.id) {
            reportsForJuneReq.push(r);
            const amt = parseFloat(r.amount || 0);
            if (r.kategoriAset === 'PENGEMBALIAN') {
                totalRefundByReqMonth += amt;
            } else {
                totalExpenseByReqMonth += amt;
            }
        }
    });

    console.log(`\nTotal Reports resolved to June REQ (Bulan Permintaan Juni 2026): ${reportsForJuneReq.length}`);
    console.log(`Total Expense (Realisasi Belanja) for June REQ: ${totalExpenseByReqMonth}`);
    console.log(`Total Refund (Pengembalian) for June REQ: ${totalRefundByReqMonth}`);

    // Check dates of reports in reportsForJuneReq
    const datesBreakdown = {};
    reportsForJuneReq.forEach(r => {
        const m = r.date ? r.date.substring(0, 7) : 'NO_DATE';
        datesBreakdown[m] = (datesBreakdown[m] || 0) + 1;
    });
    console.log('\nBreakdown of Transaction Dates (bulan nota/transaksi) for reports belonging to Bulan Permintaan Juni 2026:');
    console.log(datesBreakdown);

    // Let's check non-June transaction dates in June Request:
    console.log('\nExamples of reports with non-June transaction dates that ARE correctly grouped into Bulan Permintaan Juni 2026:');
    reportsForJuneReq.filter(r => !r.date?.startsWith('2026-06')).slice(0, 10).forEach(r => {
        console.log(`- ID: ${r.id} | Date: ${r.date?.substring(0, 10)} | Amt: ${r.amount} | Desc: "${r.description}" | Cat: "${r.category}"`);
    });
}

main();
