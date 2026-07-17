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
        console.log('Login successful. Fetching all data...');

        const dataRes = await fetch(`${API_URL}/all-data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataJson = await dataRes.json();
        const state = dataJson.data;

        const { budgetReports = [], units = [] } = state;

        // Find TKIT 2 unit
        const tkit2Unit = units.find(u => u.name.includes('TKIT 2'));
        if (!tkit2Unit) {
            console.error('Unit TKIT 2 not found!');
            return;
        }
        const unitId = tkit2Unit.id;
        console.log(`TKIT 2 Unit ID: ${unitId}`);

        // Find all APPROVED reports for TKIT 2
        const approvedReports = budgetReports.filter(r => r.unitId === unitId && r.status === 'APPROVED' && !r.isDeleted);
        console.log(`\nFound ${approvedReports.length} APPROVED reports for TKIT 2.`);

        if (approvedReports.length === 0) {
            console.log('No approved reports to cancel.');
            return;
        }

        console.log('Starting bulk cancellation to DRAFT...');
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < approvedReports.length; i++) {
            const report = approvedReports[i];
            console.log(`[${i + 1}/${approvedReports.length}] Resetting report ${report.id} (${report.description || report.category}) of amount Rp ${report.amount}...`);
            
            try {
                const updateRes = await fetch(`${API_URL}/budget-reports/${report.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ status: 'DRAFT' })
                });

                if (updateRes.ok) {
                    successCount++;
                } else {
                    const errText = await updateRes.text();
                    console.error(`Failed to update report ${report.id}:`, errText);
                    failCount++;
                }
            } catch (err) {
                console.error(`Error updating report ${report.id}:`, err.message);
                failCount++;
            }

            // Small delay to prevent overloading the server
            await new Promise(r => setTimeout(r, 100));
        }

        console.log(`\n--- BULK OPERATION COMPLETE ---`);
        console.log(`Successfully reset to DRAFT: ${successCount}`);
        console.log(`Failed: ${failCount}`);

    } catch (err) {
        console.error('Error in main execution:', err.message);
    }
}

main();
