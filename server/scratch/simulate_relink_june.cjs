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
    const tkit2 = units.find(u => u.name && u.name.toLowerCase().includes('tkit 2'));
    const unitId = tkit2.id;

    const juneReq = budgetRequests.find(r => r.unitId === unitId && (r.month === '2026-06' || r.month === 'Juni 2026'));

    const juneItemNames = new Set((juneReq.items || []).map(i => (i.name || '').trim().toLowerCase()));

    // Currently linked to June REQ:
    const currentJuneReports = budgetReports.filter(r => (r.budgetRequestId === juneReq.id || r.requestId === juneReq.id) && !r.isDeleted && r.status !== 'REJECTED');
    let currentJuneExp = currentJuneReports.filter(r => r.kategoriAset !== 'PENGEMBALIAN').reduce((s, r) => s + parseFloat(r.amount || 0), 0);
    let currentJuneRef = currentJuneReports.filter(r => r.kategoriAset === 'PENGEMBALIAN').reduce((s, r) => s + parseFloat(r.amount || 0), 0);

    console.log(`Current June REQ linked Expense: ${currentJuneExp}`);
    console.log(`Current June REQ linked Refund: ${currentJuneRef}`);
    console.log(`Current June REQ Total Cair: ${juneReq.totalAmount}`);

    // Reports in July/August REQs that belong to June items:
    const otherReports = budgetReports.filter(r => r.unitId === unitId && r.budgetRequestId !== juneReq.id && !r.isDeleted && r.status !== 'REJECTED');

    const misplacedJuneReports = otherReports.filter(r => {
        const catName = (r.category || r.description || '').trim().toLowerCase();
        return juneItemNames.has(catName);
    });

    console.log(`Found ${misplacedJuneReports.length} misplaced reports in July/August REQs matching June items:`);
    let misplacedSum = 0;
    misplacedJuneReports.forEach(r => {
        const amt = parseFloat(r.amount || 0);
        misplacedSum += amt;
        console.log(` - [${r.id}] Amt: ${amt} | Date: ${r.date?.slice(0,10)} | LinkedTo: ${r.budgetRequestId} | Cat: ${r.category} | Desc: ${r.description}`);
    });

    console.log(`\nTotal Misplaced Reports Sum: ${misplacedSum}`);
    console.log(`If relinked to June REQ, Total June Expense = ${currentJuneExp} + ${misplacedSum} = ${currentJuneExp + misplacedSum}`);
    console.log(`Total June Pertanggungjawaban (Expense + Refund) = ${currentJuneExp + misplacedSum + currentJuneRef}`);
    console.log(`Remaining June Unreported = ${parseFloat(juneReq.totalAmount) - (currentJuneExp + misplacedSum + currentJuneRef)}`);
}

main();
