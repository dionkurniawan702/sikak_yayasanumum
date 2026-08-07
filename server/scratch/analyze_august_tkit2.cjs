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

    const tkit2AugReqs = requests.filter(r => 
        (r.unitId === 'TKIT2' || r.fieldId === 'TKIT2' || r.unitId === 'mo7xk4tfhzmqk' || r.unitName?.includes('TKIT 2')) && 
        r.month === '2026-08' && 
        r.status === 'APPROVED'
    );

    console.log(`Found ${tkit2AugReqs.length} August requests for TKIT2:`);
    tkit2AugReqs.forEach(req => {
        console.log(`\nRequest ID: ${req.id} | Month: ${req.month} | Total: ${req.totalAmount}`);
        const items = typeof req.items === 'string' ? JSON.parse(req.items) : (req.items || []);
        console.log(`Total items in request: ${items.length}`);

        const tkit2Reports = reports.filter(r => !r.isDeleted && (r.unitId === req.unitId || r.unitId === 'TKIT2'));

        items.forEach((item, idx) => {
            const itemAmt = parseFloat(item.amount || 0);
            const matchingReports = tkit2Reports.filter(r => {
                if (item.componentId && r.componentId === item.componentId) return true;
                const rName = (r.category || r.description || '').trim().toLowerCase();
                const iName = (item.name || '').trim().toLowerCase();
                if (rName && iName && rName === iName) return true;
                return false;
            });

            const approvedReports = matchingReports.filter(r => r.status === 'APPROVED');
            const draftReports = matchingReports.filter(r => r.status === 'DRAFT');
            const appAmt = approvedReports.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
            const draftAmt = draftReports.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

            const isClosed = !!item.isClosed;
            const isApprovedFull = appAmt >= itemAmt;

            console.log(`${idx + 1}. [${item.name}] | RAB: ${itemAmt} | ApprovedAmt: ${appAmt} | DraftAmt: ${draftAmt} | isClosed: ${isClosed} | Hidden?: ${isClosed || isApprovedFull}`);
            if (matchingReports.length > 0) {
                console.log(`   --> Reports:`, matchingReports.map(r => `${r.id} (${r.status}, amt=${r.amount})`).join(', '));
            }
        });
    });
}

main().catch(console.error);
