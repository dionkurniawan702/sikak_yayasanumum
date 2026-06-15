const jwt = require('jsonwebtoken');
const JWT_SECRET = 'sikad-dareliman-secret-2026';
const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    const loginRes = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'superadmin', password: 'admin123' })
    });
    const loginJson = await loginRes.json();
    const token = loginJson.data.token;
    
    const dataRes = await fetch(`${API_URL}/all-data`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await dataRes.json();
    const users = data.data?.users || [];
    
    console.log('\nAll users:');
    users.forEach(u => console.log(`  username="${u.username}", id="${u.id}", role="${u.role}", unitId="${u.unitId}", fieldId="${u.fieldId}"`));
    
    // Find adminsdit2
    const sdit2User = users.find(u => u.username === 'adminsdit2');
    if (sdit2User) {
        console.log('\n=== adminsdit2 details ===');
        console.log(JSON.stringify(sdit2User, null, 2));
        
        // Now try cancel with token that has the REAL user ID from DB
        const realToken = jwt.sign(
            { 
                id: sdit2User.id, 
                username: sdit2User.username, 
                role: sdit2User.role 
                // NO unitId - simulate old token
            },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
        
        // Get pending requests for this unit
        const pendingReqs = (data.data?.budgetRequests || []).filter(r => 
            r.unitId === sdit2User.unitId && r.status === 'PENDING'
        );
        console.log('\nPending requests for SDIT 2:', pendingReqs.map(r => r.id));
        
        if (pendingReqs.length > 0) {
            const reqId = pendingReqs[0].id;
            console.log(`\nTesting cancel on ${reqId} with OLD token (no unitId)...`);
            console.log('Token payload:', JSON.stringify(jwt.decode(realToken)));
            
            const delRes = await fetch(`${API_URL}/budget-requests/${reqId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${realToken}`, 'Content-Type': 'application/json' }
            });
            console.log('Result:', delRes.status, await delRes.text());
        }
    } else {
        console.log('\nadminsdit2 NOT FOUND in users list!');
        console.log('Available usernames:', users.map(u => u.username));
    }
}

main().catch(console.error);
