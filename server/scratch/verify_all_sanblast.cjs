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

    const sanblast = budgetReports.find(r => r.id === 'REL-1787729272985');
    const ret = budgetReports.find(r => r.id === 'RET-MRCU432Q');

    console.log('=== FINAL VERIFICATION ===');
    console.log('Sanblast Report (REL-1787729272985):', sanblast ? { id: sanblast.id, status: sanblast.status, amount: sanblast.amount, journalId: sanblast.journalId } : 'Not found');
    console.log('Refund Report (RET-MRCU432Q):', ret ? { id: ret.id, status: ret.status, amount: ret.amount } : 'Not found');
}

main().catch(console.error);
