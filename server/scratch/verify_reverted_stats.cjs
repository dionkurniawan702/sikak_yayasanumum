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

    const { budgetRequests = [], budgetReports = [], units = [] } = state;
    const mitUnit = units.find(u => u.name && u.name.toLowerCase().includes('mit'));

    const juneReq = budgetRequests.find(r => r.unitId === mitUnit.id && (r.month === '2026-06' || r.month === 'Juni 2026'));
    const juneReports = budgetReports.filter(r => (r.budgetRequestId === juneReq.id || r.requestId === juneReq.id) && !r.isDeleted && r.status !== 'REJECTED');

    let totalExpense = 0;
    let totalRefund = 0;

    juneReports.forEach(r => {
        const amt = parseFloat(r.amount || 0);
        if (r.kategoriAset === 'PENGEMBALIAN') totalRefund += amt;
        else totalExpense += amt;
    });

    const sisa = juneReq.totalAmount - totalExpense - totalRefund;

    console.log('=== REVERTED STATS FOR JUNI 2026 MIT ===');
    console.log(`Total Cair (Pagu): Rp ${juneReq.totalAmount.toLocaleString('id-ID')}`);
    console.log(`Total Realisasi Belanja: Rp ${totalExpense.toLocaleString('id-ID')}`);
    console.log(`Total Pengembalian: Rp ${totalRefund.toLocaleString('id-ID')}`);
    console.log(`Total Sisa (Selisih Belum Diselesaikan): Rp ${sisa.toLocaleString('id-ID')}`);
}

main().catch(console.error);
