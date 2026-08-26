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

    const fieldId = req.fieldId;
    const unitId = req.unitId;
    const academicYearId = req.academicYearId;
    const month = req.month;

    // Simulate priorRequests
    const priorRequests = budgetRequests.filter(r => {
        const isSameEntity = (fieldId && r.fieldId === fieldId) || (unitId && r.unitId === unitId);
        return isSameEntity && r.status === 'APPROVED' && r.academicYearId === academicYearId && r.month < month;
    });

    const priorRequestIds = priorRequests.map(r => r.id);
    console.log('Prior Request IDs:', priorRequestIds);

    const totalCair = priorRequests.reduce((sum, r) => sum + (parseFloat(r.totalAmount) || 0), 0);

    const priorReports = budgetReports.filter(r => {
        return (priorRequestIds.includes(r.budgetRequestId) || priorRequestIds.includes(r.requestId)) &&
               r.status === 'APPROVED' && !r.isDeleted && r.kategoriAset !== 'PENGEMBALIAN';
    });
    const totalUsed = priorReports.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

    // FIXED approvedReturns matching logic:
    const approvedReturns = budgetReports.filter(r => {
        if (r.status !== 'APPROVED' || r.isDeleted || r.kategoriAset !== 'PENGEMBALIAN') return false;
        
        const isLinkedToPriorReq = priorRequestIds.includes(r.budgetRequestId) || priorRequestIds.includes(r.requestId);
        if (isLinkedToPriorReq) return true;

        const isSameEntity = (fieldId && r.fieldId === fieldId) || (unitId && r.unitId === unitId);
        return isSameEntity && r.academicYearId === academicYearId;
    });

    const totalReturned = approvedReturns.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

    const unreturned = totalCair - totalUsed - totalReturned;

    console.log('\n=== FIXED SERVER CALCULATION ===');
    console.log(`Total Cair: ${totalCair}`);
    console.log(`Total Used: ${totalUsed}`);
    console.log(`Total Returned: ${totalReturned}`);
    console.log(`Unreturned: ${unreturned}`);
    console.log(`Is unreturned > 0? ${unreturned > 0}`);
}

main().catch(console.error);
