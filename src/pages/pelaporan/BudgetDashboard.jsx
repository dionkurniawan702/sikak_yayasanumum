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

        // NOTE: Budget Requests removed from RAB total to avoid duplicate info as requested.
        // If needed for "Realisasi", a separate engine/column should be added later.

        return { unitRAB: uRAB, fieldRAB: fRAB };
    }, [rabPlans, units, fields, currentUser, selectedAcademicYearId, expenseItems, selectedAcademicYearName]);

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
        <div className="p-4 md:p-8 animate-in pb-20">
            {/* ===== HEADER & CONTROLS ===== */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-12 pt-12 md:pt-0">
                <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic">Dashboard Anggaran</h2>
                    <div className="flex items-center gap-4">
                        <p className="text-slate-500 font-medium tracking-tight">Konsolidasi rencana pendapatan dan belanja {sourceMode === 'YAYASAN' ? 'Yayasan' : 'BOS'}</p>
                        {sourceMode === 'YAYASAN' && isSuperAdmin && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-full border border-slate-200">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Base: {formatCurrency(totalMurni || 0)}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
                    {/* Source Selector */}
                    <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                        <button
                            onClick={() => setSourceMode('YAYASAN')}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${sourceMode === 'YAYASAN' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <Building2 size={14} />
                            Dana Yayasan
                        </button>
                        {(currentUser?.role !== 'admin_bidang' || currentUser?.role === 'superadmin') && (
                            <button
                                onClick={() => setSourceMode('BOS')}
                                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${sourceMode === 'BOS' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <Gem size={14} />
                                Dana BOS
                            </button>
                        )}
                    </div>

                    <select
                        value={selectedAcademicYearId}
                        onChange={(e) => setSelectedAcademicYearId(e.target.value)}
                        className="p-3 bg-white border-2 border-slate-100 rounded-2xl font-black text-xs text-slate-800 uppercase tracking-widest focus:ring-4 focus:ring-blue-50 outline-none transition-all shadow-sm"
                    >
                        {academicYears.filter(a => !a.isDeleted && (a.isActive || a.id === selectedAcademicYearId))
                            .sort((a, b) => b.name.localeCompare(a.name))
                            .map(y => (
                                <option key={y.id} value={y.id}>{y.name}</option>
                            ))}
                    </select>

                    <button
                        onClick={exportToExcel}
                        className="budget-export-btn shadow-sm"
                    >
                        <FileSpreadsheet size={16} />
                        <span>Cetak Laporan Excel</span>
                    </button>
                </div>
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                {sourceMode === 'YAYASAN' ? (
                    <>
            {/* ===== BIDANG TABLE (Indigo Theme) ===== */}
            {currentUser?.role !== 'admin_unit' && (
                <div className="budget-table-wrapper mb-12 border-none shadow-xl shadow-slate-200/50 animate-in">
                    <div className="budget-table-title bg-slate-900 text-white">
                        <Layers size={20} className="text-indigo-400" />
                        <span className="uppercase tracking-widest text-sm font-black text-white italic">Ringkasan Per Bidang</span>
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
                                        <tr className="budget-row-total bg-slate-50">
                                            <td className="budget-cell budget-cell-name font-black text-xs text-slate-800 uppercase tracking-widest">
                                                {(currentUser?.role === 'admin_bidang' || currentUser?.role === 'admin_unit') ? 'Total Keseluruhan' : 'Total Konsolidasi Bidang'}
                                            </td>
                                            <td className="budget-cell budget-cell-number font-black text-slate-900 border-l-2 border-indigo-100">{formatCurrency(totalBidangRAP)}</td>
                                            <td className="budget-cell budget-cell-number font-black text-slate-900">{formatCurrency(totalBidangRAB)}</td>
                                            <td className="budget-cell budget-cell-number budget-cell-sisa bg-indigo-50/30 text-indigo-700 font-black">{formatCurrency(totalBidangSisa)}</td>
                                        </tr>
                                    </>
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="text-center py-20 text-slate-300 font-bold uppercase tracking-widest text-[10px] italic">
                                            Belum ada data bidang untuk periode ini.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ===== UNIT TABLE (Indigo Theme) ===== */}
            {currentUser?.role !== 'admin_bidang' && (
                <div className="budget-table-wrapper border-none shadow-xl shadow-slate-200/50 animate-in">
                    <div className="budget-table-title bg-slate-900 text-white">
                        <Building2 size={20} className="text-blue-400" />
                        <span className="uppercase tracking-widest text-sm font-black text-white italic">Ringkasan Per Unit</span>
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
                                        <tr className="budget-row-total bg-slate-50">
                                            <td className="budget-cell budget-cell-name font-black text-xs text-slate-800 uppercase tracking-widest">
                                                {(currentUser?.role === 'admin_bidang' || currentUser?.role === 'admin_unit') ? 'Total Keseluruhan' : 'Total Konsolidasi Unit'}
                                            </td>
                                            <td className="budget-cell budget-cell-number font-black text-slate-900 border-l-2 border-blue-100">{formatCurrency(totalUnitRAP)}</td>
                                            <td className="budget-cell budget-cell-number font-black text-slate-900">{formatCurrency(totalUnitRAB)}</td>
                                            <td className="budget-cell budget-cell-number budget-cell-sisa bg-blue-50/30 text-blue-700 font-black">{formatCurrency(totalUnitSisa)}</td>
                                        </tr>
                                    </>
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="text-center py-20 text-slate-300 font-bold uppercase tracking-widest text-[10px] italic">
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
            {/* ===== BOS TABLE (Emerald/Green Theme) ===== */}
            {currentUser?.role !== 'admin_bidang' && bosUnitData.length > 0 && (
                <div className="budget-table-wrapper mt-12 border-none shadow-xl shadow-slate-200/50 animate-in slide-in-from-bottom-4 duration-700">
                    <div className="budget-table-title bg-emerald-900 text-white">
                        <Gem size={20} className="text-emerald-400" />
                        <span className="uppercase tracking-widest text-sm font-black text-white italic">Ringkasan BOS Per Unit</span>
                    </div>
                    <div className="budget-table-scroll">
                        <table className="budget-table">
                            <thead>
                                <tr className="bg-emerald-50/50">
                                    <th className="budget-th budget-th-name text-emerald-900">NAMA UNIT</th>
                                    <th className="budget-th budget-th-number text-emerald-900">RAP BOS (ALOKASI)</th>
                                    <th className="budget-th budget-th-number text-emerald-900">RAB BOS (RENCANA)</th>
                                    <th className="budget-th budget-th-number text-emerald-900">SISA BOS</th>
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
                                <tr className="budget-row-total bg-emerald-50/20">
                                    <td className="budget-cell budget-cell-name font-black text-xs text-emerald-900 uppercase tracking-widest italic">Total Konsolidasi BOS</td>
                                    <td className="budget-cell budget-cell-number font-black text-emerald-950 border-l-2 border-emerald-100">{formatCurrency(totalBosUnitRAP)}</td>
                                    <td className="budget-cell budget-cell-number font-black text-emerald-950">{formatCurrency(totalBosUnitRAB)}</td>
                                    <td className="budget-cell budget-cell-number budget-cell-sisa bg-emerald-100/30 text-emerald-800 font-black">{formatCurrency(totalBosUnitSisa)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
                    </>
                )}
            </div>

            <div className="mt-20 text-center">
                <div className="inline-block px-10 py-3 bg-white border border-slate-100 rounded-full shadow-sm">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">
                        Sistem Keuangan Dareliman — SIKAD
                    </p>
                </div>
            </div>


        </div>
    );
}
