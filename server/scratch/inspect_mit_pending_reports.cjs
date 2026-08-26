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

    const { budgetReports = [], units = [] } = state;
    const mitUnit = units.find(u => u.name && u.name.toLowerCase().includes('mit'));

    console.log('=== ALL PENDING REPORTS FOR MIT UNIT ===');
    const pendingReports = budgetReports.filter(r => r.unitId === mitUnit.id && r.status === 'PENDING');
    console.log(`Total PENDING count: ${pendingReports.length}`);
    console.log(pendingReports);

    console.log('\n=== ALL PENDING REPORTS IN THE ENTIRE SYSTEM ===');
    const allPending = budgetReports.filter(r => r.status === 'PENDING');
    console.log(`Total all pending: ${allPending.length}`);
    allPending.forEach(r => {
        const u = units.find(unit => unit.id === r.unitId);
        console.log(`- ID: ${r.id} | Unit: ${u ? u.name : r.unitId} | Amount: ${r.amount} | Cat: ${r.category} | Desc: ${r.description} | Date: ${r.date} | Status: ${r.status}`);
    });
}

main().catch(console.error);
