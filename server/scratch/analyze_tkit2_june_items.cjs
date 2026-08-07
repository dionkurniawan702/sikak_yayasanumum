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
    const tkit2 = units.find(u => u.name && u.name.toLowerCase().includes('tkit 2'));
    const unitId = tkit2.id;

    const juneReq = budgetRequests.find(r => r.id === 'REQ-MQERNJL9-GNQ');
    const juneReports = budgetReports.filter(r => (r.budgetRequestId === juneReq.id || r.requestId === juneReq.id) && !r.isDeleted && r.status !== 'REJECTED');

    console.log('=== ITEMS IN TKIT 2 JUNE REQ (REQ-MQERNJL9-GNQ) ===');
    console.log(`Total Pagu Cair: ${juneReq.totalAmount}`);

    let totalPaguItems = 0;
    let totalReportedItems = 0;

    (juneReq.items || []).forEach((item, idx) => {
        const itemPagu = parseFloat(item.amount || 0);
        totalPaguItems += itemPagu;

        const matchingReports = juneReports.filter(r => r.kategoriAset !== 'PENGEMBALIAN' && (r.componentId ? r.componentId === item.componentId : (r.category === item.name || r.category?.toLowerCase() === item.name?.toLowerCase())));
        const itemReported = matchingReports.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
        totalReportedItems += itemReported;

        const diff = itemPagu - itemReported;
        console.log(`${idx+1}. "${item.name}" | Pagu: ${itemPagu} | Realisasi Belanja: ${itemReported} | Sisa Belanja: ${diff}`);
    });

    console.log(`\nTotal Pagu Items: ${totalPaguItems}`);
    console.log(`Total Realisasi Belanja: ${totalReportedItems}`);
    console.log(`Total Sisa Belanja Belum Dilaporkan (sebelum Refund): ${totalPaguItems - totalReportedItems}`);

    const totalRefund = juneReports.filter(r => r.kategoriAset === 'PENGEMBALIAN').reduce((s, r) => s + parseFloat(r.amount || 0), 0);
    console.log(`Total Pengembalian: ${totalRefund}`);
    console.log(`Sisa Akhir Riil Tampil di UI: ${(totalPaguItems - totalReportedItems) - totalRefund}`);
}

main();
