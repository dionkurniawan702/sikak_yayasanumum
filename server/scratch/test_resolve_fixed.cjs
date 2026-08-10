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
    const tkit2 = units.find(u => u.name && u.name.toLowerCase().includes('tkit 2'));
    const unitId = tkit2.id;
    const globalAcademicYearId = state.globalAcademicYearId || state.activeAcademicYearId || 'AY-ID-MO8GWIG3-JDK';

    function resolveReportRequest(report) {
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

    const tkitReports = budgetReports.filter(r => (r.unitId === unitId || r.fieldId === unitId) && !r.isDeleted && r.status === 'APPROVED');

    console.log('=== TEST RESOLVED MONTHS FOR TKIT 2 REPORTS ===');
    const resolvedByMonth = {};
    tkitReports.forEach((r) => {
        const resolved = resolveReportRequest(r);
        const monthKey = resolved ? resolved.month : (r.date ? r.date.substring(0, 7) : 'UNKNOWN');
        if (!resolvedByMonth[monthKey]) resolvedByMonth[monthKey] = { exp: 0, ref: 0, count: 0 };

        const amt = parseFloat(r.amount || 0);
        if (r.kategoriAset === 'PENGEMBALIAN') {
            resolvedByMonth[monthKey].ref += amt;
        } else {
            resolvedByMonth[monthKey].exp += amt;
        }
        resolvedByMonth[monthKey].count++;
    });

    for (const [m, data] of Object.entries(resolvedByMonth)) {
        console.log(`\n--- MONTH ${m} --- (${data.count} reports)`);
        console.log(`Total Realisasi Belanja: Rp ${data.exp.toLocaleString('id-ID')}`);
        console.log(`Total Pengembalian Dana: Rp ${data.ref.toLocaleString('id-ID')}`);
        console.log(`Total Settled (Exp + Ref): Rp ${(data.exp + data.ref).toLocaleString('id-ID')}`);
    }
}

main();
