const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    try {
        console.log('Logging in as superadmin...');
        const loginRes = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'adminpdk', password: 'admin123' })
        });
        const loginJson = await loginRes.json();
        const token = loginJson.data.token;

        console.log('Fetching all-data...');
        const dataRes = await fetch(`${API_URL}/all-data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataJson = await dataRes.json();
        
        // We can inspect active budget requests first
        const activeRequests = dataJson.data.budgetRequests || [];
        console.log(`\nActive budget requests count: ${activeRequests.length}`);
        activeRequests.forEach(r => {
            console.log(`- ID: ${r.id}, UnitId: ${r.unitId}, Status: ${r.status}, TotalAmount: ${r.totalAmount}, Month: ${r.month}, isDeleted: ${r.isDeleted}`);
        });

    } catch (err) {
        console.error('Error:', err.message);
    }
}
main();
