/**
 * Budget Engine for SIKAK YAYASAN UMUM
 * Calculates RAP (Rencana Anggaran Pendapatan) and Allocations
 */

export const calculateRAP = (state, selectedYearId, targetUnitId, targetFieldId) => {
    const { students = [], distributionSettings = [], studentStatuses = [] } = state;
    
    // 1. Get active status ID
    const activeStatusId = studentStatuses?.find(st => st.name === 'Aktif')?.id;
    
    // 2. Filter students by status and academic year
    // Note: Use provided year ID OR current active year if none specified
    const yearId = selectedYearId || state.academicYears?.find(y => y.isCurrent)?.id;
    
    const activeStudents = students.filter(s => {
        if (s.isDeleted) return false;
        
        // Match status (fallback to true if statusId is null or studentStatuses empty)
        const statusMatch = !activeStatusId || s.statusId === activeStatusId;
        
        // Match year (fallback to true if yearId is null or academicYears empty)
        const yearMatch = !yearId || s.academicYearId === yearId;
        
        return statusMatch && yearMatch;
    });

    // 3. Results structure
    const results = {
        totalTarget: 0,
        incomeTotals: {}, // incomeItemId -> amount
        itemAllocations: {} // expenseItemId -> amount
    };

    // 4. Calculate distributions
    activeStudents.forEach(student => {
        // If calculating for a specific unit, skip other units
        if (targetUnitId && student.unitId !== targetUnitId) return;

        if (student.incomeDetails && student.incomeDetails.length > 0) {
            student.incomeDetails.forEach(detail => {
                const amount = parseFloat(detail.amount) || 0;
                if (amount <= 0) return;

                // Track income item total
                results.incomeTotals[detail.incomeItemId] = (results.incomeTotals[detail.incomeItemId] || 0) + amount;

                // SPECIAL: If in Foundation mode (no targetUnit/targetField), sum everything
                if (!targetUnitId && !targetFieldId) {
                    results.totalTarget += amount;
                }

                // Find distribution rules for this income item from this unit
                const rules = distributionSettings.filter(
                    s => s.unitId === student.unitId && s.incomeItemId === detail.incomeItemId
                );

                if (rules.length === 0) {
                    // No rules -> 100% stays at unit (unallocated expense item)
                    if (targetUnitId === student.unitId) {
                        results.totalTarget += amount;
                        results.itemAllocations['unallocated'] = (results.itemAllocations['unallocated'] || 0) + amount;
                    }
                } else {
                    rules.forEach(rule => {
                        const percent = parseFloat(rule.percentage) || 0;
                        const share = amount * (percent / 100);
                        if (share <= 0) return;

                        if (rule.destType === 'unit' && targetUnitId === student.unitId) {
                            results.totalTarget += share;
                            const exId = rule.expenseItemId || 'unallocated';
                            results.itemAllocations[exId] = (results.itemAllocations[exId] || 0) + share;
                        } else if (rule.destType === 'field' && targetFieldId === rule.destId) {
                            results.totalTarget += share;
                            const exId = rule.expenseItemId || 'unallocated';
                            results.itemAllocations[exId] = (results.itemAllocations[exId] || 0) + share;
                        }
                    });
                }
            });
        }
    });

    return results;
};
