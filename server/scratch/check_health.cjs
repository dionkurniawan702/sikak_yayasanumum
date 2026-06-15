async function main() {
    const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api/health';
    console.log(`Fetching remote health from ${API_URL}...`);
    try {
        const res = await fetch(API_URL);
        console.log('HTTP Status:', res.status);
        const text = await res.text();
        console.log('Response:');
        console.log(text);
    } catch (err) {
        console.error('Error fetching health:', err.message);
    }
}
main();
