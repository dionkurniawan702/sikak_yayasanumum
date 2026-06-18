const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    try {
        console.log('1. Logging in as superadmin adminpdk...');
        const loginRes = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'adminpdk', password: 'admin123' })
        });
        const loginJson = await loginRes.json();
        if (!loginJson.data) {
            console.error('Login failed:', loginJson);
            return;
        }
        const token = loginJson.data.token;
        console.log('Login successful.');

        console.log('\n2. Fetching all data...');
        const dataRes = await fetch(`${API_URL}/all-data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataJson = await dataRes.json();
        
        const sdit2UnitId = 'mo7xk4tfhzmqk'; // SDIT 2 unit id
        const budgetRequests = dataJson.data.budgetRequests || [];
        const sdit2Requests = budgetRequests.filter(r => r.unitId === sdit2UnitId);
        
        console.log(`\n=== SDIT 2 Budget Requests (Total: ${sdit2Requests.length}) ===`);
        sdit2Requests.forEach(r => {
            console.log(`ID: "${r.id}"`);
            console.log(`  Month: ${r.month}, Year: ${r.year}`);
            console.log(`  Amount: Rp ${parseFloat(r.totalAmount || r.amount || 0).toLocaleString('id-ID')}`);
            console.log(`  Status: ${r.status}`);
            console.log(`  isDeleted: ${r.isDeleted}`);
            console.log(`  Date: ${r.date}`);
            console.log('-------------------------------------------');
        });

    } catch (err) {
        console.error('Error:', err.message);
    }
}
main();
