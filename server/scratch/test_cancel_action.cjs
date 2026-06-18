const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    try {
        console.log('1. Logging in as adminsdit2...');
        const loginRes = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'adminsdit2', password: '123sdit2' })
        });
        const loginJson = await loginRes.json();
        if (!loginJson.data) {
            console.error('Login failed:', loginJson);
            return;
        }
        const token = loginJson.data.token;
        console.log('Login successful. Unit:', loginJson.data.unitId);

        const reqId = 'REQ-MQ0LTEIR-RBJ';
        console.log(`\n2. Performing DELETE on /budget-requests/${reqId}...`);
        const delRes = await fetch(`${API_URL}/budget-requests/${reqId}`, {
            method: 'DELETE',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('HTTP Status Code:', delRes.status);
        const delJson = await delRes.json();
        console.log('Response:', delJson);

        console.log('\n3. Re-fetching data to verify if isDeleted is now true...');
        // We log in as adminpdk to check all data
        const loginAdminRes = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'adminpdk', password: 'admin123' })
        });
        const loginAdminJson = await loginAdminRes.json();
        const adminToken = loginAdminJson.data.token;
        
        const dataRes = await fetch(`${API_URL}/all-data`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const dataJson = await dataRes.json();
        const budgetRequests = dataJson.data.budgetRequests || [];
        const req = budgetRequests.find(r => r.id === reqId);
        
        if (req) {
            console.log(`Verification: Request still found in active data!`);
            console.log(`isDeleted: ${req.isDeleted}, Status: ${req.status}`);
        } else {
            console.log(`Verification: Request is NOT found in active data (successfully hidden/deleted!).`);
        }

    } catch (err) {
        console.error('Error:', err.message);
    }
}
main();
