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
        const token = loginJson.data.token;

        const dataRes = await fetch(`${API_URL}/all-data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataJson = await dataRes.json();
        const state = dataJson.data;

        const { budgetReports = [], units = [] } = state;

        const tkit2Unit = units.find(u => u.name.includes('TKIT 2'));
        const unitId = tkit2Unit.id;

        // Find all APPROVED reports for TKIT 2 in the database right now
        const approvedReports = budgetReports.filter(r => r.unitId === unitId && r.status === 'APPROVED' && !r.isDeleted);
        console.log(`Current APPROVED reports count for TKIT 2: ${approvedReports.length}`);

        // Print details of remaining approved reports
        approvedReports.forEach((r, idx) => {
            console.log(`[${idx+1}] ID: ${r.id}, Date: ${r.date}, Category: ${r.category}, Amount: ${r.amount}, YearId: ${r.academicYearId}`);
        });

    } catch (err) {
        console.error('Error:', err.message);
    }
}
main();
