const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    console.log('Logging in to verify server state...');
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

    const { budgetRequests = [], budgetReports = [], units = [] } = state;
    const tkit2 = units.find(u => u.name && u.name.toLowerCase().includes('tkit 2'));
    const unitId = tkit2.id;

    console.log('\n=== VERIFYING SERVER STATE FOR TKIT 2 ===');
    const reqs = budgetRequests.filter(r => (r.unitId === unitId || r.fieldId === unitId) && r.status === 'APPROVED');

    reqs.forEach(req => {
        const reqReports = budgetReports.filter(r => 
            !r.isDeleted && 
            r.status === 'APPROVED' && 
            (r.budgetRequestId === req.id || r.requestId === req.id)
        );
        const expSum = reqReports.filter(r => r.kategoriAset !== 'PENGEMBALIAN').reduce((s, r) => s + parseFloat(r.amount || 0), 0);
        const refSum = reqReports.filter(r => r.kategoriAset === 'PENGEMBALIAN').reduce((s, r) => s + parseFloat(r.amount || 0), 0);
        const totalSettled = expSum + refSum;
        const reqTotal = parseFloat(req.totalAmount || 0);
        const isFullySettled = totalSettled >= reqTotal - 1 || req.isClosed;

        console.log(`REQ [${req.id}] Month: ${req.month} | Total Pagu: Rp ${reqTotal.toLocaleString('id-ID')} | Exp: Rp ${expSum.toLocaleString('id-ID')} | Ref: Rp ${refSum.toLocaleString('id-ID')} | Total Settled: Rp ${totalSettled.toLocaleString('id-ID')} | Fully Settled? ${isFullySettled ? 'YES ✅' : 'NO ❌'}`);
    });
}

main();
