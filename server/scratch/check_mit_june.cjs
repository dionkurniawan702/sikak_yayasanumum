const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    try {
        console.log('Logging in to remote API...');
        const loginRes = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'adminpdk', password: 'admin123' })
        });
        const loginJson = await loginRes.json();
        const token = loginJson.data?.token;

        if (!token) {
            console.error('Login failed:', loginJson);
            return;
        }

        const dataRes = await fetch(`${API_URL}/all-data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataJson = await dataRes.json();
        const state = dataJson.data;

        const { budgetRequests = [], budgetReports = [], units = [], globalAcademicYearId } = state;

        const mitUnit = units.find(u => u.name && u.name.toLowerCase().includes('mit'));
        console.log('MIT Unit:', mitUnit);

        const unitId = mitUnit ? mitUnit.id : null;

        console.log('\n--- MIT BUDGET REQUESTS (JUNE 2026 / 2026-06) ---');
        const mitReqs = budgetRequests.filter(r => {
            const isMit = r.unitId === unitId || (mitUnit && r.fieldId === mitUnit.fieldId);
            return isMit && (r.month === '2026-06' || r.month === 'Juni 2026');
        });
        console.log(`Found ${mitReqs.length} requests:`);
        mitReqs.forEach(r => {
            console.log(`- REQ [${r.id}] Status: ${r.status}, Month: ${r.month}, TotalAmount: ${r.totalAmount}, Desc: ${r.description}`);
            if (r.items) {
                r.items.forEach((item, idx) => {
                    console.log(`   Item ${idx+1}: ${item.name} | Amount: ${item.amount} | CompId: ${item.componentId}`);
                });
            }
        });

        console.log('\n--- ALL MIT REQUESTS APPROVED ---');
        const allMitApprovedReqs = budgetRequests.filter(r => (r.unitId === unitId) && r.status === 'APPROVED');
        allMitApprovedReqs.forEach(r => {
            console.log(`- REQ [${r.id}] Month: ${r.month}, Total: ${r.totalAmount}, Source: ${r.source}`);
        });

        console.log('\n--- MIT BUDGET REPORTS (JUNE 2026) ---');
        const mitReports = budgetReports.filter(r => {
            const isMit = r.unitId === unitId;
            const notDeleted = !r.isDeleted;
            const notRejected = r.status !== 'REJECTED';
            return isMit && notDeleted && notRejected;
        });

        console.log(`Total active MIT reports (not deleted, not rejected): ${mitReports.length}`);

        let sumExpenseJune = 0;
        let sumPengembalianJune = 0;

        mitReports.forEach(r => {
            const amt = parseFloat(r.amount || 0);
            const req = budgetRequests.find(br => br.id === (r.budgetRequestId || r.requestId));
            const reqMonth = req ? req.month : null;
            const isJuneReq = reqMonth === '2026-06' || reqMonth === 'Juni 2026';
            const isJuneDate = r.date && r.date.startsWith('2026-06');

            console.log(`- REPORT [${r.id}] Status: ${r.status}, Kategori: ${r.kategoriAset}, Amount: ${amt}, Date: ${r.date}, ReqId: ${r.budgetRequestId || r.requestId}, ReqMonth: ${reqMonth}, CategoryName: ${r.category}`);

            if (isJuneReq || isJuneDate) {
                if (r.kategoriAset === 'PENGEMBALIAN') {
                    sumPengembalianJune += amt;
                } else {
                    sumExpenseJune += amt;
                }
            }
        });

        console.log(`\nJune Calculated Total Pengeluaran (Non-Pengembalian): ${sumExpenseJune}`);
        console.log(`June Calculated Total Pengembalian: ${sumPengembalianJune}`);

    } catch (err) {
        console.error('Error:', err);
    }
}

main();
