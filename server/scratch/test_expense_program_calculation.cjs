const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
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

    const { expensePrograms = [], rabPlans = [], budgetReports = [] } = state;

    console.log(`Expense Programs count: ${expensePrograms.length}`);

    // Map components from rabPlans.expense
    const allComponents = [];
    rabPlans.forEach(plan => {
        if (plan.isDeleted) return;
        Object.entries(plan.expense || {}).forEach(([itemId, rawItemPlans]) => {
            const itemPlans = Array.isArray(rawItemPlans) ? rawItemPlans : (rawItemPlans && typeof rawItemPlans === 'object' ? [rawItemPlans] : []);
            itemPlans.forEach(p => {
                (p.components || []).forEach(comp => {
                    const compStatus = comp.status || (comp.isApproved ? 'APPROVED' : (plan.status === 'APPROVED' ? 'APPROVED' : 'PENDING'));
                    let totalPagu = parseFloat(comp.total || 0);
                    if (!totalPagu && comp.harga) {
                        totalPagu = parseFloat(comp.harga || 0) * parseFloat(comp.kali || comp.volume || 1);
                    }
                    if (!totalPagu && comp.months) {
                        totalPagu = Object.values(comp.months).reduce((sum, m) => sum + (parseFloat(m.jumlah) || 0), 0);
                    }
                    allComponents.push({
                        ...comp,
                        planId: plan.id,
                        unitId: plan.unitId,
                        fieldId: plan.fieldId,
                        academicYearId: plan.academicYearId,
                        compStatus,
                        totalPagu
                    });
                });
            });
        });
    });

    console.log(`Extracted total RAB components: ${allComponents.length}`);

    // Check programs with non-zero components or reports
    let programsWithPagu = 0;
    let programsWithReports = 0;

    expensePrograms.forEach(prog => {
        const progComps = allComponents.filter(c => c.programId === prog.id);
        const totalPagu = progComps.reduce((s, c) => s + c.totalPagu, 0);

        const progReports = budgetReports.filter(r => {
            if (r.isDeleted || r.status === 'REJECTED') return false;
            if (r.componentId) {
                const matchedComp = allComponents.find(c => c.id === r.componentId);
                if (matchedComp && matchedComp.programId === prog.id) return true;
            }
            const rName = (r.category || r.description || '').trim().toLowerCase();
            return progComps.some(c => (c.name || c.label || '').trim().toLowerCase() === rName);
        });

        const totalRealisasi = progReports.reduce((s, r) => s + parseFloat(r.amount || 0), 0);

        if (totalPagu > 0) programsWithPagu++;
        if (totalRealisasi > 0) programsWithReports++;

        if (totalPagu > 0 || totalRealisasi > 0) {
            console.log(`Prog [${prog.id}] "${prog.name}": Pagu = Rp ${totalPagu.toLocaleString('id-ID')} | Realisasi = Rp ${totalRealisasi.toLocaleString('id-ID')} (${progComps.length} comps, ${progReports.length} reports)`);
        }
    });

    console.log(`\nSummary: ${programsWithPagu} programs have Pagu > 0, ${programsWithReports} programs have Realisasi > 0`);
}

main();
