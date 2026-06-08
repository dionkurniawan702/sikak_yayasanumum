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
        const mitPlan = rabPlans.find(p => p.id === 'AY-ID-MO8GWIG3-JDK-mo7zeqb1gtuh9-YAYASAN');
        
        console.log(`=== MIT PLAN DETAILS ===`);
        if (mitPlan && mitPlan.expense) {
            const firstKey = Object.keys(mitPlan.expense)[0];
            const itemPlan = mitPlan.expense[firstKey];
            const firstComp = Array.isArray(itemPlan) ? itemPlan[0]?.components?.[0] : itemPlan.components?.[0];
            console.log(JSON.stringify(firstComp, null, 2));
        }

    } catch (err) {
        console.error('Error:', err.message);
    }
}
main();
