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

    const globalAcademicYearId = state.globalAcademicYearId || state.activeAcademicYearId || 'AY-ID-MO8GWIG3-JDK';
    const { budgetRequests = [], budgetReports = [], units = [] } = state;

    const tkit2 = units.find(u => u.name && u.name.toLowerCase().includes('tkit 2'));
    const myUnitId = tkit2.id;

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
                    return found;
                }
                const hasItem = found.items.some(i => (i.name || '').trim().toLowerCase() === reportItemName);
                if (hasItem) return found;
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

    // Pre-calculate reportedAmounts matching MonthlyReport.jsx
    const reqSettledMap = {};
    (budgetReports || []).forEach(r => {
        if (r.status !== 'REJECTED' && !r.isDeleted) {
            const resolvedReq = resolveReportRequest(r);
            const rReqId = resolvedReq ? resolvedReq.id : (r.budgetRequestId || r.requestId);
            const amt = parseFloat(r.amount || 0);

            if (rReqId) {
                if (!reqSettledMap[rReqId]) reqSettledMap[rReqId] = 0;
                reqSettledMap[rReqId] += amt;
            }
        }
    });

    const requestsForYear = (budgetRequests || []).filter(req => {
        const isYear = req.academicYearId === globalAcademicYearId;
        if (!isYear) return false;
        return req.unitId === myUnitId;
    });

    const pendingItems = [];
    requestsForYear.filter(req => req.status === 'APPROVED').forEach(req => {
        if (req.isClosed) return;

        const totalSettled = reqSettledMap[req.id] || 0;
        const reqTotal = parseFloat(req.totalAmount || 0);
        if (reqTotal > 0 && totalSettled >= reqTotal - 1) return;

        if (req.items && req.items.length > 0) {
            req.items.forEach(item => {
                if (item.isClosed) return;

                const matchingReports = (budgetReports || []).filter(r => {
                    if (r.status !== 'APPROVED' || r.isDeleted || r.kategoriAset === 'PENGEMBALIAN') return false;
                    const resolved = resolveReportRequest(r);
                    if (resolved && resolved.id === req.id) {
                        const reportName = (r.category || r.description || '').trim().toLowerCase();
                        const itemName = (item.name || '').trim().toLowerCase();
                        if (item.componentId && r.componentId === item.componentId) return true;
                        if (reportName && itemName && reportName === itemName) return true;
                    }
                    return false;
                });
                const reportedComp = matchingReports.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
                const itemAmount = parseFloat(item.amount || 0);
                const sisa = Math.max(0, itemAmount - reportedComp);

                if (sisa <= 0) return;

                pendingItems.push({
                    name: item.name,
                    reqId: req.id,
                    reqMonth: req.month,
                    amount: itemAmount,
                    sisa
                });
            });
        }
    });

    console.log(`\n=== PENDING ITEMS RESULT FOR TKIT 2 (TOTAL: ${pendingItems.length}) ===`);
    const byMonth = {};
    pendingItems.forEach(item => {
        byMonth[item.reqMonth] = (byMonth[item.reqMonth] || 0) + 1;
    });
    console.log('Pending Items Count By Month:', byMonth);
    console.log('\nPending Items Breakdown:');
    pendingItems.forEach((item, i) => {
        console.log(`${i+1}. [${item.reqMonth}] "${item.name}" - Pagu: Rp ${item.amount.toLocaleString('id-ID')} | Sisa: Rp ${item.sisa.toLocaleString('id-ID')}`);
    });
}

main();
