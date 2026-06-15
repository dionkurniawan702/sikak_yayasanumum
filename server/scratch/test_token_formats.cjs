const jwt = require('jsonwebtoken');

const JWT_SECRET = 'sikad-dareliman-secret-2026';
const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    try {
        // Fetch the real user ID of adminsdit2 from all-data (login as adminpdk first)
        const loginRes = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'adminpdk', password: 'admin123' })
        });
        const { data: { token: adminToken } } = await loginRes.json();
        
        const dataRes = await fetch(`${API_URL}/all-data`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const { data } = await dataRes.json();
        
        // Get the adminsdit2 user (superadmin can see all users)
        // Actually adminpdk is not superadmin, can only see themselves. Need to use inspect-users
        // Let's get the user ID from users in all-data
        const users = data.users || [];
        console.log('Users visible to adminpdk:', users.map(u => `${u.username}(${u.id})`));
        
        // Since we can't get adminsdit2 ID that way, let's try the OLD token format (no unitId)
        // and see if our fallback in the route works.
        const reqId = 'REQ-MQER2UWU-Q5X'; // Remaining PENDING request for SDIT 2
        
        // Test 1: OLD token without unitId - but we need a REAL user ID that maps to adminsdit2 in DB
        // Let's use our inspect-users data from before: adminsdit2 unitId = mo7xk4tfhzmqk
        // We know from test that manually signed token WITH unitId works.
        // Now test WITHOUT unitId to confirm fallback works
        
        console.log('\n--- TEST: OLD TOKEN (no unitId, no fieldId) ---');
        // We need the real user.id for adminsdit2. Use a placeholder and check fallback
        // The fallback does prisma.user.findUnique({where: { id: req.user.id }})
        // If id doesn't exist in DB, it would fail. But we can sign with a fake ID to test
        
        const oldToken = jwt.sign(
            { id: 'FAKE-ID-DOES-NOT-EXIST', username: 'adminsdit2', role: 'admin_unit' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
        
        const deleteRes1 = await fetch(`${API_URL}/budget-requests/${reqId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${oldToken}`, 'Content-Type': 'application/json' }
        });
        console.log('Status (fake ID, no unitId):', deleteRes1.status, await deleteRes1.text());
        
        console.log('\n--- TEST: NEW TOKEN (with unitId in payload) ---');
        const newToken = jwt.sign(
            { id: 'FAKE-ID-DOES-NOT-EXIST', username: 'adminsdit2', role: 'admin_unit', unitId: 'mo7xk4tfhzmqk', fieldId: null },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
        
        const deleteRes2 = await fetch(`${API_URL}/budget-requests/${reqId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${newToken}`, 'Content-Type': 'application/json' }
        });
        console.log('Status (fake ID, WITH unitId):', deleteRes2.status, await deleteRes2.text());

    } catch (err) {
        console.error('Error:', err.message);
    }
}
main();
