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

    const { expensePrograms = [], rabPlans = [], budgetRequests = [], budgetReports = [], units = [], globalAcademicYearId } = state;

    console.log(`Global Academic Year ID: ${globalAcademicYearId}`);
    console.log(`Total Expense Programs: ${expensePrograms.length}`);
    console.log(`Total RAB Plans: ${rabPlans.length}`);
    console.log(`Total Budget Reports: ${budgetReports.length}`);

    console.log('\n=== EXPENSE PROGRAMS ===');
    expensePrograms.forEach(p => {
        console.log(`ID: [${p.id}] | Code: "${p.code}" | Name: "${p.name}" | isDeleted: ${p.isDeleted}`);
    });

    console.log('\n=== RAB PLANS STATS ===');
    const rabByStatus = {};
    const rabByYear = {};
    let totalComps = 0;
    let compsWithProgramId = 0;

    rabPlans.forEach(plan => {
        rabByStatus[plan.status] = (rabByStatus[plan.status] || 0) + 1;
        rabByYear[plan.academicYearId] = (rabByYear[plan.academicYearId] || 0) + 1;

        (plan.components || []).forEach(comp => {
            totalComps++;
            if (comp.programId) {
                compsWithProgramId++;
            }
        });
    });

    console.log('RAB Plans by Status:', rabByStatus);
    console.log('RAB Plans by Academic Year:', rabByYear);
    console.log(`Total RAB Components: ${totalComps} | With programId: ${compsWithProgramId}`);

    // Sample RAB components
    console.log('\n=== SAMPLE RAB COMPONENTS WITH PROGRAM ID ===');
    let sampleCount = 0;
    rabPlans.forEach(plan => {
        (plan.components || []).forEach(comp => {
            if (comp.programId && sampleCount < 10) {
                sampleCount++;
                console.log(`Plan ID: ${plan.id} | Year: ${plan.academicYearId} | Status: ${plan.status} | Comp: "${comp.name}" | programId: [${comp.programId}] | Pagu: Rp ${parseFloat(comp.totalAmount || comp.amount).toLocaleString('id-ID')}`);
            }
        });
    });

    // Check if comp.programId matches p.id or p.name or p.code
    console.log('\n=== CHECKING COMP.PROGRAM_ID MATCHES WITH EXPENSE_PROGRAMS ===');
    const programIdSet = new Set(expensePrograms.map(p => p.id));
    const programNameSet = new Set(expensePrograms.map(p => p.name.trim().toLowerCase()));

    let matchedById = 0;
    let matchedByName = 0;
    let matchedByCode = 0;
    let unmatched = 0;

    rabPlans.forEach(plan => {
        (plan.components || []).forEach(comp => {
            if (comp.programId) {
                if (programIdSet.has(comp.programId)) {
                    matchedById++;
                } else if (programNameSet.has(comp.programId.trim().toLowerCase())) {
                    matchedByName++;
                } else {
                    unmatched++;
                    if (unmatched <= 5) {
                        console.log(`Unmatched comp.programId: "${comp.programId}" for comp "${comp.name}"`);
                    }
                }
            }
        });
    });

    console.log(`Matched by ID: ${matchedById} | Matched by Name: ${matchedByName} | Unmatched: ${unmatched}`);
}

main();
