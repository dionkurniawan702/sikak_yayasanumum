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
    const unitId = tkit2.id;

    // Helper resolveReportRequest matching MonthlyReport.jsx
    function resolveReportRequestImproved(report) {
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

    // Let's inspect each report for TKIT 2 and see which request it resolves to:
    let relinkCount = 0;
    const updatedBudgetReports = budgetReports.map(r => {
        if (r.unitId === unitId || r.fieldId === unitId) {
            const resolvedReq = resolveReportRequestImproved(r);
            if (resolvedReq && (r.budgetRequestId !== resolvedReq.id || r.requestId !== resolvedReq.id)) {
                relinkCount++;
                return {
                    ...r,
                    budgetRequestId: resolvedReq.id,
                    requestId: resolvedReq.id
                };
            }
        }
        return r;
    });

    console.log(`Relinked ${relinkCount} report records to their true budgetRequestId in DB state.`);

    // Check settlement after relinking
    const reqs = budgetRequests.filter(r => (r.unitId === unitId || r.fieldId === unitId) && r.status === 'APPROVED');
    
    reqs.forEach(req => {
        const reqReports = updatedBudgetReports.filter(r => 
            !r.isDeleted && 
            r.status === 'APPROVED' && 
            (r.budgetRequestId === req.id || r.requestId === req.id)
        );
        const expSum = reqReports.filter(r => r.kategoriAset !== 'PENGEMBALIAN').reduce((s, r) => s + parseFloat(r.amount || 0), 0);
        const refSum = reqReports.filter(r => r.kategoriAset === 'PENGEMBALIAN').reduce((s, r) => s + parseFloat(r.amount || 0), 0);
        const totalSettled = expSum + refSum;
        const reqTotal = parseFloat(req.totalAmount || 0);
        const isFullySettled = Math.abs(totalSettled - reqTotal) < 1 || totalSettled >= reqTotal || req.isClosed;

        console.log(`REQ [${req.id}] Month: ${req.month} | Total: Rp ${reqTotal.toLocaleString('id-ID')} | Exp: Rp ${expSum.toLocaleString('id-ID')} | Ref: Rp ${refSum.toLocaleString('id-ID')} | Total Settled: Rp ${totalSettled.toLocaleString('id-ID')} | Fully Settled? ${isFullySettled ? 'YES ✅' : 'NO ❌'}`);
    });
}

main();
