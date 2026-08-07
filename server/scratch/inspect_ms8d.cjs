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

    const req = requests.find(r => r.id === 'REQ-MS8DMK30-P58');
    if (!req) {
        console.log('Request REQ-MS8DMK30-P58 not found!');
        return;
    }

    console.log(`\nRequest ID: ${req.id} | Month: ${req.month} | Total: ${req.totalAmount}`);
    const items = typeof req.items === 'string' ? JSON.parse(req.items) : (req.items || []);
    console.log(`Total items in request REQ-MS8DMK30-P58: ${items.length}`);

    const tkit2Reports = reports.filter(r => !r.isDeleted && (r.unitId === req.unitId || r.unitId === 'TKIT2' || r.unitId === 'mo7xk4tfhzmqk'));

    let countPending = 0;
    let countHidden = 0;

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
        const isHidden = isClosed || isApprovedFull;

        console.log(`${idx + 1}. [${item.name}] | RAB: ${itemAmt} | AppAmt: ${appAmt} | DraftAmt: ${draftAmt} | isClosed: ${isClosed} | isHidden: ${isHidden}`);
        if (matchingReports.length > 0) {
            console.log(`   --> Reports:`, matchingReports.map(r => `${r.id} (${r.status}, amt=${r.amount})`).join(', '));
        }

        if (isHidden) {
            countHidden++;
        } else {
            countPending++;
        }
    });

    console.log(`\nSummary for REQ-MS8DMK30-P58: Total items = ${items.length}, Pending = ${countPending}, Hidden = ${countHidden}`);
}

main().catch(console.error);
