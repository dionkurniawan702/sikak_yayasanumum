// Polling until server deploys the new build
// New build should have version 1.6.0 or a different indicator
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'sikad-dareliman-secret-2026';
const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host';

async function checkIfNewBuildDeployed() {
    // Sign a token WITHOUT unitId to simulate old-format token
    const oldToken = jwt.sign(
        { id: 'USR-ID-OLD-FORMAT', username: 'test', role: 'admin_unit' },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
    
    // Try cancel on remaining pending request
    const res = await fetch(`${API_URL}/api/budget-requests/REQ-MQER2UWU-Q5X`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${oldToken}`, 'Content-Type': 'application/json' }
    });
    
    const body = await res.text();
    return { status: res.status, body };
}

async function poll() {
    const MAX_ATTEMPTS = 40;
    for (let i = 1; i <= MAX_ATTEMPTS; i++) {
        console.log(`[Attempt ${i}/${MAX_ATTEMPTS}] Testing old-token cancel...`);
        try {
            const { status, body } = await checkIfNewBuildDeployed();
            console.log(`  Status: ${status}, Body: ${body}`);
            
            if (status === 200) {
                console.log('\n✅ SUCCESS! New build is live - old token cancel now works!');
                return;
            } else if (status === 403) {
                console.log('  ❌ Still getting 403 - old build running. Waiting 15s...');
            } else if (status === 500) {
                console.log('  ⚠️ 500 error - old build or DB issue. Waiting 15s...');
            } else {
                console.log(`  Unknown status ${status}. Body: ${body}. Waiting 15s...`);
            }
        } catch(e) {
            console.log('  Connection error:', e.message, '. Waiting 15s...');
        }
        await new Promise(r => setTimeout(r, 15000));
    }
    console.log('\n❌ Timed out after 40 attempts. Please redeploy manually on Easypanel.');
}

poll();
