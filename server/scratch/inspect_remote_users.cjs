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
        const data = dataJson.data;

        const rabPlans = data.rabPlans || [];
        const tkit2Plan = rabPlans.find(p => p.id === 'AY-ID-MO8GWIG3-JDK-mo7z16fiq1hja-YAYASAN');

        if (tkit2Plan) {
            console.log(`TKIT 2 PLAN: ID=${tkit2Plan.id}, UnitId=${tkit2Plan.unitId}, Status=${tkit2Plan.status}`);
            console.log(`Components:`);
            let count = 0;
            if (tkit2Plan.expense) {
                Object.entries(tkit2Plan.expense).forEach(([itemId, rawItemPlans]) => {
                    const itemPlans = Array.isArray(rawItemPlans) ? rawItemPlans : [rawItemPlans];
                    itemPlans.forEach(itemPlan => {
                        if (itemPlan && itemPlan.components) {
                            itemPlan.components.forEach(comp => {
                                count++;
                                console.log(`  - Comp #${count}: label="${comp.label || comp.name}", unitId="${comp.unitId}", fieldId="${comp.fieldId}", useBos=${comp.useBos}, status=${comp.status}`);
                            });
                        }
                    });
                });
            }
            console.log(`Total TKIT 2 components: ${count}`);
        } else {
            console.log(`TKIT 2 plan not found!`);
        }

    } catch (err) {
        console.error('Error:', err.message);
    }
}
main();
