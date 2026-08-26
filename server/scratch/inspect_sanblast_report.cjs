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

    console.log('=== SEARCHING FOR SANBLAST REPORT (Rp 445.555) ===');
    const sanblastReport = budgetReports.find(r => r.unitId === mitUnit.id && (
        parseFloat(r.amount) === 445555 ||
        r.category?.toLowerCase().includes('sanblast') ||
        r.description?.toLowerCase().includes('sanblast') ||
        r.nomorNota === '022'
    ));

    console.log('Found Report:', sanblastReport);
}

main().catch(console.error);
