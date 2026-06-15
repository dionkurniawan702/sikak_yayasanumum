const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    try {
        console.log('Logging in to get token...');
        const loginRes = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'adminpdk', password: 'admin123' })
        });
        const loginJson = await loginRes.json();
        const token = loginJson.data.token;

        console.log('Fetching all data...');
        const dataRes = await fetch(`${API_URL}/all-data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataJson = await dataRes.json();
        const users = dataJson.data.users || [];
        const units = dataJson.data.units || [];
        const fields = dataJson.data.fields || [];

        console.log('\n--- ALL USERS IN REMOTE DB ---');
        users.forEach(u => {
            const unitName = units.find(un => un.id === u.unitId)?.name || 'None';
            const fieldName = fields.find(f => f.id === u.fieldId)?.name || 'None';
            console.log(`Username: "${u.username}", Role: "${u.role}", Unit: "${unitName}" (${u.unitId}), Field: "${fieldName}" (${u.fieldId})`);
        });

    } catch (err) {
        console.error('Error:', err.message);
    }
}
main();
