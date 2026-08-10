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

    const globalAcademicYearId = state.globalAcademicYearId || state.activeAcademicYearId || 'AY-ID-MO8GWIG3-JDK';
    const { budgetRequests = [], budgetReports = [], units = [] } = state;

    const tkit2 = units.find(u => u.name && u.name.toLowerCase().includes('tkit 2'));
    const unitId = tkit2.id;

    // Improved resolveReportRequest:
    function resolveReportRequestImproved(report) {
        if (!report || !budgetRequests || budgetRequests.length === 0) return null;

        // 1. Check matching componentId FIRST across approved budgetRequests
        if (report.componentId) {
            const found = budgetRequests.find(r => 
                r.status === 'APPROVED' && 
                (report.unitId ? (r.unitId === report.unitId || r.fieldId === report.unitId) : true) &&
                r.items && 
                r.items.some(i => i.componentId === report.componentId)
            );
            if (found) return found;
        }

        // 2. Check exact budgetRequestId if it exists AND its items contain the report item name/category
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

        // 3. Search for approved budgetRequest that actually contains this item by name
        if (reportItemName) {
            const foundByName = budgetRequests.find(r => 
                r.status === 'APPROVED' &&
                (report.unitId ? (r.unitId === report.unitId || r.fieldId === report.unitId) : true) &&
                r.items &&
                r.items.some(i => (i.name || '').trim().toLowerCase() === reportItemName)
            );
            if (foundByName) return foundByName;
        }

        // 4. Fallback: check budgetRequestId if found
        if (rReqId) {
            const found = budgetRequests.find(r => r.id === rReqId);
            if (found) return found;
        }

        // 5. Fallback: match by date month and unit
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

    const baseReports = budgetReports.filter(rel => {
        if (rel.academicYearId && rel.academicYearId !== globalAcademicYearId) return false;
        if (rel.source === 'BOS' || rel.planId?.endsWith('-BOS')) return false;
        return rel.unitId === unitId || rel.fieldId === unitId;
    });

    ['2026-06', '2026-07', '2026-08'].forEach(m => {
        const approvedReqs = budgetRequests.filter(r => 
            (r.unitId === unitId || r.fieldId === unitId) && 
            (r.academicYearId ? r.academicYearId === globalAcademicYearId : true) && 
            r.source !== 'BOS' && 
            r.status === 'APPROVED' && 
            r.month === m
        );
        const totalCair = approvedReqs.reduce((s, r) => s + parseFloat(r.totalAmount || 0), 0);

        const mReports = baseReports.filter(r => {
            if (r.kategoriAset === 'PENGEMBALIAN' || r.status === 'REJECTED' || r.isDeleted) return false;
            const req = resolveReportRequestImproved(r);
            if (req) return req.month === m;
            return r.date ? r.date.startsWith(m) : false;
        });

        const mRefunds = baseReports.filter(r => {
            if (r.kategoriAset !== 'PENGEMBALIAN' || r.status === 'REJECTED' || r.isDeleted) return false;
            const req = resolveReportRequestImproved(r);
            if (req) return req.month === m;
            return r.date ? r.date.startsWith(m) : false;
        });

        const totalExp = mReports.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
        const totalRef = mRefunds.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
        const totalSisa = Math.max(0, totalCair - totalExp - totalRef);

        console.log(`\n=== STATISTIK BULAN ${m} (TKIT 2) ===`);
        console.log(`Total Cair       : Rp ${totalCair.toLocaleString('id-ID')}`);
        console.log(`Total Pengeluaran: Rp ${totalExp.toLocaleString('id-ID')} (${mReports.length} laporan)`);
        console.log(`Total Pengembalian: Rp ${totalRef.toLocaleString('id-ID')}`);
        console.log(`Total Sisa       : Rp ${totalSisa.toLocaleString('id-ID')}`);
    });
}

main();
