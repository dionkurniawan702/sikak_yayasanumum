const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    try {
        const loginRes = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'adminpdk', password: 'admin123' })
        });
        console.log('Status:', loginRes.status);
        const text = await loginRes.text();
        console.log('Body:', text);
    } catch (err) {
        console.error('Error:', err.message);
    }
}
main();
