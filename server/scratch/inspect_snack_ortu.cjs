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
    console.log('--- REQ-MS8D (Agustus 2026 TKIT 2) ---');
    if (reqMs8d) {
        const items = typeof reqMs8d.items === 'string' ? JSON.parse(reqMs8d.items) : (reqMs8d.items || []);
        const itemSnack = items.find(i => i.name.toLowerCase().includes('snack orang tua'));
        console.log('Item Snack orang tua:', itemSnack);
    }

    console.log('\n--- ALL REPORTS matching "Snack orang tua" ---');
    const matchingReports = reports.filter(r => 
        !r.isDeleted && 
        (r.category?.toLowerCase().includes('snack orang tua') || r.description?.toLowerCase().includes('snack orang tua'))
    );

    let totalAmt = 0;
    matchingReports.forEach(r => {
        const resolved = resolveReportRequest(r, requests);
        totalAmt += parseFloat(r.amount || 0);
        console.log({
            id: r.id,
            date: r.date,
            status: r.status,
            category: r.category,
            description: r.description,
            amount: r.amount,
            budgetRequestId: r.budgetRequestId,
            resolvedReqId: resolved?.id,
            componentId: r.componentId
        });
    });
    console.log('Total reported amount for Snack orang tua:', totalAmt);
}

main().catch(console.error);
