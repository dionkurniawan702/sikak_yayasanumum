const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
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

    const requests = state.budgetRequests || [];
    const reports = state.budgetReports || [];
    const units = state.units || [];
    const fields = state.fields || [];

    const unitIds = new Set(units.map(u => u.id));
    const fieldIds = new Set(fields.map(f => f.id));

    console.log('Units:', units.map(u => ({ id: u.id, name: u.name })));
    console.log('Fields:', fields.map(f => ({ id: f.id, name: f.name })));

    console.log('\n--- Requests breakdown ---');
    requests.forEach(r => {
        const u = units.find(unit => unit.id === r.unitId)?.name || r.unitId || 'NONE';
        const f = fields.find(field => field.id === r.fieldId)?.name || r.fieldId || 'NONE';
        console.log(`Req: ${r.id} | Month: ${r.month} | unitId: ${r.unitId} (${u}) | fieldId: ${r.fieldId} (${f}) | Amt: ${r.totalAmount}`);
    });
}

main().catch(console.error);
