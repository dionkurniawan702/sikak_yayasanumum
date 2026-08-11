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

        const { expensePrograms = [], rabPlans = [], units = [] } = state;
        const mitUnit = units.find(u => u.name && u.name.toUpperCase().includes('MIT'));

        const ikhwanProg = expensePrograms.find(p => p.name && p.name.toLowerCase().includes('seragam ikhwan'));
        const akhwatProg = expensePrograms.find(p => p.name && p.name.toLowerCase().includes('seragam akhwat'));

        console.log('Ikhwan Prog ID:', ikhwanProg.id);
        console.log('Akhwat Prog ID:', akhwatProg.id);

        const mitPlans = rabPlans.filter(p => !p.isDeleted && p.unitId === mitUnit.id);

        mitPlans.forEach(plan => {
            console.log(`\n=== PLAN [${plan.id}] Status: ${plan.status} ===`);
            let count = 0;
            Object.entries(plan.expense || {}).forEach(([itemId, rawItemPlans]) => {
                const itemPlans = Array.isArray(rawItemPlans) ? rawItemPlans : [rawItemPlans];
                itemPlans.forEach(ip => {
                    (ip.components || []).forEach(comp => {
                        const name = comp.name || comp.label || '';
                        if (name.toLowerCase().includes('seragam')) {
                            count++;
                            const isIkhwan = name.toLowerCase().includes('ikhwan');
                            const isAkhwat = name.toLowerCase().includes('akhwat');
                            const currentProg = comp.programId === ikhwanProg.id ? 'IKHWAN' : (comp.programId === akhwatProg.id ? 'AKHWAT' : comp.programId);
                            const correctProg = isIkhwan ? 'IKHWAN' : (isAkhwat ? 'AKHWAT' : 'UNKNOWN');
                            const mismatch = currentProg !== correctProg ? '*** MISMATCH ***' : 'OK';

                            console.log(`${count}. [${comp.id}] "${name}" -> currentProg: ${currentProg} | correctProg: ${correctProg} ${mismatch}`);
                        }
                    });
                });
            });
        });

    } catch (err) {
        console.error(err);
    }
}

main();
