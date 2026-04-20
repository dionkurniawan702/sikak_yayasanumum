/**
 * Budget Engine for SIKAK YAYASAN UMUM
 * Calculates RAP (Rencana Anggaran Pendapatan) and Allocations
 */

export const calculateRAP = (state, selectedYearId, targetUnitId, targetFieldId) => {
    const { students = [], distributionSettings = [], studentStatuses = [], incomeItems = [] } = state;
    
    // 1. Get active status ID (Case insensitive & trimmed)
    const activeStatusId = studentStatuses?.find(st => 
        st.name?.trim().toLowerCase() === 'aktif'
    )?.id;
    
    // 2. Filter students by status and academic year
    // Note: Use provided year ID OR current active year if none specified
    const yearId = selectedYearId || state.academicYears?.find(y => y.isCurrent)?.id;
    
    const activeStudents = students.filter(s => {
        if (s.isDeleted) return false;
        
        // Match status (Using == for safety with mixed types)
        const statusMatch = !activeStatusId || s.statusId == activeStatusId;
        
        // Match year (Using == for safety)
        const yearMatch = !yearId || s.academicYearId == yearId;
        
        return statusMatch && yearMatch;
    });

    // Diagnostic Log
    if (students.length > 0 && activeStudents.length === 0) {
        console.warn(`[RAP Engine] Semua siswa (${students.length}) terfilter keluar.`, {
            searchYearId: yearId,
            searchStatusId: activeStatusId,
            sampleStudent: students[0]
        });
    }

    // 3. Results structure
    const results = {
        totalTarget: 0,
        incomeTotals: {}, // incomeItemId -> amount
        itemAllocations: {}, // expenseItemId -> amount
        itemSourceBreakdown: {} // NEW: { [expenseItemId]: { [unitId]: amount } }
    };

    // 4. Calculate distributions
    activeStudents.forEach(student => {
        // If calculating for a specific unit, skip other units
        if (targetUnitId && student.unitId != targetUnitId) return;

        if (student.incomeDetails && student.incomeDetails.length > 0) {
            student.incomeDetails.forEach(detail => {
                const amount = parseFloat(detail.amount) || 0;
                if (amount <= 0) return;

                 // Track income item total
                 // Robust lookup: if incomeItemId is not found by ID, it might be a name (from old seeds)
                 const incomeItem = incomeItems.find(ii => ii.id == detail.incomeItemId || ii.name == detail.incomeItemId);
                 const incomeId = incomeItem?.id || detail.incomeItemId;

                 results.incomeTotals[incomeId] = (results.incomeTotals[incomeId] || 0) + amount;
 
                 // SPECIAL: If in Foundation mode (no targetUnit/targetField), sum everything
                 if (!targetUnitId && !targetFieldId) {
                     results.totalTarget += amount;
                 }
 
                 // Find distribution rules for this income item from this unit
                 // Again, match by ID or Name for robustness
                 const rules = distributionSettings.filter(
                     s => s.unitId == student.unitId && (s.incomeItemId == detail.incomeItemId || s.incomeItemId == incomeId)
                 );

                if (rules.length === 0) {
                    // No rules -> 100% stays at unit (unallocated expense item)
                    const exId = 'unallocated';

                    if (!targetUnitId && !targetFieldId) {
                        results.itemAllocations[exId] = (results.itemAllocations[exId] || 0) + amount;
                    } else if (targetUnitId && targetUnitId == student.unitId) {
                        results.totalTarget += amount;
                        results.itemAllocations[exId] = (results.itemAllocations[exId] || 0) + amount;
                        // Track breakdown
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
                        
                        // Fallback: If destId/destType is missing, derive from expenseItem
                        const destId = rule.destId || exItem?.unitId || exItem?.fieldId;
                        const destType = rule.destType || (exItem?.unitId ? 'unit' : (exItem?.fieldId ? 'field' : null));

                        if (!targetUnitId && !targetFieldId) {
                            // Foundation mode: everything counts for allocations
                            results.itemAllocations[exId] = (results.itemAllocations[exId] || 0) + share;
                        } else if (destType === 'unit' && targetUnitId == destId) {
                            results.totalTarget += share;
                            results.itemAllocations[exId] = (results.itemAllocations[exId] || 0) + share;
                            
                            // Track breakdown
                            if (!results.itemSourceBreakdown[exId]) results.itemSourceBreakdown[exId] = {};
                            results.itemSourceBreakdown[exId][student.unitId] = (results.itemSourceBreakdown[exId][student.unitId] || 0) + share;

                        } else if (destType === 'field' && (targetFieldId == destId || (targetUnitId && !targetFieldId))) {
                            // If calculating for a field, we only want that field's share.
                            // If calculating for a unit, we want that unit's share of ANY field items as well.
                            results.totalTarget += share;
                            results.itemAllocations[exId] = (results.itemAllocations[exId] || 0) + share;

                            // Track breakdown
                            if (!results.itemSourceBreakdown[exId]) results.itemSourceBreakdown[exId] = {};
                            results.itemSourceBreakdown[exId][student.unitId] = (results.itemSourceBreakdown[exId][student.unitId] || 0) + share;
                        }
                    });
                }
            });
        }
    });

    // Final Diagnostic for 0 income
    if (targetUnitId && results.totalTarget === 0 && activeStudents.length > 0) {
        console.warn(`[RAP Engine] Target income Rp 0 untuk Unit ${targetUnitId} meskipun ada siswa aktif.`, {
            activeStudents: activeStudents.length,
            sampleStudentIncome: activeStudents[0]?.incomeDetails
        });
    }

    return results;
};
