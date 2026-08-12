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
        const globalAcademicYearId = 'AY-ID-MO8GWIG3-JDK';
        const taudUnit = units.find(u => u.name && u.name.toUpperCase().includes('TAUD'));

        // Rule from user:
        // Patokan perhitungan pelaporan bulan (misal Juni 2026) adalah Surat Permintaan Dana (Budget Request) bulan Juni!
        // Jika report di-resolve / dimiliki oleh budgetRequest bulan Juni, maka report tersebut MASUK KE PELAPORAN JUNI 2026,
        // tanpa peduli apakah tanggal nota-nya di bulan Juli.

        function resolveReportRequest(report) {
            if (!report || !budgetRequests || budgetRequests.length === 0) return null;

            // 1. Check exact matching componentId FIRST in approved budgetRequests
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

            // 2. Check exact budgetRequestId if it exists AND its items contain the report item name/category
            if (rReqId) {
                const found = budgetRequests.find(r => r.id === rReqId);
                if (found) {
                    if (!reportItemName || !found.items || found.items.length === 0) {
                        if (report.kategoriAset !== 'PENGEMBALIAN') return found;
                    } else {
                        const hasItem = found.items.some(i => (i.name || '').trim().toLowerCase() === reportItemName);
                        if (hasItem) return found;
                    }
                }
            }

            // 3. Search for approved budgetRequest by category / name
            if (reportItemName) {
                const found = budgetRequests.find(r => 
                    r.status === 'APPROVED' &&
                    (report.unitId ? (r.unitId === report.unitId || r.fieldId === report.unitId) : true) &&
                    r.items &&
                    r.items.some(i => (i.name || '').trim().toLowerCase() === reportItemName)
                );
                if (found) return found;
            }

            // 4. Special handling for PENGEMBALIAN (Refund) reports:
            if (report.kategoriAset === 'PENGEMBALIAN' && report.date) {
                if (rReqId) {
                    const found = budgetRequests.find(r => r.id === rReqId);
                    if (found) return found;
                }

                const reportMonth = report.date.substring(0, 7);
                const approvedReqs = budgetRequests.filter(r => {
                    const isSameUnit = (r.unitId && (r.unitId === report.unitId || r.unitId === report.fieldId)) ||
                                       (r.fieldId && (r.fieldId === report.unitId || r.fieldId === report.fieldId));
                    return isSameUnit && r.status === 'APPROVED' && (!globalAcademicYearId || r.academicYearId === globalAcademicYearId);
                }).sort((a, b) => (b.month || '').localeCompare(a.month || ''));

                const prevMonthReq = approvedReqs.find(r => r.month < reportMonth);
                if (prevMonthReq) return prevMonthReq;
            }

            // 5. Fallback: return budgetRequestId if matched
            if (rReqId) {
                const found = budgetRequests.find(r => r.id === rReqId);
                if (found) return found;
            }

            // 6. Fallback: match by date month and unit
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

        const juneReq = budgetRequests.find(r => r.unitId === taudUnit.id && r.month === '2026-06' && r.status === 'APPROVED');

        const baseReports = budgetReports.filter(r => {
            if (r.academicYearId !== globalAcademicYearId || r.isDeleted || r.status === 'REJECTED') return false;
            const req = resolveReportRequest(r);
            const isBos = (req?.items || []).some(item => item.planId?.endsWith('-BOS'));
            if (isBos) return false;
            if (r.unitId !== taudUnit.id) return false;
            return true;
        });

        const selectedMonth = '2026-06';
        const activeReportsFiltered = baseReports.filter(r => {
            const req = resolveReportRequest(r);
            if (req) return req.month === selectedMonth;
            return r.date ? r.date.startsWith(selectedMonth) : false;
        });

        // Top card totalUsed:
        const targetReports = activeReportsFiltered.filter(r => r.status === 'APPROVED');
        const topCardTotalUsed = targetReports.filter(r => r.kategoriAset !== 'PENGEMBALIAN').reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

        // Lower card reqUsed matching logic according to user's directive:
        // matchingReports for lower card must include ALL targetReports that resolve to this request OR match its items!
        const matchingReports = targetReports.filter(r => {
            if (r.kategoriAset === 'PENGEMBALIAN') return false;
            const resolvedReq = resolveReportRequest(r);
            if (resolvedReq && resolvedReq.id === juneReq.id) return true;
            if (r.budgetRequestId === juneReq.id || r.requestId === juneReq.id) return true;
            if (juneReq.month && r.date && r.date.startsWith(juneReq.month)) return true;
            return false;
        });
        const lowerCardReqUsed = matchingReports.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

        // Items detail sum:
        const itemsDetail = (juneReq.items || []).map(item => {
            const itemAmt = parseFloat(item.amount || 0);
            const itemReports = targetReports.filter(r => {
                if (r.kategoriAset === 'PENGEMBALIAN') return false;
                if (item.componentId && r.componentId === item.componentId) return true;
                const rName = (r.category || r.description || '').trim().toLowerCase();
                const iName = (item.name || '').trim().toLowerCase();
                return rName && iName && rName === iName;
            });
            const usedAmt = itemReports.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
            return { name: item.name, itemAmt, usedAmt };
        });
        const itemsDetailSum = itemsDetail.reduce((s, i) => s + i.usedAmt, 0);

        console.log('=== USER DIRECTIVE VERIFICATION (Juni 2026) ===');
        console.log('1. Top Card TOTAL REALISASI (statUsed):', topCardTotalUsed);
        console.log('2. Lower Card REALISASI (KELUAR) (matchingReports):', lowerCardReqUsed);
        console.log('3. Lower Card Items Detail Sum:', itemsDetailSum);
        console.log('ARE ALL THREE 100% EQUAL?', topCardTotalUsed === lowerCardReqUsed && lowerCardReqUsed === itemsDetailSum);

    } catch (err) {
        console.error(err);
    }
}

main();
