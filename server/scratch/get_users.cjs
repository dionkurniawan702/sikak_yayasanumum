const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    console.log(`Polling ${API_URL}/inspect-users until deployed...`);
    const maxAttempts = 30;
    const intervalMs = 15000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        console.log(`[Attempt ${attempt}/${maxAttempts}] Checking...`);
        try {
            const res = await fetch(`${API_URL}/inspect-users`);
            const text = await res.text();
            
            if (text.trim().startsWith('<!doctype') || text.trim().startsWith('<html')) {
                console.log(`Still returning HTML (fallback). Server is rebuilding. Waiting 15s...`);
            } else {
                console.log(`Success! Received JSON response.`);
                try {
                    const data = JSON.parse(text);
                    if (data.error) {
                        console.error('Server error:', data.error);
                        return;
                    }
                    console.log('\n--- REMOTE UNITS ---');
                    data.units.forEach(u => {
                        console.log(`- Unit Name: "${u.name}", ID: "${u.id}"`);
                    });

                    console.log('\n--- REMOTE USERS ---');
                    data.users.forEach(u => {
                        const unitName = data.units.find(un => un.id === u.unitId)?.name || 'None';
                        console.log(`- Username: "${u.username}", Name: "${u.name}", Role: "${u.role}", Unit: "${unitName}" (${u.unitId}), FieldId: (${u.fieldId})`);
                    });
                    return;
                } catch (jsonErr) {
                    console.log('Response is not HTML but not valid JSON either. Raw response snippet:');
                    console.log(text.slice(0, 500));
                    return;
                }
            }
        } catch (err) {
            console.log(`Fetch error (server restarting): ${err.message}. Waiting 15s...`);
        }
        await new Promise(r => setTimeout(r, intervalMs));
    }
    console.log('Timeout waiting for deployment.');
}
main();
