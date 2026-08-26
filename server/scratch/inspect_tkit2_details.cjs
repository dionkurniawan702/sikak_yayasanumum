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

    const reports = state.budgetReports || [];
    const users = state.users || [];
    const units = state.units || [];

    console.log('--- USERS ---');
    users.filter(u => u.username.includes('tkit') || u.name.includes('TKIT')).forEach(u => {
        console.log(u);
    });

    console.log('\n--- UNITS ---');
    units.filter(u => u.name.includes('TKIT')).forEach(u => {
        console.log(u);
    });

    console.log('\n--- REPORTS FOR KONSUMSI RAPAT (REQ-MS8D) ---');
    const konsumsiReports = reports.filter(r => 
        !r.isDeleted && 
        (r.budgetRequestId === 'REQ-MS8DMK30-P58' || r.requestId === 'REQ-MS8DMK30-P58') &&
        (r.category?.toLowerCase().includes('konsumsi rapat') || r.description?.toLowerCase().includes('konsumsi rapat') || r.description === 'sasad' || r.description === 'qwrwq')
    );

    console.log(JSON.stringify(konsumsiReports, null, 2));
}

main().catch(console.error);
