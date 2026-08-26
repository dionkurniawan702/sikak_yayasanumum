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

    const requests = state.budgetRequests || [];
    const reports = state.budgetReports || [];

    // Find TKIT2 August requests
    const tkit2Reqs = requests.filter(r => 
        (r.unitId === 'TKIT2' || r.fieldId === 'TKIT2' || r.unitId === 'mo7xk4tfhzmqk' || r.unitName?.includes('TKIT 2')) &&
        (r.month === '2026-08' || (r.id && r.id.includes('MS8D')))
    );

    console.log(`Found ${tkit2Reqs.length} matching requests:`);
    tkit2Reqs.forEach(req => {
        console.log(`\n=== Request ID: ${req.id} | Month: ${req.month} | Unit: ${req.unitId || req.unitName} | Status: ${req.status} ===`);
        const items = typeof req.items === 'string' ? JSON.parse(req.items) : (req.items || []);
        
        items.forEach((item, idx) => {
            if (item.name.toLowerCase().includes('konsumsi rapat')) {
                console.log(`Item #${idx+1}: "${item.name}"`);
                console.log(`  RAB Amount: ${item.amount}`);
                console.log(`  componentId: ${item.componentId}`);
                console.log(`  isClosed: ${item.isClosed}`);

                // Find reports in budgetReports matching this item
                const matchingReports = reports.filter(r => !r.isDeleted && (
                    r.budgetRequestId === req.id ||
                    (item.componentId && r.componentId === item.componentId) ||
                    (r.category && r.category.trim().toLowerCase() === item.name.trim().toLowerCase())
                ));

                console.log(`  Matching reports count: ${matchingReports.length}`);
                let totalApproved = 0;
                let totalDraft = 0;
                matchingReports.forEach(r => {
                    console.log(`    - Report ID: ${r.id} | Status: ${r.status} | Amount: ${r.amount} | Date: ${r.date} | Desc: "${r.description}" | compId: ${r.componentId} | reqId: ${r.budgetRequestId}`);
                    if (r.status === 'APPROVED') totalApproved += parseFloat(r.amount || 0);
                    if (r.status === 'DRAFT') totalDraft += parseFloat(r.amount || 0);
                });
                console.log(`  Total Approved: ${totalApproved}`);
                console.log(`  Total Draft: ${totalDraft}`);
                console.log(`  Remaining budget: ${parseFloat(item.amount || 0) - totalApproved - totalDraft}`);
            }
        });
    });
}

main().catch(console.error);
