const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    console.log('Logging in...');
    const loginRes = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'adminpdk', password: 'admin123' })
    });
    const loginJson = await loginRes.json();
    const token = loginJson.data?.token;

    if (!token) {
        console.error('Login failed');
        return;
    }

    const dataRes = await fetch(`${API_URL}/all-data`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const dataJson = await dataRes.json();
    const state = dataJson.data;

    const { budgetReports = [] } = state;
    const retReport = budgetReports.find(r => r.id === 'RET-MRCU432Q');

    if (!retReport) {
        console.error('RET-MRCU432Q not found');
        return;
    }

    console.log('Original RET-MRCU432Q:', retReport);

    const updatedReport = {
        ...retReport,
        amount: '24814722', // Updated to 24.814.722
    };

    console.log('Pushing updated report to API...');
    const pushRes = await fetch(`${API_URL}/action`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            action: { type: 'EDIT_BUDGET_REPORT', payload: updatedReport },
            state: {
                ...state,
                budgetReports: budgetReports.map(r => r.id === 'RET-MRCU432Q' ? updatedReport : r)
            }
        })
    });

    const pushJson = await pushRes.json();
    console.log('Push result:', pushJson);

    // Sync whole state to be 100% sure
    const newBudgetReports = budgetReports.map(r => r.id === 'RET-MRCU432Q' ? updatedReport : r);
    const syncRes = await fetch(`${API_URL}/sync-whole-state`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ state: { ...state, budgetReports: newBudgetReports } })
    });
    const syncJson = await syncRes.json();
    console.log('Sync result:', syncJson);
}

main().catch(console.error);
