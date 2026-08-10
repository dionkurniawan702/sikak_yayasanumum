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

    console.log(`=== TKIT 1 DATA (Unit ID: ${unitId}) ===`);
    const tkit1Reqs = budgetRequests.filter(r => (r.unitId === unitId || r.fieldId === unitId) && r.status === 'APPROVED');
    console.log(`\nApproved Budget Requests for TKIT 1:`);
    tkit1Reqs.forEach(r => {
        console.log(`REQ [${r.id}] Month: ${r.month} | Date: ${r.date} | Total: Rp ${parseFloat(r.totalAmount || 0).toLocaleString('id-ID')} | Desc: "${r.description}"`);
    });

    const refundReport = budgetReports.find(r => (r.unitId === unitId || r.fieldId === unitId) && r.kategoriAset === 'PENGEMBALIAN' && parseFloat(r.amount) === 6853337);

    console.log(`\nFound Refund Report:`);
    if (refundReport) {
        console.log(`ID: ${refundReport.id}`);
        console.log(`Date: ${refundReport.date}`);
        console.log(`Amount: Rp ${parseFloat(refundReport.amount).toLocaleString('id-ID')}`);
        console.log(`Description: "${refundReport.description}"`);
        console.log(`budgetRequestId: ${refundReport.budgetRequestId}`);
        console.log(`requestId: ${refundReport.requestId}`);
    } else {
        console.log('No exact match for 6.853.337, checking all TKIT 1 refunds:');
        const refunds = budgetReports.filter(r => (r.unitId === unitId || r.fieldId === unitId) && r.kategoriAset === 'PENGEMBALIAN');
        refunds.forEach(r => {
            console.log(`[${r.id}] Amt: ${r.amount} | Date: ${r.date} | Desc: "${r.description}" | ReqId: ${r.budgetRequestId || r.requestId}`);
        });
    }
}

main();
