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

    const reqMs8d = requests.find(r => r.id && r.id.includes('MS8D'));
    console.log('Request REQ-MS8D:', reqMs8d ? {
        id: reqMs8d.id,
        month: reqMs8d.month,
        unitId: reqMs8d.unitId,
        status: reqMs8d.status
    } : 'NOT FOUND');

    if (reqMs8d) {
        const items = typeof reqMs8d.items === 'string' ? JSON.parse(reqMs8d.items) : (reqMs8d.items || []);
        console.log(`\nItems in REQ-MS8D (${items.length} total):`);
        items.forEach((item, idx) => {
            console.log(`\nItem #${idx+1}: "${item.name}"`);
            console.log(`  amount: ${item.amount}`);
            console.log(`  componentId: ${item.componentId}`);
            console.log(`  isClosed: ${item.isClosed}`);
            
            // Find all reports linked to this request or componentId or exact category name
            const matchingReports = reports.filter(r => !r.isDeleted && (
                r.budgetRequestId === reqMs8d.id ||
                (item.componentId && r.componentId === item.componentId) ||
                (r.category && r.category.trim().toLowerCase() === item.name.trim().toLowerCase())
            ));

            console.log(`  Matching reports count: ${matchingReports.length}`);
            matchingReports.forEach(r => {
                console.log(`   - Report ID: ${r.id} | Status: ${r.status} | Amt: ${r.amount} | Date: ${r.date} | Category: "${r.category}" | Desc: "${r.description}" | compId: ${r.componentId} | reqId: ${r.budgetRequestId}`);
            });
        });
    }

    console.log('\n--- Checking all reports where budgetRequestId is REQ-MS8D ---');
    const directReports = reports.filter(r => !r.isDeleted && r.budgetRequestId === reqMs8d?.id);
    console.log(`Direct reports count: ${directReports.length}`);
    directReports.forEach(r => {
        console.log(` - ID: ${r.id} | Status: ${r.status} | Category: "${r.category}" | Desc: "${r.description}" | Amt: ${r.amount} | compId: ${r.componentId}`);
    });
}

main().catch(console.error);
