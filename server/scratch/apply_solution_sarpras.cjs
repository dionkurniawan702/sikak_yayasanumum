const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    console.log('Logging in to remote API...');
    const loginRes = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'adminpdk', password: 'admin123' })
    });
    const loginJson = await loginRes.json();
    const token = loginJson.data?.token;

    if (!token) {
        console.error('Login failed:', loginJson);
        return;
    }

    const dataRes = await fetch(`${API_URL}/all-data`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const dataJson = await dataRes.json();
    const state = dataJson.data;

    const { budgetRequests = [], budgetReports = [], globalAcademicYearId } = state;
    
    // 1. Check req REQ-MSMN7I26-ZQ9 (Juli 2026 - Rp 3.630.000)
    const reqJuli = budgetRequests.find(r => r.id === 'REQ-MSMN7I26-ZQ9');
    console.log('REQ Juli 2026 (REQ-MSMN7I26-ZQ9):', reqJuli ? { id: reqJuli.id, amount: reqJuli.totalAmount, fieldId: reqJuli.fieldId } : 'Not found');

    // Create / Submit approved refund report for REQ-MSMN7I26-ZQ9 (Rp 3.630.000)
    const refundReportId = 'RET-MSMN7I26-3630';
    const existingRefund = budgetReports.find(r => r.id === refundReportId || (r.budgetRequestId === 'REQ-MSMN7I26-ZQ9' && r.kategoriAset === 'PENGEMBALIAN'));

    const refundPayload = {
        id: existingRefund ? existingRefund.id : refundReportId,
        budgetRequestId: 'REQ-MSMN7I26-ZQ9',
        requestId: 'REQ-MSMN7I26-ZQ9',
        fieldId: reqJuli ? reqJuli.fieldId : '7af86f5b-c9a8-4c14-9fd6-86a12e2a5c77',
        academicYearId: reqJuli ? reqJuli.academicYearId : globalAcademicYearId,
        date: new Date().toISOString().split('T')[0],
        amount: '3630000',
        description: 'Pengembalian Sisa Dana Request Juli 2026',
        buktiTeks: 'Nota BYOND BSI (Pelunasan Sisa Juli)',
        kategoriAset: 'PENGEMBALIAN',
        status: 'APPROVED',
        notified: true,
        isDeleted: false
    };

    console.log('\nSubmitting approved refund report for REQ-MSMN7I26-ZQ9...');
    const refundRes = await fetch(`${API_URL}/budget-reports/${refundPayload.id}`, {
        method: existingRefund ? 'PUT' : 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(refundPayload)
    });
    console.log('Refund submit status:', refundRes.status, await refundRes.json());

    // 2. Now attempt to APPROVE REQ-MSR5S6GC-R93 (Agustus 2026 - Rp 72.466.000)
    const reqAgustus = budgetRequests.find(r => r.id === 'REQ-MSR5S6GC-R93');
    if (!reqAgustus) {
        console.error('REQ-MSR5S6GC-R93 not found');
        return;
    }

    console.log('\nApproving REQ-MSR5S6GC-R93 via API...');
    const BUDGET_REQUEST_FIELDS = ['status', 'description', 'month', 'year',
        'totalAmount', 'amount', 'items', 'unitId', 'fieldId', 'academicYearId',
        'date', 'expenseItemId', 'isDeleted', 'source', 'notified'];

    const updatedAgustus = { ...reqAgustus, status: 'APPROVED', notified: false };
    const cleanPayload = { id: updatedAgustus.id };
    BUDGET_REQUEST_FIELDS.forEach(f => {
        if (updatedAgustus[f] !== undefined) cleanPayload[f] = updatedAgustus[f];
    });

    const approveRes = await fetch(`${API_URL}/budget-requests/${reqAgustus.id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(cleanPayload)
    });

    const approveJson = await approveRes.json();
    console.log('Approve REQ-MSR5S6GC-R93 response status:', approveRes.status);
    console.log('Approve REQ-MSR5S6GC-R93 response body:', approveJson);

    // Final check
    const finalDataRes = await fetch(`${API_URL}/all-data`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const finalState = (await finalDataRes.json()).data;
    const finalReqAgustus = (finalState.budgetRequests || []).find(r => r.id === 'REQ-MSR5S6GC-R93');
    console.log('\nFinal Status of REQ-MSR5S6GC-R93:', finalReqAgustus?.status);
}

main().catch(console.error);
