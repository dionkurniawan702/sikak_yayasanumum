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

    const { auditLogs = [], budgetReports = [], budgetRequests = [] } = state;
    
    console.log(`Total Audit Logs in state: ${auditLogs.length}`);
    if (auditLogs.length > 0) {
        console.log('Sample audit logs:', auditLogs.slice(0, 10));
    }

    // Check all reports for MIT, sort by createdAt or ID
    const juneReq = budgetRequests.find(r => r.month === '2026-06' || r.month === 'Juni 2026');
    console.log('June REQ ID:', juneReq.id);

    // Let's list all 124 reports linked to June REQ, sum their amounts
    const juneReports = budgetReports.filter(r => (r.budgetRequestId === juneReq.id || r.requestId === juneReq.id) && !r.isDeleted && r.status !== 'REJECTED');

    console.log('\n=== LIST OF ALL 124 JUNE REPORTS ===');
    juneReports.forEach(r => {
        if (r.kategoriAset === 'PENGEMBALIAN' || parseFloat(r.amount) > 1000000 || r.description?.includes('445') || r.category?.includes('445')) {
            console.log(`[SPECIAL] ID: ${r.id} | Amt: ${r.amount} | Date: ${r.date} | Cat: ${r.category} | Desc: ${r.description}`);
        }
    });

    // Check if any combination of item reported amounts or diffs equals 445,555!
    console.log('\n=== CHECKING COMBINATION OF ITEM DIFFS THAT ADD UP TO 445,555 ===');
    // Let's see if any single report or sum of reports equals 445555
    const reportAmts = juneReports.map(r => parseFloat(r.amount));
    const find445 = juneReports.filter(r => Math.abs(parseFloat(r.amount) - 445555) < 1000);
    console.log('Reports near 445555:', find445);
}

main();
