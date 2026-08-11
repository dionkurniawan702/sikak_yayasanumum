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

        console.log('MIT Unit:', mitUnit ? { id: mitUnit.id, name: mitUnit.name } : 'Not found');

        const ikhwanProg = expensePrograms.find(p => p.name && p.name.toLowerCase().includes('seragam ikhwan'));
        const akhwatProg = expensePrograms.find(p => p.name && p.name.toLowerCase().includes('seragam akhwat'));

        console.log('\n--- EXPENSE PROGRAMS ---');
        console.log('Seragam Ikhwan Prog:', ikhwanProg);
        console.log('Seragam Akhwat Prog:', akhwatProg);

        console.log('\n--- RAB PLANS FOR MIT ---');
        const mitPlans = rabPlans.filter(p => !p.isDeleted && p.unitId === mitUnit.id && p.status === 'APPROVED');
        
        const mitComponents = [];
        mitPlans.forEach(plan => {
            Object.entries(plan.expense || {}).forEach(([itemId, rawItemPlans]) => {
                const itemPlans = Array.isArray(rawItemPlans) ? rawItemPlans : [rawItemPlans];
                itemPlans.forEach(ip => {
                    (ip.components || []).forEach(comp => {
                        mitComponents.push({
                            ...comp,
                            planId: plan.id
                        });
                    });
                });
            });
        });

        console.log(`Total MIT RAB Components: ${mitComponents.length}`);
        
        const ikhwanComps = mitComponents.filter(c => c.programId === ikhwanProg?.id);
        const akhwatComps = mitComponents.filter(c => c.programId === akhwatProg?.id);

        console.log('\n--- SERAGAM IKHWAN COMPONENTS IN RAB ---');
        ikhwanComps.forEach(c => console.log({ id: c.id, name: c.name, harga: c.harga, total: c.total || c.harga * (c.kali || 1), programId: c.programId }));

        console.log('\n--- SERAGAM AKHWAT COMPONENTS IN RAB ---');
        akhwatComps.forEach(c => console.log({ id: c.id, name: c.name, harga: c.harga, total: c.total || c.harga * (c.kali || 1), programId: c.programId }));

        console.log('\n--- REPORTS FOR MIT ---');
        const mitReports = budgetReports.filter(r => !r.isDeleted && r.unitId === mitUnit.id && r.status !== 'REJECTED');
        console.log(`Total MIT Reports: ${mitReports.length}`);

        console.log('\n--- REPORTS SERAGAM / CLOTHING RELATED ---');
        const seragamReports = mitReports.filter(r => {
            const desc = (r.description || r.category || '').toLowerCase();
            return desc.includes('seragam') || desc.includes('baju') || desc.includes('ikhwan') || desc.includes('akhwat') || desc.includes('batik') || desc.includes('olahraga');
        });

        seragamReports.forEach(r => {
            console.log({
                id: r.id,
                date: r.date?.slice(0,10),
                amount: r.amount,
                description: r.description,
                category: r.category,
                componentId: r.componentId,
                budgetRequestId: r.budgetRequestId
            });
        });

    } catch (err) {
        console.error(err);
    }
}

main();
