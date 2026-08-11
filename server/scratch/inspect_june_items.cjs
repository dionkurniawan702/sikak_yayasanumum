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
        const taudUnit = units.find(u => u.name && u.name.toUpperCase().includes('TAUD'));
        const juneReq = budgetRequests.find(r => r.unitId === taudUnit.id && r.month === '2026-06');

        console.log('=== JUNE REQ DETAILS ===');
        console.log(`REQ ID: ${juneReq.id}, TotalAmount: ${juneReq.totalAmount}, isClosed: ${juneReq.isClosed}`);
        console.log('\n--- ITEMS IN JUNE REQ ---');
        juneReq.items.forEach(item => {
            console.log(`Item [${item.componentId}] ${item.name} | Amt: ${item.amount} | isClosed: ${item.isClosed}`);
        });

        console.log('\n--- ALL REPORTS LINKED TO JUNE REQ OR JUNE DATE ---');
        const juneReports = budgetReports.filter(r => 
            !r.isDeleted && 
            (r.budgetRequestId === juneReq.id || r.requestId === juneReq.id || (r.date && r.date.startsWith('2026-06')))
        );
        juneReports.forEach(r => {
            console.log(`Report [${r.id}] date: ${r.date?.slice(0,10)} | status: ${r.status} | cat: ${r.kategoriAset} | amt: ${r.amount} | desc: ${r.description}`);
        });

    } catch (err) {
        console.error(err);
    }
}

main();
