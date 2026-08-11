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

        function calculateMetrics(modifiedRabPlans) {
            const componentToProgramMap = new Map();
            const allExtractedComponents = [];

            const filteredRabPlans = modifiedRabPlans.filter(p => !p.isDeleted && p.status === 'APPROVED' && p.unitId === mitUnit.id);

            filteredRabPlans.forEach(plan => {
                Object.entries(plan.expense || {}).forEach(([itemId, rawItemPlans]) => {
                    const itemPlans = Array.isArray(rawItemPlans) ? rawItemPlans : [rawItemPlans];
                    itemPlans.forEach(p => {
                        (p.components || []).forEach(comp => {
                            let pagu = parseFloat(comp.total || comp.totalAmount || 0);
                            if (!pagu && comp.harga) {
                                pagu = parseFloat(comp.harga || 0) * parseFloat(comp.kali || comp.volume || 1);
                            }
                            if (comp.programId) {
                                componentToProgramMap.set(comp.id, comp.programId);
                            }
                            allExtractedComponents.push({
                                ...comp,
                                name: comp.name || comp.label || '—',
                                pagu
                            });
                        });
                    });
                });
            });

            const filteredReports = budgetReports.filter(r => !r.isDeleted && r.status !== 'REJECTED' && r.unitId === mitUnit.id);

            return [ikhwanProg, akhwatProg].map(prog => {
                const programComponents = allExtractedComponents.filter(c => c.programId === prog.id);
                const totalPagu = programComponents.reduce((s, c) => s + c.pagu, 0);

                const progReports = filteredReports.filter(r => {
                    if (r.componentId && componentToProgramMap.get(r.componentId) === prog.id) {
                        return true;
                    }
                    const repName = (r.category || r.description || '').trim().toLowerCase();
                    const hasMatchingComp = programComponents.some(c => (c.name || '').trim().toLowerCase() === repName);
                    return hasMatchingComp;
                });

                let totalRealisasi = 0;
                let totalPengembalian = 0;
                progReports.forEach(r => {
                    const amt = parseFloat(r.amount || 0);
                    if (r.kategoriAset === 'PENGEMBALIAN') totalPengembalian += amt;
                    else totalRealisasi += amt;
                });

                const netRealisasi = Math.max(0, totalRealisasi - totalPengembalian);
                const sisaPagu = totalPagu - netRealisasi;

                return {
                    name: prog.name,
                    totalPagu,
                    totalRealisasi,
                    netRealisasi,
                    sisaPagu,
                    reportsCount: progReports.length
                };
            });
        }

        console.log('--- BEFORE FIXING MISMATCHES ---');
        console.log(calculateMetrics(rabPlans));

        // Create modified copy of rabPlans with corrected programIds
        const clonePlans = JSON.parse(JSON.stringify(rabPlans));
        clonePlans.forEach(plan => {
            if (plan.unitId === mitUnit.id) {
                Object.entries(plan.expense || {}).forEach(([itemId, rawItemPlans]) => {
                    const itemPlans = Array.isArray(rawItemPlans) ? rawItemPlans : [rawItemPlans];
                    itemPlans.forEach(ip => {
                        (ip.components || []).forEach(comp => {
                            const name = (comp.name || comp.label || '').toLowerCase();
                            if (name.includes('seragam') && name.includes('ikhwan')) {
                                comp.programId = ikhwanProg.id;
                            } else if (name.includes('seragam') && name.includes('akhwat')) {
                                comp.programId = akhwatProg.id;
                            }
                        });
                    });
                });
            }
        });

        console.log('\n--- AFTER FIXING MISMATCHES ---');
        console.log(calculateMetrics(clonePlans));

    } catch (err) {
        console.error(err);
    }
}

main();
