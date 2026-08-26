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
    console.log('REQ-MS8D:', {
        id: reqMs8d.id,
        amount: reqMs8d.amount,
        totalAmount: reqMs8d.totalAmount,
        status: reqMs8d.status
    });

    const items = typeof reqMs8d.items === 'string' ? JSON.parse(reqMs8d.items) : (reqMs8d.items || []);
    const itemsTotal = items.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);
    console.log(`Sum of item RABs in REQ-MS8D: ${itemsTotal}`);

    // Reports linked to REQ-MS8D
    const ms8dReports = reports.filter(r => !r.isDeleted && r.status !== 'REJECTED' && (
        r.budgetRequestId === reqMs8d.id || r.requestId === reqMs8d.id
    ));

    const totalReportedForReq = ms8dReports.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
    console.log(`Direct reports count for REQ-MS8D: ${ms8dReports.length}`);
    console.log(`Total amount reported across ALL items in REQ-MS8D: ${totalReportedForReq}`);

    const parentReqTotal = parseFloat(reqMs8d.totalAmount || reqMs8d.amount || 0);
    console.log(`parentReq Total: ${parentReqTotal}`);
    console.log(`Remaining total request balance (sisaDanaPengajuan): ${parentReqTotal - totalReportedForReq}`);
}

main().catch(console.error);
