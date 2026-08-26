const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    const loginRes = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'adminpdk', password: 'admin123' })
    });
    const loginJson = await loginRes.json();
    const token = loginJson.data?.token;

    const dataRes = await fetch(`${API_URL}/all-data`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const dataJson = await dataRes.json();
    const state = dataJson.data;

    const { budgetRequests = [], units = [], fields = [] } = state;
    const req = budgetRequests.find(r => r.id === 'REQ-MSR5S6GC-R93' || r.id?.includes('MSR5S6GC'));

    console.log('=== REQUEST REQ-MSR5S6GC-R93 DETAILS ===');
    console.log(req);

    if (req) {
        const u = units.find(unit => unit.id === req.unitId);
        const f = fields.find(field => field.id === req.fieldId);
        console.log('Unit:', u ? u.name : 'None');
        console.log('Field (Bidang):', f ? f.name : 'None');
        console.log('Status:', req.status);
        console.log('Month:', req.month);
        console.log('Items:', JSON.stringify(req.items, null, 2));
    }
}

main().catch(console.error);
