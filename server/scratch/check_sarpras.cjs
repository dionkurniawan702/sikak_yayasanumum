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

    const fields = state.fields || [];
    console.log('Fields:', fields.map(f => ({ id: f.id, name: f.name })));

    const sarprasField = fields.find(f => f.name.toLowerCase().includes('sarana') || f.name.toLowerCase().includes('sarpras'));
    console.log('Sarpras Field:', sarprasField);

    if (sarprasField) {
        const reqs = (state.budgetRequests || []).filter(r => r.fieldId === sarprasField.id);
        console.log(`\nFound ${reqs.length} requests for Sarpras (fieldId: ${sarprasField.id}):`);
        reqs.forEach(r => {
            console.log({
                id: r.id,
                month: r.month,
                status: r.status,
                unitId: r.unitId,
                fieldId: r.fieldId,
                totalAmount: r.totalAmount,
                description: r.description
            });
        });

        const reps = (state.budgetReports || []).filter(r => r.fieldId === sarprasField.id);
        console.log(`\nFound ${reps.length} reports for Sarpras (fieldId: ${sarprasField.id}):`);
        reps.forEach(r => {
            console.log({
                id: r.id,
                date: r.date,
                status: r.status,
                kategoriAset: r.kategoriAset,
                amount: r.amount,
                unitId: r.unitId,
                fieldId: r.fieldId,
                budgetRequestId: r.budgetRequestId
            });
        });
    }
}

main().catch(console.error);
