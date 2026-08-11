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

        console.log('--- TAUD REQS ---');
        const juneReq = budgetRequests.find(r => r.unitId === taudUnit.id && r.month === '2026-06');
        const julyReq = budgetRequests.find(r => r.unitId === taudUnit.id && r.month === '2026-07');

        console.log('June REQ:', {
            id: juneReq.id,
            totalAmount: juneReq.totalAmount,
            itemsCount: juneReq.items?.length
        });
        console.log('July REQ:', {
            id: julyReq.id,
            totalAmount: julyReq.totalAmount,
            itemsCount: julyReq.items?.length
        });

        console.log('\n--- TAUD REPORTS LINKED TO JUNE REQ ---');
        const juneReports = budgetReports.filter(r => 
            !r.isDeleted && (r.budgetRequestId === juneReq.id || r.requestId === juneReq.id)
        );
        let juneExpSum = 0;
        let juneRefSum = 0;
        juneReports.forEach(r => {
            const amt = parseFloat(r.amount || 0);
            if (r.kategoriAset === 'PENGEMBALIAN') juneRefSum += amt;
            else juneExpSum += amt;
            console.log(`Report [${r.id}] date: ${r.date} | amt: ${r.amount} | cat: ${r.kategoriAset} | desc: ${r.description}`);
        });
        console.log(`June REQ Total Cair: ${juneReq.totalAmount}`);
        console.log(`June REQ Total Expense: ${juneExpSum}`);
        console.log(`June REQ Total Refund: ${juneRefSum}`);
        console.log(`June REQ Sisa (Cair - Exp - Ref): ${parseFloat(juneReq.totalAmount) - juneExpSum - juneRefSum}`);

        console.log('\n--- TAUD REPORTS LINKED TO JULY REQ ---');
        const julyReports = budgetReports.filter(r => 
            !r.isDeleted && (r.budgetRequestId === julyReq.id || r.requestId === julyReq.id)
        );
        let julyExpSum = 0;
        let julyRefSum = 0;
        julyReports.forEach(r => {
            const amt = parseFloat(r.amount || 0);
            if (r.kategoriAset === 'PENGEMBALIAN') julyRefSum += amt;
            else julyExpSum += amt;
            console.log(`Report [${r.id}] date: ${r.date} | amt: ${r.amount} | cat: ${r.kategoriAset} | desc: ${r.description}`);
        });
        console.log(`July REQ Total Cair: ${julyReq.totalAmount}`);
        console.log(`July REQ Total Expense: ${julyExpSum}`);
        console.log(`July REQ Total Refund: ${julyRefSum}`);
        console.log(`July REQ Sisa (Cair - Exp - Ref): ${parseFloat(julyReq.totalAmount) - julyExpSum - julyRefSum}`);

        console.log('\n--- ALL PENGEMBALIAN REPORTS FOR TAUD ---');
        const taudRefunds = budgetReports.filter(r => !r.isDeleted && r.unitId === taudUnit.id && r.kategoriAset === 'PENGEMBALIAN');
        console.log(JSON.stringify(taudRefunds, null, 2));

    } catch (err) {
        console.error(err);
    }
}

main();
