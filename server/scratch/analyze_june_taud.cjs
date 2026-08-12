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

        const juneReqs = budgetRequests.filter(r => r.unitId === taudUnit.id && r.month === '2026-06' && r.status === 'APPROVED');
        console.log('--- JUNE APPROVED REQS ---');
        juneReqs.forEach(r => {
            console.log(`Req ID: ${r.id}, month: ${r.month}, totalAmount: ${r.totalAmount}`);
            console.log('Items count:', r.items?.length);
            r.items?.forEach((i, idx) => {
                console.log(`  [${idx}] name: "${i.name}", componentId: ${i.componentId}, amount: ${i.amount}`);
            });
        });

        // Filter active reports for June
        const juneReports = budgetReports.filter(r => {
            if (r.isDeleted || r.status === 'REJECTED' || r.unitId !== taudUnit.id) return false;
            // logic in activeReportsFiltered:
            // if resolveReportRequest matches
            // or r.date startsWith '2026-06'
            if (r.budgetRequestId === juneReqs[0]?.id || r.requestId === juneReqs[0]?.id) return true;
            if (r.date && r.date.startsWith('2026-06')) return true;
            return false;
        });

        console.log('\n--- JUNE REPORTS COUNT & TOTAL ---');
        let totalStatUsed = 0;
        const nonRefundReports = juneReports.filter(r => r.kategoriAset !== 'PENGEMBALIAN' && r.status === 'APPROVED');
        nonRefundReports.forEach(r => {
            totalStatUsed += parseFloat(r.amount || 0);
        });
        console.log('Total Stat Used (Sum of ALL approved non-refund reports):', totalStatUsed);

        // Now calculate card.reqUsed using itemsDetail
        const req = juneReqs[0];
        const reqItems = req ? (req.items || []) : [];
        const matchingReports = nonRefundReports; // already filtered

        let sumItemsUsed = 0;
        let unmappedReports = [...matchingReports];

        reqItems.forEach(item => {
            const itemReports = matchingReports.filter(r => {
                if (item.componentId && r.componentId === item.componentId) return true;
                const rName = (r.category || r.description || '').trim().toLowerCase();
                const iName = (item.name || '').trim().toLowerCase();
                return rName && iName && rName === iName;
            });
            const usedAmt = itemReports.reduce((sum, r) => sum + (parseFloat(r.amount || 0)), 0);
            sumItemsUsed += usedAmt;
            console.log(`Item "${item.name}" (componentId: ${item.componentId}): itemAmt=${item.amount}, matchedReportsCount=${itemReports.length}, usedAmt=${usedAmt}`);

            // Remove matched reports from unmapped
            itemReports.forEach(matched => {
                const idx = unmappedReports.findIndex(u => u.id === matched.id);
                if (idx !== -1) unmappedReports.splice(idx, 1);
            });
        });

        console.log('\n--- CARD SUMMARY vs STAT SUMMARY ---');
        console.log('Top Card Stat Used:', totalStatUsed);
        console.log('Lower Card reqUsed (Sum of Items):', sumItemsUsed);
        console.log('Difference (Unmapped):', totalStatUsed - sumItemsUsed);

        console.log('\n--- UNMAPPED REPORTS (Not counted in Lower Card reqUsed) ---');
        unmappedReports.forEach(r => {
            console.log(`Report [${r.id}] date: ${r.date} | amt: ${r.amount} | category: "${r.category}" | desc: "${r.description}" | compId: ${r.componentId}`);
        });

    } catch (err) {
        console.error(err);
    }
}

main();
