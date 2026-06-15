const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/health';

async function main() {
    console.log(`Polling ${API_URL} until deployed...`);
    const maxAttempts = 30;
    const intervalMs = 15000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        console.log(`[Attempt ${attempt}/${maxAttempts}] Checking health...`);
        try {
            const res = await fetch(API_URL);
            const text = await res.text();
            
            if (text.trim().startsWith('<!doctype') || text.trim().startsWith('<html')) {
                console.log(`Still returning HTML (fallback). Server is rebuilding. Waiting 15s...`);
            } else {
                try {
                    const data = JSON.parse(text);
                    console.log(`Success! Server is online. Status:`, data);
                    return;
                } catch (e) {
                    console.log(`Not HTML, but parse error. Snippet:`, text.slice(0, 200));
                }
            }
        } catch (err) {
            console.log(`Fetch error (server restarting/building): ${err.message}. Waiting 15s...`);
        }
        await new Promise(r => setTimeout(r, intervalMs));
    }
    console.log('Timeout waiting for deployment.');
}
main();
