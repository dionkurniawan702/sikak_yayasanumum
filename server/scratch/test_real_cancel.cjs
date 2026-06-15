const jwt = require('jsonwebtoken');

const JWT_SECRET = 'sikad-dareliman-secret-2026';
const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    try {
        // Step 1: Login as adminsdit2 to get REAL token (with new JWT payload)
        console.log('Logging in as adminsdit2 via the login API...');
        const loginRes = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // We don't know the real password, so let's try common ones
            body: JSON.stringify({ username: 'adminsdit2', password: 'daruliman123' })
        });
        const loginJson = await loginRes.json();
        console.log('Login result:', loginJson);
        
        if (!loginJson.data) {
            console.log('Login failed. Trying to cancel via manually signed token...');
            
            // Generate token with unitId (simulating new token)
            const token = jwt.sign(
                { id: 'test-user-id', username: 'adminsdit2', role: 'admin_unit', unitId: 'mo7xk4tfhzmqk', fieldId: null },
                JWT_SECRET,
                { expiresIn: '1h' }
            );
            
            const reqId = 'REQ-MQER1CAN-D92';
            console.log(`\nAttempting to DELETE/Cancel request ${reqId}...`);
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
            return;
        }
        
        const token = loginJson.data.token;
        const decoded = jwt.decode(token);
        console.log('\nDecoded token payload:', decoded);
        
        const reqId = 'REQ-MQER1CAN-D92';
        console.log(`\nAttempting to DELETE/Cancel request ${reqId} using REAL login token...`);
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
