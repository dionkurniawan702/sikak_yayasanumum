const jwt = require('jsonwebtoken');

const JWT_SECRET = 'sikad-dareliman-secret-2026';
const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    try {
        console.log('Logging in as adminpdk...');
        const loginRes = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'adminpdk', password: 'admin123' })
        });
        const loginJson = await loginRes.json();
        const token = loginJson.data.token;

        console.log('Fetching all-data to find adminponpesputri user ID...');
        const dataRes = await fetch(`${API_URL}/all-data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataJson = await dataRes.json();
        const users = dataJson.data.users || [];
        
        const targetUser = users.find(u => u.username === 'adminponpesputri');
        if (!targetUser) {
            console.error('adminponpesputri not found in database!');
            return;
        }

        console.log(`Found target user. ID: ${targetUser.id}, UnitId: ${targetUser.unitId}`);

        // Construct token OMITTING unitId to test fallback
        const testToken = jwt.sign(
            { id: targetUser.id, username: 'adminponpesputri', role: 'admin_unit' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        const reqId = 'REQ-MQEOULNY-BFZ';
        console.log(`\nAttempting to DELETE/Cancel request ${reqId} using token WITHOUT unitId...`);
        
        const deleteRes = await fetch(`${API_URL}/budget-requests/${reqId}`, {
            method: 'DELETE',
            headers: { 
                'Authorization': `Bearer ${testToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('HTTP Status Code:', deleteRes.status);
        const text = await deleteRes.text();
        console.log('Response Body:', text);

    } catch (err) {
        console.error('Error:', err.message);
    }
}
main();
