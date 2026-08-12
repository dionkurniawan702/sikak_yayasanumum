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

        // FIXED resolveReportRequest:
        function resolveReportRequestFixed(report) {
            if (!report || !budgetRequests || budgetRequests.length === 0) return null;

            // 1. If exact budgetRequestId or requestId is specified, ALWAYS prefer it!
            const rReqId = report.budgetRequestId || report.requestId;
            if (rReqId) {
                const found = budgetRequests.find(r => r.id === rReqId);
                if (found) return found;
            }

            // 2. Check exact matching componentId in approved budgetRequests
            if (report.componentId) {
                const found = budgetRequests.find(r => 
                    r.status === 'APPROVED' && 
                    (report.unitId ? (r.unitId === report.unitId || r.fieldId === report.unitId) : true) &&
                    r.items && 
                    r.items.some(i => i.componentId === report.componentId)
                );
                if (found) return found;
            }

            const reportItemName = (report.category || report.description || '').trim().toLowerCase();

            // 3. Search for approved budgetRequest by category / name matching month/date if possible
            if (report.date) {
                const reportMonth = report.date.substring(0, 7);
                const foundByDateAndName = budgetRequests.find(r => {
                    const isSameUnit = (r.unitId && (r.unitId === report.unitId || r.unitId === report.fieldId)) ||
                                       (r.fieldId && (r.fieldId === report.unitId || r.fieldId === report.fieldId));
                    return isSameUnit && r.status === 'APPROVED' && r.month === reportMonth &&
                           r.items && r.items.some(i => (i.name || '').trim().toLowerCase() === reportItemName);
                });
                if (foundByDateAndName) return foundByDateAndName;
            }

            // 4. Fallback: match by date month and unit
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

        // Test with FIXED resolveReportRequest for June 2026:
        const baseReportsFixed = budgetReports.filter(r => {
            if (r.academicYearId !== globalAcademicYearId || r.isDeleted || r.status === 'REJECTED') return false;
            const req = resolveReportRequestFixed(r);
            const isBos = (req?.items || []).some(item => item.planId?.endsWith('-BOS'));
            if (isBos) return false;
            if (r.unitId !== taudUnit.id) return false;
            return true;
        });

        const selectedMonth = '2026-06';
        const activeReportsFilteredFixed = baseReportsFixed.filter(r => {
            const req = resolveReportRequestFixed(r);
            if (req) return req.month === selectedMonth;
            return r.date ? r.date.startsWith(selectedMonth) : false;
        });

        let topCardTotalUsedFixed = 0;
        activeReportsFilteredFixed.forEach(r => {
            if (r.kategoriAset !== 'PENGEMBALIAN' && r.status === 'APPROVED') {
                topCardTotalUsedFixed += parseFloat(r.amount || 0);
            }
        });

        console.log('=== WITH FIXED resolveReportRequest ===');
        console.log('June activeReportsFiltered count:', activeReportsFilteredFixed.length);
        console.log('Top Card TOTAL REALISASI (statUsed):', topCardTotalUsedFixed);

        const juneReq = budgetRequests.find(r => r.unitId === taudUnit.id && r.month === '2026-06' && r.status === 'APPROVED');
        const targetReportsFixed = activeReportsFilteredFixed.filter(r => r.status === 'APPROVED');
        const matchingReportsFixed = targetReportsFixed.filter(r => {
            if (r.kategoriAset === 'PENGEMBALIAN') return false;
            if (r.budgetRequestId === juneReq.id || r.requestId === juneReq.id) return true;
            if (juneReq.month && r.date && r.date.startsWith(juneReq.month)) return true;
            return false;
        });
        const lowerCardReqUsedFixed = matchingReportsFixed.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

        console.log('Lower Card REALISASI (KELUAR):', lowerCardReqUsedFixed);
        console.log('Sisa Saldo (78.252.000 - ' + lowerCardReqUsedFixed + '):', 78252000 - lowerCardReqUsedFixed);
        console.log('ARE THEY EQUAL?', topCardTotalUsedFixed === lowerCardReqUsedFixed);

    } catch (err) {
        console.error(err);
    }
}

main();
