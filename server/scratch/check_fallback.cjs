const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function checkData() {
    try {
        const res = await fetch(`${API_URL}/all-data`);
        const json = await res.json();
        
        const data = json.data || json;
        const reports = data.budgetReports || [];
        const plans = data.rabPlans || [];
        const items = data.expenseItems || [];
        
        const targetReports = reports.filter(r => parseFloat(r.amount) === 825000);
        console.log("Found reports with 825000:", targetReports.length);
        
        targetReports.forEach(r => {
            console.log("\nREPORT INFO:");
            console.log("ID:", r.id);
            console.log("UnitId:", r.unitId);
            console.log("PlanId:", r.planId);
            console.log("ComponentId:", r.componentId);
            console.log("ExpenseItemId:", r.expenseItemId);
            console.log("Category:", r.category);
            
            // Try to match with plans like the dashboard does
            let exId = r.expenseItemId;
            if (!exId && r.planId && r.componentId) {
                console.log("Trying fallback logic...");
                const plan = plans.find(p => p.id === r.planId);
                if (plan && plan.expense) {
                    console.log("Found plan:", plan.id);
                    for (const [itemId, pList] of Object.entries(plan.expense)) {
                        const itemPlans = Array.isArray(pList) ? pList : [pList];
                        for (const p of itemPlans) {
                            if (p.components) {
                                const matched = p.components.some(c => {
                                    const prefix = `COMP-${plan.id}-${itemId}`;
                                    return c.id === r.componentId || prefix === r.componentId.substring(0, prefix.length);
                                });
                                if (matched) {
                                    exId = itemId;
                                    console.log("SUCCESSFULLY MATCED! Found itemId:", itemId);
                                    break;
                                }
                            }
                        }
                        if (exId) break;
                    }
                } else {
                    console.log("Plan not found or no expense data.");
                }
            } else {
                console.log("Fallback logic conditions not met.");
            }
            
            console.log("FINAL EXID:", exId);
            if (exId) {
                const exItem = items.find(e => e.id === exId);
                console.log("RESOLVED ITEM NAME:", exItem?.name);
            }
        });

    } catch (err) {
        console.error("Error:", err.message);
    }
}

checkData();
