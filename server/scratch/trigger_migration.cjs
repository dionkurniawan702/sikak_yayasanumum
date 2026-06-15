async function main() {
    const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api/run-db-push';
    console.log(`Polling ${API_URL} until the new build is deployed...`);
    
    const maxAttempts = 30;
    const intervalMs = 15000; // 15 seconds
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        console.log(`\n[Attempt ${attempt}/${maxAttempts}] Sending request...`);
        try {
            const res = await fetch(API_URL);
            const text = await res.text();
            
            if (text.trim().startsWith('<!doctype') || text.trim().startsWith('<html')) {
                console.log(`Still returning HTML (frontend fallback). Server is rebuilding or restarting. Waiting ${intervalMs/1000}s...`);
            } else {
                console.log(`Success! Received non-HTML response.`);
                try {
                    const data = JSON.parse(text);
                    console.log('Migration Response Body:', JSON.stringify(data, null, 2));
                    return;
                } catch (jsonErr) {
                    console.log('Response is not HTML but not valid JSON either. Raw response snippet:');
                    console.log(text.slice(0, 500));
                    return;
                }
            }
        } catch (err) {
            console.log(`Fetch error (server might be restarting): ${err.message}. Waiting ${intervalMs/1000}s...`);
        }
        await new Promise(r => setTimeout(r, intervalMs));
    }
    console.log('\nTimed out waiting for the build to deploy.');
}
main();
