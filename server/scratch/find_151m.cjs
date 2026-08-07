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

    console.log('Target Total Pengeluaran in Screenshot: 151487078');
    console.log('Target Total Pengembalian in Screenshot: 24369167');
    console.log('Target Total Cair in Screenshot: 154455000');

    // 151487078 + 2967922 = 154455000
    // Notice that 154455000 - 151487078 = 2967922!
    // And 151487078 - 129640278 = 21846800.

    // Let's check if there are reports in budgetReports that sum to 151487078.
    // Or let's check all reports with unitId = myUnitId regardless of deleted or status:
    const allMitReports = budgetReports.filter(r => r.unitId === myUnitId);
    console.log(`Total MIT reports including deleted: ${allMitReports.length}`);

    // Let's test various filtering criteria:
    // Criteria A: all non-rejected, non-pengembalian reports for MIT (including deleted?)
    const sumA = allMitReports.filter(r => r.kategoriAset !== 'PENGEMBALIAN' && r.status !== 'REJECTED').reduce((s,r) => s + parseFloat(r.amount||0), 0);
    console.log('Sum A (all non-rejected non-pengembalian):', sumA);

    // Criteria B: reports in June REQ (REQ-MPLVQKEG-U8C) + some draft reports?
    // Let's list all reports with status DRAFT or PENDING or REJECTED or isDeleted
    console.log('\n--- ALL NON-APPROVED OR DELETED REPORTS FOR MIT ---');
    allMitReports.filter(r => r.status !== 'APPROVED' || r.isDeleted).forEach(r => {
        console.log(`- [${r.id}] Status: ${r.status}, Deleted: ${r.isDeleted}, Amount: ${r.amount}, Date: ${r.date}, ReqId: ${r.budgetRequestId||r.requestId}, Cat: ${r.category}`);
    });

}

main();
