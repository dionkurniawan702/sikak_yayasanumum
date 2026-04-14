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
        itemAllocations: {} // expenseItemId -> amount
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
                    // In Foundation mode, we count this towards 'unallocated'
                    if (!targetUnitId && !targetFieldId) {
                        results.itemAllocations['unallocated'] = (results.itemAllocations['unallocated'] || 0) + amount;
                    } else if (targetUnitId && targetUnitId == student.unitId) {
                        results.totalTarget += amount;
                        results.itemAllocations['unallocated'] = (results.itemAllocations['unallocated'] || 0) + amount;
                    }
                } else {
                    rules.forEach(rule => {
                        const percent = parseFloat(rule.percentage) || 0;
                        const share = amount * (percent / 100);
                        if (share <= 0) return;

                        const exId = rule.expenseItemId || 'unallocated';

                        if (!targetUnitId && !targetFieldId) {
                            // Foundation mode: everything counts for allocations
                            results.itemAllocations[exId] = (results.itemAllocations[exId] || 0) + share;
                        } else if (rule.destType === 'unit' && targetUnitId === rule.destId) {
                            results.totalTarget += share;
                            results.itemAllocations[exId] = (results.itemAllocations[exId] || 0) + share;
                        } else if (rule.destType === 'field' && targetFieldId === rule.destId) {
                            results.totalTarget += share;
                            results.itemAllocations[exId] = (results.itemAllocations[exId] || 0) + share;
                        }
                    });
                }
            });
        }
    });

    return results;
};
