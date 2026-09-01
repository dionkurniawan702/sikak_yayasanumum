const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    try {
        console.log('Sending login request with headers...');
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ username: 'adminpdk', password: 'admin123' })
        });
        console.log('Status:', res.status);
        const json = await res.json();
        console.log('JSON:', json);
    } catch (e) {
        console.error('Error:', e.message);
    }
}
main();
