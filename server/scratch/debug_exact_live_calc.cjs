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

        const juneReq = budgetRequests.find(r => r.unitId === taudUnit.id && r.month === '2026-06' && r.status === 'APPROVED');
        console.log('June REQ ID:', juneReq.id);

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
                        if (report.kategoriAset !== 'PENGEMBALIAN') return found;
                    } else {
                        const hasItem = found.items.some(i => (i.name || '').trim().toLowerCase() === reportItemName);
                        if (hasItem) return found;
                    }
                }
            }

            if (reportItemName) {
                const found = budgetRequests.find(r => 
                    r.status === 'APPROVED' &&
                    (report.unitId ? (r.unitId === report.unitId || r.fieldId === report.unitId) : true) &&
                    r.items &&
                    r.items.some(i => (i.name || '').trim().toLowerCase() === reportItemName)
                );
                if (found) return found;
            }

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

        const targetReports = activeReportsFiltered.filter(r => r.status === 'APPROVED');
        const req = juneReq;
        const reqItems = req.items || [];

        console.log('--- REPORTS IN activeReportsFiltered ---');
        console.log('Total count:', activeReportsFiltered.length);

        // Find which reports are in targetReports that get matched by itemsDetail:
        const matchedReportIds = new Set();
        let itemsDetailSum = 0;

        reqItems.forEach(item => {
            const itemReports = targetReports.filter(r => {
                if (r.kategoriAset === 'PENGEMBALIAN') return false;
                if (item.componentId && r.componentId === item.componentId) return true;
                const rName = (r.category || r.description || '').trim().toLowerCase();
                const iName = (item.name || '').trim().toLowerCase();
                return rName && iName && rName === iName;
            });
            itemReports.forEach(r => matchedReportIds.add(r.id));
            const usedAmt = itemReports.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
            itemsDetailSum += usedAmt;
        });

        console.log('\n--- MATCHED BY itemsDetail (sum = ' + itemsDetailSum + ') ---');
        console.log('Matched reports count:', matchedReportIds.size);

        const matchingReports = targetReports.filter(r => {
            if (r.kategoriAset === 'PENGEMBALIAN') return false;
            if (r.budgetRequestId === req.id || r.requestId === req.id) return true;
            if (req.month && r.date && r.date.startsWith(req.month)) return true;
            return false;
        });
        const matchingReportsSum = matchingReports.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
        console.log('\n--- MATCHED BY matchingReports (sum = ' + matchingReportsSum + ') ---');
        console.log('matchingReports count:', matchingReports.length);

        console.log('\n--- REPORTS IN itemsDetail BUT NOT IN matchingReports ---');
        targetReports.filter(r => matchedReportIds.has(r.id) && !matchingReports.includes(r)).forEach(r => {
            console.log(`Report [${r.id}] date: ${r.date} | amt: ${r.amount} | bReqId: ${r.budgetRequestId} | cat: "${r.category}" | desc: "${r.description}"`);
        });

    } catch (err) {
        console.error(err);
    }
}

main();
