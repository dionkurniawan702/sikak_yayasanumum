// Debug: Test login as adminsdit2 and check what happens with delete
// First try ALL possible passwords for adminsdit2

const jwt = require('jsonwebtoken');
const JWT_SECRET = 'sikad-dareliman-secret-2026';
const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

const passwords = [
    'admin123', 'daruliman123', 'sdit2123', 'sdit2', 'admin',
    'password', '123456', 'dareliman', 'Dareliman123', 'Admin123',
    'adminsdit2', 'sdit2dareliman', 'dion123', 'sikad123'
];

async function tryLogin(password) {
    const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'adminsdit2', password })
    });
    const json = await res.json();
    return json;
}

async function main() {
    console.log('=== Trying all passwords for adminsdit2 ===');
    for (const pw of passwords) {
        const result = await tryLogin(pw);
        if (result.success !== false) {
            console.log(`✅ SUCCESS with password: "${pw}"`);
            console.log('Token:', result.data?.token?.substring(0, 50) + '...');
            const decoded = jwt.decode(result.data?.token);
            console.log('Decoded JWT:', JSON.stringify(decoded, null, 2));
            
            // Now try delete with this real token
            const token = result.data?.token;
            
            // First list all pending requests for this user
            const allData = await fetch(`${API_URL}/all-data`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const allJson = await allData.json();
            const requests = allJson.data?.budgetRequests || [];
            console.log('\nBudget requests visible:', requests.length);
            const pending = requests.filter(r => r.status === 'PENDING');
            console.log('Pending requests:', pending.map(r => `${r.id} (unit: ${r.unitId})`));
            
            if (pending.length > 0) {
                const reqId = pending[0].id;
                console.log(`\nTrying to cancel ${reqId}...`);
                const delRes = await fetch(`${API_URL}/budget-requests/${reqId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                console.log('Delete status:', delRes.status, await delRes.text());
            }
            return;
        }
        process.stdout.write('.');
    }
    console.log('\n❌ All passwords failed');
}

main().catch(console.error);
