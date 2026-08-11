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

        console.log('Fetching state...');
        const dataRes = await fetch(`${API_URL}/all-data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataJson = await dataRes.json();
        const state = dataJson.data;

        const { expensePrograms = [], rabPlans = [], units = [] } = state;
        const mitUnit = units.find(u => u.name && u.name.toUpperCase().includes('MIT'));

        const ikhwanProg = expensePrograms.find(p => p.name && p.name.toLowerCase().includes('seragam ikhwan'));
        const akhwatProg = expensePrograms.find(p => p.name && p.name.toLowerCase().includes('seragam akhwat'));

        const targetPlan = rabPlans.find(p => p.id === 'AY-ID-MO8GWIG3-JDK-mo7zeqb1gtuh9-YAYASAN');
        if (!targetPlan) {
            console.error('Target RAB Plan not found!');
            return;
        }

        console.log('Target Plan found:', targetPlan.id);

        let fixedCount = 0;
        const updatedExpense = JSON.parse(JSON.stringify(targetPlan.expense || {}));

        Object.entries(updatedExpense).forEach(([itemId, rawItemPlans]) => {
            const itemPlans = Array.isArray(rawItemPlans) ? rawItemPlans : [rawItemPlans];
            itemPlans.forEach(ip => {
                (ip.components || []).forEach(comp => {
                    const name = (comp.name || comp.label || '').toLowerCase();
                    if (name.includes('seragam') && name.includes('ikhwan')) {
                        if (comp.programId !== ikhwanProg.id) {
                            console.log(`Fixing [${comp.id}] "${comp.name}" -> ${comp.programId} => ${ikhwanProg.id}`);
                            comp.programId = ikhwanProg.id;
                            fixedCount++;
                        }
                    } else if (name.includes('seragam') && name.includes('akhwat')) {
                        if (comp.programId !== akhwatProg.id) {
                            console.log(`Fixing [${comp.id}] "${comp.name}" -> ${comp.programId} => ${akhwatProg.id}`);
                            comp.programId = akhwatProg.id;
                            fixedCount++;
                        }
                    }
                });
            });
        });

        console.log(`Total components fixed: ${fixedCount}`);

        const updatedPlanPayload = {
            ...targetPlan,
            expense: updatedExpense
        };

        console.log('Sending POST /api/rab-plans to save updated plan...');
        const postRes = await fetch(`${API_URL}/rab-plans`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updatedPlanPayload)
        });

        const postJson = await postRes.json();
        console.log('Update status:', postRes.status);

        console.log('\nVerifying state after update...');
        const verifyRes = await fetch(`${API_URL}/all-data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const verifyJson = await verifyRes.json();
        const verifiedPlan = verifyJson.data.rabPlans.find(p => p.id === targetPlan.id);

        let verifiedIkhwanCount = 0;
        let verifiedAkhwatCount = 0;

        Object.entries(verifiedPlan.expense || {}).forEach(([itemId, rawItemPlans]) => {
            const itemPlans = Array.isArray(rawItemPlans) ? rawItemPlans : [rawItemPlans];
            itemPlans.forEach(ip => {
                (ip.components || []).forEach(comp => {
                    const name = (comp.name || comp.label || '').toLowerCase();
                    if (name.includes('seragam')) {
                        if (comp.programId === ikhwanProg.id) verifiedIkhwanCount++;
                        if (comp.programId === akhwatProg.id) verifiedAkhwatCount++;
                    }
                });
            });
        });

        console.log(`AFTER VERIFICATION: Ikhwan program components: ${verifiedIkhwanCount}, Akhwat program components: ${verifiedAkhwatCount}`);

    } catch (err) {
        console.error('Error:', err);
    }
}

main();
