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
    const unitId = mitUnit.id;

    console.log('=== MIT UNIT ALL REPORTS (INCLUDING DELETED & REJECTED & DRAFT) ===');
    const allMitReports = budgetReports.filter(r => r.unitId === unitId);
    console.log(`Total MIT reports count: ${allMitReports.length}`);

    // Check reports with amount 445555 or combination
    const matches445 = allMitReports.filter(r => r.amount == 445555 || (r.description && r.description.includes('445')));
    console.log('Reports matching 445555 exact:', matches445);

    // Let's check reports created recently or updated recently
    console.log('\n=== ALL DELETED OR REJECTED MIT REPORTS ===');
    allMitReports.filter(r => r.isDeleted || r.status === 'REJECTED').forEach(r => {
        console.log(`[DELETED/REJECTED] id:${r.id} status:${r.status} amt:${r.amount} date:${r.date} desc:${r.description} cat:${r.category} reqId:${r.budgetRequestId || r.requestId}`);
    });

    // Let's check all reports linked to June request (REQ-MPLVQKEG-U8C) vs reports dated June 2026
    const juneReq = budgetRequests.find(r => r.unitId === unitId && (r.month === '2026-06' || r.month === 'Juni 2026'));
    console.log('\nJune REQ ID:', juneReq.id);

    const juneReqReports = allMitReports.filter(r => (r.budgetRequestId === juneReq.id || r.requestId === juneReq.id) && !r.isDeleted && r.status !== 'REJECTED');
    console.log(`June REQ Reports count: ${juneReqReports.length}`);

    // Check if any MIT report dated in June 2026 is NOT linked to June REQ
    const juneDatedReportsNotLinked = allMitReports.filter(r => !r.isDeleted && r.status !== 'REJECTED' && r.date?.startsWith('2026-06') && (r.budgetRequestId !== juneReq.id && r.requestId !== juneReq.id));
    console.log('\nJune Dated Reports NOT linked to June REQ:', juneDatedReportsNotLinked.map(r => ({ id: r.id, amt: r.amount, desc: r.description, reqId: r.budgetRequestId || r.requestId })));

    // Check if any report linked to June REQ is dated in July/August/etc
    const juneReqReportsNotJuneDate = juneReqReports.filter(r => !r.date?.startsWith('2026-06'));
    console.log('\nJune REQ Reports NOT dated in June 2026:', juneReqReportsNotJuneDate.map(r => ({ id: r.id, date: r.date, amt: r.amount, desc: r.description })));
}

main();
