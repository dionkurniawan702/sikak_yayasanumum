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

    console.log('Fetching all-data...');
    const dataRes = await fetch(`${API_URL}/all-data`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const dataJson = await dataRes.json();
    const state = dataJson.data;

    const { budgetReports = [] } = state;
    const retReport = budgetReports.find(r => r.id === 'RET-MRCU432Q');

    if (!retReport) {
        console.error('RET-MRCU432Q not found in remote data');
        return;
    }

    console.log('Current RET-MRCU432Q amount:', retReport.amount);

    const updatedReport = {
        ...retReport,
        amount: '24814722'
    };

    const newReports = budgetReports.map(r => r.id === 'RET-MRCU432Q' ? updatedReport : r);

    console.log('Sending sync-whole-state with updated RET amount (24814722)...');
    const syncRes = await fetch(`${API_URL}/sync-whole-state`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            state: {
                ...state,
                budgetReports: newReports
            }
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
}

main().catch(console.error);
