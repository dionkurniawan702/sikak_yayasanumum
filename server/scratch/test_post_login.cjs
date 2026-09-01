const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    try {
        console.log('Testing POST to /api/login...');
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'adminpdk', password: 'admin123' })
        });
        console.log('Status:', res.status);
        const text = await res.text();
        console.log('Response text:', text);
    } catch (e) {
        console.error('Error:', e.message);
    }
}
main();
