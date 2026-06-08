const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    try {
        const loginRes = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'adminpdk', password: 'admin123' })
        });
        const loginJson = await loginRes.json();
        const token = loginJson.data.token;

        const dataRes = await fetch(`${API_URL}/all-data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataJson = await dataRes.json();
        const state = dataJson.data;

        const expenseItems = state.expenseItems || [];
        console.log('=== ALL EXPENSE ITEMS ===');
        expenseItems.forEach(item => {
            console.log(`- ID: ${item.id}, Name: ${item.name}`);
        });

    } catch (err) {
        console.error('Error:', err.message);
    }
}
main();
