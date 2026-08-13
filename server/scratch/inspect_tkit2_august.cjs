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

    const reqMs8d = requests.find(r => r.id.includes('MS8D'));
    console.log('--- REQUEST REQ-MS8D ---');
    if (reqMs8d) {
        const items = typeof reqMs8d.items === 'string' ? JSON.parse(reqMs8d.items) : (reqMs8d.items || []);
        console.log(`Total items in REQ-MS8D: ${items.length}\n`);
        
        items.forEach((item, idx) => {
            console.log(`=== Item ${idx + 1}: "${item.name}" ===`);
            console.log(`RAB: ${item.amount} | componentId: ${item.componentId} | isClosed: ${item.isClosed}`);

            // Find matching reports in state.budgetReports
            const matchingReports = reports.filter(r => {
                if (r.isDeleted) return false;
                if (item.componentId && r.componentId === item.componentId) return true;
                const rName = (r.category || r.description || '').trim().toLowerCase();
                const iName = (item.name || '').trim().toLowerCase();
                if (rName && iName && rName === iName) return true;
                return false;
            });

            console.log(`  Matching Reports Count: ${matchingReports.length}`);
            matchingReports.forEach(r => {
                console.log(`   - Report ID: ${r.id} | Status: ${r.status} | Category: "${r.category}" | Desc: "${r.description}" | Amt: ${r.amount} | compId: ${r.componentId} | reqId: ${r.budgetRequestId}`);
            });
            console.log('');
        });
    }
}

main().catch(console.error);
