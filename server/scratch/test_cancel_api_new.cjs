const jwt = require('jsonwebtoken');

const JWT_SECRET = 'sikad-dareliman-secret-2026';
const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    try {
        const reqId = 'REQ-MQEQJ64N-YJT';
        
        // Generate token signed as the owner: admin_unit for unit 'mo7xk4tfhzmqk' (SDIT 2)
        console.log('Generating signed token for unit admin of mo7xk4tfhzmqk...');
        const token = jwt.sign(
            { id: 'test-user-id', username: 'adminsdit2', role: 'admin_unit', unitId: 'mo7xk4tfhzmqk' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        console.log(`\nAttempting to DELETE/Cancel request ${reqId} using this token...`);
        const deleteRes = await fetch(`${API_URL}/budget-requests/${reqId}`, {
            method: 'DELETE',
            headers: { 
                'Authorization': `Bearer ${token}`,
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
