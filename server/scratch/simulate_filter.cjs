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

        // Extract variables like in ArchiveRAB.jsx
        const { currentUser, rabPlans = [], units = [], fields = [], academicYears = [], globalAcademicYearId = 'AY-ID-MO8GWIG3-JDK', expenseItems = [], expensePrograms = [] } = state;
        const currentYear = academicYears.find(y => y.id === globalAcademicYearId);

        // We want to test two cases:
        // Case 1: filterUnit = 'mo7z16fiq1hja' (TKIT 2)
        // Case 2: filterUnit = 'mny1yb4u91eun' (TKIT 1)
        const testFilters = [
            { name: 'TKIT 2', id: 'mo7z16fiq1hja' },
            { name: 'TKIT 1', id: 'mny1yb4u91eun' }
        ];

        testFilters.forEach(tf => {
            const filterUnit = tf.id;
            console.log(`\n================ SIMULATING FOR ${tf.name} (id: ${filterUnit}) ================`);

            const accessiblePlans = rabPlans.filter(p => {
                if (p.academicYearId !== globalAcademicYearId) return false;
                
                const isBosPlan = p.id?.endsWith('-BOS');
                if (isBosPlan) return false; // Yayasan mode

                // Role access filter (simulate isSuperAdmin = true)
                if (filterUnit !== 'ALL') {
                    if (filterUnit.startsWith('FIELD-')) {
                        return p.fieldId === filterUnit.replace('FIELD-', '');
                    }
                    return p.unitId === filterUnit;
                }
                return true;
            });

            console.log(`Accessible plans count: ${accessiblePlans.length}`);
            accessiblePlans.forEach(p => console.log(`  - Plan ID: ${p.id}, UnitId: ${p.unitId}`));

            const data = [];
            accessiblePlans.forEach(plan => {
                const unitName = plan.unitId === 'FOUNDATION' ? 'YAYASAN' : (units.find(u => u.id === plan.unitId)?.name || 'Unknown Unit');
                const fieldName = plan.fieldId ? (fields.find(f => f.id === plan.fieldId)?.name || 'Unknown Field') : '-';
                
                Object.entries(plan.expense || {}).forEach(([itemId, rawItemPlans]) => {
                    const itemMasterName = expenseItems.find(ei => ei.id === itemId)?.name || 'Unknown Item';
                    const itemPlans = Array.isArray(rawItemPlans) ? rawItemPlans : [rawItemPlans];
                    
                    itemPlans.forEach((p, pIdx) => {
                        (p.components || []).forEach((comp, cIdx) => {
                            const compStatus = comp.status || (comp.isApproved ? 'APPROVED' : 'PENDING');
                            if (compStatus !== 'PENDING' && compStatus !== 'APPROVED') return;

                            // We check month allocation
                            // Just simulate filterMonth = 'ALL'
                            const isAllocated = true; // simplified check
                            
                            data.push({
                                id: comp.id || `${plan.id}-${itemId}-${pIdx}-${cIdx}`,
                                planId: plan.id,
                                itemId: itemId,
                                itemMasterName,
                                componentName: comp.name || comp.label,
                                status: compStatus,
                                unitName,
                                fieldName
                            });
                        });
                    });
                });
            });

            console.log(`Total components extracted: ${data.length}`);
            if (data.length > 0) {
                console.log(`Sample components (first 5):`);
                data.slice(0, 5).forEach(item => {
                    console.log(`  - ID: ${item.id}, planId: ${item.planId}, unitName: "${item.unitName}", componentName: "${item.componentName}"`);
                });
            }
        });

    } catch (err) {
        console.error('Error:', err.message);
    }
}
main();
