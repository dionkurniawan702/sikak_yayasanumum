async function run() {
  const loginRes = await fetch('https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'adminpdk', password: 'admin123' })
  });
  const loginJson = await loginRes.json();
  const token = loginJson.token;
  console.log('Login Token received:', !!token);

  const res = await fetch('https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api/all-data', {
    headers: { 
      'Authorization': `Bearer ${token}`,
      'X-Client-Version': '1.5.0-diag'
    }
  });
  const json = await res.json();
  const data = json.data || json || {};

  const requests = data.budgetRequests || [];
  const reports = data.budgetReports || [];

  console.log('Total Requests:', requests.length);
  console.log('Total Reports:', reports.length);

  const tkit2Reqs = requests.filter(r => (r.unitId === 'TKIT2' || r.fieldId === 'TKIT2') && r.month === '2026-08' && r.status === 'APPROVED');
  console.log('\nTKIT2 August Requests count:', tkit2Reqs.length);

  const tkit2Reports = reports.filter(r => !r.isDeleted && (r.unitId === 'TKIT2' || r.fieldId === 'TKIT2'));
  console.log('TKIT2 Total Non-Deleted Reports count:', tkit2Reports.length);
  tkit2Reports.forEach(rep => {
    console.log(`  Report ID: ${rep.id} | Status: ${rep.status} | Name: ${rep.category || rep.description} | Amt: ${rep.amount} | compId: ${rep.componentId} | reqId: ${rep.budgetRequestId}`);
  });

  tkit2Reqs.forEach(req => {
    console.log('\n========================================');
    console.log('Request ID:', req.id, '| Month:', req.month, '| Description:', req.description);
    const items = typeof req.items === 'string' ? JSON.parse(req.items) : (req.items || []);
    console.log('Total items in request:', items.length);

    let countPending = 0;
    let countHidden = 0;

    items.forEach((item, idx) => {
      const itemAmt = parseFloat(item.amount || 0);

      // find reports
      const itemReports = tkit2Reports.filter(r => {
        if (item.componentId && r.componentId === item.componentId) return true;
        const reportName = (r.category || r.description || '').trim().toLowerCase();
        const itemName = (item.name || '').trim().toLowerCase();
        if (reportName && itemName && reportName === itemName) return true;
        return false;
      });

      const approvedReports = itemReports.filter(r => r.status === 'APPROVED');
      const approvedAmt = approvedReports.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
      const allAmt = itemReports.filter(r => r.status !== 'REJECTED').reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

      const isHidden = approvedAmt >= itemAmt || item.isClosed;

      console.log(`${idx + 1}. [${item.name}] | Amt: ${itemAmt} | ApprovedReported: ${approvedAmt} | AllReported: ${allAmt} | isClosed: ${item.isClosed} | isHidden: ${isHidden} | Reports:`, itemReports.map(r => `${r.id}(${r.status}: ${r.amount})`).join(', '));

      if (isHidden) {
        countHidden++;
      } else {
        countPending++;
      }
    });

    console.log(`\nSummary for ${req.id}: Total items = ${items.length}, Pending = ${countPending}, Hidden = ${countHidden}`);
  });
}

run().catch(console.error);
