const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    try {
        console.log('1. Logging in as superadmin...');
        const loginRes = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'password123' })
        });
        const loginJson = await loginRes.json();
        if (!loginJson.data) {
            console.error('Superadmin login failed:', loginJson);
            return;
        }
        
        const token = loginJson.data.token;
        console.log('Login successful. Role:', loginJson.data.role);
        
        console.log('\n2. Fetching all users to identify unit admin credentials...');
        const dataRes = await fetch(`${API_URL}/all-data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataJson = await dataRes.json();
        const users = dataJson.data.users || [];
        const units = dataJson.data.units || [];
        const fields = dataJson.data.fields || [];

        users.forEach(u => {
            const unitName = units.find(un => un.id === u.unitId)?.name || 'None';
            const fieldName = fields.find(f => f.id === u.fieldId)?.name || 'None';
            console.log(`- Username: "${u.username}", Role: "${u.role}", Unit: "${unitName}" (${u.unitId}), Field: "${fieldName}" (${u.fieldId})`);
        });

        const reqId = 'REQ-MQ0LTEIR-RBJ';
        const budgetRequests = dataJson.data.budgetRequests || [];
        const req = budgetRequests.find(r => r.id === reqId);
        
        if (!req) {
            console.log(`\nRequest ${reqId} not found!`);
            return;
        }
        
        console.log(`\n3. Found request:`, {
            id: req.id,
            unitId: req.unitId,
            unitName: units.find(un => un.id === req.unitId)?.name || 'None',
            fieldId: req.fieldId,
            fieldName: fields.find(f => f.id === req.fieldId)?.name || 'None',
            status: req.status
        });

    } catch (err) {
        console.error('Error during diagnostics:', err.message);
    }
}
main();
