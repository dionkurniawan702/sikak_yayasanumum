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

    const augReq = budgetRequests.find(r => (r.unitId === unitId || r.fieldId === unitId) && (r.month === '2026-08' || r.month === 'Agustus 2026') && r.status === 'APPROVED');

    console.log(`=== AUGUST 2026 REQUEST (ID: ${augReq?.id}) ===`);
    console.log(`Total Pagu Cair: Rp ${parseFloat(augReq?.totalAmount || 0).toLocaleString('id-ID')}`);
    console.log(`Total Items in Request: ${augReq?.items?.length || 0}`);

    function resolveReportRequest(report) {
        if (!report || !budgetRequests || budgetRequests.length === 0) return null;

        if (report.componentId) {
            const found = budgetRequests.find(r => 
                r.status === 'APPROVED' && 
                (report.unitId ? (r.unitId === report.unitId || r.fieldId === report.unitId) : true) &&
                r.items && 
                r.items.some(i => i.componentId === report.componentId)
            );
            if (found) return found;
        }

        const rReqId = report.budgetRequestId || report.requestId;
        const reportItemName = (report.category || report.description || '').trim().toLowerCase();

        if (rReqId) {
            const found = budgetRequests.find(r => r.id === rReqId);
            if (found) {
                if (!reportItemName || !found.items || found.items.length === 0) {
                    return found;
                }
                const hasItem = found.items.some(i => (i.name || '').trim().toLowerCase() === reportItemName);
                if (hasItem) return found;
            }
        }

        if (reportItemName) {
            const foundByName = budgetRequests.find(r => 
                r.status === 'APPROVED' &&
                (report.unitId ? (r.unitId === report.unitId || r.fieldId === report.unitId) : true) &&
                r.items &&
                r.items.some(i => (i.name || '').trim().toLowerCase() === reportItemName)
            );
            if (foundByName) return foundByName;
        }

        if (rReqId) {
            const found = budgetRequests.find(r => r.id === rReqId);
            if (found) return found;
        }

        if (report.date) {
            const reportMonth = report.date.substring(0, 7);
            const foundByDate = budgetRequests.find(r => {
                const isSameUnit = (r.unitId && (r.unitId === report.unitId || r.unitId === report.fieldId)) ||
                                   (r.fieldId && (r.fieldId === report.unitId || r.fieldId === report.fieldId));
                return isSameUnit && r.status === 'APPROVED' && r.month === reportMonth;
            });
            if (foundByDate) return foundByDate;
        }

        return null;
    }

    const tkitReports = budgetReports.filter(r => (r.unitId === unitId || r.fieldId === unitId) && !r.isDeleted && r.status !== 'REJECTED');
    
    console.log('\n--- DETAILED BREAKDOWN OF ALL ITEMS IN AUGUST REQUEST ---');
    let fullyReportedCount = 0;
    let pendingCount = 0;

    (augReq?.items || []).forEach((item, idx) => {
        const itemPagu = parseFloat(item.amount || 0);

        const matchingReports = tkitReports.filter(r => {
            if (r.kategoriAset === 'PENGEMBALIAN') return false;
            const resolved = resolveReportRequest(r);
            if (resolved && resolved.id === augReq.id) {
                const reportName = (r.category || r.description || '').trim().toLowerCase();
                const itemName = (item.name || '').trim().toLowerCase();
                if (item.componentId && r.componentId === item.componentId) return true;
                if (reportName && itemName && reportName === itemName) return true;
            }
            return false;
        });

        const reportedAmt = matchingReports.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
        const sisa = Math.max(0, itemPagu - reportedAmt);

        const isFullyReported = sisa <= 0;
        if (isFullyReported) fullyReportedCount++;
        else pendingCount++;

        console.log(`${idx + 1}. "${item.name}" | Pagu: Rp ${itemPagu.toLocaleString('id-ID')} | Total Realisasi Nota: Rp ${reportedAmt.toLocaleString('id-ID')} (${matchingReports.length} nota) | Sisa: Rp ${sisa.toLocaleString('id-ID')} | Status di "Perlu Dilaporkan": ${isFullyReported ? '❌ TERSEMBUNYI (Sudah 100% Dilaporkan)' : '✅ MUNCUL (Belum Dilaporkan)'}`);
        if (matchingReports.length > 0) {
            matchingReports.forEach(r => {
                console.log(`     -> Nota [${r.id}] Rp ${parseFloat(r.amount).toLocaleString('id-ID')} | Tgl: ${r.date?.slice(0,10)} | Status: ${r.status} | Cat/Desc: "${r.category || r.description}"`);
            });
        }
    });

    console.log(`\n========================================`);
    console.log(`Total Items di Pengajuan Agustus : ${augReq?.items?.length || 0}`);
    console.log(`Items Sudah Full Dilaporkan (Sisa 0) : ${fullyReportedCount}`);
    console.log(`Items Belum Full Dilaporkan (Muncul) : ${pendingCount}`);
    console.log(`========================================`);
}

main();
