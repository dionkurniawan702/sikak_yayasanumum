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
    const tkit1 = units.find(u => u.name && u.name.toLowerCase().includes('tkit 1'));
    const unitId = tkit1.id;

    const refundReport = budgetReports.find(r => r.id === 'RET-MSIF5MD4');

    function resolveReportRequest(report) {
        if (!report || !budgetRequests || budgetRequests.length === 0) return null;

        const rReqId = report.budgetRequestId || report.requestId;
        if (rReqId) {
            const found = budgetRequests.find(r => r.id === rReqId);
            if (found) return found;
        }

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
        if (reportItemName) {
            const foundByName = budgetRequests.find(r => 
                r.status === 'APPROVED' &&
                (report.unitId ? (r.unitId === report.unitId || r.fieldId === report.unitId) : true) &&
                r.items &&
                r.items.some(i => (i.name || '').trim().toLowerCase() === reportItemName)
            );
            if (foundByName) return foundByName;
        }

        if (report.kategoriAset === 'PENGEMBALIAN' && report.date) {
            const reportMonth = report.date.substring(0, 7);
            const approvedReqs = budgetRequests.filter(r => {
                const isSameUnit = (r.unitId && (r.unitId === report.unitId || r.unitId === report.fieldId)) ||
                                   (r.fieldId && (r.fieldId === report.unitId || r.fieldId === report.fieldId));
                return isSameUnit && r.status === 'APPROVED';
            }).sort((a, b) => (b.month || '').localeCompare(a.month || ''));

            const prevMonthReq = approvedReqs.find(r => r.month < reportMonth);
            if (prevMonthReq) return prevMonthReq;
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

    const resolved = resolveReportRequest(refundReport);
    console.log(`\n=== RESOLVED REQUEST FOR REFUND REPORT RET-MSIF5MD4 ===`);
    console.log(`Report ID: ${refundReport.id}`);
    console.log(`Report Date: ${refundReport.date?.slice(0, 10)}`);
    console.log(`Amount: Rp ${parseFloat(refundReport.amount).toLocaleString('id-ID')}`);
    console.log(`Description: "${refundReport.description}"`);
    console.log(`Resolved Month: ${resolved?.month}`);
    console.log(`Resolved Request ID: ${resolved?.id}`);
    console.log(`Resolved Request Desc: "${resolved?.description}"`);
}

main();
