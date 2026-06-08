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
        
        console.log(`=== MIT BOS PLAN FULL INSPECTION ===`);
        if (!plan) {
            console.log('MIT BOS Plan not found!');
            return;
        }

        console.log('Plan ID:', plan.id);
        console.log('Plan Status:', plan.status);
        console.log('Expense JSON:');
        console.log(JSON.stringify(plan.expense, null, 2));

    } catch (err) {
        console.error('Error:', err.message);
    }
}
main();
