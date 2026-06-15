async function main() {
    const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api/health';
    console.log(`Polling health check at ${API_URL}...`);
    
    const maxAttempts = 30;
    const intervalMs = 15000;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        console.log(`[Attempt ${attempt}/${maxAttempts}] checking...`);
        try {
            const res = await fetch(API_URL);
            if (res.status === 200) {
                const data = await res.json();
                console.log(`Success! Server is up. Version: ${data.version}`);
                return;
            } else {
                console.log(`Server returned status ${res.status}. Waiting...`);
            }
        } catch (err) {
            console.log(`Fetch failed (server restarting): ${err.message}. Waiting...`);
        }
        await new Promise(r => setTimeout(r, intervalMs));
    }
    console.log('Timeout waiting for deployment.');
}
main();
