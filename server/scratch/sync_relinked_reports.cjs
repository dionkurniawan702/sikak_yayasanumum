const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    console.log('Logging in to sync relinked reports...');
    const loginRes = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'adminpdk', password: 'admin123' })
    });
    const loginJson = await loginRes.json();
    const token = loginJson.data?.token;

    if (!token) {
        console.error('Login failed');
        return;
    }

    const dataRes = await fetch(`${API_URL}/all-data`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const dataJson = await dataRes.json();
    const state = dataJson.data;

    const { budgetRequests = [], budgetReports = [] } = state;

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

    let relinkCount = 0;
    const updatedReports = budgetReports.map(r => {
        const resolvedReq = resolveReportRequestImproved(r);
        if (resolvedReq && (r.budgetRequestId !== resolvedReq.id || r.requestId !== resolvedReq.id)) {
            relinkCount++;
            return {
                ...r,
                budgetRequestId: resolvedReq.id,
                requestId: resolvedReq.id
            };
        }
        return r;
    });

    console.log(`Relinking ${relinkCount} reports in database state...`);

    const newState = {
        ...state,
        budgetReports: updatedReports
    };

    const syncRes = await fetch(`${API_URL}/sync-state`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ state: newState })
    });

    const syncJson = await syncRes.json();
    console.log('Sync DB result:', syncJson.success ? 'SUCCESS ✅' : syncJson);
}

main();
