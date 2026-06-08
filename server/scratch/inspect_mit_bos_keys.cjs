const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    try {
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

        const rabPlans = state.rabPlans || [];
        const plan = rabPlans.find(p => p.id === 'AY-ID-MO8GWIG3-JDK-mo7zeqb1gtuh9-BOS');
        
        console.log(`=== MIT BOS PLAN KEYS ===`);
        if (!plan) {
            console.log('MIT BOS Plan not found!');
            return;
        }

        Object.entries(plan.expense || {}).forEach(([id, list]) => {
            const arr = Array.isArray(list) ? list : [list];
            console.log(`\nExpense Category: ${id}`);
            arr.forEach((sub, idx) => {
                console.log(`  Sub-plan #${idx+1}:`);
                console.log(`    ID: ${sub.id}`);
                console.log(`    useBos: ${sub.useBos}`);
                console.log(`    bosAmount: ${sub.bosAmount}`);
                console.log(`    total: ${sub.total}`);
                console.log(`    components count: ${sub.components?.length || 0}`);
            });
        });

    } catch (err) {
        console.error('Error:', err.message);
    }
}
main();
