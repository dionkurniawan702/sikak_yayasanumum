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

    return null;
}

function isReportMatchingItem(r, item, budgetRequests, globalAcademicYearId) {
    if (!r || !item || r.isDeleted || r.status === 'REJECTED') return false;

    // 1. Component ID match
    if (item.componentId && r.componentId && item.componentId === r.componentId) {
        return true;
    }

    // 2. Category / description match to item name
    const rCat = (r.category || '').trim().toLowerCase();
    const rDesc = (r.description || '').trim().toLowerCase();
    const iName = (item.name || '').trim().toLowerCase();

    if (iName && (rCat === iName || rDesc === iName)) {
        return true;
    }

    // 3. Exact budgetRequestId match
    const rReqId = r.budgetRequestId || r.requestId;
    if (rReqId && item.reqId && rReqId === item.reqId) {
        if (!r.componentId && !r.category) return true;
    }

    return false;
}

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

    const requests = state.budgetRequests || [];
    const reports = state.budgetReports || [];

    const reqMs8d = requests.find(r => r.id.includes('MS8D'));
    if (reqMs8d) {
        const items = typeof reqMs8d.items === 'string' ? JSON.parse(reqMs8d.items) : (reqMs8d.items || []);
        
        items.forEach((item, idx) => {
            const fullItem = {
                ...item,
                reqId: reqMs8d.id,
                reqUnitId: reqMs8d.unitId
            };

            const matching = reports.filter(r => isReportMatchingItem(r, fullItem, requests));
            if (matching.length > 0) {
                console.log(`Item "${item.name}": ${matching.length} matching reports`);
                matching.forEach(m => console.log(`   - [${m.status}] ${m.id} | category: "${m.category}" | desc: "${m.description}" | amount: ${m.amount}`));
            }
        });
    }
}

main().catch(console.error);
