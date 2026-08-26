const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    console.log('Logging in to remote server...');
    const loginRes = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'adminpdk', password: 'admin123' })
    });
    const loginJson = await loginRes.json();
    const token = loginJson.data?.token;

    if (!token) {
        console.error('Login failed:', loginJson);
        return;
    }

    console.log('Fetching current data for RET-MRCU432Q...');
    const dataRes = await fetch(`${API_URL}/all-data`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const dataJson = await dataRes.json();
    const state = dataJson.data;

    const { budgetReports = [] } = state;
    const retReport = budgetReports.find(r => r.id === 'RET-MRCU432Q');

    if (!retReport) {
        console.error('RET-MRCU432Q not found!');
        return;
    }

    console.log('Current RET-MRCU432Q amount:', retReport.amount);

    const updatedReport = {
        ...retReport,
        amount: '24814722'
    };

    console.log('Updating via PUT /budget-reports/RET-MRCU432Q...');
    const putRes = await fetch(`${API_URL}/budget-reports/RET-MRCU432Q`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatedReport)
    });

    const putJson = await putRes.json();
    console.log('PUT response status:', putRes.status);
    console.log('PUT response body:', putJson);

    // Also update via /sync endpoint if needed
    const newReports = budgetReports.map(r => r.id === 'RET-MRCU432Q' ? updatedReport : r);
    console.log('Syncing state via POST /sync...');
    const syncRes = await fetch(`${API_URL}/sync`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            budgetReports: newReports
        })
    });
    const syncJson = await syncRes.json();
    console.log('Sync response status:', syncRes.status);
    console.log('Sync response body:', syncJson);

    // Verify change
    const checkRes = await fetch(`${API_URL}/all-data`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const checkJson = await checkRes.json();
    const checkRet = (checkJson.data?.budgetReports || []).find(r => r.id === 'RET-MRCU432Q');
    console.log('\nVerified RET-MRCU432Q amount on server after update:', checkRet?.amount);

    // Recalculate stats for MIT June 2026:
    const juneReq = (checkJson.data?.budgetRequests || []).find(r => r.id === 'REQ-MPLVQKEG-U8C');
    const juneReports = (checkJson.data?.budgetReports || []).filter(r => (r.budgetRequestId === juneReq.id || r.requestId === juneReq.id) && !r.isDeleted && r.status !== 'REJECTED');
    let expenseSum = 0;
    let refundSum = 0;
    juneReports.forEach(r => {
        const amt = parseFloat(r.amount || 0);
        if (r.kategoriAset === 'PENGEMBALIAN') refundSum += amt;
        else expenseSum += amt;
    });
    const sisa = juneReq.totalAmount - expenseSum - refundSum;
    console.log('\n=== RECALCULATED STATS FOR JUNI 2026 ===');
    console.log(`Total Cair: ${juneReq.totalAmount}`);
    console.log(`Total Pengeluaran: ${expenseSum}`);
    console.log(`Total Pengembalian: ${refundSum}`);
    console.log(`Total Sisa: ${sisa} (Expected: 0)`);
}

main().catch(console.error);
