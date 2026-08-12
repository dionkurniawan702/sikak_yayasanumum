const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    try {
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
        const taudUnit = units.find(u => u.name && u.name.toUpperCase().includes('TAUD'));

        const juneReq = budgetRequests.find(r => r.unitId === taudUnit.id && r.month === '2026-06' && r.status === 'APPROVED');

        const activeReportsFiltered = budgetReports.filter(r => {
            if (r.isDeleted || r.status === 'REJECTED' || r.unitId !== taudUnit.id) return false;
            if (r.budgetRequestId === juneReq.id || r.requestId === juneReq.id) return true;
            if (r.date && r.date.startsWith('2026-06')) return true;
            return false;
        });

        const targetReports = activeReportsFiltered.filter(r => r.status === 'APPROVED');
        const matchingReports = targetReports.filter(r => r.kategoriAset !== 'PENGEMBALIAN');

        const reqApproved = parseFloat(juneReq.totalAmount || 0);
        const reqUsed = matchingReports.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
        const reqReturned = targetReports.filter(r => r.kategoriAset === 'PENGEMBALIAN').reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
        const reqSisa = Math.max(0, reqApproved - reqUsed - reqReturned);

        console.log('--- PROPOSED CARD CALCULATION ---');
        console.log('Dana Cair (ACC):', reqApproved);
        console.log('Realisasi (Keluar):', reqUsed);
        console.log('Pengembalian:', reqReturned);
        console.log('Sisa Saldo:', reqSisa);

    } catch (err) {
        console.error(err);
    }
}

main();
