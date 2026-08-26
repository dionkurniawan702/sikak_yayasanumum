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

    const juneReq = (state.budgetRequests || []).find(r => r.id === 'REQ-MPLVQKEG-U8C');
    const juneReports = (state.budgetReports || []).filter(r => (r.budgetRequestId === juneReq.id || r.requestId === juneReq.id) && !r.isDeleted && r.status !== 'REJECTED');
    
    let expenseSum = 0;
    let refundSum = 0;

    juneReports.forEach(r => {
        const amt = parseFloat(r.amount || 0);
        if (r.kategoriAset === 'PENGEMBALIAN') {
            refundSum += amt;
            console.log(`Refund report ID: ${r.id} | Amount: ${amt}`);
        } else {
            expenseSum += amt;
        }
    });

    const sisa = juneReq.totalAmount - expenseSum - refundSum;
    console.log('=== VERIFICATION OF MIT JUNE 2026 STATS ===');
    console.log(`Total Cair (Pagu): Rp ${juneReq.totalAmount.toLocaleString('id-ID')}`);
    console.log(`Total Realisasi Belanja: Rp ${expenseSum.toLocaleString('id-ID')}`);
    console.log(`Total Pengembalian: Rp ${refundSum.toLocaleString('id-ID')}`);
    console.log(`Total Sisa: Rp ${sisa.toLocaleString('id-ID')}`);
}

main().catch(console.error);
