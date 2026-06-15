const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    try {
        console.log('Logging in...');
        const loginRes = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'adminpdk', password: 'admin123' })
        });
        const loginJson = await loginRes.json();
        const token = loginJson.data.token;

        console.log('Fetching all-data...');
        const dataRes = await fetch(`${API_URL}/all-data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataJson = await dataRes.json();
        const requests = dataJson.data.budgetRequests || [];
        
        const req = requests.find(r => r.id === 'REQ-MQ0LTEIR-RBJ');
        if (req) {
            console.log('Request REQ-MQ0LTEIR-RBJ is STILL ACTIVE:', req);
        } else {
            console.log('Request REQ-MQ0LTEIR-RBJ is NOT in the active list (successfully cancelled/deleted!).');
        }
    } catch (err) {
        console.error('Error:', err.message);
    }
}
main();
