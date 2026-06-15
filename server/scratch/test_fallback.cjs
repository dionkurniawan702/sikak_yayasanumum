const jwt = require('jsonwebtoken');

const JWT_SECRET = 'sikad-dareliman-secret-2026';
const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    try {
        // We will test canceling REQ-MQEOULNY-BFZ (owned by mo84ljcz1maso - PONPES PUTRI)
        // Using adminsmit (unit admin of mo84ljcz1maso) but simulating an OLD token payload (no unitId)
        const reqId = 'REQ-MQEOULNY-BFZ';
        
        console.log('Generating OLD token structure (no unitId/fieldId)...');
        // Let's find the user ID for adminponpesputri. In our inspect-users output:
        // Username: "adminponpesputri", Name: " ponpes putri Dar el-Iman", Role: "admin_unit", Unit: "PONPES PUTRI" (mo84ljcz1maso)
        // Since we don't have the exact user ID here, we can use any placeholder or query the DB to get it.
        // Wait! We can fetch all-data first to get the user ID of adminponpesputri!
        
        console.log('Logging in to get the real user ID of adminponpesputri...');
        const loginRes = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'adminponpesputri', password: 'password123' })
        });
        const loginJson = await loginRes.json();
        if (!loginJson.data) {
            console.error('Login failed:', loginJson);
            return;
        }
        
        const userId = loginJson.data.id;
        console.log(`Successfully logged in. User ID: ${userId}`);

        // Sign token manually OMITTING unitId
        const token = jwt.sign(
            { id: userId, username: 'adminponpesputri', role: 'admin_unit' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        console.log(`\nAttempting to DELETE/Cancel request ${reqId} using the token without unitId...`);
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
