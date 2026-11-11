import React, { useMemo, useState } from 'react';
import { 
    LayoutDashboard, 
    TrendingUp, 
    Building2, 
    Layers, 
    FileSpreadsheet, 
    Gem,
    ArrowUpRight,
    ArrowDownRight,
    PieChart,
    ChevronDown,
    ChevronRight,
    ChevronUp,
    Target,
    Wallet,
    Landmark,
    ArrowLeftRight,
    Download,
    CheckCircle2,
    AlertCircle,
    Sparkles,
    Search,
    ExternalLink,
    HelpCircle,
    ArrowUpDown,
    Filter
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { formatRupiah } from '../../utils/format';
import * as XLSX from 'xlsx';
import BudgetRow from '../../components/BudgetRow';

export default function RealizationDashboard() {
    const { state, dispatch } = useApp();
    const navigate = useNavigate();
    const { 
        currentUser, 
        units = [], 
        fields = [], 
        expenseItems = [], 
        rabPlans = [],
        budgetReports = [],
        budgetRequests = [],
        academicYears = [],
        bosAllocations = []
    } = state;

    const [sourceMode, setSourceMode] = useState('YAYASAN'); // 'YAYASAN' or 'BOS'
    const selectedAcademicYearId = state.globalAcademicYearId || '';
    const setSelectedAcademicYearId = (id) => dispatch({ type: 'SET_GLOBAL_YEAR', payload: id });

    const [expandedItems, setExpandedItems] = useState({});
    const toggleExpand = (id) => setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));

    // States for Hidden-by-default Semester 1 vs 2 Analysis
    const [showSemesterAnalysis, setShowSemesterAnalysis] = useState(false);
    const [semesterTab, setSemesterTab] = useState('ALL'); // 'ALL', 'UNIT', 'BIDANG'
    const [semesterSearch, setSemesterSearch] = useState('');
    const [semesterViewMode, setSemesterViewMode] = useState('ITEMS'); // 'ITEMS' (Rincian per Pos Belanja) or 'ENTITIES' (Rekap per Unit/Bidang)
    const [itemStatusFilter, setItemStatusFilter] = useState('ALL'); // 'ALL', 'SURPLUS', 'EXACT', 'OVER'
    const [itemSortBy, setItemSortBy] = useState('REMAINING_DESC'); // 'REMAINING_DESC', 'BUDGET_DESC', 'SPENT_DESC', 'PERCENT_ASC', 'PERCENT_DESC', 'NAME_ASC'
    const [expandedSemesterRows, setExpandedSemesterRows] = useState({});

    const isRowExpanded = (id, totalRows) => {
        if (expandedSemesterRows[id] !== undefined) return expandedSemesterRows[id];
        // If single entity or admin_unit, default to expanded!
        if (totalRows === 1 || currentUser?.role === 'admin_unit') return true;
        return false;
    };

    const toggleSemesterRow = (id, totalRows) => {
        setExpandedSemesterRows(prev => {
            const current = prev[id] !== undefined ? prev[id] : (totalRows === 1 || currentUser?.role === 'admin_unit');
            return { ...prev, [id]: !current };
        });
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

    // ========== CALCULATIONS ENGINE ==========
    const dashboardData = useMemo(() => {
        const isBOS = sourceMode === 'BOS';
        const activeAcademicYear = academicYears.find(y => y.id === selectedAcademicYearId && !y.isDeleted);

        // Helper to determine if a date or month belongs to Semester 1
        const isSemester1DateOrMonth = (val) => {
            if (!val) return true;
            let m = null;
            let y = null;
            if (typeof val === 'string' && val.includes('-')) {
                const parts = val.split('-');
                if (parts[0].length === 4) {
                    y = parseInt(parts[0], 10);
                    m = parseInt(parts[1], 10);
                }
            }
            if (!m) {
                const d = new Date(val);
                if (!isNaN(d.getTime())) {
                    m = d.getMonth() + 1;
                    y = d.getFullYear();
                }
            }
            if (!m) return true;

            if (activeAcademicYear?.startDate && activeAcademicYear?.endDate) {
                const start = new Date(activeAcademicYear.startDate);
                const end = new Date(activeAcademicYear.endDate);
                const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
                const halfMonths = Math.ceil(diffMonths / 2);
                const offset = (y - start.getFullYear()) * 12 + (m - 1 - start.getMonth());
                return offset >= 0 && offset < halfMonths;
            }

            // Default standard school calendar: July (7) to Dec (12) is S1, Jan (1) to Jun (6) is S2
            return m >= 7 && m <= 12;
        };
        
        // 1. Get Base Budgets (RAB)
        const unitRAB = {};
        const fieldRAB = {};
        units.forEach(u => {
            unitRAB[u.id] = { 
                budget: 0, 
                spent: 0, 
                items: {}, 
                spentItems: {},
                budgetS1: 0,
                budgetS2: 0,
                spentS1: 0,
                spentS2: 0,
                itemsS1: {},
                itemsS2: {},
                spentItemsS1: {},
                spentItemsS2: {}
            };
        });
        fields.forEach(f => {
            fieldRAB[f.id] = { 
                budget: 0, 
                spent: 0, 
                items: {}, 
                spentItems: {},
                budgetS1: 0,
                budgetS2: 0,
                spentS1: 0,
                spentS2: 0,
                itemsS1: {},
                itemsS2: {},
                spentItemsS1: {},
                spentItemsS2: {}
            };
        });

        // Process RAB Plans
        rabPlans.filter(p => p.academicYearId === selectedAcademicYearId && !p.id.includes('-REVISION-')).forEach(plan => {
            Object.keys(plan.expense || {}).forEach(exId => {
                const rawItemPlans = plan.expense[exId];
                const itemPlans = Array.isArray(rawItemPlans)
                    ? rawItemPlans
                    : (rawItemPlans && typeof rawItemPlans === 'object' && Object.keys(rawItemPlans).length > 0 ? [rawItemPlans] : []);

                let amount = 0;
                let amountS1 = 0;
                let amountS2 = 0;

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
                                
                                let compEffective = 0;
                                if (isBOS) {
                                    if (useBos) {
                                        compEffective = bosAmount > 0 ? bosAmount : compTotal;
                                    }
                                } else {
                                    const bosPortion = useBos ? (bosAmount > 0 ? bosAmount : compTotal) : 0;
                                    compEffective = compTotal - bosPortion;
                                }

                                if (compEffective > 0) {
                                    amount += compEffective;

                                    // Determine S1 vs S2 for this component
                                    let cS1 = 0;
                                    let cS2 = 0;
                                    const monthsObj = comp.months || {};
                                    const mKeys = Object.keys(monthsObj);
                                    const activeM = mKeys.filter(k => monthsObj[k] && (monthsObj[k].m === true || parseFloat(monthsObj[k].jumlah) > 0));

                                    if (activeM.length > 0) {
                                        const hasExplicitAmounts = activeM.some(k => parseFloat(monthsObj[k]?.jumlah) > 0);
                                        if (hasExplicitAmounts) {
                                            let sumAmounts = 0;
                                            activeM.forEach(k => {
                                                const j = parseFloat(monthsObj[k]?.jumlah) || 0;
                                                sumAmounts += j;
                                                if (isSemester1DateOrMonth(k)) cS1 += j;
                                                else cS2 += j;
                                            });
                                            if (sumAmounts > 0 && Math.abs(sumAmounts - compEffective) > 1) {
                                                const scale = compEffective / sumAmounts;
                                                cS1 *= scale;
                                                cS2 *= scale;
                                            }
                                        } else {
                                            let countS1 = 0;
                                            let countS2 = 0;
                                            activeM.forEach(k => {
                                                if (isSemester1DateOrMonth(k)) countS1++;
                                                else countS2++;
                                            });
                                            const tot = countS1 + countS2;
                                            if (tot > 0) {
                                                cS1 = (countS1 / tot) * compEffective;
                                                cS2 = (countS2 / tot) * compEffective;
                                            } else {
                                                cS1 = compEffective;
                                            }
                                        }
                                    } else {
                                        if (String(comp.semester) === '2') {
                                            cS2 = compEffective;
                                        } else {
                                            cS1 = compEffective;
                                        }
                                    }
                                    amountS1 += cS1;
                                    amountS2 += cS2;
                                }
                            }
                        });
                    } else {
                        // Legacy/Fallback Plan Status System
                        const isApproved = plan.status === 'APPROVED' || p.status === 'APPROVED' || p.isApproved === true;
                        if (isApproved) {
                            const total = parseFloat(p.total) || 0;
                            const useBos = p.useBos || false;
                            const bosAmount = parseFloat(p.bosAmount) || 0;
                            let eff = 0;
                            if (isBOS) {
                                if (useBos) {
                                    eff = bosAmount > 0 ? bosAmount : total;
                                }
                            } else {
                                const bosPortion = useBos ? (bosAmount > 0 ? bosAmount : total) : 0;
                                eff = total - bosPortion;
                            }
                            if (eff > 0) {
                                amount += eff;
                                if (String(p.semester) === '2') {
                                    amountS2 += eff;
                                } else {
                                    amountS1 += eff;
                                }
                            }
                        }
                    }
                });

                if (amount <= 0) return;

                const exItem = expenseItems.find(e => e.id === exId);
                const itemName = (exItem?.name || '').toLowerCase().trim();
                const isField = (exItem && exItem.fieldId && !exItem.unitId) || 
                                   itemName.includes('penggajian') || 
                                   itemName.includes('pengembangan (umum)') ||
                                   itemName.includes('honor') ||
                                   itemName.includes('yayasan');

                if (!isField && plan.unitId && unitRAB[plan.unitId]) {
                    unitRAB[plan.unitId].budget += amount;
                    unitRAB[plan.unitId].items[exId] = (unitRAB[plan.unitId].items[exId] || 0) + amount;
                    unitRAB[plan.unitId].budgetS1 += amountS1;
                    unitRAB[plan.unitId].budgetS2 += amountS2;
                    unitRAB[plan.unitId].itemsS1[exId] = (unitRAB[plan.unitId].itemsS1[exId] || 0) + amountS1;
                    unitRAB[plan.unitId].itemsS2[exId] = (unitRAB[plan.unitId].itemsS2[exId] || 0) + amountS2;
                } else if (plan.fieldId && fieldRAB[plan.fieldId]) {
                    fieldRAB[plan.fieldId].budget += amount;
                    fieldRAB[plan.fieldId].items[exId] = (fieldRAB[plan.fieldId].items[exId] || 0) + amount;
                    fieldRAB[plan.fieldId].budgetS1 += amountS1;
                    fieldRAB[plan.fieldId].budgetS2 += amountS2;
                    fieldRAB[plan.fieldId].itemsS1[exId] = (fieldRAB[plan.fieldId].itemsS1[exId] || 0) + amountS1;
                    fieldRAB[plan.fieldId].itemsS2[exId] = (fieldRAB[plan.fieldId].itemsS2[exId] || 0) + amountS2;
                }
            });
        });

        // 2. Get Actual Spending (Reports)
        budgetReports.filter(r => 
            r.status !== 'REJECTED' && 
            r.academicYearId === selectedAcademicYearId && 
            !r.isDeleted &&
            r.kategoriAset !== 'PENGEMBALIAN' &&
            (isBOS ? r.planId?.endsWith('-BOS') : !r.planId?.endsWith('-BOS'))
        ).forEach(report => {
            const amount = parseFloat(report.amount) || 0;
            let exId = report.expenseItemId;
            
            if (!exId && report.componentId) {
                for (const plan of rabPlans) {
                    if (plan.id.includes('-REVISION-')) continue;
                    if (plan.expense) {
                        for (const [itemId, plans] of Object.entries(plan.expense)) {
                            const itemPlans = Array.isArray(plans) ? plans : [plans];
                            for (const p of itemPlans) {
                                if (p.components && p.components.some(c => c.id === report.componentId || `COMP-${plan.id}-${itemId}` === report.componentId.substring(0, `COMP-${plan.id}-${itemId}`.length))) {
                                    exId = itemId;
                                    break;
                                }
                            }
                            if (exId) break;
                        }
                    }
                    if (exId) break;
                }
            }

            // Exhaustive search across all plans if componentId exists but planId didn't match
            if (!exId && report.componentId) {
                for (const plan of rabPlans) {
                    if (plan.id.includes('-REVISION-')) continue;
                    if (plan.expense) {
                        for (const [itemId, plans] of Object.entries(plan.expense)) {
                            const itemPlans = Array.isArray(plans) ? plans : [plans];
                            for (const p of itemPlans) {
                                if (p.components && p.components.some(c => c.id === report.componentId || `COMP-${plan.id}-${itemId}` === report.componentId.substring(0, `COMP-${plan.id}-${itemId}`.length))) {
                                    exId = itemId;
                                    break;
                                }
                            }
                            if (exId) break;
                        }
                    }
                    if (exId) break;
                }
            }

            if (!exId && report.budgetRequestId) {
                const req = budgetRequests.find(r => r.id === report.budgetRequestId);
                if (req) {
                    if (report.componentId && req.items) {
                        const reqItem = req.items.find(i => i.componentId === report.componentId);
                        if (reqItem && reqItem.expenseItemId) {
                            exId = reqItem.expenseItemId;
                        }
                    }
                    if (!exId && req.expenseItemId) {
                        exId = req.expenseItemId;
                    }
                }
            }
            
            // Last resort: Match by category name
            if (!exId && report.category) {
                const catLower = report.category.toLowerCase().trim();
                const matched = expenseItems.find(e => e.name.toLowerCase().trim() === catLower || catLower.includes(e.name.toLowerCase().trim()));
                if (matched) {
                    exId = matched.id;
                }
            }

            const exItem = expenseItems.find(e => e.id === exId);
            const itemName = (exItem?.name || '').toLowerCase().trim();
            const isField = (exItem && exItem.fieldId && !exItem.unitId) || 
                               itemName.includes('penggajian') || 
                               itemName.includes('pengembangan (umum)') ||
                               itemName.includes('honor') ||
                               itemName.includes('yayasan');

            const isS1 = report.date 
                ? isSemester1DateOrMonth(report.date) 
                : (report.month ? isSemester1DateOrMonth(report.month) : true);

            if (!isField && report.unitId && unitRAB[report.unitId]) {
                unitRAB[report.unitId].spent += amount;
                unitRAB[report.unitId].spentItems[exId] = (unitRAB[report.unitId].spentItems[exId] || 0) + amount;
                if (isS1) {
                    unitRAB[report.unitId].spentS1 += amount;
                    unitRAB[report.unitId].spentItemsS1[exId] = (unitRAB[report.unitId].spentItemsS1[exId] || 0) + amount;
                } else {
                    unitRAB[report.unitId].spentS2 += amount;
                    unitRAB[report.unitId].spentItemsS2[exId] = (unitRAB[report.unitId].spentItemsS2[exId] || 0) + amount;
                }
            } else if (report.fieldId && fieldRAB[report.fieldId]) {
                fieldRAB[report.fieldId].spent += amount;
                fieldRAB[report.fieldId].spentItems[exId] = (fieldRAB[report.fieldId].spentItems[exId] || 0) + amount;
                if (isS1) {
                    fieldRAB[report.fieldId].spentS1 += amount;
                    fieldRAB[report.fieldId].spentItemsS1[exId] = (fieldRAB[report.fieldId].spentItemsS1[exId] || 0) + amount;
                } else {
                    fieldRAB[report.fieldId].spentS2 += amount;
                    fieldRAB[report.fieldId].spentItemsS2[exId] = (fieldRAB[report.fieldId].spentItemsS2[exId] || 0) + amount;
                }
            }
        });

        // 3. Format for Display (Standard)
        const unitsList = units.filter(u => !u.isDeleted && (
            currentUser.role === 'admin_unit' ? u.id === currentUser.unitId : 
            (currentUser.role === 'admin_bidang' ? false : true)
        ))
            .map(u => {
                const allItemIds = Array.from(new Set([
                    ...Object.keys(unitRAB[u.id].items),
                    ...Object.keys(unitRAB[u.id].spentItems)
                ]));

                const itemsList = allItemIds.map(exId => {
                    const exItem = expenseItems.find(e => e.id === exId);
                    const budget = unitRAB[u.id].items[exId] || 0;
                    const spent = unitRAB[u.id].spentItems[exId] || 0;
                    return {
                        id: exId,
                        name: exItem?.name || 'Item Pengeluaran Lainnya',
                        sourceOfFunds: exItem?.sourceOfFunds || '',
                        budget,
                        spent,
                        remaining: budget - spent,
                        percent: budget > 0 ? (spent / budget) * 100 : 0
                    };
                }).filter(item => item.budget > 0 || item.spent > 0)
                  .sort((a, b) => b.budget - a.budget);

                return {
                    id: u.id,
                    name: u.name,
                    rap: unitRAB[u.id].budget,
                    rab: unitRAB[u.id].spent,
                    sisa: unitRAB[u.id].budget - unitRAB[u.id].spent,
                    percent: unitRAB[u.id].budget > 0 ? (unitRAB[u.id].spent / unitRAB[u.id].budget) * 100 : 0,
                    breakdown: itemsList.map(item => ({
                        id: item.id,
                        name: item.name,
                        rap: item.budget,
                        rab: item.spent,
                        sisa: item.remaining
                    }))
                };
            }).filter(u => u.rap > 0 || u.rab > 0);

        const fieldsList = fields.filter(f => !f.isDeleted && (
            currentUser.role === 'admin_bidang' ? f.id === currentUser.fieldId : 
            (currentUser.role === 'admin_unit' ? false : true)
        ))
            .map(f => {
                const allItemIds = Array.from(new Set([
                    ...Object.keys(fieldRAB[f.id].items),
                    ...Object.keys(fieldRAB[f.id].spentItems)
                ]));

                const itemsList = allItemIds.map(exId => {
                    const exItem = expenseItems.find(e => e.id === exId);
                    const budget = fieldRAB[f.id].items[exId] || 0;
                    const spent = fieldRAB[f.id].spentItems[exId] || 0;
                    return {
                        id: exId,
                        name: exItem?.name || 'Item Pengeluaran Lainnya',
                        sourceOfFunds: exItem?.sourceOfFunds || '',
                        budget,
                        spent,
                        remaining: budget - spent,
                        percent: budget > 0 ? (spent / budget) * 100 : 0
                    };
                }).filter(item => item.budget > 0 || item.spent > 0)
                  .sort((a, b) => b.budget - a.budget);

                return {
                    id: f.id,
                    name: f.name,
                    rap: fieldRAB[f.id].budget,
                    rab: fieldRAB[f.id].spent,
                    sisa: fieldRAB[f.id].budget - fieldRAB[f.id].spent,
                    percent: fieldRAB[f.id].budget > 0 ? (fieldRAB[f.id].spent / fieldRAB[f.id].budget) * 100 : 0,
                    breakdown: itemsList.map(item => ({
                        id: item.id,
                        name: item.name,
                        rap: item.budget,
                        rab: item.spent,
                        sisa: item.remaining
                    }))
                };
            }).filter(f => f.rap > 0 || f.rab > 0);

        const totalBudget = [...unitsList, ...fieldsList].reduce((s, x) => s + x.rap, 0);
        const totalSpent = [...unitsList, ...fieldsList].reduce((s, x) => s + x.rab, 0);

        const totalBidangRAB = fieldsList.reduce((s, x) => s + x.rap, 0);
        const totalBidangSpent = fieldsList.reduce((s, x) => s + x.rab, 0);
        const totalBidangRemaining = totalBidangRAB - totalBidangSpent;

        const totalUnitRAB = unitsList.reduce((s, x) => s + x.rap, 0);
        const totalUnitSpent = unitsList.reduce((s, x) => s + x.rab, 0);
        const totalUnitRemaining = totalUnitRAB - totalUnitSpent;

        // 4. Format for Semester 1 vs Semester 2 Analysis
        const semesterUnitsList = units.filter(u => !u.isDeleted && (
            currentUser.role === 'admin_unit' ? u.id === currentUser.unitId : 
            (currentUser.role === 'admin_bidang' ? false : true)
        )).map(u => {
            const data = unitRAB[u.id];
            const allItemIds = Array.from(new Set([
                ...Object.keys(data.itemsS1),
                ...Object.keys(data.itemsS2),
                ...Object.keys(data.spentItemsS1),
                ...Object.keys(data.spentItemsS2)
            ]));

            const items = allItemIds.map(exId => {
                const exItem = expenseItems.find(e => e.id === exId);
                const bS1 = data.itemsS1[exId] || 0;
                const sS1 = data.spentItemsS1[exId] || 0;
                const remS1 = bS1 - sS1;
                const bS2 = data.itemsS2[exId] || 0;
                const surplusS1 = Math.max(0, remS1);
                const projS2 = bS2 + surplusS1;

                return {
                    id: exId,
                    name: exItem?.name || 'Item Pengeluaran Lainnya',
                    budgetS1: bS1,
                    spentS1: sS1,
                    remainingS1: remS1,
                    budgetS2: bS2,
                    surplusS1: surplusS1,
                    projectedS2: projS2,
                    percentS1: bS1 > 0 ? (sS1 / bS1) * 100 : 0
                };
            }).filter(item => item.budgetS1 > 0 || item.spentS1 > 0 || item.budgetS2 > 0)
              .sort((a, b) => b.budgetS1 - a.budgetS1);

            const remainingS1 = data.budgetS1 - data.spentS1;
            const surplusS1 = Math.max(0, remainingS1);

            return {
                id: u.id,
                name: u.name,
                type: 'UNIT',
                budgetS1: data.budgetS1,
                spentS1: data.spentS1,
                remainingS1: remainingS1,
                surplusS1: surplusS1,
                rateS1: data.budgetS1 > 0 ? (data.spentS1 / data.budgetS1) * 100 : 0,
                budgetS2: data.budgetS2,
                projectedS2: data.budgetS2 + surplusS1,
                items: items
            };
        }).filter(u => u.budgetS1 > 0 || u.spentS1 > 0 || u.budgetS2 > 0);

        const semesterFieldsList = fields.filter(f => !f.isDeleted && (
            currentUser.role === 'admin_bidang' ? f.id === currentUser.fieldId : 
            (currentUser.role === 'admin_unit' ? false : true)
        )).map(f => {
            const data = fieldRAB[f.id];
            const allItemIds = Array.from(new Set([
                ...Object.keys(data.itemsS1),
                ...Object.keys(data.itemsS2),
                ...Object.keys(data.spentItemsS1),
                ...Object.keys(data.spentItemsS2)
            ]));

            const items = allItemIds.map(exId => {
                const exItem = expenseItems.find(e => e.id === exId);
                const bS1 = data.itemsS1[exId] || 0;
                const sS1 = data.spentItemsS1[exId] || 0;
                const remS1 = bS1 - sS1;
                const bS2 = data.itemsS2[exId] || 0;
                const surplusS1 = Math.max(0, remS1);
                const projS2 = bS2 + surplusS1;

                return {
                    id: exId,
                    name: exItem?.name || 'Item Pengeluaran Lainnya',
                    budgetS1: bS1,
                    spentS1: sS1,
                    remainingS1: remS1,
                    budgetS2: bS2,
                    surplusS1: surplusS1,
                    projectedS2: projS2,
                    percentS1: bS1 > 0 ? (sS1 / bS1) * 100 : 0
                };
            }).filter(item => item.budgetS1 > 0 || item.spentS1 > 0 || item.budgetS2 > 0)
              .sort((a, b) => b.budgetS1 - a.budgetS1);

            const remainingS1 = data.budgetS1 - data.spentS1;
            const surplusS1 = Math.max(0, remainingS1);

            return {
                id: f.id,
                name: f.name,
                type: 'BIDANG',
                budgetS1: data.budgetS1,
                spentS1: data.spentS1,
                remainingS1: remainingS1,
                surplusS1: surplusS1,
                rateS1: data.budgetS1 > 0 ? (data.spentS1 / data.budgetS1) * 100 : 0,
                budgetS2: data.budgetS2,
                projectedS2: data.budgetS2 + surplusS1,
                items: items
            };
        }).filter(f => f.budgetS1 > 0 || f.spentS1 > 0 || f.budgetS2 > 0);

        const allSemesterRows = [...semesterUnitsList, ...semesterFieldsList];
        const semTotalS1Budget = allSemesterRows.reduce((s, x) => s + x.budgetS1, 0);
        const semTotalS1Spent = allSemesterRows.reduce((s, x) => s + x.spentS1, 0);
        const semTotalS1Remaining = semTotalS1Budget - semTotalS1Spent;
        const semTotalS1Surplus = allSemesterRows.reduce((s, x) => s + x.surplusS1, 0);
        const semTotalS2Budget = allSemesterRows.reduce((s, x) => s + x.budgetS2, 0);
        const semTotalS2Projected = semTotalS2Budget + semTotalS1Surplus;

        return { 
            unitsList, 
            fieldsList, 
            totalBudget, 
            totalSpent,
            totalBidangRAB,
            totalBidangSpent,
            totalBidangRemaining,
            totalUnitRAB,
            totalUnitSpent,
            totalUnitRemaining,
            activeAcademicYear,
            semesterUnitsList,
            semesterFieldsList,
            semTotalS1Budget,
            semTotalS1Spent,
            semTotalS1Remaining,
            semTotalS1Surplus,
            semTotalS2Budget,
            semTotalS2Projected
        };
    }, [sourceMode, selectedAcademicYearId, units, fields, rabPlans, budgetReports, budgetRequests, expenseItems, currentUser, academicYears]);

    const absorptionRate = dashboardData.totalBudget > 0 ? (dashboardData.totalSpent / dashboardData.totalBudget) * 100 : 0;

    // Filtered lists for display in Semester Analysis
    const displaySemesterRows = useMemo(() => {
        let list = [];
        if (semesterTab === 'BIDANG') {
            list = dashboardData.semesterFieldsList || [];
        } else if (semesterTab === 'UNIT') {
            list = dashboardData.semesterUnitsList || [];
        } else {
            list = [
                ...(dashboardData.semesterFieldsList || []),
                ...(dashboardData.semesterUnitsList || [])
            ];
        }

        if (!semesterSearch.trim()) return list;

        const q = semesterSearch.toLowerCase();
        return list.filter(row => {
            const matchName = (row.name || '').toLowerCase().includes(q);
            const matchItem = row.items?.some(it => (it.name || '').toLowerCase().includes(q));
            return matchName || matchItem;
        });
    }, [dashboardData, semesterTab, semesterSearch]);

    // Flat list of all items across visible entities for direct itemized view
    const flatSemesterItems = useMemo(() => {
        const list = [];
        displaySemesterRows.forEach(row => {
            (row.items || []).forEach(it => {
                list.push({
                    ...it,
                    entityId: row.id,
                    entityName: row.name,
                    entityType: row.type
                });
            });
        });

        // Filter by item status
        let filtered = list;
        if (itemStatusFilter === 'SURPLUS') {
            filtered = filtered.filter(it => it.remainingS1 > 0);
        } else if (itemStatusFilter === 'OVER') {
            filtered = filtered.filter(it => it.remainingS1 < 0);
        } else if (itemStatusFilter === 'EXACT') {
            filtered = filtered.filter(it => it.remainingS1 === 0 && it.budgetS1 > 0);
        }

        // Sort
        return [...filtered].sort((a, b) => {
            if (itemSortBy === 'REMAINING_DESC') return b.remainingS1 - a.remainingS1;
            if (itemSortBy === 'REMAINING_ASC') return a.remainingS1 - b.remainingS1;
            if (itemSortBy === 'BUDGET_DESC') return b.budgetS1 - a.budgetS1;
            if (itemSortBy === 'SPENT_DESC') return b.spentS1 - a.spentS1;
            if (itemSortBy === 'PERCENT_ASC') return a.percentS1 - b.percentS1;
            if (itemSortBy === 'PERCENT_DESC') return b.percentS1 - a.percentS1;
            if (itemSortBy === 'NAME_ASC') return (a.name || '').localeCompare(b.name || '');
            return 0;
        });
    }, [displaySemesterRows, itemStatusFilter, itemSortBy]);

    const flatCounts = useMemo(() => {
        let total = 0;
        let surplus = 0;
        let over = 0;
        let exact = 0;
        displaySemesterRows.forEach(row => {
            (row.items || []).forEach(it => {
                total++;
                if (it.remainingS1 > 0) surplus++;
                else if (it.remainingS1 < 0) over++;
                else if (it.remainingS1 === 0 && it.budgetS1 > 0) exact++;
            });
        });
        return { total, surplus, over, exact };
    }, [displaySemesterRows]);

    const flatTotals = useMemo(() => {
        const totalBudgetS1 = flatSemesterItems.reduce((s, it) => s + it.budgetS1, 0);
        const totalSpentS1 = flatSemesterItems.reduce((s, it) => s + it.spentS1, 0);
        const totalRemainingS1 = flatSemesterItems.reduce((s, it) => s + it.remainingS1, 0);
        const totalSurplusS1 = flatSemesterItems.reduce((s, it) => s + it.surplusS1, 0);
        const totalBudgetS2 = flatSemesterItems.reduce((s, it) => s + it.budgetS2, 0);
        const totalProjectedS2 = flatSemesterItems.reduce((s, it) => s + it.projectedS2, 0);
        return {
            totalBudgetS1,
            totalSpentS1,
            totalRemainingS1,
            totalSurplusS1,
            totalBudgetS2,
            totalProjectedS2,
            rateS1: totalBudgetS1 > 0 ? (totalSpentS1 / totalBudgetS1) * 100 : 0
        };
    }, [flatSemesterItems]);

    const toggleAllSemesterRows = () => {
        const areAllExpanded = displaySemesterRows.every(r => isRowExpanded(r.id, displaySemesterRows.length));
        const next = {};
        displaySemesterRows.forEach(r => {
            next[r.id] = !areAllExpanded;
        });
        setExpandedSemesterRows(next);
    };

    // Excel Export for Semester 1 vs 2 Analysis
    const handleExportSemesterExcel = () => {
        const rows = [
            ['REKAPITULASI EVALUASI REALISASI SEMESTER 1 & POTENSI REALOKASI SEMESTER 2'],
            ['SIKLUS PERUBAHAN ANGGARAN (OKTOBER) — SIKAD YAYASAN'],
            [`Tahun Ajaran: ${dashboardData.activeAcademicYear?.name || '-'} | Sumber Dana: ${sourceMode} | Dicetak: ${new Date().toLocaleString('id-ID')}`],
            [],
            [
                'No', 'Entitas', 'Nama Unit / Bidang', 'Pos Belanja', 
                'Pagu Smt 1 (Rp)', 'Realisasi Smt 1 (Rp)', 'Sisa Pagu Smt 1 (Rp)', 'Serapan S1 (%)',
                'Pagu Awal Smt 2 (Rp)', 'Potensi Pagu Smt 2 Baru (Rp)', 'Status Efisiensi'
            ]
        ];

        let no = 1;
        const allList = semesterTab === 'BIDANG' ? dashboardData.semesterFieldsList :
                        semesterTab === 'UNIT' ? dashboardData.semesterUnitsList :
                        [...dashboardData.semesterFieldsList, ...dashboardData.semesterUnitsList];

        const filteredList = allList.filter(row => {
            if (!semesterSearch.trim()) return true;
            const q = semesterSearch.toLowerCase();
            const matchName = (row.name || '').toLowerCase().includes(q);
            const matchItem = row.items?.some(it => (it.name || '').toLowerCase().includes(q));
            return matchName || matchItem;
        });

        filteredList.forEach(ent => {
            rows.push([
                no++,
                ent.type === 'BIDANG' ? 'Bidang' : 'Unit',
                ent.name,
                '>>> TOTAL ENTITAS <<<',
                ent.budgetS1,
                ent.spentS1,
                ent.remainingS1,
                `${ent.rateS1.toFixed(1)}%`,
                ent.budgetS2,
                ent.projectedS2,
                ent.remainingS1 > 0 ? `Surplus Smt 1 Rp ${ent.surplusS1.toLocaleString('id-ID')} (Siap Ditransfer ke S2)` : 'Tidak Ada Sisa'
            ]);

            ent.items.forEach(it => {
                rows.push([
                    '',
                    '',
                    ent.name,
                    it.name,
                    it.budgetS1,
                    it.spentS1,
                    it.remainingS1,
                    `${it.percentS1.toFixed(1)}%`,
                    it.budgetS2,
                    it.projectedS2,
                    it.remainingS1 > 0 ? `Efisiensi Pos Rp ${it.surplusS1.toLocaleString('id-ID')}` : '-'
                ]);
            });
        });

        // Summary row
        rows.push([]);
        rows.push([
            'TOTAL',
            '',
            'TOTAL KESELURUHAN',
            '',
            dashboardData.semTotalS1Budget,
            dashboardData.semTotalS1Spent,
            dashboardData.semTotalS1Remaining,
            dashboardData.semTotalS1Budget > 0 ? `${((dashboardData.semTotalS1Spent / dashboardData.semTotalS1Budget) * 100).toFixed(1)}%` : '0%',
            dashboardData.semTotalS2Budget,
            dashboardData.semTotalS2Projected,
            `Total Potensi Tambahan Pagu S2: Rp ${dashboardData.semTotalS1Surplus.toLocaleString('id-ID')}`
        ]);

        const ws = XLSX.utils.aoa_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Evaluasi_Semester');

        // Second sheet: Flat Items List (Rincian Semua Pos Belanja Langsung)
        const itemRows = [
            ['RINCIAN PER POS BELANJA EVALUASI REALISASI SEMESTER 1 & REALOKASI SEMESTER 2'],
            [`Tahun Ajaran: ${dashboardData.activeAcademicYear?.name || '-'} | Sumber Dana: ${sourceMode} | Dicetak: ${new Date().toLocaleString('id-ID')}`],
            [],
            [
                'No', 'Entitas', 'Nama Pos Belanja', 
                'Pagu Smt 1 (Rp)', 'Realisasi Smt 1 (Rp)', 'Sisa Pagu Smt 1 (Rp)', 'Serapan S1 (%)',
                'Pagu Awal Smt 2 (Rp)', 'Proyeksi Pagu Smt 2 Baru (Rp)', 'Status Efisiensi'
            ]
        ];
        flatSemesterItems.forEach((it, i) => {
            itemRows.push([
                i + 1,
                it.entityName,
                it.name,
                it.budgetS1,
                it.spentS1,
                it.remainingS1,
                `${it.percentS1.toFixed(1)}%`,
                it.budgetS2,
                it.projectedS2,
                it.remainingS1 > 0 ? `Hemat Rp ${it.surplusS1.toLocaleString('id-ID')} (Siap Ditransfer)` : (it.remainingS1 < 0 ? 'Over Pagu' : 'Terserap Pas (100%)')
            ]);
        });
        itemRows.push([]);
        itemRows.push([
            'TOTAL',
            '',
            'TOTAL ITEM TERFILTER',
            flatTotals.totalBudgetS1,
            flatTotals.totalSpentS1,
            flatTotals.totalRemainingS1,
            `${flatTotals.rateS1.toFixed(1)}%`,
            flatTotals.totalBudgetS2,
            flatTotals.totalProjectedS2,
            `Total Surplus: Rp ${flatTotals.totalSurplusS1.toLocaleString('id-ID')}`
        ]);
        const wsItems = XLSX.utils.aoa_to_sheet(itemRows);
        XLSX.utils.book_append_sheet(wb, wsItems, 'Rincian_Per_Item');

        XLSX.writeFile(wb, `Evaluasi_Perubahan_Anggaran_${sourceMode}_${selectedAcademicYearId}.xlsx`);
    };

    return (
        <div className="p-8 pb-24 animate-in">
            {/* HEADER */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-[#13261E] tracking-tight">Dashboard Realisasi</h2>
                    <p className="text-[#6B7E75] text-xs sm:text-sm font-medium mt-0.5">Analisis efisiensi penyerapan anggaran {sourceMode === 'YAYASAN' ? 'Yayasan' : 'BOS'}</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    <div className="flex bg-[#EEF3F0] p-1 rounded-xl border border-[#DCE5DF]">
                        <button
                            onClick={() => setSourceMode('YAYASAN')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${sourceMode === 'YAYASAN' ? 'bg-white text-[#157A52] shadow-xs border border-[#E3E9E5]' : 'text-[#6B7E75] hover:text-[#13261E]'}`}
                        >
                            <Building2 size={14} />
                            Yayasan
                        </button>
                        {(currentUser?.role !== 'admin_bidang' || currentUser?.role === 'superadmin') && (
                            <button
                                onClick={() => setSourceMode('BOS')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${sourceMode === 'BOS' ? 'bg-white text-[#0D6844] shadow-xs border border-[#E3E9E5]' : 'text-[#6B7E75] hover:text-[#13261E]'}`}
                            >
                                <Gem size={14} />
                                BOS
                            </button>
                        )}
                    </div>

                    <select
                        value={selectedAcademicYearId}
                        onChange={(e) => setSelectedAcademicYearId(e.target.value)}
                        className="px-3.5 py-2.5 bg-white border border-[#DCE5DF] rounded-xl font-bold text-xs text-[#13261E] tracking-wide focus:ring-2 focus:ring-[#157A52]/20 focus:border-[#157A52] outline-none transition-all shadow-2xs"
                    >
                        {academicYears.filter(y => !y.isDeleted).map(y => (
                            <option key={y.id} value={y.id}>Tahun {y.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* METRICS CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
                <div className="bg-gradient-to-br from-white via-[#F6F9FE] to-[#EAF1FC] p-7 rounded-3xl border border-[#DAE4F2] shadow-xs relative overflow-hidden group">
                    <div className="relative z-10">
                        <p className="text-[11px] font-semibold text-[#5B6F8A] uppercase tracking-wider mb-1.5">Total Anggaran</p>
                        <h3 className="text-xl sm:text-2xl font-bold text-[#13261E] tracking-tight tabular-nums">{formatRupiah(dashboardData.totalBudget)}</h3>
                        <div className="mt-4 flex items-center gap-1.5 text-[#2557A7] font-bold text-xs">
                            <Target size={14} className="text-[#2557A7]" />
                            <span>RAB {sourceMode}</span>
                        </div>
                    </div>
                    <Target size={96} className="absolute -bottom-5 -right-5 text-[#DCE7F7]/80 group-hover:text-[#CDDDF4] transition-colors" />
                </div>

                <div className="bg-gradient-to-br from-white via-[#FEF8F6] to-[#FCECE7] p-7 rounded-3xl border border-[#F3DDD6] shadow-xs relative overflow-hidden group">
                    <div className="relative z-10">
                        <p className="text-[11px] font-semibold text-[#8A6256] uppercase tracking-wider mb-1.5">Total Terpakai</p>
                        <h3 className="text-xl sm:text-2xl font-bold text-[#13261E] tracking-tight tabular-nums">{formatRupiah(dashboardData.totalSpent)}</h3>
                        <div className="mt-4 flex items-center gap-1.5 text-[#D65A38] font-bold text-xs">
                            <ArrowUpRight size={14} />
                            <span>Realisasi Berjalan</span>
                        </div>
                    </div>
                    <TrendingUp size={96} className="absolute -bottom-5 -right-5 text-[#F6DFD7]/80 group-hover:text-[#F0CFC4] transition-colors" />
                </div>

                <div className="bg-gradient-to-br from-white via-[#F6FCF9] to-[#E9F6EF] p-7 rounded-3xl border border-[#D8EAE0] shadow-xs relative overflow-hidden group">
                    <div className="relative z-10">
                        <p className="text-[11px] font-semibold text-[#5C7A6B] uppercase tracking-wider mb-1.5">Sisa Anggaran</p>
                        <h3 className="text-xl sm:text-2xl font-bold text-[#13261E] tracking-tight tabular-nums">{formatRupiah(dashboardData.totalBudget - dashboardData.totalSpent)}</h3>
                        <div className="mt-4 flex items-center gap-1.5 text-[#157A52] font-bold text-xs">
                            <Wallet size={14} />
                            <span>Sisa RAB</span>
                        </div>
                    </div>
                    <Landmark size={96} className="absolute -bottom-5 -right-5 text-[#DCEEE4]/80 group-hover:text-[#CBE5D7] transition-colors" />
                </div>

                <div className="bg-gradient-to-br from-[#1B3A63] via-[#1C5E75] to-[#157A52] p-7 rounded-3xl shadow-md border border-[#236B7C]/40 relative overflow-hidden group">
                    <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full bg-white/10 pointer-events-none" />
                    <div className="relative z-10">
                        <p className="text-[11px] font-bold text-sky-100/85 uppercase tracking-wider mb-1.5">Serapan Dana</p>
                        <h3 className="text-3xl sm:text-4xl font-bold text-white tracking-tight tabular-nums">{absorptionRate.toFixed(1)}%</h3>
                        <div className="mt-4 w-full bg-black/25 h-2 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-gradient-to-r from-[#F59E0B] via-[#34D399] to-[#6EE7B7] rounded-full transition-all duration-1000" 
                                style={{ width: `${Math.min(absorptionRate, 100)}%` }}
                            />
                        </div>
                    </div>
                    <PieChart size={96} className="absolute -bottom-5 -right-5 text-white/10" />
                </div>
            </div>

            {/* ========================================================================= */}
            {/* COLLAPSIBLE SECTION: EVALUASI SEMESTER 1 & REALOKASI SEMESTER 2 */}
            {/* (DISEMBUNYIKAN SECARA DEFAULT, DIKLIK BARU MUNCUL SESUAI INSTRUKSI USER) */}
            {/* ========================================================================= */}
            <div className="mb-9 transition-all">
                {/* Trigger Banner (Pola Gradasi Multi-Tone Cobalt-Teal + Aksen Hangat) */}
                <div 
                    onClick={() => setShowSemesterAnalysis(!showSemesterAnalysis)}
                    className="cursor-pointer group p-6 rounded-3xl bg-gradient-to-r from-[#1C3557] via-[#26517D] to-[#197278] text-white shadow-md border border-[#346A96]/40 hover:shadow-lg transition-all duration-300 relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-8 opacity-15 pointer-events-none group-hover:scale-110 transition-transform text-sky-200">
                        <Sparkles size={120} />
                    </div>
                    <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className="w-13 h-13 rounded-2xl bg-white/15 text-sky-100 border border-white/25 flex items-center justify-center shadow-inner group-hover:bg-white/20 transition-colors shrink-0">
                                <ArrowLeftRight size={24} className="group-hover:rotate-180 transition-transform duration-500" />
                            </div>
                            <div>
                                <div className="flex items-center gap-3 flex-wrap">
                                    <h3 className="text-base sm:text-lg font-bold tracking-tight text-white">
                                        Evaluasi Sisa Anggaran Semester 1 &amp; Realokasi Semester 2
                                    </h3>
                                    <span className="px-3 py-0.5 bg-gradient-to-r from-[#DF6B45]/90 to-[#E59838]/90 text-white rounded-full font-bold text-[10px] uppercase tracking-wider shadow-xs">
                                        Persiapan Perubahan Anggaran (Oktober)
                                    </span>
                                </div>
                                <p className="text-sky-100/80 text-xs font-medium mt-1">
                                    Lihat rincian sisa efisiensi belanja Semester 1 (Juli–Desember) yang siap dimanfaatkan untuk penambahan pagu Semester 2.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-sky-100/85 hidden sm:inline">
                                {showSemesterAnalysis ? 'Klik untuk Menyembunyikan' : 'Klik untuk Membuka Analisis'}
                            </span>
                            <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs tracking-wide transition-all shadow-sm ${showSemesterAnalysis ? 'bg-[#132640] text-sky-100 border border-sky-300/30' : 'bg-white text-[#1C3557] hover:bg-sky-50 group-hover:scale-[1.03]'}`}>
                                {showSemesterAnalysis ? (
                                    <>
                                        <ChevronUp size={16} />
                                        <span>Sembunyikan</span>
                                    </>
                                ) : (
                                    <>
                                        <ChevronDown size={16} />
                                        <span>Buka Analisis</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content Panel (Hanya Muncul Saat Diklik) */}
                {showSemesterAnalysis && (
                    <div className="mt-4 p-7 bg-white rounded-3xl border border-[#DCE6E0] shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
                        {/* Guideline Banner */}
                        <div className="p-5 bg-gradient-to-r from-[#EEF7F2] to-[#F6FBF8] border border-[#C6E3D5] rounded-2xl mb-7 flex items-start gap-4">
                            <div className="p-2.5 bg-[#157A52] text-white rounded-xl shadow-xs shrink-0">
                                <HelpCircle size={20} />
                            </div>
                            <div className="text-xs text-[#364940] leading-relaxed">
                                <span className="font-bold text-[#13261E] text-sm block mb-1">
                                    Pedoman Tata Kelola Perubahan Anggaran (Oktober):
                                </span>
                                Tabel di bawah ini secara otomatis memisahkan pagu dan realisasi belanja antara <strong>Semester 1 (Juli–Desember)</strong> dan <strong>Semester 2 (Januari–Juni)</strong>. 
                                Sisa anggaran yang hemat/tidak terserap pada Semester 1 dihitung sebagai <span className="text-[#0D6844] font-bold bg-[#E2F1EA] px-1.5 py-0.5 rounded">Surplus Sisa Pagu</span>, 
                                yang dapat Anda jadikan dasar penambahan pagu belanja Semester 2 pada saat Perubahan Anggaran disahkan.
                            </div>
                        </div>

                        {/* 5 KPI METRICS FOR SEMESTER ANALYSIS */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                    Pagu Belanja Smt 1
                                </span>
                                <h4 className="text-xl font-black text-slate-900">{formatRupiah(dashboardData.semTotalS1Budget)}</h4>
                                <span className="text-[10px] text-slate-500 font-semibold block mt-1">Alokasi Juli–Desember</span>
                            </div>

                            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                    Realisasi Smt 1
                                </span>
                                <h4 className="text-xl font-black text-indigo-600">{formatRupiah(dashboardData.semTotalS1Spent)}</h4>
                                <span className="text-[10px] text-slate-500 font-semibold block mt-1">
                                    Serapan: {dashboardData.semTotalS1Budget > 0 ? ((dashboardData.semTotalS1Spent / dashboardData.semTotalS1Budget) * 100).toFixed(1) : 0}%
                                </span>
                            </div>

                            <div className="p-5 bg-emerald-50 rounded-2xl border-2 border-emerald-300 shadow-sm shadow-emerald-100 relative overflow-hidden">
                                <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest block mb-1">
                                    Sisa Efisiensi Smt 1
                                </span>
                                <h4 className="text-xl font-black text-emerald-700">{formatRupiah(dashboardData.semTotalS1Surplus)}</h4>
                                <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-emerald-800">
                                    <Sparkles size={12} />
                                    <span>Siap Ditransfer ke S2</span>
                                </div>
                            </div>

                            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                    Pagu Awal Smt 2
                                </span>
                                <h4 className="text-xl font-black text-slate-900">{formatRupiah(dashboardData.semTotalS2Budget)}</h4>
                                <span className="text-[10px] text-slate-500 font-semibold block mt-1">Alokasi Januari–Juni</span>
                            </div>

                            <div className="p-5 bg-indigo-50 rounded-2xl border-2 border-indigo-300 shadow-sm shadow-indigo-100">
                                <span className="text-[10px] font-black text-indigo-900 uppercase tracking-widest block mb-1">
                                    Proyeksi Pagu Smt 2 Baru
                                </span>
                                <h4 className="text-xl font-black text-indigo-700">{formatRupiah(dashboardData.semTotalS2Projected)}</h4>
                                <span className="text-[10px] text-indigo-600 font-semibold block mt-1">Pagu S2 + Sisa S1</span>
                            </div>
                        </div>

                        {/* CONTROLS BAR: VIEW MODE SWITCH, TABS, SEARCH, EXCEL & NAVIGATION */}
                        <div className="flex flex-col gap-4 mb-6">
                            {/* Top row of controls */}
                            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
                                <div className="flex items-center gap-3 flex-wrap">
                                    {/* Dual Mode Switch: Items vs Entities */}
                                    <div className="flex bg-indigo-50/80 p-1 rounded-2xl border border-indigo-200 shadow-xs">
                                        <button
                                            onClick={() => setSemesterViewMode('ITEMS')}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${semesterViewMode === 'ITEMS' ? 'bg-indigo-600 text-white shadow-md' : 'text-indigo-900 hover:bg-white/60'}`}
                                            title="Lihat rincian anggaran, realisasi, dan sisa per pos pengeluaran secara langsung"
                                        >
                                            <Layers size={14} />
                                            <span>Rincian Item Belanja ({flatCounts.total})</span>
                                        </button>
                                        <button
                                            onClick={() => setSemesterViewMode('ENTITIES')}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${semesterViewMode === 'ENTITIES' ? 'bg-indigo-600 text-white shadow-md' : 'text-indigo-900 hover:bg-white/60'}`}
                                            title="Lihat ringkasan per Unit atau Bidang dengan dropdown rincian"
                                        >
                                            <Building2 size={14} />
                                            <span>Rekap Unit / Bidang ({displaySemesterRows.length})</span>
                                        </button>
                                    </div>

                                    {/* Entity Filter Tabs */}
                                    <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
                                        <button
                                            onClick={() => setSemesterTab('ALL')}
                                            className={`px-3.5 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${semesterTab === 'ALL' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                        >
                                            Semua
                                        </button>
                                        {currentUser?.role !== 'admin_bidang' && (
                                            <button
                                                onClick={() => setSemesterTab('UNIT')}
                                                className={`px-3.5 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${semesterTab === 'UNIT' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                            >
                                                Unit Sekolah ({(dashboardData.semesterUnitsList || []).length})
                                            </button>
                                        )}
                                        {currentUser?.role !== 'admin_unit' && (
                                            <button
                                                onClick={() => setSemesterTab('BIDANG')}
                                                className={`px-3.5 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${semesterTab === 'BIDANG' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                            >
                                                Bidang ({(dashboardData.semesterFieldsList || []).length})
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 flex-wrap">
                                    <div className="relative">
                                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Cari item pengeluaran..."
                                            value={semesterSearch}
                                            onChange={(e) => setSemesterSearch(e.target.value)}
                                            className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 outline-none transition-all w-60"
                                        />
                                    </div>

                                    <button
                                        onClick={handleExportSemesterExcel}
                                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 shrink-0"
                                        title="Unduh rekapitulasi dan rincian pos belanja ke file Excel"
                                    >
                                        <Download size={15} />
                                        <span>Unduh Excel</span>
                                    </button>

                                    <button
                                        onClick={() => navigate('/anggaran/pergeseran-anggaran')}
                                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#125138] to-[#157A52] hover:from-[#0E402C] hover:to-[#0F5E3F] text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-sm active:scale-95 shrink-0 cursor-pointer"
                                        title="Buka menu resmi Pergeseran Anggaran untuk memindahkan sisa pagu"
                                    >
                                        <ExternalLink size={15} />
                                        <span>Pergeseran</span>
                                    </button>
                                </div>
                            </div>

                            {/* Second row: Sub-filters and sort controls */}
                            {semesterViewMode === 'ITEMS' ? (
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-[#F7FAF8] rounded-2xl border border-[#DCE5DF] text-xs">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7E75] flex items-center gap-1 mr-1">
                                            <Filter size={12} />
                                            Status:
                                        </span>
                                        <button
                                            onClick={() => setItemStatusFilter('ALL')}
                                            className={`px-3 py-1 rounded-xl font-bold text-[11px] transition-all cursor-pointer ${itemStatusFilter === 'ALL' ? 'bg-[#162922] text-white shadow-2xs' : 'bg-white text-[#5C6F66] border border-[#DCE5DF] hover:bg-[#EEF3F0]'}`}
                                        >
                                            Semua Pos ({flatCounts.total})
                                        </button>
                                        <button
                                            onClick={() => setItemStatusFilter('SURPLUS')}
                                            className={`px-3 py-1 rounded-xl font-bold text-[11px] transition-all flex items-center gap-1.5 cursor-pointer ${itemStatusFilter === 'SURPLUS' ? 'bg-[#157A52] text-white shadow-2xs' : 'bg-[#E9F5EF] text-[#0D6844] border border-[#C6E3D5] hover:bg-[#DFF1E7]'}`}
                                        >
                                            <Sparkles size={12} />
                                            <span>Ada Sisa / Hemat ({flatCounts.surplus})</span>
                                        </button>
                                        <button
                                            onClick={() => setItemStatusFilter('OVER')}
                                            className={`px-3 py-1 rounded-xl font-bold text-[11px] transition-all flex items-center gap-1.5 cursor-pointer ${itemStatusFilter === 'OVER' ? 'bg-rose-600 text-white shadow-2xs' : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'}`}
                                        >
                                            <AlertCircle size={12} />
                                            <span>Over Pagu ({flatCounts.over})</span>
                                        </button>
                                        <button
                                            onClick={() => setItemStatusFilter('EXACT')}
                                            className={`px-3 py-1 rounded-xl font-bold text-[11px] transition-all cursor-pointer ${itemStatusFilter === 'EXACT' ? 'bg-[#364940] text-white shadow-2xs' : 'bg-white text-[#5C6F66] border border-[#DCE5DF] hover:bg-[#EEF3F0]'}`}
                                        >
                                            Terserap Pas ({flatCounts.exact})
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7E75] flex items-center gap-1">
                                            <ArrowUpDown size={12} />
                                            Urutkan:
                                        </span>
                                        <select
                                            value={itemSortBy}
                                            onChange={(e) => setItemSortBy(e.target.value)}
                                            className="px-3 py-1.5 bg-white border border-[#DCE5DF] rounded-xl font-bold text-[11px] text-[#13261E] outline-none focus:ring-2 focus:ring-[#157A52]/20 cursor-pointer"
                                        >
                                            <option value="REMAINING_DESC">Sisa Smt 1 Terbanyak (Surplus)</option>
                                            <option value="REMAINING_ASC">Sisa Smt 1 Terkecil / Over</option>
                                            <option value="BUDGET_DESC">Pagu Anggaran S1 Terbesar</option>
                                            <option value="SPENT_DESC">Realisasi S1 Terbesar</option>
                                            <option value="PERCENT_ASC">% Serapan Terendah (Paling Hemat)</option>
                                            <option value="PERCENT_DESC">% Serapan Tertinggi</option>
                                            <option value="NAME_ASC">Nama Pos (A–Z)</option>
                                        </select>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between p-3 bg-[#F7FAF8] rounded-2xl border border-[#DCE5DF] text-xs">
                                    <span className="text-[11px] font-semibold text-[#5C6F66]">
                                        Menampilkan {displaySemesterRows.length} entitas. Klik baris atau tombol pos untuk melihat rincian item pengeluaran.
                                    </span>
                                    <button
                                        onClick={toggleAllSemesterRows}
                                        className="px-3.5 py-1.5 bg-white hover:bg-[#EEF3F0] text-[#0D6844] border border-[#C6E3D5] rounded-xl font-bold text-[11px] transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                                    >
                                        <Layers size={13} />
                                        <span>Buka / Tutup Semua Rincian</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* MODE 1: DIRECT PER-ITEM EXPENSE VIEW (RINCIAN PER POS PENGELUARAN) */}
                        {semesterViewMode === 'ITEMS' ? (
                            <div className="overflow-x-auto rounded-2xl border border-[#E4EAE6] shadow-xs">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        {/* Multi-tier group header */}
                                        <tr className="bg-gradient-to-r from-[#1C375B] via-[#244E82] to-[#17726C] text-white font-bold uppercase text-[10px] tracking-wider">
                                            <th rowSpan={2} className="px-4 py-4 w-12 text-center border-r border-white/15">No</th>
                                            <th rowSpan={2} className="px-5 py-4 min-w-[240px] border-r border-white/15">Pos Pengeluaran</th>
                                            {currentUser?.role !== 'admin_unit' && (
                                                <th rowSpan={2} className="px-4 py-4 min-w-[140px] border-r border-white/15">Unit / Bidang</th>
                                            )}
                                            <th colSpan={4} className="px-6 py-3 text-center bg-[#234C82]/85 border-r border-white/15">
                                                SEMESTER 1 (JULI – DESEMBER)
                                            </th>
                                            <th colSpan={2} className="px-6 py-3 text-center bg-[#14706A]/85 border-r border-white/15">
                                                SEMESTER 2 (JANUARI – JUNI)
                                            </th>
                                            <th rowSpan={2} className="px-4 py-4 min-w-[170px] text-center">Status Efisiensi</th>
                                        </tr>
                                        <tr className="bg-[#1D406D] text-sky-50 font-bold text-[9px] uppercase tracking-wider">
                                            <th className="px-4 py-2.5 text-right bg-[#1A3B66]/85 border-r border-white/15">Pagu Smt 1</th>
                                            <th className="px-4 py-2.5 text-right bg-[#1A3B66]/85 border-r border-white/15">Realisasi Smt 1</th>
                                            <th className="px-4 py-2.5 text-right bg-[#1A3B66]/85 border-r border-white/15 text-emerald-200 font-bold">Sisa Smt 1 (Surplus)</th>
                                            <th className="px-3 py-2.5 text-center bg-[#1A3B66]/85 border-r border-white/15">% Serap</th>
                                            <th className="px-4 py-2.5 text-right bg-[#115F5A]/85 border-r border-white/15">Pagu Awal S2</th>
                                            <th className="px-4 py-2.5 text-right bg-[#115F5A]/85 border-r border-white/15 text-sky-100 font-bold">Proyeksi S2 Baru</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                                        {flatSemesterItems.length > 0 ? (
                                            flatSemesterItems.map((it, idx) => (
                                                <tr key={`${it.entityId}-${it.id}`} className="hover:bg-indigo-50/30 transition-colors">
                                                    <td className="px-4 py-3.5 text-center font-bold text-slate-400 border-r border-slate-100">
                                                        {idx + 1}
                                                    </td>
                                                    <td className="px-5 py-3.5 font-bold text-slate-900 border-r border-slate-100">
                                                        <div className="flex items-center gap-2">
                                                            <span>{it.name}</span>
                                                            {it.sourceOfFunds && (
                                                                <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-slate-100 text-slate-600">
                                                                    {it.sourceOfFunds}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    {currentUser?.role !== 'admin_unit' && (
                                                        <td className="px-4 py-3.5 border-r border-slate-100">
                                                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${it.entityType === 'BIDANG' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                                                                {it.entityName}
                                                            </span>
                                                        </td>
                                                    )}
                                                    <td className="px-4 py-3.5 text-right font-bold text-slate-700 border-r border-slate-100">
                                                        {formatRupiah(it.budgetS1)}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-right font-black text-slate-900 border-r border-slate-100">
                                                        {formatRupiah(it.spentS1)}
                                                    </td>
                                                    <td className={`px-4 py-3.5 text-right font-black border-r border-slate-100 ${it.remainingS1 > 0 ? 'text-emerald-700 bg-emerald-50/70 font-extrabold' : it.remainingS1 < 0 ? 'text-rose-600 bg-rose-50/70' : 'text-slate-400'}`}>
                                                        {formatRupiah(it.remainingS1)}
                                                    </td>
                                                    <td className="px-3 py-3.5 text-center font-bold border-r border-slate-100">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${it.percentS1 > 100 ? 'bg-rose-100 text-rose-800' : it.percentS1 > 90 ? 'bg-emerald-100 text-emerald-800' : it.percentS1 > 50 ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                                                            {it.percentS1.toFixed(1)}%
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3.5 text-right font-bold text-slate-700 border-r border-slate-100">
                                                        {formatRupiah(it.budgetS2)}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-right font-black text-indigo-700 bg-indigo-50/30 border-r border-slate-100">
                                                        {formatRupiah(it.projectedS2)}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-center">
                                                        {it.remainingS1 > 0 ? (
                                                            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase inline-flex items-center gap-1 shadow-xs">
                                                                <Sparkles size={11} />
                                                                <span>Hemat {formatRupiah(it.surplusS1)}</span>
                                                            </span>
                                                        ) : it.remainingS1 < 0 ? (
                                                            <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black uppercase inline-flex items-center gap-1">
                                                                <AlertCircle size={11} />
                                                                <span>Over Pagu</span>
                                                            </span>
                                                        ) : (
                                                            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                                                                Terserap Pas (100%)
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={currentUser?.role !== 'admin_unit' ? 10 : 9} className="text-center py-12 text-slate-400 font-bold uppercase tracking-wider text-xs">
                                                    Tidak ditemukan item pengeluaran untuk kriteria filter ini.
                                                </td>
                                            </tr>
                                        )}

                                        {/* TOTAL ROW FOR ITEMS */}
                                        <tr className="bg-gradient-to-r from-[#1C375B] via-[#244E82] to-[#17726C] text-white font-bold text-xs border-t border-white/15">
                                            <td colSpan={currentUser?.role !== 'admin_unit' ? 3 : 2} className="px-6 py-4 text-center uppercase tracking-wider text-sky-100">
                                                TOTAL ({flatSemesterItems.length} POS BELANJA TERFILTER)
                                            </td>
                                            <td className="px-4 py-4 text-right border-l border-white/15 font-bold tabular-nums">
                                                {formatRupiah(flatTotals.totalBudgetS1)}
                                            </td>
                                            <td className="px-4 py-4 text-right border-l border-white/15 font-bold tabular-nums">
                                                {formatRupiah(flatTotals.totalSpentS1)}
                                            </td>
                                            <td className="px-4 py-4 text-right border-l border-white/15 font-bold text-emerald-200 bg-black/15 tabular-nums">
                                                {formatRupiah(flatTotals.totalRemainingS1)}
                                            </td>
                                            <td className="px-3 py-4 text-center border-l border-white/15 font-bold text-[10px] tabular-nums">
                                                {flatTotals.rateS1.toFixed(1)}%
                                            </td>
                                            <td className="px-4 py-4 text-right border-l border-white/15 font-bold tabular-nums">
                                                {formatRupiah(flatTotals.totalBudgetS2)}
                                            </td>
                                            <td className="px-4 py-4 text-right border-l border-white/15 font-bold text-sky-100 bg-black/15 tabular-nums">
                                                {formatRupiah(flatTotals.totalProjectedS2)}
                                            </td>
                                            <td className="px-4 py-4 text-center border-l border-white/15">
                                                <span className="text-[10px] text-emerald-200 uppercase font-bold block tabular-nums">
                                                    +{formatRupiah(flatTotals.totalSurplusS1)}
                                                </span>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            /* MODE 2: GROUPED ENTITIES VIEW (REKAP PER UNIT / BIDANG) */
                            <div className="overflow-x-auto rounded-2xl border border-[#E4EAE6] shadow-xs">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        {/* Multi-tier group header */}
                                        <tr className="bg-gradient-to-r from-[#1C375B] via-[#244E82] to-[#17726C] text-white font-bold uppercase text-[10px] tracking-wider">
                                            <th rowSpan={2} className="px-5 py-4 w-12 text-center border-r border-white/15">No</th>
                                            <th rowSpan={2} className="px-6 py-4 min-w-[200px] border-r border-white/15">Nama Unit / Bidang</th>
                                            <th colSpan={4} className="px-6 py-3 text-center bg-[#234C82]/85 border-r border-white/15">
                                                SEMESTER 1 (JULI – DESEMBER)
                                            </th>
                                            <th colSpan={2} className="px-6 py-3 text-center bg-[#14706A]/85 border-r border-white/15">
                                                SEMESTER 2 (JANUARI – JUNI)
                                            </th>
                                            <th rowSpan={2} className="px-4 py-4 w-28 text-center">Rincian Pos</th>
                                        </tr>
                                        <tr className="bg-[#1D406D] text-sky-50 font-bold text-[9px] uppercase tracking-wider">
                                            <th className="px-4 py-2.5 text-right bg-[#1A3B66]/85 border-r border-white/15">Pagu Smt 1</th>
                                            <th className="px-4 py-2.5 text-right bg-[#1A3B66]/85 border-r border-white/15">Realisasi Smt 1</th>
                                            <th className="px-4 py-2.5 text-right bg-[#1A3B66]/85 border-r border-white/15 text-emerald-200 font-bold">Sisa Smt 1 (Surplus)</th>
                                            <th className="px-3 py-2.5 text-center bg-[#1A3B66]/85 border-r border-white/15">% Serap</th>
                                            <th className="px-4 py-2.5 text-right bg-[#115F5A]/85 border-r border-white/15">Pagu Awal S2</th>
                                            <th className="px-4 py-2.5 text-right bg-[#115F5A]/85 border-r border-white/15 text-sky-100 font-bold">Proyeksi S2 Baru</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                                        {displaySemesterRows.length > 0 ? (
                                            displaySemesterRows.map((row, idx) => {
                                                const isExpanded = isRowExpanded(row.id, displaySemesterRows.length);
                                                return (
                                                    <React.Fragment key={row.id}>
                                                        <tr 
                                                            onClick={() => toggleSemesterRow(row.id, displaySemesterRows.length)}
                                                            className={`hover:bg-indigo-50/40 cursor-pointer transition-colors ${isExpanded ? 'bg-indigo-50/30' : ''}`}
                                                        >
                                                            <td className="px-5 py-4 text-center font-bold text-slate-400 border-r border-slate-100">
                                                                {idx + 1}
                                                            </td>
                                                            <td className="px-6 py-4 font-black text-slate-900 border-r border-slate-100">
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${row.type === 'BIDANG' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'}`}>
                                                                        {row.type === 'BIDANG' ? 'Bidang' : 'Unit'}
                                                                    </span>
                                                                    <span>{row.name}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-4 text-right font-bold text-slate-700 border-r border-slate-100">
                                                                {formatRupiah(row.budgetS1)}
                                                            </td>
                                                            <td className="px-4 py-4 text-right font-bold text-slate-900 border-r border-slate-100">
                                                                {formatRupiah(row.spentS1)}
                                                            </td>
                                                            <td className={`px-4 py-4 text-right font-black border-r border-slate-100 ${row.remainingS1 > 0 ? 'text-emerald-700 bg-emerald-50/50' : row.remainingS1 < 0 ? 'text-rose-600 bg-rose-50/50' : 'text-slate-400'}`}>
                                                                {formatRupiah(row.remainingS1)}
                                                            </td>
                                                            <td className="px-3 py-4 text-center font-bold text-slate-700 border-r border-slate-100">
                                                                <span className={`px-2 py-1 rounded-full text-[10px] font-black ${row.rateS1 > 90 ? 'bg-emerald-100 text-emerald-800' : row.rateS1 > 50 ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                                                                    {row.rateS1.toFixed(1)}%
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-4 text-right font-bold text-slate-700 border-r border-slate-100">
                                                                {formatRupiah(row.budgetS2)}
                                                            </td>
                                                            <td className="px-4 py-4 text-right font-black text-indigo-700 bg-indigo-50/30 border-r border-slate-100">
                                                                {formatRupiah(row.projectedS2)}
                                                            </td>
                                                            <td className="px-4 py-4 text-center">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        toggleSemesterRow(row.id, displaySemesterRows.length);
                                                                    }}
                                                                    className="px-3 py-1.5 bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-800 rounded-xl font-black text-[10px] uppercase tracking-wider transition-colors inline-flex items-center gap-1.5"
                                                                >
                                                                    <span>{row.items?.length || 0} Pos</span>
                                                                    {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                                                </button>
                                                            </td>
                                                        </tr>

                                                        {/* Expanded Items Breakdown */}
                                                        {isExpanded && (
                                                            <tr className="bg-slate-50/80">
                                                                <td colSpan={9} className="p-6">
                                                                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-inner">
                                                                        <div className="p-4 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
                                                                            <span className="font-black text-xs text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                                                                <Layers size={15} className="text-indigo-600" />
                                                                                Rincian Pos Belanja: {row.name}
                                                                            </span>
                                                                            <span className="text-[10px] text-slate-500 font-semibold italic">
                                                                                *Sisa efisiensi pos di S1 dapat dipindahkan ke pos S2
                                                                            </span>
                                                                        </div>
                                                                        <table className="w-full text-left text-xs">
                                                                            <thead>
                                                                                <tr className="bg-slate-50 text-slate-500 font-bold text-[9px] uppercase tracking-wider border-b border-slate-200">
                                                                                    <th className="px-4 py-2">Pos Pengeluaran</th>
                                                                                    <th className="px-4 py-2 text-right">Pagu Smt 1</th>
                                                                                    <th className="px-4 py-2 text-right">Realisasi Smt 1</th>
                                                                                    <th className="px-4 py-2 text-right text-emerald-700">Sisa Pagu S1</th>
                                                                                    <th className="px-3 py-2 text-center">% Serap</th>
                                                                                    <th className="px-4 py-2 text-right">Pagu Smt 2 Awal</th>
                                                                                    <th className="px-4 py-2 text-right text-indigo-700">Proyeksi Smt 2</th>
                                                                                    <th className="px-4 py-2 text-center">Status</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-slate-100">
                                                                                {row.items.map(it => (
                                                                                    <tr key={it.id} className="hover:bg-slate-50/50">
                                                                                        <td className="px-4 py-3 font-semibold text-slate-800">
                                                                                            {it.name}
                                                                                        </td>
                                                                                        <td className="px-4 py-3 text-right text-slate-600">
                                                                                            {formatRupiah(it.budgetS1)}
                                                                                        </td>
                                                                                        <td className="px-4 py-3 text-right text-slate-900 font-bold">
                                                                                            {formatRupiah(it.spentS1)}
                                                                                        </td>
                                                                                        <td className={`px-4 py-3 text-right font-black ${it.remainingS1 > 0 ? 'text-emerald-700 bg-emerald-50/40' : it.remainingS1 < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                                                                                            {formatRupiah(it.remainingS1)}
                                                                                        </td>
                                                                                        <td className="px-3 py-3 text-center text-slate-600 font-semibold text-[10px]">
                                                                                            {it.percentS1.toFixed(1)}%
                                                                                        </td>
                                                                                        <td className="px-4 py-3 text-right text-slate-600">
                                                                                            {formatRupiah(it.budgetS2)}
                                                                                        </td>
                                                                                        <td className="px-4 py-3 text-right font-black text-indigo-700">
                                                                                            {formatRupiah(it.projectedS2)}
                                                                                        </td>
                                                                                        <td className="px-4 py-3 text-center">
                                                                                            {it.remainingS1 > 0 ? (
                                                                                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase">
                                                                                                    Hemat Rp {formatRupiah(it.surplusS1)}
                                                                                                </span>
                                                                                            ) : it.remainingS1 < 0 ? (
                                                                                                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[9px] font-black uppercase">
                                                                                                    Over Pagu
                                                                                                </span>
                                                                                            ) : (
                                                                                                <span className="text-slate-400 text-[10px]">-</span>
                                                                                            )}
                                                                                        </td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })
                                        ) : (
                                            <tr>
                                                <td colSpan={9} className="text-center py-12 text-slate-400 font-bold uppercase tracking-wider text-xs">
                                                    Tidak ditemukan data anggaran semester untuk filter ini.
                                                </td>
                                            </tr>
                                        )}

                                        {/* GRAND TOTAL SEMESTER ROW */}
                                        <tr className="bg-gradient-to-r from-[#1C375B] via-[#244E82] to-[#17726C] text-white font-bold text-xs border-t border-white/15">
                                            <td colSpan={2} className="px-6 py-4 text-center uppercase tracking-wider text-sky-100">
                                                TOTAL KESELURUHAN (EVALUASI SEMESTER)
                                            </td>
                                            <td className="px-4 py-4 text-right border-l border-white/15 font-bold tabular-nums">
                                                {formatRupiah(dashboardData.semTotalS1Budget)}
                                            </td>
                                            <td className="px-4 py-4 text-right border-l border-white/15 font-bold tabular-nums">
                                                {formatRupiah(dashboardData.semTotalS1Spent)}
                                            </td>
                                            <td className="px-4 py-4 text-right border-l border-white/15 font-bold text-emerald-200 bg-black/15 tabular-nums">
                                                {formatRupiah(dashboardData.semTotalS1Remaining)}
                                            </td>
                                            <td className="px-3 py-4 text-center border-l border-white/15 font-bold text-[10px] tabular-nums">
                                                {dashboardData.semTotalS1Budget > 0 ? ((dashboardData.semTotalS1Spent / dashboardData.semTotalS1Budget) * 100).toFixed(1) : 0}%
                                            </td>
                                            <td className="px-4 py-4 text-right border-l border-white/15 font-bold tabular-nums">
                                                {formatRupiah(dashboardData.semTotalS2Budget)}
                                            </td>
                                            <td className="px-4 py-4 text-right border-l border-white/15 font-bold text-sky-100 bg-black/15 tabular-nums">
                                                {formatRupiah(dashboardData.semTotalS2Projected)}
                                            </td>
                                            <td className="px-4 py-4 text-center border-l border-white/15">
                                                <span className="text-[9px] text-emerald-200 uppercase font-bold block tabular-nums">
                                                    +{formatRupiah(dashboardData.semTotalS1Surplus)}
                                                </span>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Bottom Collapse Button */}
                        <div className="mt-6 flex justify-end">
                            <button
                                onClick={() => setShowSemesterAnalysis(false)}
                                className="px-5 py-2.5 bg-[#EEF3F0] hover:bg-[#E2ECE6] text-[#13261E] border border-[#DCE5DF] rounded-xl font-bold text-xs tracking-wide transition-all flex items-center gap-2 cursor-pointer"
                            >
                                <ChevronUp size={16} />
                                <span>Sembunyikan Tampilan Analisis</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* MAIN DATA TABLES */}
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* BIDANG REALISASI (Gradasi Cobalt Steel Blue) */}
                {currentUser.role !== 'admin_unit' && (
                    <div className="budget-table-wrapper bg-white rounded-2xl border border-[#DCE5F2] shadow-xs overflow-hidden mb-8">
                        <div className="budget-table-title bg-gradient-to-r from-[#1C375B] via-[#265187] to-[#2E69A8] text-white px-5 py-3.5 flex items-center gap-3">
                            <span className="w-8 h-8 rounded-lg bg-white/15 border border-white/20 text-sky-100 flex items-center justify-center shrink-0">
                                <Layers size={16} />
                            </span>
                            <span className="tracking-tight text-sm font-bold text-white">Serapan Anggaran Per Bidang</span>
                        </div>
                        <div className="budget-table-scroll">
                            <table className="budget-table">
                                <thead>
                                    <tr>
                                        <th className="budget-th budget-th-name">NAMA BIDANG</th>
                                        <th className="budget-th budget-th-number">RAB (BELANJA)</th>
                                        <th className="budget-th budget-th-number">REALISASI ANGGARAN</th>
                                        <th className="budget-th budget-th-number">SISA ANGGARAN</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dashboardData.fieldsList.length > 0 ? (
                                        <>
                                            {dashboardData.fieldsList.map(f => (
                                                <BudgetRow
                                                    key={f.id}
                                                    data={f}
                                                    isExpanded={!!expandedItems[f.id]}
                                                    onToggle={() => toggleExpand(f.id)}
                                                    formatCurrency={formatRupiah}
                                                    isField={true}
                                                />
                                            ))}
                                            <tr className="budget-row-total bg-[#F3F7FC]">
                                                <td className="budget-cell budget-cell-name font-bold text-xs text-[#1C375B] uppercase tracking-wider">
                                                    TOTAL KESELURUHAN
                                                </td>
                                                <td className="budget-cell budget-cell-number font-bold text-[#13261E] border-l border-[#DCE5F2] tabular-nums">{formatRupiah(dashboardData.totalBidangRAB)}</td>
                                                <td className="budget-cell budget-cell-number font-bold text-[#13261E] tabular-nums">{formatRupiah(dashboardData.totalBidangSpent)}</td>
                                                <td className="budget-cell budget-cell-number budget-cell-sisa bg-[#EBF3FD] text-[#244E82] font-bold tabular-nums">{formatRupiah(dashboardData.totalBidangRemaining)}</td>
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

                {/* UNIT REALISASI (Gradasi Teal to Emerald) */}
                {currentUser.role !== 'admin_bidang' && (
                    <div className="budget-table-wrapper bg-white rounded-2xl border border-[#DCEAE3] shadow-xs overflow-hidden">
                        <div className="budget-table-title bg-gradient-to-r from-[#12514A] via-[#157A52] to-[#22986B] text-white px-5 py-3.5 flex items-center gap-3">
                            <span className="w-8 h-8 rounded-lg bg-white/15 border border-white/20 text-emerald-100 flex items-center justify-center shrink-0">
                                <Building2 size={16} />
                            </span>
                            <span className="tracking-tight text-sm font-bold text-white">Serapan Anggaran Per Unit</span>
                        </div>
                        <div className="budget-table-scroll">
                            <table className="budget-table">
                                <thead>
                                    <tr>
                                        <th className="budget-th budget-th-name">NAMA UNIT</th>
                                        <th className="budget-th budget-th-number">RAB (BELANJA)</th>
                                        <th className="budget-th budget-th-number">REALISASI ANGGARAN</th>
                                        <th className="budget-th budget-th-number">SISA ANGGARAN</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dashboardData.unitsList.length > 0 ? (
                                        <>
                                            {dashboardData.unitsList.map(u => (
                                                <BudgetRow
                                                    key={u.id}
                                                    data={u}
                                                    isExpanded={!!expandedItems[u.id]}
                                                    onToggle={() => toggleExpand(u.id)}
                                                    formatCurrency={formatRupiah}
                                                />
                                            ))}
                                            <tr className="budget-row-total bg-[#F2F6F4]">
                                                <td className="budget-cell budget-cell-name font-bold text-xs text-[#13261E] uppercase tracking-wider">
                                                    TOTAL KESELURUHAN
                                                </td>
                                                <td className="budget-cell budget-cell-number font-bold text-[#13261E] border-l border-[#E3E9E5] tabular-nums">{formatRupiah(dashboardData.totalUnitRAB)}</td>
                                                <td className="budget-cell budget-cell-number font-bold text-[#13261E] tabular-nums">{formatRupiah(dashboardData.totalUnitSpent)}</td>
                                                <td className="budget-cell budget-cell-number budget-cell-sisa bg-[#E9F5EF]/70 text-[#157A52] font-bold tabular-nums">{formatRupiah(dashboardData.totalUnitRemaining)}</td>
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


