import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Building2, Layers, Download, FileSpreadsheet, Gem } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatRupiah } from '../../utils/format';
import * as XLSX from 'xlsx';
import BudgetRow from '../../components/BudgetRow';

export default function BudgetDashboard() {
    const { state, dispatch } = useApp();
    const { 
        currentUser, 
        students = [], 
        units = [], 
        fields = [], 
        expenseItems = [], 
        distributionSettings = [], 
        studentStatuses = [],
        budgets = [],
        academicYears = [],
        rabPlans = [],
        budgetShifts = [],
        bosAllocations = []
    } = state;

    // Global Academic Year Persistence (ID-based)
    const selectedAcademicYearId = state.globalAcademicYearId || '';
    const setSelectedAcademicYearId = (id) => dispatch({ type: 'SET_GLOBAL_YEAR', payload: id });
    
    const activeAcademicYear = useMemo(() => {
        return academicYears.find(y => y.id === selectedAcademicYearId && !y.isDeleted);
    }, [academicYears, selectedAcademicYearId]);
    
    // For display/logic compatibility
    const selectedAcademicYearName = activeAcademicYear?.name || '';

    const [expandedUnits, setExpandedUnits] = useState({});
    const [expandedBosUnits, setExpandedBosUnits] = useState({});
    const toggleBosUnit = (id) => setExpandedBosUnits(prev => ({ ...prev, [id]: !prev[id] }));
    const [expandedFields, setExpandedFields] = useState({});

    const toggleUnit = (id) => {
        setExpandedUnits(prev => ({ ...prev, [id]: !prev[id] }));
    };
    const toggleField = (id) => {
        setExpandedFields(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const [expandedDetailItems, setExpandedDetailItems] = useState({}); // Stores fieldId-exId
    const [sourceMode, setSourceMode] = useState('YAYASAN'); // 'YAYASAN' or 'BOS'

    const toggleDetailItem = (parentId, itemId) => {
        const key = `${parentId}|${itemId}`;
        setExpandedDetailItems(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const [activePopover, setActivePopover] = useState(null); // { id, name, breakdown, x, y }

    const handlePopoverMouseMove = (e, item) => {
        const xOffset = 20;
        const yOffset = -50;
        let x = e.clientX + xOffset;
        let y = e.clientY + yOffset;
        
        // Adjust if popover would overflow the window width
        if (x + 560 > window.innerWidth) {
            x = e.clientX - 580; // place to the left of the cursor
        }
        
        // Adjust if popover would overflow the window height
        if (y + 350 > window.innerHeight) {
            y = window.innerHeight - 360;
        }
        if (y < 10) y = 10;

        setActivePopover({
            id: item.id,
            name: item.name,
            breakdown: item.breakdown || [],
            x,
            y
        });
    };

    const handlePopoverMouseLeave = () => {
        setActivePopover(null);
    };

    // ========== ENGINE: RAP (Rencana Anggaran Pendapatan) ==========
    const { unitRAP, fieldRAP, totalMurni } = useMemo(() => {
        const uRAP = {};
        const fRAP = {};
        units.filter(u => !u.isDeleted).forEach(u => uRAP[u.id] = { total: 0, items: {} });
        fields.filter(f => !f.isDeleted).forEach(f => fRAP[f.id] = { total: 0, items: {} });

        const nonActiveStatusNames = ['alumni', 'pindah', 'dikeluarkan', 'cuti', 'non aktif'];
        const activeStudents = students.filter(s => {
            if (s.isDeleted) return false;
            const statusName = (s.status?.name || '').toLowerCase();
            if (nonActiveStatusNames.includes(statusName)) return false;
            return (activeAcademicYear ? s.academicYearId === activeAcademicYear.id : true);
        });

        activeStudents.forEach(student => {
            if (!student.unitId || !uRAP[student.unitId]) return;
            
            student.incomeDetails?.forEach(detail => {
                const amount = parseFloat(detail.amount) || 0;
                if (amount <= 0) return;

                const rawRules = distributionSettings.filter(
                    s => s.unitId === student.unitId && s.incomeItemId === detail.incomeItemId
                );

                // DEDUPLICATION ON-THE-FLY: Ensure we don't apply the same rule twice
                const seenRules = new Set();
                const rules = rawRules.filter(r => {
                    const key = `${r.destId}-${r.destType}-${r.expenseItemId}-${r.percentage}`;
                    if (seenRules.has(key)) return false;
                    seenRules.add(key);
                    return true;
                });

                if (rules.length === 0) {
                    uRAP[student.unitId].total += amount;
                    const exId = 'unallocated';
                    uRAP[student.unitId].items[exId] = (uRAP[student.unitId].items[exId] || 0) + amount;
                } else {
                    rules.forEach(rule => {
                        const percent = parseFloat(rule.percentage) || 0;
                        const share = amount * (percent / 100);
                        if (share <= 0) return;

                        const exItem = expenseItems.find(e => e.id === rule.expenseItemId);
                        const itemName = (exItem?.name || getExpenseName(rule.expenseItemId) || '').toLowerCase().trim();
                        
                        // SMART GUARD: Exclude Field-only keywords and explicit Field ownership
                        const isFieldItem = (exItem && exItem.fieldId && !exItem.unitId) || 
                                           itemName.includes('penggajian') || 
                                           itemName.includes('pengembangan (umum)') ||
                                           itemName.includes('honor') ||
                                           itemName.includes('yayasan');
                                           
                        const effectiveDestType = isFieldItem ? 'field' : rule.destType;
                        // Use item's fieldId if it's a field item and rule.destId is not a field
                        const targetFieldId = isFieldItem ? (exItem?.fieldId || (rule.destType === 'field' ? rule.destId : fields[0]?.id)) : rule.destId;

                        if (effectiveDestType === 'unit') {
                            uRAP[student.unitId].total += share;
                            const exId = rule.expenseItemId || 'unallocated';
                            uRAP[student.unitId].items[exId] = (uRAP[student.unitId].items[exId] || 0) + share;
                        } else if (effectiveDestType === 'field') {
                            if (targetFieldId && fRAP[targetFieldId]) {
                                fRAP[targetFieldId].total += share;
                                const exId = rule.expenseItemId || 'unallocated';
                                if (!fRAP[targetFieldId].items[exId]) {
                                    fRAP[targetFieldId].items[exId] = { total: 0, sources: {} };
                                }
                                fRAP[targetFieldId].items[exId].total += share;
                                fRAP[targetFieldId].items[exId].sources[student.unitId] = 
                                    (fRAP[targetFieldId].items[exId].sources[student.unitId] || 0) + share;
                            }
                        }
                    });
                }
            });
        });

        const totalMurni = activeStudents.reduce((sum, s) => {
            return sum + (s.incomeDetails?.reduce((s2, d) => s2 + (parseFloat(d.amount) || 0), 0) || 0);
        }, 0);

        return { unitRAP: uRAP, fieldRAP: fRAP, totalMurni };
    }, [students, units, fields, distributionSettings, studentStatuses, currentUser, activeAcademicYear, expenseItems]);

    // ========== ENGINE: RAB (Rencana Anggaran Belanja) ==========
    const { unitRAB, fieldRAB } = useMemo(() => {
        const uRAB = {};
        const fRAB = {};
        units.filter(u => !u.isDeleted).forEach(u => uRAB[u.id] = { total: 0, items: {} });
        fields.filter(f => !f.isDeleted).forEach(f => fRAB[f.id] = { total: 0, items: {} });

        // 1. Process Consolidated RAB Plans (The Master Budget Source)
        // BUG FIX: Only use this as the single source for RAB to avoid double counting with requests
        rabPlans.filter(p => p.academicYearId === selectedAcademicYearId && !p.id.includes('-REVISION-')).forEach(plan => {
            Object.keys(plan.expense || {}).forEach(exId => {
                const rawItemPlans = plan.expense[exId];
                const itemPlans = Array.isArray(rawItemPlans)
                    ? rawItemPlans
                    : (rawItemPlans && typeof rawItemPlans === 'object' && Object.keys(rawItemPlans).length > 0 ? [rawItemPlans] : []);

                let amount = 0;
                itemPlans.forEach(p => {
                    if (p.components && p.components.length > 0) {
                        // New Granular Approval System: Sum only approved components
                        p.components.forEach(comp => {
                            const isApproved = (comp.status === 'APPROVED' || (!comp.status && comp.isApproved === true)) &&
                                comp.status !== 'PENDING' && comp.status !== 'DRAFT' && comp.status !== 'REJECTED' &&
                                (!comp.isAsset || comp.sarprasStatus === 'APPROVED');
                            if (isApproved) {
                                const compTotal = parseFloat(comp.total) || 0;
                                const useBos = comp.useBos || false;
                                const bosAmount = parseFloat(comp.bosAmount) || 0;
                                
                                // General RAB (Foundation) = Total - BOS Amount
                                const bosPortion = useBos ? (bosAmount > 0 ? bosAmount : compTotal) : 0;
                                amount += compTotal - bosPortion;
                            }
                        });
                    } else {
                        // Legacy/Fallback Plan Status System
                        const isApproved = plan.status === 'APPROVED' || p.status === 'APPROVED' || p.isApproved === true;
                        if (isApproved) {
                            const total = parseFloat(p.total) || 0;
                            const useBos = p.useBos || false;
                            const bosAmount = parseFloat(p.bosAmount) || 0;
                            const bosPortion = useBos ? (bosAmount > 0 ? bosAmount : total) : 0;
                            amount += total - bosPortion;
                        }
                    }
                });

                if (amount <= 0) return;

                const exItem = expenseItems.find(e => e.id === exId);
                const itemName = (exItem?.name || getExpenseName(exId) || '').toLowerCase().trim();

                const isFieldItem = (exItem && exItem.fieldId && !exItem.unitId) || 
                                   itemName.includes('penggajian') || 
                                   itemName.includes('pengembangan (umum)') ||
                                   itemName.includes('honor') ||
                                   itemName.includes('yayasan');

                const targetFieldId = isFieldItem ? (exItem?.fieldId || plan.fieldId || fields[0]?.id) : plan.fieldId;

                if (!isFieldItem && plan.unitId && uRAB[plan.unitId]) {
                    uRAB[plan.unitId].total += amount;
                    uRAB[plan.unitId].items[exId] = (uRAB[plan.unitId].items[exId] || 0) + amount;
                } else if (targetFieldId && fRAB[targetFieldId]) {
                    fRAB[targetFieldId].total += amount;
                    if (!fRAB[targetFieldId].items[exId]) {
                        fRAB[targetFieldId].items[exId] = { total: 0, sources: {} };
                    }
                    const fItem = fRAB[targetFieldId].items[exId];
                    if (typeof fItem === 'number') {
                        fRAB[targetFieldId].items[exId] = { total: fItem + amount, sources: {} };
                    } else {
                        fItem.total += amount;
                        if (plan.unitId) {
                            fItem.sources[plan.unitId] = (fItem.sources[plan.unitId] || 0) + amount;
                        }
                    }
                }
            });
        });

        // 2. Apply Approved/Applied Budget Shifts
        (budgetShifts || []).filter(s => 
            !s.isDeleted && 
            s.academicYearId === selectedAcademicYearId && 
            (s.status === 'APPROVED' || s.status === 'APPLIED')
        ).forEach(shift => {
            const shiftAmt = parseFloat(shift.amount) || 0;
            if (shiftAmt <= 0) return;

            // Deduct from source pos
            if (shift.fromUnitId && shift.fromExpenseItemId && uRAB[shift.fromUnitId]) {
                uRAB[shift.fromUnitId].total -= shiftAmt;
                uRAB[shift.fromUnitId].items[shift.fromExpenseItemId] = 
                    (uRAB[shift.fromUnitId].items[shift.fromExpenseItemId] || 0) - shiftAmt;
            } else if (shift.fromFieldId && shift.fromExpenseItemId && fRAB[shift.fromFieldId]) {
                fRAB[shift.fromFieldId].total -= shiftAmt;
                if (fRAB[shift.fromFieldId].items[shift.fromExpenseItemId]) {
                    fRAB[shift.fromFieldId].items[shift.fromExpenseItemId].total -= shiftAmt;
                }
            }

            // Add to destination pos
            if (shift.toUnitId && shift.toExpenseItemId && uRAB[shift.toUnitId]) {
                uRAB[shift.toUnitId].total += shiftAmt;
                uRAB[shift.toUnitId].items[shift.toExpenseItemId] = 
                    (uRAB[shift.toUnitId].items[shift.toExpenseItemId] || 0) + shiftAmt;
            } else if (shift.toFieldId && shift.toExpenseItemId && fRAB[shift.toFieldId]) {
                fRAB[shift.toFieldId].total += shiftAmt;
                if (fRAB[shift.toFieldId].items[shift.toExpenseItemId]) {
                    fRAB[shift.toFieldId].items[shift.toExpenseItemId].total += shiftAmt;
                }
            }
        });

        // NOTE: Budget Requests removed from RAB total to avoid duplicate info as requested.
        // If needed for "Realisasi", a separate engine/column should be added later.

        return { unitRAB: uRAB, fieldRAB: fRAB };
    }, [rabPlans, budgetShifts, units, fields, currentUser, selectedAcademicYearId, expenseItems, selectedAcademicYearName]);

    // ========== Helpers ==========
    const getExpenseName = (id) => {
        if (id === 'unallocated') return 'Belum Dialokasikan';
        if (id === 'other') return 'Lainnya';
        const ex = expenseItems.find(e => e.id === id);
        return ex ? ex.name : 'Pos Tidak Ditemukan';
    };

    const getUnitName = (id) => {
        const u = units.find(u => u.id === id);
        return u ? u.name : 'Unknown';
    };

    const formatCurrency = (val) => {
        const num = parseFloat(val) || 0;
        return `Rp. ${num.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    };

    // ========== Build Display Data ==========
    const unitData = useMemo(() => {
        return units.filter(u => !u.isDeleted).map(u => {
            if (currentUser?.role === 'admin_unit' && u.id !== currentUser.unitId) return null;
            
            const rawItems = unitRAP[u.id]?.items || {};
            const rawRabItems = unitRAB[u.id]?.items || {};
            const allKeys = new Set([...Object.keys(rawItems), ...Object.keys(rawRabItems)]);
            
            const breakdown = [];
            allKeys.forEach(exId => {
                const exItem = expenseItems.find(e => e.id === exId);
                const itemName = (exItem?.name || getExpenseName(exId) || '').toLowerCase().trim();
                
                // ULTIMATE FILTER: Strictly block Field items from Unit breakdown
                const isFieldItem = (exItem && exItem.fieldId && !exItem.unitId) || 
                                   itemName.includes('penggajian') || 
                                   itemName.includes('pengembangan (umum)') ||
                                   itemName.includes('honor') ||
                                   itemName.includes('yayasan');
                
                if (isFieldItem) return;

                const itemRAP = rawItems[exId] || 0;
                const itemRAB = rawRabItems[exId] || 0;
                if (itemRAP === 0 && itemRAB === 0) return;

                breakdown.push({
                    id: exId,
                    name: getExpenseName(exId),
                    rap: itemRAP,
                    rab: itemRAB,
                    sisa: itemRAP - itemRAB
                });
            });

            // Recalculate Totals based ONLY on visible breakdown items for consistency
            const totalRAP = breakdown.reduce((sum, item) => sum + item.rap, 0);
            const totalRAB = breakdown.reduce((sum, item) => sum + item.rab, 0);

            return { 
                id: u.id, 
                name: u.name, 
                rap: totalRAP, 
                rab: totalRAB, 
                sisa: totalRAP - totalRAB, 
                breakdown 
            };
        }).filter(Boolean).sort((a, b) => b.rap - a.rap);
    }, [units, unitRAP, unitRAB, currentUser, expenseItems, fields]);
    
    // ========== ENGINE: BOS (Bantuan Operasional Sekolah) ==========
    const bosUnitData = useMemo(() => {
        const uBosRAP = {};
        const uBosRAB = {};
        units.forEach(u => {
            uBosRAP[u.id] = 0;
            uBosRAB[u.id] = 0;
        });

        // RAP BOS (Allocations)
        bosAllocations?.forEach(alloc => {
            if (alloc.academicYearId === selectedAcademicYearId && !alloc.isDeleted) {
                if (uBosRAP[alloc.unitId] !== undefined) {
                    uBosRAP[alloc.unitId] += (parseFloat(alloc.amount) || 0);
                }
            }
        });

        // RAB BOS (Expenses)
        rabPlans?.filter(p => !p.id.includes('-REVISION-')).forEach(plan => {
            if (plan.academicYearId === selectedAcademicYearId && plan.status === 'APPROVED') {
                Object.keys(plan.expense || {}).forEach(exId => {
                    const rawItemPlans = plan.expense[exId];
                    const itemPlans = Array.isArray(rawItemPlans)
                        ? rawItemPlans
                        : (rawItemPlans && typeof rawItemPlans === 'object' && Object.keys(rawItemPlans).length > 0 ? [rawItemPlans] : []);

                    let bosAmount = 0;
                    itemPlans.forEach(p => {
                        if (p.components && p.components.length > 0) {
                            p.components.forEach(comp => {
                                const isApproved = (comp.status === 'APPROVED' || (!comp.status && comp.isApproved === true)) &&
                                    comp.status !== 'PENDING' && comp.status !== 'DRAFT' && comp.status !== 'REJECTED' &&
                                    (!comp.isAsset || comp.sarprasStatus === 'APPROVED');
                                if (isApproved && comp.useBos) {
                                    const compTotal = parseFloat(comp.total) || 0;
                                    const cBos = parseFloat(comp.bosAmount) || 0;
                                    bosAmount += cBos > 0 ? cBos : compTotal;
                                }
                            });
                        } else {
                            const isApproved = plan.status === 'APPROVED' || p.status === 'APPROVED' || p.isApproved === true;
                            if (isApproved && p.useBos) {
                                const total = parseFloat(p.total) || 0;
                                const pBos = parseFloat(p.bosAmount) || 0;
                                bosAmount += pBos > 0 ? pBos : total;
                            }
                        }
                    });

                    if (bosAmount > 0 && plan.unitId) {
                        if (uBosRAB[plan.unitId] !== undefined) {
                            uBosRAB[plan.unitId] += bosAmount;
                        }
                    }
                });
            }
        });

        return units.filter(u => !u.isDeleted).map(u => {
            if (currentUser?.role === 'admin_unit' && u.id !== currentUser.unitId) return null;
            const rap = uBosRAP[u.id] || 0;
            const rab = uBosRAB[u.id] || 0;
            if (rap === 0 && rab === 0) return null;

            // Build per-item breakdown from bosAllocations
            const unitAllocations = (bosAllocations || []).filter(a =>
                a.unitId === u.id && a.academicYearId === selectedAcademicYearId && !a.isDeleted
            );
            const plan = (rabPlans || []).find(p =>
                p.unitId === u.id && p.academicYearId === selectedAcademicYearId && p.status === 'APPROVED' && !p.id.includes('-REVISION-')
            );
            const breakdown = unitAllocations.map(alloc => {
                const exItem = expenseItems.find(e => e.id === alloc.expenseItemId);
                
                // Calculate itemRab based on approved components/plans
                const rawItemPlans = plan?.expense?.[alloc.expenseItemId];
                const itemPlans = Array.isArray(rawItemPlans)
                    ? rawItemPlans
                    : (rawItemPlans && typeof rawItemPlans === 'object' && Object.keys(rawItemPlans).length > 0 ? [rawItemPlans] : []);

                let itemRab = 0;
                itemPlans.forEach(p => {
                    if (p.components && p.components.length > 0) {
                        p.components.forEach(comp => {
                            const isApproved = (comp.status === 'APPROVED' || (!comp.status && comp.isApproved === true)) &&
                                comp.status !== 'PENDING' && comp.status !== 'DRAFT' && comp.status !== 'REJECTED' &&
                                (!comp.isAsset || comp.sarprasStatus === 'APPROVED');
                            if (isApproved && comp.useBos) {
                                const compTotal = parseFloat(comp.total) || 0;
                                const cBos = parseFloat(comp.bosAmount) || 0;
                                itemRab += cBos > 0 ? cBos : compTotal;
                            }
                        });
                    } else {
                        const isApproved = plan?.status === 'APPROVED' || p.status === 'APPROVED' || p.isApproved === true;
                        if (isApproved && p.useBos) {
                            const total = parseFloat(p.total) || 0;
                            const pBos = parseFloat(p.bosAmount) || 0;
                            itemRab += pBos > 0 ? pBos : total;
                        }
                    }
                });

                const itemRap = parseFloat(alloc.amount) || 0;
                return {
                    id: alloc.id || alloc.expenseItemId,
                    name: exItem?.name || alloc.expenseItemId,
                    rap: itemRap,
                    rab: itemRab,
                    sisa: itemRap - itemRab
                };
            });
            
            return { id: u.id, name: u.name, rap, rab, sisa: rap - rab, breakdown };
        }).filter(Boolean).sort((a, b) => b.rap - a.rap);
    }, [units, bosAllocations, rabPlans, expenseItems, currentUser, selectedAcademicYearId]);

    const totalBosUnitRAP = bosUnitData.reduce((s, u) => s + u.rap, 0);
    const totalBosUnitRAB = bosUnitData.reduce((s, u) => s + u.rab, 0);
    const totalBosUnitSisa = totalBosUnitRAP - totalBosUnitRAB;

    const bidangData = useMemo(() => {
        return fields.filter(f => !f.isDeleted).map(f => {
            if (currentUser?.role === 'admin_bidang' && f.id !== currentUser.fieldId) return null;
            
            // SPECIAL CASE: Bidang Pendidikan consolidates all Educational Units
            if (f.name === 'Bidang Pendidikan') {
                const rap = unitData.reduce((s, u) => s + u.rap, 0);
                const rab = unitData.reduce((s, u) => s + u.rab, 0);
                return {
                    id: f.id,
                    name: f.name,
                    rap,
                    rab,
                    sisa: rap - rab,
                    breakdown: unitData.map(u => ({
                        id: u.id,
                        name: u.name,
                        rap: u.rap,
                        rab: u.rab,
                        sisa: u.sisa
                    }))
                };
            }

            const rap = fieldRAP[f.id]?.total || 0;
            const rab = fieldRAB[f.id]?.total || 0;
            const sisa = rap - rab;
            const items = fieldRAP[f.id]?.items || {};
            const rabItems = fieldRAB[f.id]?.items || {};
            
            const allKeys = new Set([...Object.keys(items), ...Object.keys(rabItems)]);
            const breakdown = [];
            allKeys.forEach(exId => {
                const itemRAP = typeof items[exId] === 'object' ? items[exId].total : (items[exId] || 0);
                const itemRAB = typeof rabItems[exId] === 'object' ? rabItems[exId].total : (rabItems[exId] || 0);
                if (itemRAP === 0 && itemRAB === 0) return;

                breakdown.push({
                    id: exId,
                    name: getExpenseName(exId),
                    rap: itemRAP,
                    rab: itemRAB,
                    sisa: itemRAP - itemRAB,
                    sources: typeof items[exId] === 'object' ? items[exId].sources : {}
                });
            });

            return { id: f.id, name: f.name, rap, rab, sisa, breakdown };
        }).filter(Boolean).sort((a, b) => b.rap - a.rap);
    }, [fields, fieldRAP, fieldRAB, currentUser, expenseItems, unitData]);

    // ========== Totals ==========
    // Use totalMurni for Superadmin/Yayasan, but sum visible data for others to ensure totals match visible rows
    const isSuperAdmin = currentUser?.role === 'superadmin' || currentUser?.role === 'yayasan';
    
    const totalBidangRAP = isSuperAdmin ? (totalMurni || 0) : bidangData.reduce((s, d) => s + d.rap, 0);
    const totalBidangRAB = bidangData.reduce((s, d) => s + d.rab, 0);
    const totalBidangSisa = totalBidangRAP - totalBidangRAB;

    const totalUnitRAP = isSuperAdmin ? (totalMurni || 0) : unitData.reduce((s, d) => s + d.rap, 0);
    const totalUnitRAB = unitData.reduce((s, d) => s + d.rab, 0);
    const totalUnitSisa = totalUnitRAP - totalUnitRAB;

    // ========== Export to Excel (Bahasa Indonesia) ==========
    const exportToExcel = () => {
        const wb = XLSX.utils.book_new();

        // Bidang Sheet
        if (currentUser?.role !== 'admin_unit') {
            const bidangRows = [];
            bidangData.forEach(b => {
                bidangRows.push({ Nama: b.name, RAP: b.rap, RAB: b.rab, 'Sisa Anggaran': b.sisa });
                b.breakdown.forEach(item => {
                    bidangRows.push({ Nama: `  └ ${item.name}`, RAP: item.rap, RAB: item.rab, 'Sisa Anggaran': item.sisa });
                    if (item.sources && Object.keys(item.sources).length > 0) {
                        Object.entries(item.sources).forEach(([unitId, amount]) => {
                            bidangRows.push({ 
                                Nama: `    • ${getUnitName(unitId)}`, 
                                RAP: amount, 
                                RAB: '', 
                                'Sisa Anggaran': '' 
                            });
                        });
                    }
                });
            });
            const bidangLabel = (currentUser?.role === 'admin_bidang' || currentUser?.role === 'admin_unit') ? 'TOTAL KESELURUHAN' : 'TOTAL';
            bidangRows.push({ Nama: bidangLabel, RAP: totalBidangRAP, RAB: totalBidangRAB, 'Sisa Anggaran': totalBidangSisa });
            const ws1 = XLSX.utils.json_to_sheet(bidangRows);
            XLSX.utils.book_append_sheet(wb, ws1, 'Bidang');
        }

        // Unit Sheet
        if (currentUser?.role !== 'admin_bidang') {
            const unitRows = [];
            unitData.forEach(u => {
                unitRows.push({ Nama: u.name, RAP: u.rap, RAB: u.rab, 'Sisa Anggaran': u.sisa });
                u.breakdown.forEach(item => {
                    unitRows.push({ Nama: `  └ ${item.name}`, RAP: item.rap, RAB: item.rab, 'Sisa Anggaran': item.sisa });
                });
            });
            const unitLabel = (currentUser?.role === 'admin_bidang' || currentUser?.role === 'admin_unit') ? 'TOTAL KESELURUHAN' : 'TOTAL';
            unitRows.push({ Nama: unitLabel, RAP: totalUnitRAP, RAB: totalUnitRAB, 'Sisa Anggaran': totalUnitSisa });
            const ws2 = XLSX.utils.json_to_sheet(unitRows);
            XLSX.utils.book_append_sheet(wb, ws2, 'Unit');
        }

        XLSX.writeFile(wb, `Dasbor-Anggaran-${selectedAcademicYearName}.xlsx`);
    };

    // BudgetRow local definition removed. Using shared component.


    return (
        <div className="p-4 md:p-7 animate-in pb-20 max-w-[1600px] mx-auto">
            {/* ===== HEADER & CONTROLS ===== */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8 pt-10 md:pt-0">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-[#13261E] tracking-tight">Dashboard Anggaran</h2>
                    <div className="flex flex-wrap items-center gap-3 mt-1">
                        <p className="text-[#6B7E75] text-xs sm:text-sm font-medium">Konsolidasi rencana pendapatan dan belanja {sourceMode === 'YAYASAN' ? 'Yayasan' : 'BOS'}</p>
                        {sourceMode === 'YAYASAN' && isSuperAdmin && (
                            <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-white rounded-full border border-[#DCE5DF] shadow-2xs">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#157A52]"></div>
                                <span className="text-[10px] font-bold text-[#5C6F66] uppercase tracking-wider tabular-nums">Base: {formatCurrency(totalMurni || 0)}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    {/* Source Selector */}
                    <div className="flex bg-[#EEF3F0] p-1 rounded-xl border border-[#DCE5DF]">
                        <button
                            onClick={() => setSourceMode('YAYASAN')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${sourceMode === 'YAYASAN' ? 'bg-white text-[#244E82] shadow-xs border border-[#DCE5F2]' : 'text-[#6B7E75] hover:text-[#13261E]'}`}
                        >
                            <Building2 size={14} />
                            Dana Yayasan
                        </button>
                        {(currentUser?.role !== 'admin_bidang' || currentUser?.role === 'superadmin') && (
                            <button
                                onClick={() => setSourceMode('BOS')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${sourceMode === 'BOS' ? 'bg-white text-[#157A52] shadow-xs border border-[#DCEAE3]' : 'text-[#6B7E75] hover:text-[#13261E]'}`}
                            >
                                <Gem size={14} />
                                Dana BOS
                            </button>
                        )}
                    </div>

                    <select
                        value={selectedAcademicYearId}
                        onChange={(e) => setSelectedAcademicYearId(e.target.value)}
                        className="px-3.5 py-2.5 bg-white border border-[#DCE5DF] rounded-xl font-bold text-xs text-[#13261E] tracking-wide focus:ring-2 focus:ring-[#157A52]/20 focus:border-[#157A52] outline-none transition-all shadow-2xs"
                    >
                        {academicYears.filter(a => !a.isDeleted && (a.isActive || a.id === selectedAcademicYearId))
                            .sort((a, b) => b.name.localeCompare(a.name))
                            .map(y => (
                                <option key={y.id} value={y.id}>{y.name}</option>
                            ))}
                    </select>

                    <button
                        onClick={exportToExcel}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-[#F7FAF8] text-[#13261E] border border-[#DCE5DF] rounded-xl font-bold text-xs shadow-2xs transition-all cursor-pointer"
                    >
                        <FileSpreadsheet size={15} className="text-[#157A52]" />
                        <span>Cetak Laporan Excel</span>
                    </button>
                </div>
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                {sourceMode === 'YAYASAN' ? (
                    <>
            {/* ===== BIDANG TABLE (Gradasi Cobalt Steel Blue) ===== */}
            {currentUser?.role !== 'admin_unit' && (
                <div className="budget-table-wrapper mb-8 bg-white rounded-2xl border border-[#DCE5F2] shadow-xs overflow-hidden animate-in">
                    <div className="budget-table-title bg-gradient-to-r from-[#1C375B] via-[#265187] to-[#2E69A8] text-white px-5 py-3.5 flex items-center gap-3">
                        <span className="w-8 h-8 rounded-lg bg-white/15 border border-white/20 text-sky-100 flex items-center justify-center shrink-0">
                            <Layers size={16} />
                        </span>
                        <div>
                            <span className="text-sm font-bold text-white tracking-tight block">Ringkasan Per Bidang</span>
                            <span className="text-[11px] font-medium text-sky-100/80">Konsolidasi alokasi pendapatan &amp; rencana belanja per bidang</span>
                        </div>
                    </div>
                    <div className="budget-table-scroll">
                        <table className="budget-table">
                            <thead>
                                <tr>
                                    <th className="budget-th budget-th-name">NAMA BIDANG</th>
                                    <th className="budget-th budget-th-number">RAP (PENDAPATAN)</th>
                                    <th className="budget-th budget-th-number">RAB (BELANJA)</th>
                                    <th className="budget-th budget-th-number">SISA ANGGARAN</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bidangData.length > 0 ? (
                                    <>
                                        {bidangData.map(b => (
                                            <BudgetRow
                                                key={b.id}
                                                data={b}
                                                isExpanded={!!expandedFields[b.id]}
                                                onToggle={() => toggleField(b.id)}
                                                formatCurrency={formatRupiah}
                                                expandedDetailItems={expandedDetailItems}
                                                onToggleDetailItem={toggleDetailItem}
                                                isField={true}
                                                getUnitName={getUnitName}
                                            />
                                        ))}
                                        <tr className="budget-row-total bg-[#F3F7FC]">
                                            <td className="budget-cell budget-cell-name font-bold text-xs text-[#1C375B] uppercase tracking-wider">
                                                {(currentUser?.role === 'admin_bidang' || currentUser?.role === 'admin_unit') ? 'Total Keseluruhan' : 'Total Konsolidasi Bidang'}
                                            </td>
                                            <td className="budget-cell budget-cell-number font-bold text-[#13261E] border-l border-[#DCE5F2] tabular-nums">{formatCurrency(totalBidangRAP)}</td>
                                            <td className="budget-cell budget-cell-number font-bold text-[#13261E] tabular-nums">{formatCurrency(totalBidangRAB)}</td>
                                            <td className="budget-cell budget-cell-number budget-cell-sisa bg-[#EBF3FD] text-[#244E82] font-bold tabular-nums">{formatCurrency(totalBidangSisa)}</td>
                                        </tr>
                                    </>
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="text-center py-16 text-[#8DA096] font-semibold uppercase tracking-widest text-[10px]">
                                            Belum ada data bidang untuk periode ini.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ===== UNIT TABLE (Calm Ferna Sage & Emerald Theme) ===== */}
            {currentUser?.role !== 'admin_bidang' && (
                <div className="budget-table-wrapper bg-white rounded-2xl border border-[#E4EAE6] shadow-xs overflow-hidden animate-in">
                    <div className="budget-table-title bg-gradient-to-r from-[#114C35] via-[#157A52] to-[#218E63] text-white px-5 py-3.5 flex items-center gap-3">
                        <span className="w-8 h-8 rounded-lg bg-white/15 border border-white/20 text-emerald-100 flex items-center justify-center shrink-0">
                            <Building2 size={16} />
                        </span>
                        <div>
                            <span className="text-sm font-bold text-white tracking-tight block">Ringkasan Per Unit</span>
                            <span className="text-[11px] font-medium text-emerald-100/80">Rincian alokasi pendapatan &amp; belanja masing-masing unit</span>
                        </div>
                    </div>
                    <div className="budget-table-scroll">
                        <table className="budget-table">
                            <thead>
                                <tr>
                                    <th className="budget-th budget-th-name">NAMA UNIT</th>
                                    <th className="budget-th budget-th-number">RAP (PENDAPATAN)</th>
                                    <th className="budget-th budget-th-number">RAB (BELANJA)</th>
                                    <th className="budget-th budget-th-number">SISA ANGGARAN</th>
                                </tr>
                            </thead>
                            <tbody>
                                {unitData.length > 0 ? (
                                    <>
                                        {unitData.map(u => (
                                            <BudgetRow
                                                key={u.id}
                                                data={u}
                                                isExpanded={!!expandedUnits[u.id]}
                                                onToggle={() => toggleUnit(u.id)}
                                                formatCurrency={formatRupiah}
                                                expandedDetailItems={expandedDetailItems}
                                                onToggleDetailItem={toggleDetailItem}
                                            />
                                        ))}
                                        <tr className="budget-row-total bg-[#F2F6F4]">
                                            <td className="budget-cell budget-cell-name font-bold text-xs text-[#13261E] uppercase tracking-wider">
                                                {(currentUser?.role === 'admin_bidang' || currentUser?.role === 'admin_unit') ? 'Total Keseluruhan' : 'Total Konsolidasi Unit'}
                                            </td>
                                            <td className="budget-cell budget-cell-number font-bold text-[#13261E] border-l border-[#E3E9E5] tabular-nums">{formatCurrency(totalUnitRAP)}</td>
                                            <td className="budget-cell budget-cell-number font-bold text-[#13261E] tabular-nums">{formatCurrency(totalUnitRAB)}</td>
                                            <td className="budget-cell budget-cell-number budget-cell-sisa bg-[#E9F5EF]/70 text-[#157A52] font-bold tabular-nums">{formatCurrency(totalUnitSisa)}</td>
                                        </tr>
                                    </>
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="text-center py-16 text-[#8DA096] font-semibold uppercase tracking-widest text-[10px]">
                                            Belum ada data unit untuk periode ini.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
                    </>
                ) : (
                    <>
            {/* ===== BOS TABLE (Calm Ferna Sage & Emerald Theme) ===== */}
            {currentUser?.role !== 'admin_bidang' && bosUnitData.length > 0 && (
                <div className="budget-table-wrapper mt-8 bg-white rounded-2xl border border-[#E4EAE6] shadow-xs overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
                    <div className="budget-table-title bg-gradient-to-r from-[#0F525C] via-[#177E89] to-[#1FA19B] text-white px-5 py-3.5 flex items-center gap-3">
                        <span className="w-8 h-8 rounded-lg bg-white/15 border border-white/20 text-cyan-100 flex items-center justify-center shrink-0">
                            <Gem size={16} />
                        </span>
                        <div>
                            <span className="text-sm font-bold text-white tracking-tight block">Ringkasan BOS Per Unit</span>
                            <span className="text-[11px] font-medium text-cyan-100/80">Konsolidasi alokasi &amp; rencana belanja Dana BOS per unit</span>
                        </div>
                    </div>
                    <div className="budget-table-scroll">
                        <table className="budget-table">
                            <thead>
                                <tr>
                                    <th className="budget-th budget-th-name">NAMA UNIT</th>
                                    <th className="budget-th budget-th-number">RAP BOS (ALOKASI)</th>
                                    <th className="budget-th budget-th-number">RAB BOS (RENCANA)</th>
                                    <th className="budget-th budget-th-number">SISA BOS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bosUnitData.map(u => (
                                    <BudgetRow
                                        key={u.id}
                                        data={u}
                                        isExpanded={!!expandedBosUnits[u.id]}
                                        onToggle={() => toggleBosUnit(u.id)}
                                        formatCurrency={formatRupiah}
                                        expandedDetailItems={expandedDetailItems}
                                        onToggleDetailItem={toggleDetailItem}
                                        isBos={true}
                                    />
                                ))}
                                <tr className="budget-row-total bg-[#F2F6F4]">
                                    <td className="budget-cell budget-cell-name font-bold text-xs text-[#13261E] uppercase tracking-wider">Total Konsolidasi BOS</td>
                                    <td className="budget-cell budget-cell-number font-bold text-[#13261E] border-l border-[#E3E9E5] tabular-nums">{formatCurrency(totalBosUnitRAP)}</td>
                                    <td className="budget-cell budget-cell-number font-bold text-[#13261E] tabular-nums">{formatCurrency(totalBosUnitRAB)}</td>
                                    <td className="budget-cell budget-cell-number budget-cell-sisa bg-[#E9F5EF]/70 text-[#157A52] font-bold tabular-nums">{formatCurrency(totalBosUnitSisa)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
                    </>
                )}
            </div>

            <div className="mt-16 text-center">
                <div className="inline-block px-6 py-2 bg-white border border-[#E4EAE6] rounded-full shadow-2xs">
                    <p className="text-[10px] font-bold text-[#8DA096] uppercase tracking-[0.25em]">
                        Sistem Keuangan Dareliman — SIKAD
                    </p>
                </div>
            </div>


        </div>
    );
}
