const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    console.log('Logging in to remote server...');
    const loginRes = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'adminpdk', password: 'admin123' })
    });
    const loginJson = await loginRes.json();
    const token = loginJson.data?.token;

    if (!token) {
        console.error('Login failed');
        return;
    }

    const dataRes = await fetch(`${API_URL}/all-data`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const dataJson = await dataRes.json();
    const state = dataJson.data;

    const { budgetReports = [], budgetRequests = [], units = [] } = state;
    const mitUnit = units.find(u => u.name && u.name.toLowerCase().includes('mit'));

    // 1. Revert RET-MRCU432Q to original amount 24369167
    const retReport = budgetReports.find(r => r.id === 'RET-MRCU432Q');
    if (retReport) {
        console.log('Reverting RET-MRCU432Q amount to original 24369167...');
        const updatedRet = { ...retReport, amount: '24369167' };
        
        const putRes = await fetch(`${API_URL}/budget-reports/RET-MRCU432Q`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updatedRet)
        });
        console.log('PUT RET-MRCU432Q status:', putRes.status);

        const newReports = budgetReports.map(r => r.id === 'RET-MRCU432Q' ? updatedRet : r);
        await fetch(`${API_URL}/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ budgetReports: newReports })
        });
    }

    // 2. Fetch fresh state and verify MIT June stats
    const freshRes = await fetch(`${API_URL}/all-data`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const freshState = (await freshRes.json()).data;

    const juneReq = (freshState.budgetRequests || []).find(r => r.unitId === mitUnit.id && (r.month === '2026-06' || r.month === 'Juni 2026'));
    const juneReports = (freshState.budgetReports || []).filter(r => (r.budgetRequestId === juneReq.id || r.requestId === juneReq.id) && !r.isDeleted && r.status !== 'REJECTED');

    let totalExpense = 0;
    let totalRefund = 0;

    juneReports.forEach(r => {
        const amt = parseFloat(r.amount || 0);
        if (r.kategoriAset === 'PENGEMBALIAN') totalRefund += amt;
        else totalExpense += amt;
    });

    const sisa = juneReq.totalAmount - totalExpense - totalRefund;

    console.log('\n=== REVERTED MIT JUNE 2026 STATS ===');
    console.log(`Total Cair (Pagu): ${juneReq.totalAmount}`);
    console.log(`Total Realisasi Belanja: ${totalExpense}`);
    console.log(`Total Pengembalian: ${totalRefund}`);
    console.log(`Total Sisa (Selisih Belum Selesai): ${sisa}`);
}

main().catch(console.error);
