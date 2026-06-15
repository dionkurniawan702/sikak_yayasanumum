const jwt = require('jsonwebtoken');

const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    console.log(`Polling JWT payload from ${API_URL}/login until updated...`);
    const maxAttempts = 40;
    const intervalMs = 15000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        console.log(`[Attempt ${attempt}/${maxAttempts}] Checking JWT payload...`);
        try {
            const loginRes = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'adminpdk', password: 'admin123' })
            });
            const loginJson = await loginRes.json();
            
            if (loginJson.data && loginJson.data.token) {
                const decoded = jwt.decode(loginJson.data.token);
                if (decoded.fieldId !== undefined) {
                    console.log(`\n🎉 SUCCESS! The new backend build is deployed and active.`);
                    console.log(`Payload:`, decoded);
                    return;
                } else {
                    console.log(`Still running the old build. Waiting 15s...`);
                }
            } else {
                console.log(`Server returned error or invalid JSON. Waiting 15s...`);
            }
        } catch (err) {
            console.log(`Fetch error (server restarting): ${err.message}. Waiting 15s...`);
        }
        await new Promise(r => setTimeout(r, intervalMs));
    }
    console.log('Timeout waiting for deployment.');
}
main();
