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

    const users = state.users || [];
    const tkit2User = users.find(u => u.username === 'tkit2' || u.username.toLowerCase().includes('tkit2'));
    console.log('TKIT 2 User:', tkit2User);

    const academicYears = state.academicYears || [];
    console.log('Academic Years:', academicYears);

    const reports = state.budgetReports || [];
    const requests = state.budgetRequests || [];

    // Find the 5 reports for Konsumsi Rapat in REQ-MS8D
    const ms8dReq = requests.find(r => r.id === 'REQ-MS8DMK30-P58');
    console.log('REQ-MS8D:', {
        id: ms8dReq.id,
        unitId: ms8dReq.unitId,
        fieldId: ms8dReq.fieldId,
        academicYearId: ms8dReq.academicYearId,
        source: ms8dReq.source,
        month: ms8dReq.month
    });

    const konsumsiReports = reports.filter(r => 
        !r.isDeleted && 
        (r.budgetRequestId === ms8dReq.id || r.requestId === ms8dReq.id)
    );

    console.log('\n--- 5 Reports for REQ-MS8D ---');
    konsumsiReports.forEach((r, idx) => {
        console.log(`[${idx+1}] ID: ${r.id}`);
        console.log(`    status: ${r.status}`);
        console.log(`    unitId: ${r.unitId}`);
        console.log(`    fieldId: ${r.fieldId}`);
        console.log(`    academicYearId: ${r.academicYearId}`);
        console.log(`    source: ${r.source}`);
        console.log(`    planId: ${r.planId}`);
        console.log(`    category: "${r.category}"`);
        console.log(`    description: "${r.description}"`);
        console.log(`    amount: ${r.amount}`);
        console.log(`    componentId: ${r.componentId}`);
        console.log(`    date: ${r.date}`);
    });
}

main().catch(console.error);
