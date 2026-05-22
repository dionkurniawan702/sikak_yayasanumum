const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    console.log('--- DIAGNOSTIC SIKAD API ---');
    try {
        const res = await fetch(`${API_URL}/all-data`);
        const json = await res.json();
        console.log("JSON response:", json);
    } catch (err) {
        console.error("Error fetching remote data:", err.message);
    }
}

main();
