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

    const { budgetRequests = [] } = state;
    const req = budgetRequests.find(r => r.id === 'REQ-MSGZQ7RE-MJX');

    console.log('=== FINAL CHECK FOR REQ-MSGZQ7RE-MJX ===');
    console.log('Request ID:', req?.id);
    console.log('Status:', req?.status);
    console.log('Total Amount:', req?.totalAmount);
    console.log('Month:', req?.month);
}

main().catch(console.error);
