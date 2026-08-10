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
    const sdit2 = units.find(u => u.name && u.name.toLowerCase().includes('sdit 2'));
    const unitId = sdit2.id;

    console.log(`=== SDIT 2 DATA (Unit ID: ${unitId}) ===`);

    const sdit2Reqs = budgetRequests.filter(r => (r.unitId === unitId || r.fieldId === unitId) && r.status === 'APPROVED');
    const targetReq = sdit2Reqs.find(r => r.id.startsWith('REQ-MSCV'));

    console.log(`\nTarget Request: [${targetReq?.id}] Month: ${targetReq?.month} | Total: Rp ${parseFloat(targetReq?.totalAmount || 0).toLocaleString('id-ID')}`);
    
    let waterItem = null;
    (targetReq?.items || []).forEach(item => {
        if ((item.name || '').toLowerCase().includes('isi ulang air minum') || (item.name || '').toLowerCase().includes('air minum')) {
            waterItem = item;
            console.log(`Found Item: "${item.name}" | Amount: Rp ${parseFloat(item.amount).toLocaleString('id-ID')} | componentId: ${item.componentId}`);
        }
    });

    const sdit2Reports = budgetReports.filter(r => (r.unitId === unitId || r.fieldId === unitId) && !r.isDeleted);
    console.log(`\nTotal Reports for SDIT 2: ${sdit2Reports.length}`);

    // Check reports matching "Isi Ulang Air Minum" or linked to targetReq
    console.log('\n--- REPORTS MATCHING WATER ITEM ---');
    const waterReports = sdit2Reports.filter(r => {
        const cat = (r.category || r.description || '').toLowerCase();
        return cat.includes('isi ulang air minum') || cat.includes('air minum');
    });

    waterReports.forEach((r, idx) => {
        console.log(`${idx+1}. [${r.id}] Tgl: ${r.date?.slice(0,10)} | No Nota: "${r.nomorNota || '-'}" | Cat: "${r.category}" | Desc: "${r.description}" | Amt: Rp ${parseFloat(r.amount).toLocaleString('id-ID')} | Status: ${r.status} | r.budgetRequestId: ${r.budgetRequestId} | r.componentId: ${r.componentId}`);
    });

    // Also check getReportsCountForItem logic vs pendingItems reportedComp calculation logic in MonthlyReport.jsx!
    console.log('\n--- SIMULATING REPORTED AMOUNT CALCULATIONS ---');
    if (waterItem && targetReq) {
        const reqCompKey = waterItem.componentId ? `${targetReq.id}_${waterItem.componentId}` : null;
        console.log(`reqCompKey: ${reqCompKey}`);

        // Method A: matchingReports in pendingItems loop in MonthlyReport.jsx
        const matchingReports = (budgetReports || []).filter(r => {
            if (r.status !== 'APPROVED' || r.isDeleted) return false;
            const isSameUnit = (r.unitId && (r.unitId === targetReq.unitId || r.unitId === targetReq.fieldId)) || 
                               (r.fieldId && (r.fieldId === targetReq.unitId || r.fieldId === targetReq.fieldId));
            if (!isSameUnit) return false;

            if (waterItem.componentId && r.componentId === waterItem.componentId) return true;

            const reportName = (r.category || r.description || '').trim().toLowerCase();
            const itemName = (waterItem.name || '').trim().toLowerCase();
            if (reportName && itemName && reportName === itemName) return true;
            return false;
        });

        const sumA = matchingReports.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
        console.log(`Method A (matchingReports for pendingItems): ${matchingReports.length} reports | Sum: Rp ${sumA.toLocaleString('id-ID')}`);
        matchingReports.forEach(r => console.log(`   -> [${r.id}] Status: ${r.status} | Amt: ${r.amount} | Cat: "${r.category}"`));

        // Method B: getReportsCountForItem
        const countForItem = (budgetReports || []).filter(r => {
            if (r.isDeleted || r.status === 'REJECTED') return false;
            let effectiveComponentId = r.componentId;
            const rReqId = r.budgetRequestId || r.requestId;
            if (rReqId && targetReq.id) {
                return rReqId === targetReq.id && (effectiveComponentId ? effectiveComponentId === waterItem.componentId : true);
            }
            return effectiveComponentId === waterItem.componentId || (!effectiveComponentId && r.budgetRequestId === targetReq.id);
        }).length;

        console.log(`Method B (getReportsCountForItem): ${countForItem} reports`);
    }
}

main();
