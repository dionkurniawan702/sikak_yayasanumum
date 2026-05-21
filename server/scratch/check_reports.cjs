const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function checkReports() {
    try {
        const res = await fetch(`${API_URL}/budget-reports`);
        const json = await res.json();
        const reports = Array.isArray(json) ? json : (json.data || []);
        
        // Find reports that have 825000 as amount
        const targetReports = reports.filter(r => parseFloat(r.amount) === 825000);
        
        console.log("Found reports with 825,000:");
        targetReports.forEach(r => {
            console.log(`ID: ${r.id}, PlanId: ${r.planId}, ComponentId: ${r.componentId}, BudgetReqId: ${r.budgetRequestId}, ExpenseItemId: ${r.expenseItemId}`);
        });

    } catch (err) {
        console.error("Error:", err.message);
    }
}

checkReports();
