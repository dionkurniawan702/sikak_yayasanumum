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

        console.log('--- RAB ITEMS IN JUNE REQ ---');
        const rabItemsMap = new Map();
        juneReq.items?.forEach((i, idx) => {
            rabItemsMap.set(i.componentId, i);
            console.log(`[Item ${idx}] name: "${i.name}" | compId: ${i.componentId} | amount: ${i.amount}`);
        });

        const juneReports = budgetReports.filter(r => {
            if (r.isDeleted || r.status === 'REJECTED' || r.unitId !== taudUnit.id) return false;
            if (r.kategoriAset === 'PENGEMBALIAN') return false;
            if (r.budgetRequestId === juneReq.id || r.requestId === juneReq.id) return true;
            if (r.date && r.date.startsWith('2026-06')) return true;
            return false;
        });

        console.log(`\n--- ALL JUNE REPORTS FOR TAUD (${juneReports.length} reports) ---`);
        let grandTotal = 0;
        let matchedTotal = 0;
        let unmappedTotal = 0;

        juneReports.forEach(r => {
            const amt = parseFloat(r.amount || 0);
            grandTotal += amt;

            // Check if matches any item
            const matchedItem = juneReq.items?.find(item => {
                if (item.componentId && r.componentId === item.componentId) return true;
                const rName = (r.category || r.description || '').trim().toLowerCase();
                const iName = (item.name || '').trim().toLowerCase();
                return rName && iName && rName === iName;
            });

            if (matchedItem) {
                matchedTotal += amt;
            } else {
                unmappedTotal += amt;
                console.log(`❌ UNMAPPED REPORT: ID=${r.id} | date=${r.date?.substring(0,10)} | amt=${r.amount} | cat="${r.category}" | desc="${r.description}" | compId=${r.componentId}`);
            }
        });

        console.log('\n--- SUMMARY ---');
        console.log(`Grand Total (Top Card): Rp ${grandTotal.toLocaleString('id-ID')}`);
        console.log(`Matched Total (Lower Card Items Sum): Rp ${matchedTotal.toLocaleString('id-ID')}`);
        console.log(`Unmapped Total (Difference): Rp ${unmappedTotal.toLocaleString('id-ID')}`);

    } catch (err) {
        console.error(err);
    }
}

main();
