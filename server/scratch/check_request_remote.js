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
        if (!loginJson.data) {
            console.error('Login failed:', loginJson);
            return;
        }
        const token = loginJson.data.token;
        console.log('Fetching all data...');

        const dataRes = await fetch(`${API_URL}/all-data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataJson = await dataRes.json();
        const state = dataJson.data;

        const { budgetReports = [], budgetRequests = [] } = state;

        // Find TKIT 2 unit
        const tkit2Unit = state.units.find(u => u.name.includes('TKIT 2'));
        const unitId = tkit2Unit?.id;
        console.log(`TKIT 2 Unit ID: ${unitId}`);

        // Let's filter all reports for TKIT 2
        const tkitReports = budgetReports.filter(r => r.unitId === unitId);
        console.log(`\nTotal reports for TKIT 2: ${tkitReports.length}`);

        console.log('\n--- TKIT 2 Reports that are NOT APPROVED (status !== APPROVED) ---');
        const notApproved = tkitReports.filter(r => r.status !== 'APPROVED');
        notApproved.forEach(r => {
            console.log(`- Report [${r.id}] ReqId: ${r.budgetRequestId}, Amount: ${r.amount}, Status: ${r.status}, Nota: ${r.nomorNota}, Desc: ${r.description}, isDeleted: ${r.isDeleted}`);
        });

        console.log('\n--- TKIT 2 Reports with amount = 90,000 or similar ---');
        const ninetyKReports = tkitReports.filter(r => Math.abs(parseFloat(r.amount) - 90000) < 1 || r.description?.includes('90') || r.description?.toLowerCase().includes('sembilan puluh'));
        ninetyKReports.forEach(r => {
            console.log(`- Report [${r.id}] ReqId: ${r.budgetRequestId}, Amount: ${r.amount}, Status: ${r.status}, Nota: ${r.nomorNota}, Desc: ${r.description}, isDeleted: ${r.isDeleted}`);
        });

        // Let's print out all requests of TKIT 2 for this academic year
        console.log('\n--- All Requests of TKIT 2 ---');
        const tkitRequests = budgetRequests.filter(r => r.unitId === unitId);
        tkitRequests.forEach(r => {
            console.log(`- Request [${r.id}] Month: ${r.month}, Status: ${r.status}, Amount: ${r.totalAmount}, isDeleted: ${r.isDeleted}`);
        });

    } catch (err) {
        console.error('Error:', err.message);
    }
}
main();
