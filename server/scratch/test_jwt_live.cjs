const jwt = require('jsonwebtoken');

const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    try {
        console.log('Logging in as adminpdk to fetch JWT...');
        const loginRes = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'adminpdk', password: 'admin123' })
        });
        const loginJson = await loginRes.json();
        
        if (!loginJson.data || !loginJson.data.token) {
            console.error('Login failed:', loginJson);
            return;
        }

        const token = loginJson.data.token;
        const decoded = jwt.decode(token);
        
        console.log('\nDecoded JWT Payload from Live Server:');
        console.log(JSON.stringify(decoded, null, 2));

        if (decoded.fieldId !== undefined) {
            console.log('\n✅ SUCCESS: The new backend build is live! Payload contains new fields.');
        } else {
            console.log('\n❌ FAILURE: The server is still running the old backend build.');
        }

    } catch (err) {
        console.error('Error:', err.message);
    }
}
main();
