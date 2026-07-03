const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

// Copied calculateRAP from src/utils/budgetEngine.js
function calculateRAP(state, selectedYearId, targetUnitId, targetFieldId) {
    const { students = [], distributionSettings = [], studentStatuses = [], incomeItems = [] } = state;
    
    const activeStatusId = studentStatuses?.find(st => 
        st.name?.trim().toLowerCase() === 'aktif'
    )?.id;
    
    const yearId = selectedYearId || state.academicYears?.find(y => y.isCurrent)?.id;
    
    const activeStudents = students.filter(s => {
        if (s.isDeleted) return false;
        const statusMatch = !activeStatusId || s.statusId == activeStatusId;
        const yearMatch = !yearId || s.academicYearId == yearId;
        return statusMatch && yearMatch;
    });

    const results = {
        totalTarget: 0,
        incomeTotals: {},
        itemAllocations: {},
        itemSourceBreakdown: {}
    };

    activeStudents.forEach(student => {
        if (targetUnitId && student.unitId != targetUnitId) return;

        if (student.incomeDetails && student.incomeDetails.length > 0) {
            student.incomeDetails.forEach(detail => {
                const amount = parseFloat(detail.amount) || 0;
                if (amount <= 0) return;

                 const incomeItem = incomeItems.find(ii => ii.id == detail.incomeItemId || ii.name == detail.incomeItemId);
                 const incomeId = incomeItem?.id || detail.incomeItemId;

                 results.incomeTotals[incomeId] = (results.incomeTotals[incomeId] || 0) + amount;
 
                 if (!targetUnitId && !targetFieldId) {
                     results.totalTarget += amount;
                 }
 
                 const rules = distributionSettings.filter(
                     s => s.unitId == student.unitId && 
                          (s.incomeItemId == detail.incomeItemId || s.incomeItemId == incomeId) &&
                          (!s.academicYearId || s.academicYearId == yearId)
                 );

                if (rules.length === 0) {
                    const exId = 'unallocated';
                    if (!targetUnitId && !targetFieldId) {
                        results.itemAllocations[exId] = (results.itemAllocations[exId] || 0) + amount;
                    } else if (targetUnitId && targetUnitId == student.unitId) {
                        results.totalTarget += amount;
                        results.itemAllocations[exId] = (results.itemAllocations[exId] || 0) + amount;
                        if (!results.itemSourceBreakdown[exId]) results.itemSourceBreakdown[exId] = {};
                        results.itemSourceBreakdown[exId][student.unitId] = (results.itemSourceBreakdown[exId][student.unitId] || 0) + amount;
                    }
                } else {
                    rules.forEach(rule => {
                        const percent = parseFloat(rule.percentage) || 0;
                        const share = amount * (percent / 100);
                        if (share <= 0) return;

                        const exId = rule.expenseItemId || 'unallocated';
                        const exItem = state.expenseItems?.find(ei => ei.id == exId);
                        
                        const destId = rule.destId || exItem?.unitId || exItem?.fieldId;
                        const destType = rule.destType || (exItem?.unitId ? 'unit' : (exItem?.fieldId ? 'field' : null));

                        if (!targetUnitId && !targetFieldId) {
                            results.itemAllocations[exId] = (results.itemAllocations[exId] || 0) + share;
                        } else if (destType === 'unit' && targetUnitId == destId) {
                            results.totalTarget += share;
                            results.itemAllocations[exId] = (results.itemAllocations[exId] || 0) + share;
                            if (!results.itemSourceBreakdown[exId]) results.itemSourceBreakdown[exId] = {};
                            results.itemSourceBreakdown[exId][student.unitId] = (results.itemSourceBreakdown[exId][student.unitId] || 0) + share;
                        } else if (destType === 'field' && targetFieldId == destId) {
                            results.totalTarget += share;
                            results.itemAllocations[exId] = (results.itemAllocations[exId] || 0) + share;
                            if (!results.itemSourceBreakdown[exId]) results.itemSourceBreakdown[exId] = {};
                            results.itemSourceBreakdown[exId][student.unitId] = (results.itemSourceBreakdown[exId][student.unitId] || 0) + share;
                        }
                    });
                }
            });
        }
    });

    return results;
}

async function main() {
    try {
        const loginRes = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'superadmin', password: 'admin123' })
        });
        const loginJson = await loginRes.json();
        const token = loginJson.data.token;

        const dataRes = await fetch(`${API_URL}/all-data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataJson = await dataRes.json();
        const state = dataJson.data;

        const selectedYearId = 'AY-ID-MO8GWIG3-JDK'; // "2026-2027"

        // 1. Calculate RAP (Foundation Mode: targetUnitId=null, targetFieldId=null)
        const rapData = calculateRAP(state, selectedYearId, null, null);
        console.log(`Computed RAP Total Target: Rp ${rapData.totalTarget.toLocaleString('id-ID')}`);

        // 2. Calculate Consolidated Plan Expense
        const yearPlans = (state.rabPlans || []).filter(p =>
            p && p.academicYearId === selectedYearId &&
            p.unitId !== 'FOUNDATION' &&
            (!p.id.endsWith('-BOS')) // Yayasan source
        );
        console.log(`Number of plans consolidated: ${yearPlans.length}`);

        const consolidated = { income: {}, expense: {} };
        yearPlans.forEach(plan => {
            const planExpense = plan.expense || {};
            Object.entries(planExpense).forEach(([itemId, dataArray]) => {
                if (!dataArray || !Array.isArray(dataArray)) return;
                if (!consolidated.expense[itemId]) {
                    consolidated.expense[itemId] = JSON.parse(JSON.stringify(dataArray));
                } else {
                    consolidated.expense[itemId] = [
                        ...consolidated.expense[itemId],
                        ...JSON.parse(JSON.stringify(dataArray))
                    ];
                }
            });
        });

        // Sum the consolidated expenses
        let totalExpense = 0;
        let totalExpenseBos = 0;

        Object.values(consolidated.expense).flat().forEach(val => {
            totalExpense += parseFloat(val.total || 0);
            totalExpenseBos += val.useBos ? (parseFloat(val.bosAmount) || 0) : 0;
        });

        console.log(`Consolidated Total Expense (RAB): Rp ${totalExpense.toLocaleString('id-ID')}`);
        console.log(`Consolidated Total Expense BOS: Rp ${totalExpenseBos.toLocaleString('id-ID')}`);
        console.log(`Consolidated Total Yayasan Expense: Rp ${(totalExpense - totalExpenseBos).toLocaleString('id-ID')}`);

    } catch (err) {
        console.error('Error:', err.message);
    }
}
main();
