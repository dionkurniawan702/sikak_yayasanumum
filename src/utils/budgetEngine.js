/**
 * Budget Engine for SIKAD DARELIMAN
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
                     s => s.unitId == student.unitId && 
                          (s.incomeItemId == detail.incomeItemId || s.incomeItemId == incomeId) &&
                          (!s.academicYearId || s.academicYearId == yearId)
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

                        } else if (destType === 'field' && targetFieldId == destId) {
                            // If calculating for a field, we only want that field's share.
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

/**
 * Helper to extract specific "Keterangan Rincian" for a budget request item or component.
 * Strictly returns only the specific note, specification, asset/room details belonging
 * to THAT specific item or component (suppresses parent plan aggregate descriptions and category names).
 */
export const getComponentKeterangan = (item, rabPlans, expenseItems = []) => {
    if (!item) return '';

    const clean = (val) => (val ? String(val).trim() : '');
    const itemName = clean(item.name).toLowerCase();

    // Helper to detect if text is an aggregate list of multiple items
    const isAggregateText = (text) => {
        if (!text) return false;
        return text.includes(',') && text.length > 40 && (text.split(',').length >= 3);
    };

    // 1. Direct fields on item if present and specific to this item
    const directParts = [];
    const directKet = clean(item.keterangan);
    if (directKet && directKet.toLowerCase() !== itemName && !isAggregateText(directKet)) {
        directParts.push(directKet);
    }
    const directSarpras = clean(item.sarprasNotes);
    if (directSarpras && directSarpras.toLowerCase() !== itemName && !directParts.includes(directSarpras)) {
        directParts.push(directSarpras);
    }
    const directRoom = clean(item.assetRoom);
    if (directRoom) {
        directParts.push(`Ruang/Lokasi: ${directRoom}`);
    }
    const directAsset = clean(item.assetName || item.namaAset);
    if (directAsset && directAsset.toLowerCase() !== itemName && !directParts.includes(directAsset)) {
        directParts.push(directAsset);
    }
    const directDesc = clean(item.description);
    if (directDesc && 
        directDesc.toLowerCase() !== itemName && 
        !directParts.includes(directDesc) && 
        !isAggregateText(directDesc) &&
        directDesc !== clean(item.reqDescription) &&
        directDesc !== clean(item.planDescription)) {
        directParts.push(directDesc);
    }

    if (directParts.length > 0) {
        return directParts.join(' • ');
    }

    // 2. Lookup in rabPlans by componentId or planId
    if (rabPlans && Array.isArray(rabPlans) && (item.componentId || item.planId)) {
        const targetCompId = item.componentId || item.id;
        for (const plan of rabPlans) {
            if (item.planId && plan.id !== item.planId) continue;
            for (const [itemId, rawPlans] of Object.entries(plan.expense || {})) {
                const plansArr = Array.isArray(rawPlans) ? rawPlans : (rawPlans && typeof rawPlans === 'object' ? [rawPlans] : []);
                for (let pIdx = 0; pIdx < plansArr.length; pIdx++) {
                    const p = plansArr[pIdx];
                    const compList = p.components || [];
                    for (let cIdx = 0; cIdx < compList.length; cIdx++) {
                        const c = compList[cIdx];
                        const syntheticId = `COMP-${plan.id}-${itemId}-${pIdx}-${cIdx}`;
                        const isMatch = (c.id && c.id === targetCompId) || 
                                        (targetCompId === syntheticId) ||
                                        (!item.componentId && clean(c.label).toLowerCase() === itemName);

                        if (isMatch) {
                            const parts = [];
                            const cLabel = clean(c.label);
                            if (cLabel && cLabel.toLowerCase() !== itemName) {
                                parts.push(cLabel);
                            }
                            const cKet = clean(c.keterangan);
                            if (cKet && cKet.toLowerCase() !== itemName && !parts.includes(cKet) && !isAggregateText(cKet)) {
                                parts.push(cKet);
                            }
                            const cSarpras = clean(c.sarprasNotes);
                            if (cSarpras && cSarpras.toLowerCase() !== itemName && !parts.includes(cSarpras)) {
                                parts.push(cSarpras);
                            }
                            const cRoom = clean(c.assetRoom);
                            if (cRoom) {
                                parts.push(`Ruang/Lokasi: ${cRoom}`);
                            }
                            const cAsset = clean(c.assetName || c.namaAset);
                            if (cAsset && cAsset.toLowerCase() !== itemName && !parts.includes(cAsset)) {
                                parts.push(cAsset);
                            }
                            const cDesc = clean(c.description);
                            if (cDesc && 
                                cDesc.toLowerCase() !== itemName && 
                                cDesc !== clean(p.description) && 
                                !parts.includes(cDesc) && 
                                !isAggregateText(cDesc)) {
                                parts.push(cDesc);
                            }

                            if (parts.length > 0) return parts.join(' • ');
                            return ''; // Matched specific component, but component has no extra notes
                        }
                    }
                }
            }
        }
    }

    return '';
};

