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

    const { budgetRequests = [], budgetReports = [] } = state;
    const req = budgetRequests.find(r => r.id === 'REQ-MSR5S6GC-R93');

    console.log('Target Request REQ-MSR5S6GC-R93:', {
        id: req.id,
        unitId: req.unitId,
        fieldId: req.fieldId,
        month: req.month,
        academicYearId: req.academicYearId
    });

    const targetId = req.fieldId || req.unitId;

    console.log('\n=== ALL BUDGET REQUESTS FOR THIS FIELD/UNIT ID ===');
    const fieldReqs = budgetRequests.filter(r => r.fieldId === targetId || r.unitId === targetId);
    fieldReqs.forEach(r => {
        console.log(`- REQ [${r.id}] Month: ${r.month} Status: ${r.status} UnitId: ${r.unitId} FieldId: ${r.fieldId} TotalAmount: ${r.totalAmount}`);
    });

    console.log('\n=== ALL BUDGET REPORTS FOR THIS FIELD/UNIT ID ===');
    const fieldReports = budgetReports.filter(r => r.fieldId === targetId || r.unitId === targetId);
    fieldReports.forEach(r => {
        console.log(`- REPORT [${r.id}] Date: ${r.date} Status: ${r.status} Kategori: ${r.kategoriAset} UnitId: ${r.unitId} FieldId: ${r.fieldId} ReqId: ${r.budgetRequestId || r.requestId} Amount: ${r.amount}`);
    });
}

main().catch(console.error);
