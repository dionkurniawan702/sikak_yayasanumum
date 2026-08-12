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

        const baseRequests = budgetRequests.filter(r => {
            if (r.academicYearId !== globalAcademicYearId) return false;
            const isBos = (r.items || []).some(item => item.planId?.endsWith('-BOS'));
            if (isBos) return false;
            if (r.unitId !== taudUnit.id) return false;
            return true;
        });

        const baseReports = budgetReports.filter(r => {
            if (r.academicYearId !== globalAcademicYearId || r.isDeleted || r.status === 'REJECTED') return false;
            const req = resolveReportRequest(r);
            const isBos = (req?.items || []).some(item => item.planId?.endsWith('-BOS'));
            if (isBos) return false;
            if (r.unitId !== taudUnit.id) return false;
            return true;
        });

        const activeRequestsFiltered = baseRequests;
        const activeReportsFiltered = baseReports;

        const totalUsed = activeReportsFiltered.filter(r => r.kategoriAset !== 'PENGEMBALIAN' && r.status === 'APPROVED').reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

        const approvedReqs = activeRequestsFiltered.filter(r => r.status === 'APPROVED');
        const targetReports = activeReportsFiltered.filter(r => r.status === 'APPROVED');

        let sumCardsReqUsed = 0;

        approvedReqs.forEach((req, idx) => {
            // SINGLE ASSIGNMENT: match report ONLY to its resolved request!
            const matchingReports = targetReports.filter(r => {
                if (r.kategoriAset === 'PENGEMBALIAN') return false;
                const resolved = resolveReportRequest(r);
                if (resolved) return resolved.id === req.id;
                // fallback if not resolved to any request:
                return r.date ? r.date.startsWith(req.month) : false;
            });

            const reqUsed = matchingReports.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
            sumCardsReqUsed += reqUsed;

            console.log(`[Card ${idx + 1}] Req ID: ${req.id} | Month: ${req.month} | Used: ${reqUsed}`);
        });

        console.log('\n=== SINGLE ASSIGNMENT COMPARISON ===');
        console.log('Top Card Total Realisasi:', totalUsed);
        console.log('Sum of Lower Cards Realisasi:', sumCardsReqUsed);
        console.log('Are they 100% EQUAL?', totalUsed === sumCardsReqUsed);

    } catch (err) {
        console.error(err);
    }
}

main();
