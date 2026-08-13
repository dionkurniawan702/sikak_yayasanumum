const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

function resolveReportRequest(report, budgetRequests) {
    if (!report || !budgetRequests || budgetRequests.length === 0) return null;

    if (report.componentId) {
        const found = budgetRequests.find(r => 
            r.status === 'APPROVED' && 
            (report.unitId ? (r.unitId === report.unitId || r.fieldId === report.unitId) : true) &&
            r.items && 
            r.items.some(i => i.componentId === report.componentId)
        );
        if (found) return found;
    }

    const rReqId = report.budgetRequestId || report.requestId;
    const reportItemName = (report.category || report.description || '').trim().toLowerCase();

    if (rReqId) {
        const found = budgetRequests.find(r => r.id === rReqId);
        if (found) {
            if (!reportItemName || !found.items || found.items.length === 0) {
                if (report.kategoriAset !== 'PENGEMBALIAN') return found;
            } else {
                const hasItem = found.items.some(i => (i.name || '').trim().toLowerCase() === reportItemName);
                if (hasItem) return found;
            }
        }
    }

    if (reportItemName) {
        const foundByName = budgetRequests.find(r => 
            r.status === 'APPROVED' &&
            (report.unitId ? (r.unitId === report.unitId || r.fieldId === report.unitId) : true) &&
            r.items &&
            r.items.some(i => (i.name || '').trim().toLowerCase() === reportItemName)
        );
        if (foundByName) return foundByName;
    }

    return null;
}

async function main() {
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

    const rawRequests = state.budgetRequests || [];
    const rawReports = state.budgetReports || [];

    const budgetRequests = rawRequests.map(r => ({
        ...r,
        items: typeof r.items === 'string' ? JSON.parse(r.items) : (r.items || [])
    }));
    const budgetReports = rawReports;

    console.log('Total Requests:', budgetRequests.length);
    console.log('Total Reports:', budgetReports.length);

    const approvedRequests = budgetRequests.filter(r => r.status === 'APPROVED');

    for (const parentReq of approvedRequests) {
        const totalApproved = parseFloat(parentReq.totalAmount || parentReq.amount || 0);

        // Header calculation logic (with resolveReportRequest):
        const reportsForReqHeader = budgetReports.filter(r => {
            if (r.status === 'REJECTED' || r.isDeleted) return false;
            const resolved = resolveReportRequest(r, budgetRequests);
            if (resolved) return resolved.id === parentReq.id;
            return r.budgetRequestId === parentReq.id;
        });
        const totalReportedHeader = reportsForReqHeader.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
        const sisaHeader = totalApproved - totalReportedHeader;

        // Submit logic in handleReportSubmit (WITHOUT resolveReportRequest):
        const reportsForReqSubmit = budgetReports.filter(r => 
            r.budgetRequestId === parentReq.id && r.status !== 'REJECTED' && !r.isDeleted
        );
        const totalReportedSubmit = reportsForReqSubmit.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
        const sisaSubmit = totalApproved - totalReportedSubmit;

        if (Math.abs(sisaHeader - 2614170) < 1000 || Math.abs(sisaSubmit - (-7840830)) < 1000 || Math.abs(sisaHeader - sisaSubmit) > 1) {
            console.log(`\n=== Request ID: ${parentReq.id} | Month: ${parentReq.month} | Unit: ${parentReq.unitId || parentReq.fieldId} | Name/Desc: ${parentReq.description || parentReq.name} ===`);
            console.log(`Total Approved (Cair): ${totalApproved}`);
            console.log(`[Header Calc] Total Reported: ${totalReportedHeader} => Sisa: ${sisaHeader}`);
            console.log(`[Submit Calc] Total Reported: ${totalReportedSubmit} => Sisa: ${sisaSubmit}`);
            
            if (Math.abs(sisaHeader - sisaSubmit) > 1) {
                console.log(`  --> DISCREPANCY DETECTED! Header says ${sisaHeader}, Submit says ${sisaSubmit}`);
            }
        }
    }
}

main().catch(console.error);
