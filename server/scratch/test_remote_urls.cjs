async function main() {
    const urls = [
        'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api/health',
        'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api/login',
        'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/health'
    ];
    for (const url of urls) {
        try {
            const res = await fetch(url);
            const text = await res.text();
            console.log(`URL: ${url} -> Status: ${res.status}`);
            console.log(`Body snippet: ${text.substring(0, 200)}\n`);
        } catch (e) {
            console.log(`URL: ${url} -> Error: ${e.message}\n`);
        }
    }
}
main();
