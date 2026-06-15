const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    try {
        console.log('Logging in to remote API...');
        const loginRes = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'adminpdk', password: 'admin123' })
        });
        const loginJson = await loginRes.json();
        if (!loginJson.data) {
            console.error('Login failed:', loginJson);
            return;
        }
        const token = loginJson.data.token;
        console.log('Login successful. Fetching all data...');

        const dataRes = await fetch(`${API_URL}/all-data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataJson = await dataRes.json();
        const state = dataJson.data;

        console.log('\n--- Academic Years in Remote DB ---');
        console.log(state.academicYears.map(y => ({ id: y.id, name: y.name, isCurrent: y.isCurrent })));

        console.log('\n--- Distribution Settings count by academicYearId ---');
        const settings = state.distributionSettings || [];
        console.log(`Total settings in remote DB: ${settings.length}`);

        const counts = {};
        settings.forEach(s => {
            const key = s.academicYearId || 'null';
            counts[key] = (counts[key] || 0) + 1;
        });
        console.log(counts);

        if (settings.length > 0) {
            console.log('\nSample setting:', settings[0]);
        }
    } catch (err) {
        console.error('Error:', err.message);
    }
}
main();
