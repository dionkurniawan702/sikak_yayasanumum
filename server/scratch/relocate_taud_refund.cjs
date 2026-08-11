const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    try {
        console.log('Logging in...');
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

        console.log('Fetching existing report RET-MSFQC2IM...');
        const dataRes = await fetch(`${API_URL}/all-data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataJson = await dataRes.json();
        const state = dataJson.data;

        const report = state.budgetReports.find(r => r.id === 'RET-MSFQC2IM');
        if (!report) {
            console.error('Report RET-MSFQC2IM not found!');
            return;
        }

        console.log('BEFORE update:', {
            id: report.id,
            description: report.description,
            amount: report.amount,
            budgetRequestId: report.budgetRequestId,
            requestId: report.requestId
        });

        // Update budgetRequestId and requestId to July 2026 REQ: REQ-MREIJYNC-13M
        const updatedReport = {
            ...report,
            budgetRequestId: 'REQ-MREIJYNC-13M',
            requestId: 'REQ-MREIJYNC-13M'
        };

        console.log('Updating via PUT /api/budget-reports/RET-MSFQC2IM...');
        const putRes = await fetch(`${API_URL}/budget-reports/RET-MSFQC2IM`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updatedReport)
        });

        const putJson = await putRes.json();
        console.log('Update result:', putJson);

        // Verification fetch
        console.log('\nVerifying update...');
        const verifyRes = await fetch(`${API_URL}/all-data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const verifyJson = await verifyRes.json();
        const verifiedReport = verifyJson.data.budgetReports.find(r => r.id === 'RET-MSFQC2IM');

        console.log('AFTER update:', {
            id: verifiedReport.id,
            description: verifiedReport.description,
            amount: verifiedReport.amount,
            budgetRequestId: verifiedReport.budgetRequestId,
            requestId: verifiedReport.requestId
        });

        const julyReq = verifyJson.data.budgetRequests.find(r => r.id === verifiedReport.budgetRequestId);
        console.log('Linked Budget Request:', {
            id: julyReq.id,
            month: julyReq.month,
            status: julyReq.status
        });

    } catch (err) {
        console.error('Error:', err);
    }
}

main();
