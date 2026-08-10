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
    const globalAcademicYearId = state.globalAcademicYearId || state.activeAcademicYearId || 'AY-ID-MO8GWIG3-JDK';

    const tkitReports = budgetReports.filter(r => (r.unitId === unitId || r.fieldId === unitId) && !r.isDeleted && r.status === 'APPROVED');
    const juneReq = budgetRequests.find(r => r.id === 'REQ-MQERNJL9-GNQ');

    console.log(`=== TKIT 2 JUNE REQUEST (ID: ${juneReq?.id}) ===`);
    console.log(`Total Cair: Rp ${parseFloat(juneReq?.totalAmount || 0).toLocaleString('id-ID')}`);

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
                return isSameUnit && r.status === 'APPROVED' && (!globalAcademicYearId || r.academicYearId === globalAcademicYearId);
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

    console.log('\n=== ALL TKIT 2 APPROVED REPORTS AND THEIR RESOLVED MONTH ===');
    const resolvedByMonth = {};
    tkitReports.forEach((r, idx) => {
        const resolved = resolveReportRequest(r);
        const monthKey = resolved ? resolved.month : (r.date ? r.date.substring(0, 7) : 'UNKNOWN');
        if (!resolvedByMonth[monthKey]) resolvedByMonth[monthKey] = { exp: 0, ref: 0, count: 0, items: [] };

        const amt = parseFloat(r.amount || 0);
        if (r.kategoriAset === 'PENGEMBALIAN') {
            resolvedByMonth[monthKey].ref += amt;
        } else {
            resolvedByMonth[monthKey].exp += amt;
        }
        resolvedByMonth[monthKey].count++;
        resolvedByMonth[monthKey].items.push({
            id: r.id,
            category: r.category,
            desc: r.description,
            amt,
            date: r.date?.slice(0, 10),
            budgetRequestId: r.budgetRequestId,
            resolvedReqId: resolved?.id
        });
    });

    for (const [m, data] of Object.entries(resolvedByMonth)) {
        console.log(`\n--- MONTH ${m} --- (${data.count} reports)`);
        console.log(`Total Realisasi Belanja: Rp ${data.exp.toLocaleString('id-ID')}`);
        console.log(`Total Pengembalian Dana: Rp ${data.ref.toLocaleString('id-ID')}`);
        console.log(`Total Settled (Exp + Ref): Rp ${(data.exp + data.ref).toLocaleString('id-ID')}`);
    }

    // Inspect reports for Laptop, Kipas, Seragam Akhwat, Seragam Ikhwan
    console.log('\n=== SPECIFIC INSPECTION FOR LAPTOP, KIPAS, SERAGAM ===');
    const targetNames = ['laptop untuk tu', 'kipas angin', 'seragam akhwat @ 4 stel', 'seragam ikhwan @ 4 stel', 'microfon'];
    tkitReports.filter(r => {
        const name = (r.category || r.description || '').toLowerCase();
        return targetNames.some(t => name.includes(t));
    }).forEach(r => {
        const res = resolveReportRequest(r);
        console.log(`[${r.id}] Cat: "${r.category}" | Desc: "${r.description}" | Amt: Rp ${parseFloat(r.amount).toLocaleString('id-ID')} | Date: ${r.date?.slice(0,10)} | r.budgetRequestId: ${r.budgetRequestId} | Resolved Month: ${res?.month} (ReqID: ${res?.id})`);
    });
}

main();
