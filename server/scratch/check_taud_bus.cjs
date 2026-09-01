const jwt = require('jsonwebtoken');

const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';
const JWT_SECRET = 'sikad-dareliman-secret-2026';

async function main() {
    try {
        const token = jwt.sign(
            { id: 'USR-default-superadmin-id-fallback', username: 'adminsdit1', role: 'superadmin' },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        console.log('Fetching all-data from live API...');
        const res = await fetch(`${API_URL}/all-data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            console.error(`Fetch failed: ${res.status}`);
            return;
        }

        const json = await res.json();
        const state = json.data;
        const { budgetRequests = [], budgetReports = [], units = [] } = state;

        const taudUnit = units.find(u => u.name && u.name.toUpperCase().includes('TAUD'));
        console.log('TAUD Unit:', taudUnit);

        const reqs = budgetRequests.filter(r => r.unitId === taudUnit?.id);
        console.log(`Found ${reqs.length} requests for TAUD:`);

        reqs.forEach(req => {
            console.log(`\nREQ ID: ${req.id} | Month: ${req.month} | Total: ${req.totalAmount} | Status: ${req.status}`);
            (req.items || []).forEach((item, idx) => {
                console.log(`   Item [${idx}]: name="${item.name}", vol=${item.volume}, harga=${item.harga}, amount=${item.amount}, componentId="${item.componentId}", planId="${item.planId}"`);
            });
        });

        const taudReports = budgetReports.filter(r => r.unitId === taudUnit?.id && !r.isDeleted && r.status !== 'REJECTED');
        console.log(`\nFound ${taudReports.length} active/pending reports for TAUD:`);

        taudReports.forEach(r => {
            console.log(`Report [${r.id}]: reqId="${r.budgetRequestId || r.requestId}", componentId="${r.componentId}", category="${r.category}", desc="${r.description}", amount=${r.amount}, date=${r.date}, status=${r.status}`);
        });

    } catch (err) {
        console.error('Error:', err);
    }
}

main();
