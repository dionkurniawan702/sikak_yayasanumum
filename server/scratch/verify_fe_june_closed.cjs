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

        const { budgetRequests = [], units = [] } = state;
        const taudUnit = units.find(u => u.name && u.name.toUpperCase().includes('TAUD'));

        const juneReq = budgetRequests.find(r => r.unitId === taudUnit.id && r.month === '2026-06');
        
        let pendingCount = 0;
        if (juneReq.items && juneReq.items.length > 0) {
            juneReq.items.forEach(item => {
                if (item.isClosed) return; // Skipped!
                pendingCount++;
            });
        }

        console.log(`Pending items count for June 2026 (TAUD) in "Perlu Dilaporkan": ${pendingCount}`);

    } catch (err) {
        console.error(err);
    }
}

main();
