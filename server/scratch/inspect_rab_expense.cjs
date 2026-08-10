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

    const { rabPlans = [], expensePrograms = [], budgetRequests = [], budgetReports = [] } = state;

    console.log('\n=== SAMPLE RAB PLAN EXPENSE ARRAY ===');
    const plan = rabPlans.find(p => p.expense && p.expense.length > 0);
    if (plan) {
        console.log(`Plan ID: ${plan.id} | expense length: ${plan.expense.length}`);
        console.log('First expense item keys:', Object.keys(plan.expense[0]));
        console.log('First 3 expense items:', plan.expense.slice(0, 3));
    }

    // Inspect programId matching in rabPlans.expense
    let totalExpenseItems = 0;
    let withProgramId = 0;
    const programIdCounts = {};

    rabPlans.forEach(p => {
        (p.expense || []).forEach(item => {
            totalExpenseItems++;
            if (item.programId) {
                withProgramId++;
                programIdCounts[item.programId] = (programIdCounts[item.programId] || 0) + 1;
            }
        });
    });

    console.log(`\nTotal RAB Expense Items: ${totalExpenseItems} | With programId: ${withProgramId}`);
    console.log('programId Value Distribution in RAB items:');
    console.log(programIdCounts);

    // Also check budgetReports for programId or expenseItemId or componentId!
    console.log('\n=== SAMPLE BUDGET REPORT OBJECT ===');
    if (budgetReports.length > 0) {
        console.log('Report Keys:', Object.keys(budgetReports[0]));
        console.log('Sample Report:', budgetReports[0]);
    }
}

main();
