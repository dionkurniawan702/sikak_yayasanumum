const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function checkData() {
    try {
        const res = await fetch(`${API_URL}/all-data`);
        const json = await res.json();
        
        const data = json.data || json;
        const reports = data.budgetReports || [];
        const units = data.units || [];
        const reqs = data.budgetRequests || [];
        const items = data.expenseItems || [];
        
        // Find any report with 825000
        const targetReports = reports.filter(r => parseFloat(r.amount) === 825000);
        console.log("Found reports with 825,000:", targetReports.length);
        
        targetReports.forEach(r => {
            console.log("\nREPORT DATA:");
            console.log("ID:", r.id);
            console.log("Amount:", r.amount);
            console.log("Category:", r.category);
            console.log("PlanId:", r.planId);
            console.log("ComponentId:", r.componentId);
            console.log("ExpenseItemId:", r.expenseItemId);
            console.log("ReqId:", r.budgetRequestId);
            
            const unit = units.find(u => u.id === r.unitId);
            console.log("Unit:", unit ? unit.name : "Unknown");
            
            if (r.expenseItemId) {
                const ex = items.find(i => i.id === r.expenseItemId);
                console.log("Mapped Expense Item in DB:", ex ? ex.name : "NOT FOUND IN DB ITEMS");
            }
        });

    } catch (err) {
        console.error("Error:", err.message);
    }
}

checkData();
