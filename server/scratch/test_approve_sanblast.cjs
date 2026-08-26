const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    const loginRes = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'adminpdk', password: 'admin123' })
    });
    const loginJson = await loginRes.json();
    const token = loginJson.data?.token;

    const dataRes = await fetch(`${API_URL}/all-data`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const dataJson = await dataRes.json();
    const state = dataJson.data;

    const { budgetReports = [] } = state;
    const report = budgetReports.find(r => r.id === 'REL-1787729272985');

    console.log('Sanblast Report found:', report);

    if (report) {
        console.log('\nTesting PUT /budget-reports/REL-1787729272985 with status: APPROVED...');
        const updated = { ...report, status: 'APPROVED', notified: false };

        const putRes = await fetch(`${API_URL}/budget-reports/${report.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updated)
        });

        const putText = await putRes.text();
        console.log('PUT Status:', putRes.status);
        console.log('PUT Response:', putText);
    }
}

main().catch(console.error);
