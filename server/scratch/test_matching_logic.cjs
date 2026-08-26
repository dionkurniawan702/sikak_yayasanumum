const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    const loginRes = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'adminpdk', password: 'admin123' })
    });
    const loginJson = await loginRes.json();
    const token = loginJson.data.token;

    const dataRes = await fetch(`${API_URL}/all-data`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const dataJson = await dataRes.json();
    const state = dataJson.data;

    const reports = state.budgetReports || [];
    const requests = state.budgetRequests || [];

    const reqMs8d = requests.find(r => r.id === 'REQ-MS8DMK30-P58');
    const items = typeof reqMs8d.items === 'string' ? JSON.parse(reqMs8d.items) : (reqMs8d.items || []);
    const itemKonsumsi = items.find(i => i.name.toLowerCase().includes('konsumsi rapat'));

    console.log('Item Konsumsi Rapat:', {
        name: itemKonsumsi.name,
        componentId: itemKonsumsi.componentId,
        amount: itemKonsumsi.amount
    });

    const item = {
        ...itemKonsumsi,
        reqId: reqMs8d.id,
        reqMonth: reqMs8d.month,
        reqDate: reqMs8d.date,
        reqDescription: reqMs8d.description,
        reqUnitId: reqMs8d.unitId,
        expenseItemId: itemKonsumsi.expenseItemId || reqMs8d.expenseItemId,
    };

    // Test getReportsCountForItem
    const globalAcademicYearId = 'AY-ID-MO8GWIG3-JDK';

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

        if (rReqId) {
            const found = budgetRequests.find(r => r.id === rReqId);
            if (found) return found;
        }

        return null;
    }

    const matchedReports = reports.filter(r => {
        if (!r || r.isDeleted || r.status === 'REJECTED') return false;

        const resolvedReq = resolveReportRequest(r, requests, globalAcademicYearId);
        const rReqId = resolvedReq ? resolvedReq.id : (r.budgetRequestId || r.requestId);

        if (rReqId && item.reqId && rReqId !== item.reqId) {
            return false;
        }

        if (item.componentId) {
            if (r.componentId) {
                return item.componentId === r.componentId;
            }
            const req = (requests || []).find(b => b.id === (item.reqId || rReqId));
            if (req && req.items) {
                const rCat = (r.category || '').trim().toLowerCase();
                const rDesc = (r.description || '').trim().toLowerCase();
                const match = req.items.find(ri => {
                    const riName = (ri.name || '').trim().toLowerCase();
                    return riName && (riName === rCat || riName === rDesc);
                });
                return match && match.componentId === item.componentId;
            }
            return false;
        }

        const rCat = (r.category || '').trim().toLowerCase();
        const rDesc = (r.description || '').trim().toLowerCase();
        const iName = (item.name || '').trim().toLowerCase();

        if (iName && (rCat === iName || rDesc === iName)) {
            return true;
        }

        return false;
    });

    console.log(`\nMatched reports count for Konsumsi Rapat: ${matchedReports.length}`);
    matchedReports.forEach(r => {
        console.log(` - ID: ${r.id} | Status: ${r.status} | Category: "${r.category}" | Desc: "${r.description}" | Amt: ${r.amount}`);
    });
}

main().catch(console.error);
