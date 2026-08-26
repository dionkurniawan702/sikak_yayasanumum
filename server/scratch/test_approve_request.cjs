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

    const { budgetRequests = [] } = state;
    const req = budgetRequests.find(r => r.id === 'REQ-MSR5S6GC-R93');

    if (!req) {
        console.error('Request REQ-MSR5S6GC-R93 not found');
        return;
    }

    console.log('Testing PUT /budget-requests/REQ-MSR5S6GC-R93...');

    const BUDGET_REQUEST_FIELDS = ['status', 'description', 'month', 'year',
        'totalAmount', 'amount', 'items', 'unitId', 'fieldId', 'academicYearId',
        'date', 'expenseItemId', 'isDeleted', 'source', 'notified'];
    
    const updated = { ...req, status: 'APPROVED', notified: false };
    const cleanPayload = { id: updated.id };
    BUDGET_REQUEST_FIELDS.forEach(f => {
        if (updated[f] !== undefined) cleanPayload[f] = updated[f];
    });

    console.log('Sending cleanPayload:', JSON.stringify(cleanPayload).slice(0, 200) + '...');

    const putRes = await fetch(`${API_URL}/budget-requests/${req.id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(cleanPayload)
    });

    const putText = await putRes.text();
    console.log(`PUT Status: ${putRes.status}`);
    console.log(`PUT Response text:`, putText);
}

main().catch(console.error);
