const plan = {
    id: "test-plan-1",
    status: "APPROVED",
    expense: {
        "item-1": [
            {
                id: "sub-1",
                components: [
                    { label: "comp 1", status: "APPROVED", isApproved: true },
                    { label: "comp 2", status: "APPROVED", isApproved: true }
                ]
            }
        ]
    },
    income: {
        "item-2": [
            {
                id: "sub-2",
                components: [
                    { label: "comp 3", status: "APPROVED", isApproved: true }
                ]
            }
        ]
    }
};

const updatedExpense = { ...plan.expense };
Object.keys(updatedExpense).forEach(itemId => {
    const rawPlans = updatedExpense[itemId];
    const plansArr = Array.isArray(rawPlans) ? rawPlans : (rawPlans && typeof rawPlans === 'object' && Object.keys(rawPlans).length > 0 ? [{ id: `P-${itemId}-LEGACY`, itemId, ...rawPlans }] : []);
    
    updatedExpense[itemId] = plansArr.map(p => {
        const comps = p.components || [];
        const updatedComps = comps.map(c => ({
            ...c,
            status: 'REJECTED',
            isApproved: false
        }));
        return { ...p, components: updatedComps };
    });
});

console.log("Updated Expense Components:");
console.log(JSON.stringify(updatedExpense, null, 2));
