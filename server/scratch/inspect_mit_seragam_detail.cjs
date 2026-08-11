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

        const { expensePrograms = [], rabPlans = [], budgetReports = [], units = [] } = state;
        const mitUnit = units.find(u => u.name && u.name.toUpperCase().includes('MIT'));

        const ikhwanProg = expensePrograms.find(p => p.name && p.name.toLowerCase().includes('seragam ikhwan'));
        const akhwatProg = expensePrograms.find(p => p.name && p.name.toLowerCase().includes('seragam akhwat'));

        const mitPlans = rabPlans.filter(p => !p.isDeleted && p.unitId === mitUnit.id && p.status === 'APPROVED');
        
        console.log('=== MIT APPROVED RAB PLANS ===');
        mitPlans.forEach(plan => {
            console.log(`Plan [${plan.id}] title: ${plan.title || plan.name} | unitId: ${plan.unitId} | year: ${plan.academicYearId}`);
            Object.entries(plan.expense || {}).forEach(([itemId, rawItemPlans]) => {
                const itemPlans = Array.isArray(rawItemPlans) ? rawItemPlans : [rawItemPlans];
                itemPlans.forEach(ip => {
                    (ip.components || []).forEach(comp => {
                        if (comp.programId === ikhwanProg.id || comp.programId === akhwatProg.id) {
                            console.log(`- Comp ID: ${comp.id} | programId: ${comp.programId === ikhwanProg.id ? 'IKHWAN' : 'AKHWAT'} | name/label: "${comp.name || comp.label}" | harga: ${comp.harga} | total: ${comp.total || comp.harga * (comp.kali || comp.volume || 1)}`);
                        }
                    });
                });
            });
        });

        console.log('\n=== ALL MIT REPORTS AND HOW THEY ARE MATCHED ===');
        const mitReports = budgetReports.filter(r => !r.isDeleted && r.unitId === mitUnit.id && r.status !== 'REJECTED');

        mitReports.forEach(r => {
            const desc = (r.description || r.category || '').toLowerCase();
            const cat = (r.category || '').toLowerCase();
            if (desc.includes('seragam') || desc.includes('baju') || cat.includes('seragam') || desc.includes('jilbab') || desc.includes('kopiah')) {
                console.log(`REPORT [${r.id}] date: ${r.date?.slice(0,10)} | amt: ${r.amount} | compId: ${r.componentId} | cat: "${r.category}" | desc: "${r.description}"`);
            }
        });

    } catch (err) {
        console.error(err);
    }
}

main();
