const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    console.log('Logging in...');
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

    const { budgetRequests = [], globalAcademicYearId } = state;
    const reqJuli = budgetRequests.find(r => r.id === 'REQ-MSMN7I26-ZQ9');

    const refundPayload = {
        id: 'RET-MSMN7I26-3630',
        budgetRequestId: 'REQ-MSMN7I26-ZQ9',
        requestId: 'REQ-MSMN7I26-ZQ9',
        fieldId: reqJuli ? reqJuli.fieldId : '23dfc180-eccb-4e44-aace-702eab3705ed',
        academicYearId: reqJuli ? reqJuli.academicYearId : globalAcademicYearId,
        date: new Date().toISOString(),
        amount: '3630000',
        description: 'Pengembalian Sisa Dana Request Juli 2026',
        buktiTeks: 'Nota BYOND BSI (Pelunasan Sisa Juli)',
        kategoriAset: 'PENGEMBALIAN',
        status: 'APPROVED',
        notified: true,
        isDeleted: false
    };

    console.log('Submitting refund report via POST /budget-reports...');
    const refundRes = await fetch(`${API_URL}/budget-reports`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(refundPayload)
    });
    const refundText = await refundRes.text();
    console.log('POST /budget-reports status:', refundRes.status, refundText);

    // Now approve REQ-MSR5S6GC-R93
    const reqAgustus = budgetRequests.find(r => r.id === 'REQ-MSR5S6GC-R93');
    const BUDGET_REQUEST_FIELDS = ['status', 'description', 'month', 'year',
        'totalAmount', 'amount', 'items', 'unitId', 'fieldId', 'academicYearId',
        'date', 'expenseItemId', 'isDeleted', 'source', 'notified'];

    const updatedAgustus = { ...reqAgustus, status: 'APPROVED', notified: false };
    const cleanPayload = { id: updatedAgustus.id };
    BUDGET_REQUEST_FIELDS.forEach(f => {
        if (updatedAgustus[f] !== undefined) cleanPayload[f] = updatedAgustus[f];
    });

    console.log('\nApproving REQ-MSR5S6GC-R93 via PUT /budget-requests/REQ-MSR5S6GC-R93...');
    const approveRes = await fetch(`${API_URL}/budget-requests/${reqAgustus.id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(cleanPayload)
    });

    const approveText = await approveRes.text();
    console.log('PUT /budget-requests Status:', approveRes.status, approveText);
}

main().catch(console.error);
