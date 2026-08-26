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

    const { budgetRequests = [], budgetReports = [], fields = [], globalAcademicYearId } = state;
    const req = budgetRequests.find(r => r.id === 'REQ-MSR5S6GC-R93');

    const fieldId = req.fieldId || req.unitId;
    const field = fields.find(f => f.id === fieldId);

    console.log('Target Request ID:', req.id);
    console.log('Target Field ID:', fieldId, '| Name:', field ? field.name : 'Unknown');
    console.log('Target Request Month:', req.month);

    // Prior approved requests for this field in same academic year
    const priorRequests = budgetRequests.filter(r => {
        const isSameEntity = (r.fieldId && r.fieldId === fieldId) || (r.unitId && r.unitId === fieldId);
        const isPriorMonth = r.month < req.month;
        return isSameEntity && r.status === 'APPROVED' && r.academicYearId === globalAcademicYearId && isPriorMonth;
    });

    console.log(`\nPrior Approved Requests count: ${priorRequests.length}`);
    priorRequests.forEach(r => {
        console.log(`- REQ [${r.id}] Month: ${r.month} TotalAmount: ${r.totalAmount}`);
    });

    const totalCair = priorRequests.reduce((sum, r) => sum + (parseFloat(r.totalAmount) || 0), 0);

    const priorRequestIds = priorRequests.map(r => r.id);
    const priorReports = budgetReports.filter(r => {
        return (priorRequestIds.includes(r.budgetRequestId) || priorRequestIds.includes(r.requestId)) &&
               r.status === 'APPROVED' && !r.isDeleted && r.kategoriAset !== 'PENGEMBALIAN';
    });

    const totalUsed = priorReports.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

    const allReturnsForField = budgetReports.filter(r => {
        const isSameEntity = r.fieldId === fieldId || r.unitId === fieldId;
        return isSameEntity && r.kategoriAset === 'PENGEMBALIAN' && !r.isDeleted;
    });

    console.log(`\nAll Refund Reports (PENGEMBALIAN) for Field: ${allReturnsForField.length}`);
    allReturnsForField.forEach(r => {
        console.log(`- REFUND [${r.id}] Status: ${r.status} Date: ${r.date} Amount: ${r.amount} Desc: "${r.description}" ReqId: ${r.budgetRequestId || r.requestId}`);
    });

    const approvedReturns = allReturnsForField.filter(r => r.status === 'APPROVED');
    const totalReturnedApproved = approvedReturns.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

    const pendingReturns = allReturnsForField.filter(r => r.status === 'PENDING');
    const totalReturnedPending = pendingReturns.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

    console.log('\n=== SUMMARY CALCULATION ===');
    console.log(`Total Cair (Prior Months): ${totalCair}`);
    console.log(`Total Realisasi Belanja (APPROVED): ${totalUsed}`);
    console.log(`Total Pengembalian (APPROVED): ${totalReturnedApproved}`);
    console.log(`Total Pengembalian (PENDING): ${totalReturnedPending}`);
    console.log(`Sisa Unreturned menurut Backend (Cair - Used - ApprovedReturned): ${totalCair - totalUsed - totalReturnedApproved}`);
}

main().catch(console.error);
