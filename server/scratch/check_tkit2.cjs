const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function checkData() {
    try {
        const res = await fetch(`${API_URL}/all-data`);
        const json = await res.json();
        
        const data = json.data || json;
        const reports = data.budgetReports || [];
        const units = data.units || [];
        const reqs = data.budgetRequests || [];
        
        console.log("Units:");
        units.forEach(u => console.log(`- ID: ${u.id}, Name: ${u.name}`));
        
        const tkit2 = units.find(u => u.name.toLowerCase().includes("tkit 2") || u.name.toLowerCase().includes("tkit2"));
        if (!tkit2) {
            console.log("TKIT 2 not found even with lowercase check!");
            return;
        }

        console.log("TKIT 2 ID:", tkit2.id);
        
        const targetReports = reports.filter(r => r.unitId === tkit2.id);
        console.log("\nREPORTS:");
        targetReports.forEach(r => {
            console.log(`ID: ${r.id}, Amount: ${r.amount}, Category: ${r.category}, PlanId: ${r.planId}, ComponentId: ${r.componentId}, ExpenseItemId: ${r.expenseItemId}, ReqId: ${r.budgetRequestId}`);
        });

        const targetReqs = reqs.filter(r => r.unitId === tkit2.id);
        console.log("\nREQUESTS:");
        targetReqs.forEach(r => {
            console.log(`ReqID: ${r.id}, TotalAmount: ${r.totalAmount}, ExpenseItemId: ${r.expenseItemId}`);
            if (r.items) {
                r.items.forEach(i => {
                    console.log(`  -> Item: ${i.name}, ComponentId: ${i.componentId}, PlanId: ${i.planId}, ExpenseItemId: ${i.expenseItemId}`);
                });
            }
        });

    } catch (err) {
        console.error("Error:", err.message);
    }
}

checkData();
