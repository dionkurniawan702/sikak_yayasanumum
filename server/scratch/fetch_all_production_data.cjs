const jwt = require('jsonwebtoken');

const JWT_SECRET = 'sikad-dareliman-secret-2026';
const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    try {
        console.log('Generating superadmin token...');
        const token = jwt.sign(
            { id: 'superadmin_id', username: 'adminsdit1', role: 'superadmin' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        console.log('Fetching all remote data...');
        const dataRes = await fetch(`${API_URL}/all-data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataJson = await dataRes.json();
        console.log('Server Response:', JSON.stringify(dataJson, null, 2));

    } catch (err) {
        console.error('Error:', err.message);
    }
}
main();
