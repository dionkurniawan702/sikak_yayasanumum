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
    const mitUnit = units.find(u => u.name && u.name.toLowerCase().includes('mit'));
    const myUnitId = mitUnit.id;

    console.log('--- REQ MOUNT & DATES ---');
    budgetRequests.filter(r => r.unitId === myUnitId).forEach(r => {
        console.log(`REQ [${r.id}] Month: "${r.month}", TotalAmount: ${r.totalAmount}`);
    });

    // Let's test resolveReportRequest as implemented in MonthlyReport.jsx:
    function resolveReportRequest(report) {
        if (!report) return null;
        const reqId = report.budgetRequestId || report.requestId;
        if (reqId) {
            const found = budgetRequests.find(r => r.id === reqId);
            if (found) return found;
        }
        if (report.date) {
            const reportMonth = report.date.slice(0, 7);
            const match = budgetRequests.find(r => {
                const isSameUnit = (r.unitId && r.unitId === report.unitId) || (r.fieldId && r.fieldId === report.fieldId);
                return isSameUnit && r.month === reportMonth;
            });
            if (match) return match;
        }
        return null;
    }

    const juneReq = budgetRequests.find(r => r.unitId === myUnitId && (r.month === '2026-06' || r.month === 'Juni 2026'));

    const baseReports = budgetReports.filter(r => r.unitId === myUnitId && !r.isDeleted);

    // Let's check reports where resolveReportRequest returns juneReq:
    const matchedJuneReqReports = baseReports.filter(r => {
        const req = resolveReportRequest(r);
        return req && req.id === juneReq.id;
    });

    console.log(`Total reports resolved to June REQ: ${matchedJuneReqReports.length}`);
    const sumJuneReqExp = matchedJuneReqReports.filter(r => r.kategoriAset !== 'PENGEMBALIAN').reduce((s,r) => s + parseFloat(r.amount||0), 0);
    const sumJuneReqRef = matchedJuneReqReports.filter(r => r.kategoriAset === 'PENGEMBALIAN').reduce((s,r) => s + parseFloat(r.amount||0), 0);

    console.log(`Resolved June REQ Expense: ${sumJuneReqExp}`);
    console.log(`Resolved June REQ Refund: ${sumJuneReqRef}`);

    // Now let's check reports where date starts with '2026-06':
    const juneDateReports = baseReports.filter(r => r.date && r.date.startsWith('2026-06'));
    console.log(`Total reports with date starting 2026-06: ${juneDateReports.length}`);
    const sumJuneDateExp = juneDateReports.filter(r => r.kategoriAset !== 'PENGEMBALIAN').reduce((s,r) => s + parseFloat(r.amount||0), 0);
    const sumJuneDateRef = juneDateReports.filter(r => r.kategoriAset === 'PENGEMBALIAN').reduce((s,r) => s + parseFloat(r.amount||0), 0);

    console.log(`Date 2026-06 Expense: ${sumJuneDateExp}`);
    console.log(`Date 2026-06 Refund: ${sumJuneDateRef}`);

    // Now let's check July REQ reports:
    const julyReq = budgetRequests.find(r => r.unitId === myUnitId && (r.month === '2026-07' || r.month === 'Juli 2026'));
    const matchedJulyReqReports = baseReports.filter(r => {
        const req = resolveReportRequest(r);
        return req && req.id === julyReq.id;
    });
    console.log(`\nTotal reports resolved to July REQ: ${matchedJulyReqReports.length}`);
    const sumJulyReqExp = matchedJulyReqReports.filter(r => r.kategoriAset !== 'PENGEMBALIAN').reduce((s,r) => s + parseFloat(r.amount||0), 0);
    console.log(`July REQ Expense: ${sumJulyReqExp}`);

    // Let's print all July REQ reports and their dates and amounts:
    console.log('\n--- JULY REQ REPORTS BREAKDOWN ---');
    matchedJulyReqReports.forEach(r => {
        console.log(`[${r.id}] Amt: ${r.amount} | Date: ${r.date?.slice(0,10)} | Cat: ${r.category}`);
    });
}

main();
