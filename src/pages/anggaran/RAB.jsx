import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Calendar, Building2, Layers, Save, RefreshCw,
    ArrowUpCircle, ArrowDownCircle, Info, ChevronRight,
    TrendingUp, Wallet, ShieldCheck, Download, Filter,
    Send, CheckCircle2, XCircle, AlertCircle, MessageSquare,
    Edit3, PlusCircle, Database, Plus, X, RotateCcw, Package,
    Calculator, Trash2, Pencil, DollarSign, BarChart3, CloudUpload, Eye, EyeOff, Lock, CheckSquare, Search,
    ExternalLink, CheckCheck
} from 'lucide-react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { useApp } from '../../context/AppContext';
import { formatRupiah } from '../../utils/format';
import { api } from '../../services/api';
import { calculateRAP } from '../../utils/budgetEngine';
import BudgetRow from '../../components/BudgetRow';

const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const getMonthName = (monthNum) => monthNames[monthNum - 1] || `Bulan ${monthNum}`;

// Helper to generate months for an academic year based on its settings
const generateMonths = (ay) => {
    const months = [];

    try {
        // Option 1: Use explicit start and end dates from settings
        if (ay?.startDate && ay?.endDate) {
            const start = new Date(ay.startDate);
            const end = new Date(ay.endDate);
            const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
            const monthsPerSemester = Math.ceil(diffMonths / 2);

            let current = new Date(start);
            let safetyCounter = 0;

            while (current <= end && safetyCounter < 24) {
                const year = current.getFullYear();
                const monthIdx = current.getMonth();
                const monthNum = monthIdx + 1;

                const semester = safetyCounter < monthsPerSemester ? '1' : '2';
                const shortYear = String(year).slice(-2);

                months.push({
                    id: `${year}-${String(monthNum).padStart(2, '0')}`,
                    name: `${monthNames[monthIdx]}-${year}`,
                    label: `${monthNames[monthIdx]} '${shortYear}`,
                    shortLabel: `${monthNames[monthIdx].substring(0, 3).toUpperCase()} ${shortYear}`,
                    year: year,
                    semester
                });

                current.setMonth(current.getMonth() + 1);
                safetyCounter++;
            }
        }

        // Option 2: Fallback if months are still empty
        if (months.length === 0) {
            const [startYearStr, endYearStr] = (ay.name || '').split((ay.name || '').includes('/') ? '/' : '-');
            const startYear = parseInt(startYearStr) || new Date().getFullYear();
            const endYear = parseInt(endYearStr) || (startYear + 1);

            const sequence = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];
            sequence.forEach((monthNum, idx) => {
                const year = monthNum >= 7 ? startYear : endYear;
                const semester = idx < 6 ? '1' : '2';
                const shortYear = String(year).slice(-2);
                months.push({
                    id: `${year}-${String(monthNum).padStart(2, '0')}`,
                    name: `${monthNames[monthNum - 1]}-${year}`,
                    label: `${monthNames[monthNum - 1]} '${shortYear}`,
                    shortLabel: `${monthNames[monthNum - 1].substring(0, 3).toUpperCase()} ${shortYear}`,
                    year: year,
                    semester
                });
            });
        }
    } catch (err) {
        console.error('[Month Generation Error]:', err);
    }

    return months;
};

// Robust helper to parse number values from Excel sheet cells, handling Indonesian format (e.g. dots as thousands and comma as decimal separator)
const parseExcelNum = (val) => {
    if (val === undefined || val === null) return 0;
    const str = val.toString().trim();
    if (str === '') return 0;
    if (/^-?\d+$/.test(str)) return parseInt(str, 10);
    // If it has dots/commas typical of Indonesian thousand/decimal separators
    const sanitized = str.replace(/\./g, '').replace(/,/g, '.');
    return parseFloat(sanitized) || parseFloat(str) || 0;
};

// Flexible month matching logic that supports clean matches with and without year suffix (case-insensitive)
const findRowKeyForMonth = (rowKeys, monthObj) => {
    const cleanName = monthObj.name.toLowerCase();
    const cleanLabel = monthObj.label.toLowerCase();
    const cleanShortLabel = monthObj.shortLabel.toLowerCase();
    const monthOnly = cleanName.split('-')[0];
    
    return rowKeys.find(k => {
        const cleanKey = k.trim().toLowerCase();
        return cleanKey === cleanName || 
               cleanKey === cleanLabel || 
               cleanKey === cleanShortLabel ||
               cleanKey === monthOnly;
    });
};

function RABContent() {
    const { state, dispatch } = useApp();
    const lastPlanIdRef = React.useRef(null);
    const {
        units = [],
        fields = [],
        academicYears = [],
        incomeItems = [],
        expenseItems = [],
        rabPlans = [],
        programs = [],
        expensePrograms = [],
        bosStages = [],
        bosPosList = [],
        bosAllocations = [],
        assetCategories = [],
        assetRooms = [],
        assets = [],
        currentUser,
        budgetReports = []
    } = state;

    // Role helpers
    const isSuperAdmin = currentUser?.role === 'superadmin';
    const isAdminBidang = currentUser?.role === 'admin_bidang';
    const currentUserUnit = units.find(u => u.id === currentUser?.unitId);
    const isBosRecipient = isSuperAdmin || isAdminBidang || (currentUserUnit && currentUserUnit.receivesBos);
    const userField = fields.find(f => f.id === currentUser?.fieldId);
    const isSarprasAdmin = isSuperAdmin || (isAdminBidang && (
        userField?.name?.toLowerCase().includes('sarana') ||
        userField?.name?.toLowerCase().includes('sarpras') ||
        currentUser?.name?.toLowerCase().includes('sarana') ||
        currentUser?.name?.toLowerCase().includes('sarpras') ||
        currentUser?.username?.toLowerCase().includes('sarana') ||
        currentUser?.username?.toLowerCase().includes('sarpras')
    ));

    const selectedYearId = state.globalAcademicYearId || '';
    const setSelectedYearId = (id) => dispatch({ type: 'SET_GLOBAL_YEAR', payload: id });
    const activeYearObj = academicYears.find(a => a.id === selectedYearId);
    const activeYearName = activeYearObj?.name || '';
    const isSarprasRequiredYear = activeYearName >= '2026-2027';

    const [selectedUnitId, setSelectedUnitId] = useState('FOUNDATION');
    const [showDashboard, setShowDashboard] = useState(isSuperAdmin);
    const [activeTab, setActiveTab] = useState('EXPENSE'); // EXPENSE | REVIEW (for admin)
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [showRejectionInput, setShowRejectionInput] = useState(null); // planId if reviewing
    const [searchTerm, setSearchTerm] = useState('');
    const [fundSourceFilter, setFundSourceFilter] = useState('Yayasan');
    const [newItemData, setNewItemData] = useState({ name: '', incomeItemId: '', sourceOfFunds: 'Yayasan' });
    const [editingItem, setEditingItem] = useState(null);
    const [compSearchQuery, setCompSearchQuery] = useState('');
    const [compStatusFilter, setCompStatusFilter] = useState('ALL');

    useEffect(() => {
        setCompSearchQuery('');
        setCompStatusFilter('ALL');
    }, [editingItem]);

    const [filterMonth, setFilterMonth] = useState(null); // monthId (e.g. 2026-07)
    const [filterProgram, setFilterProgram] = useState(null); // programId
    const [isAddendumMode, setIsAddendumMode] = useState(false);

    // States for Sarpras Asset Verification View
    const [sarprasFilterStatus, setSarprasFilterStatus] = useState('PENDING'); // PENDING | APPROVED | REJECTED | ALL
    const [sarprasFilterUnit, setSarprasFilterUnit] = useState('ALL');
    const [sarprasSearchQuery, setSarprasSearchQuery] = useState('');
    const [rejectModalItem, setRejectModalItem] = useState(null);
    const [rejectModalReason, setRejectModalReason] = useState('');
    const [detailAssetItem, setDetailAssetItem] = useState(null);

    const revisionPlanId = `${selectedYearId}-${selectedUnitId}-REVISION-${fundSourceFilter === 'BOS' ? 'BOS' : 'YAYASAN'}`;
    const revisionPlan = useMemo(() => (rabPlans || []).find(p => p.id === revisionPlanId), [rabPlans, revisionPlanId]);
    const hasRevision = !!revisionPlan;
    const originalPlan = useMemo(() => (rabPlans || []).find(p => p.id === `${selectedYearId}-${selectedUnitId}-${fundSourceFilter === 'BOS' ? 'BOS' : 'YAYASAN'}`), [rabPlans, selectedYearId, selectedUnitId, fundSourceFilter]);
    
    const currentPlanId = useMemo(() => {
        return hasRevision ? revisionPlanId : `${selectedYearId}-${selectedUnitId}-${fundSourceFilter === 'BOS' ? 'BOS' : 'YAYASAN'}`;
    }, [selectedYearId, selectedUnitId, fundSourceFilter, hasRevision, revisionPlanId]);

    const originalTotal = useMemo(() => {
        if (!originalPlan) return 0;
        if (fundSourceFilter === 'BOS') {
            return Object.values(originalPlan.expense || {}).flat().reduce((sum, val) => {
                return sum + (val?.useBos ? (parseFloat(val?.bosAmount) || 0) : 0);
            }, 0);
        } else {
            return Object.values(originalPlan.expense || {}).flat().reduce((sum, val) => {
                const itemTotal = val?.total || 0;
                const bosAmt = val?.useBos ? (parseFloat(val?.bosAmount) || 0) : 0;
                return sum + (itemTotal - bosAmt);
            }, 0);
        }
    }, [originalPlan, fundSourceFilter]);

    const revisionTotal = useMemo(() => {
        if (!revisionPlan) return 0;
        if (fundSourceFilter === 'BOS') {
            return Object.values(revisionPlan.expense || {}).flat().reduce((sum, val) => {
                return sum + (val?.useBos ? (parseFloat(val?.bosAmount) || 0) : 0);
            }, 0);
        } else {
            return Object.values(revisionPlan.expense || {}).flat().reduce((sum, val) => {
                const itemTotal = val?.total || 0;
                const bosAmt = val?.useBos ? (parseFloat(val?.bosAmount) || 0) : 0;
                return sum + (itemTotal - bosAmt);
            }, 0);
        }
    }, [revisionPlan, fundSourceFilter]);

    const revisionDiff = revisionTotal - originalTotal;


    // States for Journal-style component entry
    const [entryForm, setEntryForm] = useState({
        label: '',
        volume: 0,
        satuan: '',
        kali: 1,
        harga: 0,
        programId: '',
        semester: '1',
        months: {},
        isAsset: false,
        assetName: '',
        assetCategory: '',
        assetRoom: '',
        assetProcurementType: 'BARU',
        sarprasStatus: null,
        sarprasNotes: ''
    });
    const [editingCompIdx, setEditingCompIdx] = useState(null);
    const [showCompModal, setShowCompModal] = useState(false);
    const [isReadOnlyComp, setIsReadOnlyComp] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [expandedReviewPlans, setExpandedReviewPlans] = useState({});
    const [expandedDashboardPlans, setExpandedDashboardPlans] = useState({});
    const [expandedDetailItems, setExpandedDetailItems] = useState({});
    const [selectedComponents, setSelectedComponents] = useState(new Set());
    const [programSearchQuery, setProgramSearchQuery] = useState('');
    const [showProgramDropdown, setShowProgramDropdown] = useState(false);

    const componentSpending = useMemo(() => {
        const map = {};
        (budgetReports || []).filter(r => r.status === 'APPROVED' && !r.isDeleted && r.kategoriAset !== 'PENGEMBALIAN').forEach(report => {
            if (report.componentId) {
                map[report.componentId] = (map[report.componentId] || 0) + (parseFloat(report.amount) || 0);
            }
        });
        return map;
    }, [budgetReports]);

    // Gather all asset items from all units/bidang for Sarpras verification
    const allSarprasAssets = useMemo(() => {
        if (!isSarprasAdmin && !isSuperAdmin) return [];
        const list = [];
        (rabPlans || []).forEach(plan => {
            const isYearMatch = !selectedYearId || 
                plan.academicYearId === selectedYearId || 
                plan.id?.startsWith(selectedYearId) ||
                (activeYearName && (plan.id?.includes(activeYearName) || plan.academicYearId === activeYearName));
            if (!isYearMatch) {
                return;
            }

            let ownerName = 'Yayasan';
            let ownerType = 'YAYASAN';
            let rawUnitId = 'FOUNDATION';
            if (plan.unitId && plan.unitId !== 'FOUNDATION') {
                const u = units.find(unit => unit.id === plan.unitId);
                ownerName = u ? u.name : plan.unitId;
                ownerType = 'UNIT';
                rawUnitId = plan.unitId;
            } else if (plan.fieldId) {
                const f = fields.find(field => field.id === plan.fieldId);
                ownerName = f ? f.name : plan.fieldId;
                ownerType = 'BIDANG';
                rawUnitId = `FIELD-${plan.fieldId}`;
            }

            const isBos = plan.id?.endsWith('-BOS') || plan.sourceOfFunds === 'BOS';
            const sourceLabel = isBos ? 'BOS' : 'Yayasan';

            if (plan.expense && typeof plan.expense === 'object') {
                Object.entries(plan.expense).forEach(([itemId, groupList]) => {
                    const expenseItemDef = expenseItems.find(ei => ei.id === itemId);
                    const expenseItemName = expenseItemDef?.name || itemId;

                    if (Array.isArray(groupList)) {
                        groupList.forEach((group) => {
                            if (Array.isArray(group?.components)) {
                                group.components.forEach((comp, compIdx) => {
                                    if (comp && comp.isAsset) {
                                        list.push({
                                            planId: plan.id,
                                            planAcademicYearId: plan.academicYearId,
                                            planStatus: plan.status,
                                            unitId: rawUnitId,
                                            ownerName,
                                            ownerType,
                                            sourceLabel,
                                            itemId,
                                            expenseItemName,
                                            subGroupId: group.id,
                                            subGroupName: group.name || group.description || 'Rincian Anggaran',
                                            compIdx,
                                            component: comp,
                                            sarprasStatus: comp.sarprasStatus || (isSarprasRequiredYear ? 'APPROVED' : 'APPROVED')
                                        });
                                    }
                                });
                            }
                        });
                    }
                });
            }
        });
        return list;
    }, [isSarprasAdmin, isSuperAdmin, rabPlans, selectedYearId, units, fields, expenseItems, isSarprasRequiredYear]);

    const pendingSarprasCount = useMemo(() => {
        return allSarprasAssets.filter(item => item.component?.sarprasStatus === 'PENDING').length;
    }, [allSarprasAssets]);

    const sarprasStats = useMemo(() => {
        let totalNominal = 0;
        let pendingCount = 0;
        let pendingNominal = 0;
        let approvedCount = 0;
        let approvedNominal = 0;
        let rejectedCount = 0;

        allSarprasAssets.forEach(item => {
            const tot = parseFloat(item.component?.total) || 0;
            totalNominal += tot;
            const st = item.component?.sarprasStatus;
            if (st === 'PENDING') {
                pendingCount++;
                pendingNominal += tot;
            } else if (st === 'APPROVED') {
                approvedCount++;
                approvedNominal += tot;
            } else if (st === 'REJECTED') {
                rejectedCount++;
            }
        });

        return {
            totalCount: allSarprasAssets.length,
            totalNominal,
            pendingCount,
            pendingNominal,
            approvedCount,
            approvedNominal,
            rejectedCount
        };
    }, [allSarprasAssets]);

    const uniqueAssetUnits = useMemo(() => {
        const map = new Map();
        allSarprasAssets.forEach(item => {
            if (!map.has(item.unitId)) {
                map.set(item.unitId, {
                    id: item.unitId,
                    name: item.ownerName,
                    type: item.ownerType
                });
            }
        });
        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [allSarprasAssets]);

    const filteredSarprasAssets = useMemo(() => {
        return allSarprasAssets.filter(item => {
            const comp = item.component;

            if (sarprasFilterStatus === 'PENDING') {
                if (comp.sarprasStatus !== 'PENDING') return false;
            } else if (sarprasFilterStatus === 'APPROVED') {
                if (comp.sarprasStatus !== 'APPROVED') return false;
            } else if (sarprasFilterStatus === 'REJECTED') {
                if (comp.sarprasStatus !== 'REJECTED') return false;
            }

            if (sarprasFilterUnit !== 'ALL') {
                if (item.unitId !== sarprasFilterUnit) return false;
            }

            if (sarprasSearchQuery.trim()) {
                const q = sarprasSearchQuery.toLowerCase();
                const matchName = (comp.assetName || comp.namaAset || '').toLowerCase().includes(q);
                const matchLabel = (comp.label || '').toLowerCase().includes(q);
                const matchOwner = (item.ownerName || '').toLowerCase().includes(q);
                const matchRoom = (comp.assetRoom || '').toLowerCase().includes(q);
                const matchCat = (comp.assetCategory || '').toLowerCase().includes(q);
                if (!matchName && !matchLabel && !matchOwner && !matchRoom && !matchCat) return false;
            }

            return true;
        });
    }, [allSarprasAssets, sarprasFilterStatus, sarprasFilterUnit, sarprasSearchQuery]);

    const validatePlan = (plan) => {
        // 1. Gather all component IDs present in the new plan
        const presentComponents = new Map(); // c.id -> c
        Object.keys(plan.expense || {}).forEach(itemId => {
            const plans = plan.expense[itemId];
            const plansArr = Array.isArray(plans) ? plans : (plans && typeof plans === 'object' && Object.keys(plans).length > 0 ? [plans] : []);
            plansArr.forEach(p => {
                const comps = p.components || [];
                comps.forEach(c => {
                    if (c.id) {
                        presentComponents.set(c.id, c);
                    }
                });
            });
        });

        // 2. Check all components currently present in the plan
        let overspentComponent = null;
        for (const [compId, c] of presentComponents.entries()) {
            const spent = componentSpending[compId] || 0;
            const budget = parseFloat(c.total) || 0;
            if (budget < spent) {
                overspentComponent = { name: c.label, budget, spent };
                return overspentComponent;
            }
        }

        // 3. Check for any components that have actual transactions (spent > 0) in the database/reports 
        // for this unit/field, academic year, and source, but were completely deleted from the plan!
        const targetSourceBOS = fundSourceFilter === 'BOS';
        const targetUnitId = plan.unitId;
        const targetFieldId = plan.fieldId;
        const targetYearId = plan.academicYearId;

        // Group budget reports by componentId to compute spent for deleted items
        const spentMapForContext = {};
        const compLabelMap = {};

        (budgetReports || []).forEach(r => {
            if (r.status !== 'APPROVED' || r.isDeleted || r.kategoriAset === 'PENGEMBALIAN') return;
            if (r.academicYearId !== targetYearId) return;
            
            // Match Unit/Field
            if (targetFieldId) {
                if (r.fieldId !== targetFieldId) return;
            } else {
                if (r.unitId !== targetUnitId) return;
            }

            // Match Source
            const isBOSReport = r.source === 'BOS';
            if (targetSourceBOS !== isBOSReport) return;

            if (r.componentId) {
                spentMapForContext[r.componentId] = (spentMapForContext[r.componentId] || 0) + (parseFloat(r.amount) || 0);
                if (r.description && !compLabelMap[r.componentId]) {
                    compLabelMap[r.componentId] = r.description;
                }
            }
        });

        // Now, for every component that has spent > 0 in this context, verify it exists in the plan
        for (const compId of Object.keys(spentMapForContext)) {
            const spent = spentMapForContext[compId] || 0;
            if (spent <= 0) continue;

            if (!presentComponents.has(compId)) {
                // Component is deleted but has transactions!
                const compName = compLabelMap[compId] || "Komponen yang dihapus";
                overspentComponent = { name: compName, budget: 0, spent };
                return overspentComponent;
            }
        }

        return null;
    };

    const toggleComponentSelection = (id) => {
        setSelectedComponents(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSelectAll = () => {
        const type = activeTab === 'INCOME' ? 'income' : 'expense';
        const items = type === 'income' ? incomeItems : expenseItems; // Using all items instead of filtered ones to ensure we catch everything
        const newSelected = new Set(selectedComponents);
        
        let addedCount = 0;

        items.forEach(itemMaster => {
            let allPlans = activePlan[type]?.[itemMaster.id] || [];
            const planArray = Array.isArray(allPlans) ? allPlans : (allPlans && typeof allPlans === 'object' && Object.keys(allPlans).length > 0 ? [{ id: `P-${itemMaster.id}-LEGACY`, itemId: itemMaster.id, ...allPlans }] : []);
            
            // Re-apply force consolidation logic if it's not review mode
            if (activeTab !== 'REVIEW' && planArray.length > 1) {
                const first = planArray[0];
                const allComps = planArray.flatMap(p => p.components || []);
                const virtualPlan = { ...first, components: allComps, total: planArray.reduce((s, p) => s + (parseFloat(p.total) || 0), 0) };
                
                (virtualPlan.components || []).forEach((c, cIdx) => {
                    let compStatus = c.status;
                    if (!compStatus) compStatus = activePlan.status === 'APPROVED' ? 'APPROVED' : (activePlan.status === 'PENDING' ? 'PENDING' : 'DRAFT');
                    
                    const isReviewMode = activeTab === 'REVIEW';
                    const canSelect = isReviewMode 
                        ? compStatus === 'PENDING' 
                        : (isSuperAdmin 
                            ? (compStatus === 'APPROVED' || compStatus === 'PENDING' || compStatus === 'DRAFT' || compStatus === 'REJECTED')
                            : (compStatus === 'DRAFT' || compStatus === 'REJECTED')
                          );
                    
                    if (canSelect) {
                        const pIdx = 0; // Because we forced consolidated to 1 plan
                        const compId = `${virtualPlan.id}|COMP-${virtualPlan.id}|${pIdx}|${cIdx}`;
                        newSelected.add(compId);
                        addedCount++;
                    }
                });
            } else {
                planArray.forEach((plan, pIdx) => {
                    (plan.components || []).forEach((c, cIdx) => {
                        let compStatus = c.status;
                        if (!compStatus) compStatus = activePlan.status === 'APPROVED' ? 'APPROVED' : (activePlan.status === 'PENDING' ? 'PENDING' : 'DRAFT');
                        
                        const isReviewMode = activeTab === 'REVIEW';
                        const canSelect = isReviewMode 
                            ? compStatus === 'PENDING' 
                            : (isSuperAdmin 
                                ? (compStatus === 'APPROVED' || compStatus === 'PENDING' || compStatus === 'DRAFT' || compStatus === 'REJECTED')
                                : (compStatus === 'DRAFT' || compStatus === 'REJECTED')
                              );
                        
                        if (canSelect) {
                            const compId = `${plan.id}|COMP-${plan.id}|${pIdx}|${cIdx}`;
                            newSelected.add(compId);
                            addedCount++;
                        }
                    });
                });
            }
        });

        if (addedCount === 0) {
            // If already all selected or none to select, maybe clear?
            if (selectedComponents.size > 0) setSelectedComponents(new Set());
            else alert(isSuperAdmin ? "Tidak ada rincian yang bisa dipilih." : "Tidak ada rincian yang bisa dipilih (semua sudah diajukan/disetujui).");
        } else {
            setSelectedComponents(newSelected);
        }
    };

    const toggleReviewPlan = (id) => setExpandedReviewPlans(prev => ({ ...prev, [id]: !prev[id] }));
    const toggleDashboardPlan = (id) => setExpandedDashboardPlans(prev => ({ ...prev, [id]: !prev[id] }));

    // Mapped data for the Review and Consolidated views (Extracted Hooks)
    const incomePrograms = useMemo(() => programs.filter(p => !p.isDeleted && p.type === 'INCOME'), [programs]);
    const pendingPlans = useMemo(() => {
        return rabPlans.filter(p => {
            const matchStatus = p.status === 'PENDING';
            const matchYear = p.academicYearId === selectedYearId;
            const matchSource = fundSourceFilter === 'BOS' ? p.id.endsWith('-BOS') : !p.id.endsWith('-BOS');
            
            let matchUnit = true;
            if (selectedUnitId && selectedUnitId !== 'FOUNDATION') {
                if (selectedUnitId.startsWith('FIELD-')) {
                    matchUnit = p.fieldId === selectedUnitId.replace('FIELD-', '');
                } else {
                    matchUnit = p.unitId === selectedUnitId;
                }
            }
            
            return matchStatus && matchYear && matchSource && matchUnit;
        });
    }, [rabPlans, selectedYearId, fundSourceFilter, selectedUnitId]);
    const filteredReviewPlans = useMemo(() =>
        pendingPlans.filter(p => p.academicYearId === selectedYearId),
        [pendingPlans, selectedYearId]);

    const activeYear = useMemo(() => academicYears.find(ay => ay.id === selectedYearId), [academicYears, selectedYearId]);
    const monthsOptions = useMemo(() => activeYear ? generateMonths(activeYear) : [], [activeYear]);
    const allPrograms = useMemo(() => {
        if (activeTab === 'INCOME') return programs.filter(p => !p.isDeleted && p.type === 'INCOME');
        return expensePrograms;
    }, [programs, expensePrograms, activeTab]);

    // AUTO-REPAIR STUCK PENDING PLANS
    useEffect(() => {
        if (!rabPlans || rabPlans.length === 0) return;
        
        let needsUpdate = false;
        
        // Use a timeout to avoid immediate state updates during render phase
        const timer = setTimeout(async () => {
            for (const plan of rabPlans) {
                if (plan.status === 'PENDING' || plan.status === 'APPROVED' || plan.status === 'DRAFT') {
                    let hasPendingComp = false;
                    let hasApprovedComp = false;
                    
                    // Check expense components
                    Object.values(plan.expense || {}).forEach(plans => {
                        const arr = Array.isArray(plans) ? plans : (plans && typeof plans === 'object' && Object.keys(plans).length > 0 ? [plans] : []);
                        arr.forEach(p => {
                            (p.components || []).forEach(c => {
                                if (c.status === 'PENDING' || !c.status) hasPendingComp = true;
                                if (c.status === 'APPROVED' || c.isApproved) hasApprovedComp = true;
                            });
                        });
                    });
                    
                    // Check income components
                    Object.values(plan.income || {}).forEach(plans => {
                        const arr = Array.isArray(plans) ? plans : (plans && typeof plans === 'object' && Object.keys(plans).length > 0 ? [plans] : []);
                        arr.forEach(p => {
                            (p.components || []).forEach(c => {
                                if (c.status === 'PENDING' || !c.status) hasPendingComp = true;
                                if (c.status === 'APPROVED' || c.isApproved) hasApprovedComp = true;
                            });
                        });
                    });
                    
                    if (plan.status === 'PENDING' && !hasPendingComp && hasApprovedComp) {
                        // All components are approved (or draft), none are pending. Fix the plan status.
                        const updatedPlan = {
                            ...plan,
                            status: 'APPROVED',
                            updatedAt: new Date().toISOString()
                        };
                        dispatch({ type: 'SET_RAB_PLAN', payload: updatedPlan });
                        needsUpdate = true;
                    }
                    else if (plan.status === 'APPROVED' && hasPendingComp) {
                        // The plan is approved, but some components are stuck in pending. Cascade the approval.
                        const updatedExpense = { ...plan.expense };
                        Object.keys(updatedExpense).forEach(itemId => {
                            const rawPlans = updatedExpense[itemId];
                            const plansArr = Array.isArray(rawPlans) ? rawPlans : (rawPlans && typeof rawPlans === 'object' && Object.keys(rawPlans).length > 0 ? [{ id: `P-${itemId}-LEGACY`, itemId, ...rawPlans }] : []);
                            
                            updatedExpense[itemId] = plansArr.map(p => {
                                const comps = p.components || [];
                                const updatedComps = comps.map(c => ({
                                    ...c,
                                    status: 'APPROVED',
                                    isApproved: true
                                }));
                                return { ...p, components: updatedComps };
                            });
                        });

                        const updatedIncome = { ...plan.income };
                        Object.keys(updatedIncome).forEach(itemId => {
                            const rawPlans = updatedIncome[itemId];
                            const plansArr = Array.isArray(rawPlans) ? rawPlans : (rawPlans && typeof rawPlans === 'object' && Object.keys(rawPlans).length > 0 ? [{ id: `P-${itemId}-LEGACY`, itemId, ...rawPlans }] : []);
                            
                            updatedIncome[itemId] = plansArr.map(p => {
                                const comps = p.components || [];
                                const updatedComps = comps.map(c => ({
                                    ...c,
                                    status: 'APPROVED',
                                    isApproved: true
                                }));
                                return { ...p, components: updatedComps };
                            });
                        });

                        const updatedPlan = {
                            ...plan,
                            expense: updatedExpense,
                            income: updatedIncome,
                            updatedAt: new Date().toISOString()
                        };
                        dispatch({ type: 'SET_RAB_PLAN', payload: updatedPlan });
                        needsUpdate = true;
                    }
                    else if (plan.status === 'DRAFT' && hasPendingComp) {
                        // The plan is DRAFT, but some components are stuck in pending (due to cancel submission). Cascade DRAFT.
                        const updatedExpense = { ...plan.expense };
                        Object.keys(updatedExpense).forEach(itemId => {
                            const rawPlans = updatedExpense[itemId];
                            const plansArr = Array.isArray(rawPlans) ? rawPlans : (rawPlans && typeof rawPlans === 'object' && Object.keys(rawPlans).length > 0 ? [{ id: `P-${itemId}-LEGACY`, itemId, ...rawPlans }] : []);
                            
                            updatedExpense[itemId] = plansArr.map(p => {
                                const comps = p.components || [];
                                const updatedComps = comps.map(c => ({
                                    ...c,
                                    status: 'DRAFT',
                                    isApproved: false
                                }));
                                return { ...p, components: updatedComps };
                            });
                        });

                        const updatedIncome = { ...plan.income };
                        Object.keys(updatedIncome).forEach(itemId => {
                            const rawPlans = updatedIncome[itemId];
                            const plansArr = Array.isArray(rawPlans) ? rawPlans : (rawPlans && typeof rawPlans === 'object' && Object.keys(rawPlans).length > 0 ? [{ id: `P-${itemId}-LEGACY`, itemId, ...rawPlans }] : []);
                            
                            updatedIncome[itemId] = plansArr.map(p => {
                                const comps = p.components || [];
                                const updatedComps = comps.map(c => ({
                                    ...c,
                                    status: 'DRAFT',
                                    isApproved: false
                                }));
                                return { ...p, components: updatedComps };
                            });
                        });

                        const updatedPlan = {
                            ...plan,
                            expense: updatedExpense,
                            income: updatedIncome,
                            updatedAt: new Date().toISOString()
                        };
                        dispatch({ type: 'SET_RAB_PLAN', payload: updatedPlan });
                        needsUpdate = true;
                    }
                }
            }
        }, 1000);
        
        return () => clearTimeout(timer);
    }, [rabPlans, isSuperAdmin, dispatch, state]);

    const toggleDetailItem = (parentId, itemId) => {
        const key = `${parentId}|${itemId}`;
        setExpandedDetailItems(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const formatCurrency = (val) => {
        const num = parseFloat(val) || 0;
        return `Rp ${num.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    };

    const getUnitName = (id) => {
        const u = units.find(u => u.id === id);
        return u ? u.name : 'Unknown';
    };
    const [searchParams] = useSearchParams();
    const sourceParam = searchParams.get('source');
    const labelInputRef = useRef(null);

    // Sync filter with URL parameter
    useEffect(() => {
        if (sourceParam === 'Yayasan' || sourceParam === 'BOS') {
            setFundSourceFilter(sourceParam);
        }
    }, [sourceParam]);

    // Close program dropdown when clicking outside
    useEffect(() => {
        if (!showProgramDropdown) return;
        const handleClickOutside = (e) => {
            if (!e.target.closest('[data-program-dropdown]')) {
                setShowProgramDropdown(false);
                setProgramSearchQuery('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showProgramDropdown]);

    // Auto-clear success messages
    useEffect(() => {
        if (message && message.type === 'success') {
            const timer = setTimeout(() => {
                setMessage(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [message]);


    // Local state for the current editing plan
    const [currentPlan, setCurrentPlan] = useState({
        income: {},
        expense: {},
        status: 'DRAFT',
        rejectionReason: null
    });

    // Set initial filters
    useEffect(() => {
        if (currentUser?.role === 'admin_unit') {
            setSelectedUnitId(currentUser.unitId);
            setShowDashboard(false);
        } else if (currentUser?.role === 'admin_bidang') {
            setSelectedUnitId(`FIELD-${currentUser.fieldId}`);
            setShowDashboard(false);
        } else if (isSuperAdmin && selectedUnitId === 'FOUNDATION') {
            setShowDashboard(true);
        }
    }, [currentUser, isSuperAdmin]);

    // Load existing plan when filters change or plan status updates
    useEffect(() => {
        if (!selectedYearId || !selectedUnitId) return;

        const basePlanId = `${selectedYearId}-${selectedUnitId}`;
        const planId = `${basePlanId}-${fundSourceFilter === 'BOS' ? 'BOS' : 'YAYASAN'}`;
        const revPlanId = `${selectedYearId}-${selectedUnitId}-REVISION-${fundSourceFilter === 'BOS' ? 'BOS' : 'YAYASAN'}`;
        const existingPlan = (rabPlans || []).find(p => p.id === revPlanId) || (rabPlans || []).find(p => p.id === planId);
        
        // Track status, notified, and updatedAt changes so the modal can show up even if data loads late or auto-repair runs
        const planKey = existingPlan ? `${existingPlan.id}-${existingPlan.status}-${existingPlan.notified}-${existingPlan.updatedAt}` : planId;

        if (lastPlanIdRef.current !== planKey) {
            if (existingPlan) {
                // Migration logic: convert single objects to arrays if detected
                const rawExpense = existingPlan.expense || {};
                const migratedExpense = {};

                Object.entries(rawExpense).forEach(([itemId, data]) => {
                    if (Array.isArray(data)) {
                        migratedExpense[itemId] = data;
                    } else if (data && typeof data === 'object' && Object.keys(data).length > 0) {
                        // Convert old single plan to array with a permanent ID
                        migratedExpense[itemId] = [{
                            id: `P-${itemId}-LEGACY`,
                            itemId: itemId,
                            ...data
                        }];
                    } else {
                        migratedExpense[itemId] = [];
                    }
                });

                setCurrentPlan({
                    income: existingPlan.income || {},
                    expense: migratedExpense,
                    status: existingPlan.status || 'DRAFT',
                    rejectionReason: existingPlan.rejectionReason || null,
                    notified: existingPlan.notified
                });

                if ((existingPlan.status === 'APPROVED' || existingPlan.status === 'REJECTED') && !existingPlan.notified) {
                    setShowStatusModal(true);
                }
            } else {
                setCurrentPlan({ income: {}, expense: {}, status: 'DRAFT', rejectionReason: null });
            }
            lastPlanIdRef.current = planKey;
        }
    }, [selectedYearId, selectedUnitId, fundSourceFilter, rabPlans]);
    // Compute consolidated data if Yayasan is selected
    const consolidatedPlan = useMemo(() => {
        try {
            if (selectedUnitId !== 'FOUNDATION' || !selectedYearId) return null;

            const yearPlans = (rabPlans || []).filter(p =>
                p && p.academicYearId === selectedYearId &&
                p.unitId !== 'FOUNDATION' &&
                (fundSourceFilter === 'BOS' ? p.id.endsWith('-BOS') : !p.id.endsWith('-BOS'))
            );

            const consolidated = {
                income: {},
                expense: {},
                status: 'CONSOLIDATED',
                rejectionReason: null
            };

            yearPlans.forEach(plan => {
                if (!plan) return;
                // Merge Income
                const planIncome = plan.income || {};
                Object.entries(planIncome).forEach(([itemId, data]) => {
                    if (!data) return;
                    if (!consolidated.income[itemId]) {
                        consolidated.income[itemId] = JSON.parse(JSON.stringify(data));
                    } else {
                        const existing = consolidated.income[itemId];
                        existing.total = (existing.total || 0) + (data.total || 0);
                        if (data.months) {
                            if (!existing.months) existing.months = {};
                            Object.entries(data.months).forEach(([mId, mData]) => {
                                if (!mData) return;
                                const currentM = existing.months[mId] || { jumlah: 0, m: false };
                                existing.months[mId] = {
                                    jumlah: (currentM.jumlah || 0) + (parseFloat(mData.jumlah) || 0),
                                    m: currentM.m || mData.m
                                };
                            });
                        }
                    }
                });
                // Merge Expense (Now handles Arrays of plans per item)
                const planExpense = plan.expense || {};
                Object.entries(planExpense).forEach(([itemId, dataArray]) => {
                    if (!dataArray || !Array.isArray(dataArray)) return;

                    if (!consolidated.expense[itemId]) {
                        consolidated.expense[itemId] = JSON.parse(JSON.stringify(dataArray));
                    } else {
                        // Concatenate plans from different units for the same item master
                        consolidated.expense[itemId] = [
                            ...consolidated.expense[itemId],
                            ...JSON.parse(JSON.stringify(dataArray))
                        ];
                    }
                });
            });

            return consolidated;
        } catch (err) {
            console.error('[Consolidation Error]:', err);
            return null;
        }
    }, [rabPlans, selectedYearId, selectedUnitId, fundSourceFilter]);

    // Determine which plan data to display
    // Determine which plan data to display with automatic consolidation for local items
    const activePlan = useMemo(() => {
        const raw = (selectedUnitId === 'FOUNDATION' && consolidatedPlan) ? consolidatedPlan : (currentPlan || { income: {}, expense: {}, status: 'DRAFT' });
        
        // Force consolidate expense if it has multiple plans per item (only for non-foundation/non-review views)
        if (selectedUnitId !== 'FOUNDATION' && activeTab !== 'REVIEW' && raw.expense) {
            const consolidatedExpense = {};
            Object.entries(raw.expense).forEach(([itemId, plans]) => {
                if (Array.isArray(plans) && plans.length > 1) {
                    // Merge multiple plans into one virtual plan for UI consistency
                    const first = plans[0];
                    const allComponents = plans.flatMap(p => p.components || []);
                    const aggrMonths = {};
                    plans.forEach(p => {
                        Object.entries(p.months || {}).forEach(([mId, mData]) => {
                            if (!mData.m) return;
                            if (!aggrMonths[mId]) aggrMonths[mId] = { m: true, jumlah: 0 };
                            aggrMonths[mId].jumlah += (parseFloat(mData.jumlah) || 0);
                        });
                    });
                    consolidatedExpense[itemId] = [{
                        ...first,
                        total: plans.reduce((s, p) => s + (parseFloat(p.total) || 0), 0),
                        components: allComponents,
                        months: aggrMonths,
                        description: allComponents.length > 0 ? allComponents[0].label : ''
                    }];
                } else {
                    consolidatedExpense[itemId] = plans;
                }
            });
            return { ...raw, expense: consolidatedExpense };
        }
        return raw;
    }, [currentPlan, consolidatedPlan, selectedUnitId, activeTab]);

    const isConsolidation = selectedUnitId === 'FOUNDATION';
    const isField = selectedUnitId.startsWith('FIELD-');
    const fieldId = isField ? selectedUnitId.replace('FIELD-', '') : null;
    const isLocked = ((activePlan?.status === 'APPROVED' && !isAddendumMode) || activePlan?.status === 'PENDING' || isConsolidation) && !isSuperAdmin;

    const bosItemMap = useMemo(() => {
        const map = {};
        if (!selectedYearId) return map;

        const unitIdForBos = isField ? null : (selectedUnitId === 'FOUNDATION' ? null : selectedUnitId);

        (bosAllocations || []).filter(a =>
            !a.isDeleted &&
            a.academicYearId === selectedYearId &&
            ((!isField && a.unitId === unitIdForBos) || (isField && a.fieldId === fieldId))
        ).forEach(a => {
            map[a.expenseItemId] = (map[a.expenseItemId] || 0) + (parseFloat(a.amount) || 0);
        });
        return map;
    }, [bosAllocations, selectedYearId, selectedUnitId, isField, fieldId]);

    // Calculate RAP for the selected context
    const rapData = useMemo(() => {
        if (!selectedYearId || !selectedUnitId) return { totalTarget: 0, incomeTotals: {}, itemAllocations: {} };

        let unitId = null;
        let fieldId = null;

        if (selectedUnitId.startsWith('FIELD-')) {
            fieldId = selectedUnitId.replace('FIELD-', '');
        } else if (selectedUnitId !== 'FOUNDATION') {
            unitId = selectedUnitId;
        }

        return calculateRAP(state, selectedYearId, unitId, fieldId);
    }, [state, selectedYearId, selectedUnitId]);

    // Filtered items based on unit configuration
    const filteredIncomeItems = useMemo(() => {
        if (selectedUnitId === 'FOUNDATION') return incomeItems;

        const distributionSettings = state.distributionSettings || [];
        const isField = selectedUnitId.startsWith('FIELD-');
        const fieldId = isField ? selectedUnitId.replace('FIELD-', '') : null;

        const activeIds = new Set(
            distributionSettings
                .filter(s => {
                    if (isField) return s.destId === fieldId;
                    return s.unitId === selectedUnitId;
                })
                .map(s => s.incomeItemId)
        );
        return (incomeItems || []).filter(ii => activeIds.has(ii.id));
    }, [incomeItems, state.distributionSettings, selectedUnitId]);

    const filteredExpenseItems = useMemo(() => {
        if (selectedUnitId === 'FOUNDATION') return expenseItems.filter(ei => !ei.isDeleted);

        const distributionSettings = state.distributionSettings || [];
        const isField = selectedUnitId.startsWith('FIELD-');
        const fieldId = isField ? selectedUnitId.replace('FIELD-', '') : null;
        const unitId = !isField && selectedUnitId !== 'FOUNDATION' ? selectedUnitId : null;

        const activeIds = new Set();

        // Include items where this unit/field is the distribution destination
        // OR if this unit is the source of the distribution (even if going to a field)
        distributionSettings
            .filter(s => {
                if (isField) return s.destId === fieldId;
                return s.destId === selectedUnitId;
            })
            .forEach(s => { if (s.expenseItemId) activeIds.add(s.expenseItemId); });

        // Include items from BOS allocations
        const unitIdForBos = isField ? null : (selectedUnitId === 'FOUNDATION' ? null : selectedUnitId);
        if (selectedYearId) {
            (bosAllocations || []).filter(a =>
                !a.isDeleted &&
                a.academicYearId === selectedYearId &&
                ((!isField && a.unitId === unitIdForBos) || (isField && a.fieldId === fieldId))
            ).forEach(a => activeIds.add(a.expenseItemId));
        }

        return (expenseItems || []).filter(ei => {
            if (ei.isDeleted || !activeIds.has(ei.id)) return false;

            // NEW: Hide 'Persentase Konfigurasi' items from Admin Units specifically
            if (currentUser?.role === 'admin_unit' && ei.sourceOfFunds === 'Persentase Konfigurasi') {
                return false;
            }

            // HANYA tampilkan item GLOBAL (otomatis). 
            // Item yang diinput secara manual (memiliki unitId/fieldId) tetap disembunyikan.
            if (ei.unitId !== null || ei.fieldId !== null) return false;

            // Special Rule: "Pengembangan (umum)" only for Superadmin and Finance Field
            if (ei.name === 'Pengembangan (umum)') {
                const financeField = fields.find(f => f.name === 'Bidang Keuangan');
                const isFinanceAdmin = currentUser?.role === 'admin_bidang' && currentUser?.fieldId === financeField?.id;
                if (!isSuperAdmin && !isFinanceAdmin) return false;
            }

            return true;
        });
    }, [expenseItems, state.distributionSettings, bosAllocations, selectedYearId, selectedUnitId, currentUser, fields, isSuperAdmin]);


    // - [x] Hapus fitur Migrasi Otomatis (Auto-Migration) di `RAB.jsx`
    // - [x] Bersihkan logika fallback `currentItem.total` di `handlePushComponent`
    // - [x] Perbaiki perhitungan `activeMonths` di UI
    // - [x] Hanya hitung bulan yang status centangnya `true`
    // - [x] Restore Migration for Summary Table (Isi detil dari data lama)
    // - [x] Clear Months only (Kosongkan kotak bulanan saat migrasi)
    // - [x] Sinkronisasi handlePush & handleAdd
    // - [ ] Git commit & push
    const handleItemUpdate = (itemId, planId, field, value) => {
        const type = activeTab === 'INCOME' ? 'income' : 'expense';
        setCurrentPlan(prev => {
            const plans = prev[type][itemId] || [];
            let planFound = false;

            const updatedPlans = plans.map(p => {
                if (p.id !== planId && p.id !== itemId) return p;
                planFound = true;

                const updatedPlan = { ...p, [field]: value };

                if (['volume', 'kali', 'harga'].includes(field)) {
                    updatedPlan.total = (parseFloat(updatedPlan.volume) || 0) *
                        (parseFloat(updatedPlan.kali) || 0) *
                        (parseFloat(updatedPlan.harga) || 0);
                }

                if (updatedPlan.components && updatedPlan.components.length > 0) {
                    updatedPlan.total = updatedPlan.components.reduce((sum, c) => sum + (parseFloat(c.total) || 0), 0);
                }

                if (field === 'semester') {
                    const ay = academicYears.find(a => a.id === selectedYearId);
                    const yearMonths = generateMonths(ay);
                    const monthsData = { ...(updatedPlan.months || {}) };
                    yearMonths.forEach((m, idx) => {
                        const isSemester1 = idx < 6;
                        const targetSemester = value === '1' ? isSemester1 : !isSemester1;
                        monthsData[m.id] = { ...(monthsData[m.id] || { jumlah: 0 }), m: targetSemester };
                    });
                    updatedPlan.months = monthsData;
                }

                return updatedPlan;
            });

            // If it's a new plan and not yet in the array, add it now
            if (!planFound && editingItem?.isNewPlan) {
                const newPlan = {
                    id: planId,
                    itemId: itemId,
                    total: 0,
                    components: [],
                    months: {},
                    semester: editingItem.semester || '1',
                    [field]: value
                };
                return {
                    ...prev,
                    [type]: { ...prev[type], [itemId]: [...plans, newPlan] }
                };
            }

            return {
                ...prev,
                [type]: { ...prev[type], [itemId]: updatedPlans }
            };
        });
    };

    const handleComponentUpdate = (itemId, planId, index, field, value) => {
        const type = activeTab === 'INCOME' ? 'income' : 'expense';
        setCurrentPlan(prev => {
            const plans = prev[type][itemId] || [];
            let planFound = false;

            const updatedPlans = plans.map(p => {
                if (p.id !== planId) return p;
                planFound = true;

                const components = [...(p.components || [])];
                if (!components[index]) {
                    components[index] = { label: '', volume: 0, satuan: '', kali: 1, harga: 0, total: 0 };
                }

                const updatedComp = { ...components[index], [field]: value };
                if (['volume', 'kali', 'harga'].includes(field)) {
                    updatedComp.total = (parseFloat(updatedComp.volume) || 0) *
                        (parseFloat(updatedComp.kali) || 0) *
                        (parseFloat(updatedComp.harga) || 0);
                }
                components[index] = updatedComp;

                return {
                    ...p,
                    components,
                    total: components.reduce((sum, c) => sum + (parseFloat(c.total) || 0), 0)
                };
            });

            if (!planFound && editingItem?.isNewPlan) {
                const components = [{ label: '', volume: 0, satuan: '', kali: 1, harga: 0, total: 0 }];
                const updatedComp = { ...components[0], [field]: value };
                if (['volume', 'kali', 'harga'].includes(field)) {
                    updatedComp.total = (parseFloat(updatedComp.volume) || 0) *
                        (parseFloat(updatedComp.kali) || 0) *
                        (parseFloat(updatedComp.harga) || 0);
                }
                components[0] = updatedComp;

                const newPlan = {
                    id: planId,
                    itemId: itemId,
                    total: updatedComp.total,
                    components,
                    months: {},
                    semester: editingItem.semester || '1'
                };
                return { ...prev, [type]: { ...prev[type], [itemId]: [...plans, newPlan] } };
            }

            return { ...prev, [type]: { ...prev[type], [itemId]: updatedPlans } };
        });
    };

    const handlePushComponent = (itemId, planId) => {
        if (!entryForm.label || !entryForm.volume || !entryForm.harga) {
            setMessage({ type: 'error', text: 'Mohon isi Keterangan, Volume, dan Harga!' });
            return;
        }

        if (entryForm.isAsset && isSarprasRequiredYear) {
            if (!entryForm.assetName || !entryForm.assetName.trim()) {
                setMessage({ type: 'error', text: `Untuk TA ${activeYearName || '2026-2027'}, Nama Aset wajib diisi untuk rencana pembelian aset!` });
                return;
            }
            if (!entryForm.assetCategory) {
                setMessage({ type: 'error', text: `Untuk TA ${activeYearName || '2026-2027'}, Kategori Aset wajib dipilih untuk rencana pembelian aset!` });
                return;
            }
        }

        const type = activeTab === 'INCOME' ? 'income' : 'expense';
        const total = (parseFloat(entryForm.volume) || 0) * (parseFloat(entryForm.kali) || 0) * (parseFloat(entryForm.harga) || 0);
        
        const monthsData = entryForm.months || {};
        const activeMonthIds = Object.keys(monthsData).filter(mId => monthsData[mId]?.m);
        const monthlyTotal = Object.values(monthsData).reduce((sum, m) => sum + (m?.m ? (parseFloat(m?.jumlah) || 0) : 0), 0);
        
        if (activeMonthIds.length > 0 && Math.abs(monthlyTotal - total) > 1) {
            setMessage({ type: 'error', text: `Total alokasi bulanan (${formatRupiah(monthlyTotal)}) tidak sama dengan subtotal rincian (${formatRupiah(total)}). Silakan klik 'Sync'!` });
            return;
        }
        
        let newStatus = entryForm.status;
        if (editingCompIdx === null) {
            // Komponen baru yang ditambahkan: status selalu DRAFT (wajib diajukan & disetujui Yayasan/Sarpras)
            newStatus = 'DRAFT';
        } else if (newStatus === 'REJECTED' || !newStatus) {
            newStatus = (currentPlan?.status === 'APPROVED' || currentPlan?.status === 'PENDING') ? currentPlan.status : 'DRAFT';
        }

        let newSarprasStatus = entryForm.sarprasStatus;
        if (entryForm.isAsset) {
            if (isSarprasRequiredYear) {
                if (editingCompIdx === null) {
                    // Pengajuan baru: wajib verifikasi Sarpras
                    newSarprasStatus = 'PENDING';
                } else if (!newSarprasStatus) {
                    // Rincian lama yang sudah ada sebelumnya: otomatis disetujui
                    newSarprasStatus = 'APPROVED';
                }
            } else {
                newSarprasStatus = 'APPROVED';
            }
        } else {
            newSarprasStatus = null;
        }

        const newComp = {
            ...entryForm,
            volume: parseFloat(entryForm.volume),
            kali: parseFloat(entryForm.kali),
            harga: parseFloat(entryForm.harga),
            total,
            status: newStatus,
            isApproved: newStatus === 'APPROVED',
            isAsset: !!entryForm.isAsset,
            assetName: entryForm.isAsset ? (entryForm.assetName || entryForm.label || '') : '',
            namaAset: entryForm.isAsset ? (entryForm.assetName || entryForm.label || '') : '',
            assetCategory: entryForm.isAsset ? (entryForm.assetCategory || '') : '',
            assetRoom: entryForm.isAsset ? (entryForm.assetRoom || '') : '',
            assetProcurementType: entryForm.isAsset ? (entryForm.assetProcurementType || 'BARU') : 'BARU',
            sarprasStatus: newSarprasStatus,
            sarprasNotes: entryForm.sarprasNotes || ''
        };

        setCurrentPlan(prev => {
            const plans = prev[type][itemId] || [];
            let planFound = false;

            const updatedPlans = plans.map(p => {
                if (p.id !== planId) return p;
                planFound = true;

                const components = p.components && p.components.length > 0 ? [...p.components] : [];
                if (editingCompIdx !== null) components[editingCompIdx] = newComp;
                else components.push(newComp);

                const newTotal = components.reduce((sum, c) => sum + (parseFloat(c.total) || 0), 0);
                const newBosAmount = components.reduce((sum, c) => sum + (c.useBos ? (parseFloat(c.total) || 0) : 0), 0);

                // Aggregate months from all components
                const aggregatedMonths = {};
                components.forEach(c => {
                    Object.entries(c.months || {}).forEach(([mId, mData]) => {
                        if (!mData.m) return;
                        if (!aggregatedMonths[mId]) aggregatedMonths[mId] = { m: true, jumlah: 0 };
                        aggregatedMonths[mId].jumlah += (parseFloat(mData.jumlah) || 0);
                    });
                });

                const updatedPlan = {
                    ...p,
                    components,
                    total: newTotal,
                    bosAmount: newBosAmount,
                    useBos: newBosAmount > 0,
                    semester: components[0]?.semester || '1',
                    programId: components[0]?.programId || '',
                    description: components.map(c => c.label).join(', '),
                    months: aggregatedMonths
                };

                return updatedPlan;
            });

            if (!planFound && editingItem?.isNewPlan) {
                const newPlan = {
                    id: planId,
                    itemId: itemId,
                    total: newComp.total,
                    components: [newComp],
                    months: newComp.months || {},
                    semester: newComp.semester || '1',
                    programId: newComp.programId || '',
                    useBos: !!newComp.useBos,
                    bosAmount: newComp.useBos ? newComp.total : 0,
                    description: newComp.label
                };
                return { ...prev, [type]: { ...prev[type], [itemId]: [...plans, newPlan] } };
            }

            return { ...prev, [type]: { ...prev[type], [itemId]: updatedPlans } };
        });

        setEntryForm({
            label: '',
            volume: 0,
            satuan: '',
            kali: 1,
            harga: 0,
            programId: '',
            semester: '1',
            months: {},
            isAsset: false,
            assetName: '',
            assetCategory: '',
            assetRoom: '',
            assetProcurementType: 'BARU',
            sarprasStatus: null,
            sarprasNotes: ''
        });
        setEditingCompIdx(null);
        setShowCompModal(false);
    };

    const handleAddComponent = (itemId, planId) => {
        const type = activeTab === 'INCOME' ? 'income' : 'expense';
        setCurrentPlan(prev => {
            const plans = prev[type][itemId] || [];
            let planFound = false;

            const updatedPlans = plans.map(p => {
                if (p.id !== planId) return p;
                planFound = true;

                const components = p.components && p.components.length > 0 ? [...p.components] : [];
                components.push({ label: '', volume: 1, satuan: '', kali: 1, harga: 0, total: 0 });

                const newTotal = components.reduce((sum, c) => sum + (parseFloat(c.total) || 0), 0);
                const updatedPlan = { ...p, components, total: newTotal };

                if (fundSourceFilter === 'BOS' || editingItem?.sourceOfFunds === 'BOS') {
                    updatedPlan.useBos = true;
                    updatedPlan.bosAmount = newTotal;
                }
                return updatedPlan;
            });

            if (!planFound && editingItem?.isNewPlan) {
                const newComp = { label: '', volume: 1, satuan: '', kali: 1, harga: 0, total: 0 };
                const newPlan = {
                    id: planId,
                    itemId: itemId,
                    total: 0,
                    components: [newComp],
                    months: {},
                    semester: editingItem.semester || '1',
                    useBos: fundSourceFilter === 'BOS' || editingItem?.sourceOfFunds === 'BOS',
                    bosAmount: 0
                };
                return { ...prev, [type]: { ...prev[type], [itemId]: [...plans, newPlan] } };
            }

            return { ...prev, [type]: { ...prev[type], [itemId]: updatedPlans } };
        });
    };

    const handleEntryMonthlyUpdate = (monthId, field, value) => {
        setEntryForm(prev => {
            const currentMonths = prev.months || {};
            const currentMonthData = currentMonths[monthId] || { jumlah: 0, m: false };
            let updatedMonthData = { ...currentMonthData, [field]: value };

            if (field === 'm' && value === false) updatedMonthData.jumlah = 0;
            if (field === 'jumlah' && (parseFloat(value) || 0) > 0) updatedMonthData.m = true;
            if (field === 'jumlah' && (parseFloat(value) || 0) <= 0) updatedMonthData.m = false;

            return { ...prev, months: { ...currentMonths, [monthId]: updatedMonthData } };
        });
    };

    const handleSyncEntryMonthly = () => {
        const total = (parseFloat(entryForm.volume) || 0) * (parseFloat(entryForm.kali) || 1) * (parseFloat(entryForm.harga) || 0);
        if (total <= 0) return;

        const monthsData = { ...(entryForm.months || {}) };
        const activeMonthIds = Object.keys(monthsData).filter(mId => monthsData[mId]?.m);

        if (activeMonthIds.length === 0) {
            setMessage({ type: 'error', text: 'Pilih setidaknya satu bulan (centang) untuk membagi anggaran!' });
            setTimeout(() => setMessage(null), 3000);
            return;
        }

        const amountPerMonth = Math.floor(total / activeMonthIds.length);
        const remainder = total % activeMonthIds.length;

        activeMonthIds.forEach((mId, idx) => {
            monthsData[mId] = {
                ...monthsData[mId],
                jumlah: amountPerMonth + (idx === 0 ? remainder : 0)
            };
        });

        setEntryForm(prev => ({ ...prev, months: monthsData }));
    };

    const handleRemoveComponent = (itemId, planId, index) => {
        const type = activeTab === 'INCOME' ? 'income' : 'expense';
        setCurrentPlan(prev => {
            const plans = prev[type][itemId] || [];
            const updatedPlans = plans.map(p => {
                if (p.id !== planId) return p;

                const components = (p.components || []).filter((_, i) => i !== index);
                const newTotal = components.reduce((sum, c) => sum + (parseFloat(c.total) || 0), 0);
                const newBosAmount = components.reduce((sum, c) => sum + (c.useBos ? (parseFloat(c.total) || 0) : 0), 0);

                // Aggregate months from remaining components
                const aggregatedMonths = {};
                let firstProgramId = '';
                let firstSemester = '1';
                components.forEach(c => {
                    if (!firstProgramId && c.programId) firstProgramId = c.programId;
                    if (c.semester) firstSemester = c.semester;
                    Object.entries(c.months || {}).forEach(([mId, mData]) => {
                        if (!mData.m) return;
                        if (!aggregatedMonths[mId]) aggregatedMonths[mId] = { m: true, jumlah: 0 };
                        aggregatedMonths[mId].jumlah += (parseFloat(mData.jumlah) || 0);
                    });
                });

                const updatedPlan = {
                    ...p,
                    components,
                    total: newTotal,
                    bosAmount: newBosAmount,
                    useBos: newBosAmount > 0,
                    semester: firstSemester,
                    programId: firstProgramId,
                    months: aggregatedMonths,
                    description: components.length > 0 ? components[0].label : ''
                };

                return updatedPlan;
            });

            return { ...prev, [type]: { ...prev[type], [itemId]: updatedPlans } };
        });
    };

    const handleAjukanDraftsInModal = async (draftIndexes) => {
        if (!editingItem || draftIndexes.length === 0) return;
        
        const mId = editingItem.itemId || editingItem.id;
        const type = activeTab === 'INCOME' ? 'income' : 'expense';
        const plans = currentPlan[type][mId] || [];
        const planIndex = plans.findIndex(p => p.id === editingItem.planId) !== -1 
            ? plans.findIndex(p => p.id === editingItem.planId) 
            : 0;
        
        const plan = plans[planIndex];
        if (!plan) return;

        const newComps = [...(plan.components || [])];

        // Validasi Ketat: Jika TA >= 2026-2027, rincian bertipe Aset harus di-ACC Sarpras terlebih dahulu
        if (isSarprasRequiredYear) {
            const blockedAssets = [];
            draftIndexes.forEach(idx => {
                const c = newComps[idx];
                if (c && c.isAsset && c.sarprasStatus !== 'APPROVED') {
                    const stLabel = c.sarprasStatus === 'REJECTED' ? 'Ditolak Sarpras' : 'Menunggu ACC Sarpras';
                    blockedAssets.push(`"${c.assetName || c.label || 'Aset'}" (${stLabel})`);
                }
            });

            if (blockedAssets.length > 0) {
                alert(`PENGAJUAN DITAHAN:\n\nTerdapat ${blockedAssets.length} rincian belanja aset yang belum disetujui (ACC) oleh Bidang Sarana Prasarana:\n\n${blockedAssets.map(a => `• ${a}`).join('\n')}\n\nSilakan tunggu verifikasi/persetujuan dari Sarpras atau perbaiki rincian aset terlebih dahulu sebelum mengajukan ke Yayasan.`);
                return;
            }
        }

        draftIndexes.forEach(idx => {
            if (newComps[idx]) {
                newComps[idx] = { ...newComps[idx], status: 'PENDING' };
            }
        });

        const updatedPlan = { ...plan, components: newComps };
        const newPlans = [...plans];
        newPlans[planIndex] = updatedPlan;

        // Sweep ALL expense items: mark eligible DRAFT/REJECTED components as PENDING
        // (Rincian aset yang belum di-ACC Sarpras tetap dipertahankan sebagai DRAFT)
        const sweepedExpense = { ...currentPlan.expense };
        Object.keys(sweepedExpense).forEach(itemId => {
            const itemPlans = sweepedExpense[itemId];
            if (Array.isArray(itemPlans)) {
                sweepedExpense[itemId] = itemPlans.map(p => ({
                    ...p,
                    components: (p.components || []).map(c => {
                        if (c.status === 'DRAFT' || c.status === 'REJECTED' || !c.status) {
                            if (c.isAsset && isSarprasRequiredYear && c.sarprasStatus !== 'APPROVED') {
                                return c; // Jangan ajukan aset yang belum di-ACC Sarpras
                            }
                            return { ...c, status: 'PENDING' };
                        }
                        return c;
                    })
                }));
            }
        });
        // Override with the specifically updated item
        sweepedExpense[mId] = newPlans;

        // Also sweep income
        const sweepedIncome = { ...currentPlan.income };
        Object.keys(sweepedIncome).forEach(itemId => {
            const itemPlans = sweepedIncome[itemId];
            if (Array.isArray(itemPlans)) {
                sweepedIncome[itemId] = itemPlans.map(p => ({
                    ...p,
                    components: (p.components || []).map(c =>
                        (c.status === 'DRAFT' || c.status === 'REJECTED' || !c.status)
                            ? { ...c, status: 'PENDING' }
                            : c
                    )
                }));
            }
        });

        // Set plan status to PENDING so superadmin gets notified
        const nextPlan = { 
            ...currentPlan, 
            expense: sweepedExpense, 
            income: sweepedIncome,
            status: 'PENDING',
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser?.username
        };
        setCurrentPlan(nextPlan);

        const planId = currentPlanId;
        const dbPlan = {
            id: planId,
            academicYearId: selectedYearId,
            unitId: selectedUnitId.startsWith('FIELD-') ? null : (selectedUnitId === 'FOUNDATION' ? 'FOUNDATION' : selectedUnitId),
            fieldId: selectedUnitId.startsWith('FIELD-') ? selectedUnitId.replace('FIELD-', '') : null,
            income: nextPlan.income,
            expense: nextPlan.expense,
            status: 'PENDING',
            notified: false,
            rejectionReason: null,
            updatedAt: nextPlan.updatedAt,
            updatedBy: nextPlan.updatedBy
        };

        const overspent = validatePlan(dbPlan);
                                                        if (overspent) {
                                                            alert(`DILARANG: Anggaran untuk "${overspent.name}" (${formatRupiah(overspent.budget)}) tidak boleh kurang dari realisasi saat ini (${formatRupiah(overspent.spent)}).`);
                                                            return;
                                                        }
                                                        await persistPlanToServer(dbPlan);
        setMessage({ type: 'success', text: `RAB berhasil diajukan ke Yayasan untuk direview!` });
        setTimeout(() => setMessage(null), 5000);
    };

    const handleBatalkanRincian = async (compIdx) => {
        if (!editingItem) return;
        const mId = editingItem.itemId || editingItem.id;
        const plans = currentPlan.expense[mId] || [];
        const planIndex = plans.findIndex(p => p.id === editingItem.planId) !== -1
            ? plans.findIndex(p => p.id === editingItem.planId)
            : 0;
        const plan = plans[planIndex];
        if (!plan) return;

        const newComps = [...(plan.components || [])];
        if (newComps[compIdx]) {
            newComps[compIdx] = { ...newComps[compIdx], status: 'DRAFT' };
        }

        const updatedPlan = { ...plan, components: newComps };
        const newPlans = [...plans];
        newPlans[planIndex] = updatedPlan;

        const tempPlan = {
            ...currentPlan,
            expense: { ...currentPlan.expense, [mId]: newPlans }
        };

        // Dynamically determine the overall status of the RAB Plan
        let hasPendingComp = false;
        let hasApprovedComp = false;

        const checkStatus = (comps) => {
            (comps || []).forEach(c => {
                if (c.status === 'PENDING') hasPendingComp = true;
                if (c.status === 'APPROVED' || c.isApproved) hasApprovedComp = true;
            });
        };

        // Check expense
        Object.values(tempPlan.expense || {}).forEach(plansArr => {
            const arr = Array.isArray(plansArr) ? plansArr : (plansArr && typeof plansArr === 'object' && Object.keys(plansArr).length > 0 ? [plansArr] : []);
            arr.forEach(p => checkStatus(p?.components));
        });

        // Check income
        Object.values(tempPlan.income || {}).forEach(plansArr => {
            const arr = Array.isArray(plansArr) ? plansArr : (plansArr && typeof plansArr === 'object' && Object.keys(plansArr).length > 0 ? [plansArr] : []);
            arr.forEach(p => checkStatus(p?.components));
        });

        const newPlanStatus = hasPendingComp ? 'PENDING' : (hasApprovedComp ? 'APPROVED' : 'DRAFT');

        const nextPlan = {
            ...tempPlan,
            status: newPlanStatus,
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser?.username
        };
        setCurrentPlan(nextPlan);

        const planId = currentPlanId;
        const dbPlan = {
            id: planId,
            academicYearId: selectedYearId,
            unitId: selectedUnitId.startsWith('FIELD-') ? null : (selectedUnitId === 'FOUNDATION' ? 'FOUNDATION' : selectedUnitId),
            fieldId: selectedUnitId.startsWith('FIELD-') ? selectedUnitId.replace('FIELD-', '') : null,
            income: nextPlan.income,
            expense: nextPlan.expense,
            status: newPlanStatus,
            rejectionReason: null,
            updatedAt: nextPlan.updatedAt,
            updatedBy: nextPlan.updatedBy
        };
        await persistPlanToServer(dbPlan);
        setMessage({ type: 'success', text: 'Pengajuan rincian dibatalkan. Rincian kembali ke status Draft.' });
        setTimeout(() => setMessage(null), 4000);
    };

    const handleSuperAdminCancelComponent = async (compIdx) => {
        if (!editingItem) return;
        const mId = editingItem.itemId || editingItem.id;
        const plans = currentPlan.expense[mId] || [];
        const planIndex = plans.findIndex(p => p.id === editingItem.planId) !== -1
            ? plans.findIndex(p => p.id === editingItem.planId)
            : 0;
        const plan = plans[planIndex];
        if (!plan) return;

        const reason = window.prompt('Masukkan alasan pembatalan/penolakan rincian ini:', 'Pembatalan persetujuan rincian.');
        if (reason === null) return; // User cancelled prompt

        const newComps = [...(plan.components || [])];
        if (newComps[compIdx]) {
            newComps[compIdx] = { 
                ...newComps[compIdx], 
                status: 'REJECTED', 
                isApproved: false 
            };
        }

        const updatedPlan = { ...plan, components: newComps };
        const newPlans = [...plans];
        newPlans[planIndex] = updatedPlan;

        const updatedExpense = { ...currentPlan.expense, [mId]: newPlans };
        
        let hasPendingComp = false;
        let hasApprovedComp = false;
        Object.keys(updatedExpense).forEach(itemId => {
            const itemPlans = Array.isArray(updatedExpense[itemId]) ? updatedExpense[itemId] : [updatedExpense[itemId]];
            itemPlans.forEach(p => {
                (p?.components || []).forEach(c => {
                    if (c.status === 'PENDING') hasPendingComp = true;
                    if (c.status === 'APPROVED' || c.isApproved) hasApprovedComp = true;
                });
            });
        });
        const newPlanStatus = hasPendingComp ? 'PENDING' : (hasApprovedComp ? 'APPROVED' : 'REJECTED');

        const nextPlan = {
            ...currentPlan,
            expense: updatedExpense,
            status: newPlanStatus,
            rejectionReason: reason,
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser?.username
        };
        setCurrentPlan(nextPlan);

        const planId = currentPlanId;
        const dbPlan = {
            id: planId,
            academicYearId: selectedYearId,
            unitId: selectedUnitId.startsWith('FIELD-') ? null : (selectedUnitId === 'FOUNDATION' ? 'FOUNDATION' : selectedUnitId),
            fieldId: selectedUnitId.startsWith('FIELD-') ? selectedUnitId.replace('FIELD-', '') : null,
            income: nextPlan.income,
            expense: nextPlan.expense,
            status: newPlanStatus,
            rejectionReason: reason,
            updatedAt: nextPlan.updatedAt,
            updatedBy: nextPlan.updatedBy
        };
        await persistPlanToServer(dbPlan);
        setMessage({ type: 'success', text: 'Persetujuan rincian berhasil dibatalkan.' });
        setTimeout(() => setMessage(null), 4000);
    };

    const handleResetBudget = (itemId) => {
        const type = activeTab === 'INCOME' ? 'income' : 'expense';
        if (!window.confirm('Apakah Anda yakin ingin mengosongkan rincian alokasi bulanan untuk item ini? (Rincian komponen tetap dipertahankan)')) return;

        setCurrentPlan(prev => ({
            ...prev,
            [type]: {
                ...prev[type],
                [itemId]: {
                    ...prev[type][itemId],
                    months: {}
                }
            }
        }));
        setMessage({ type: 'success', text: 'Alokasi bulanan telah dikosongkan.' });
        setTimeout(() => setMessage(null), 3000);
    };

    const handleSyncMonthly = (itemId) => {
        const type = activeTab === 'INCOME' ? 'income' : 'expense';
        setCurrentPlan(prev => {
            const currentItem = prev[type][itemId] || { total: 0, months: {} };
            const monthsData = { ...(currentItem.months || {}) };
            const activeMonthIds = Object.keys(monthsData).filter(mId => monthsData[mId]?.m);

            if (activeMonthIds.length === 0) {
                setMessage({ type: 'error', text: 'Pilih setidaknya satu bulan (centang) untuk membagi anggaran!' });
                setTimeout(() => setMessage(null), 3000);
                return prev;
            }

            const totalToSync = currentItem.total || 0;
            if (totalToSync <= 0) {
                setMessage({ type: 'error', text: 'Total anggaran harus lebih dari 0 untuk disinkronkan!' });
                setTimeout(() => setMessage(null), 3000);
                return prev;
            }

            const amountPerMonth = Math.floor(totalToSync / activeMonthIds.length);
            const remainder = totalToSync % activeMonthIds.length;

            activeMonthIds.forEach((mId, idx) => {
                monthsData[mId] = {
                    ...monthsData[mId],
                    jumlah: amountPerMonth + (idx === 0 ? remainder : 0)
                };
            });

            return {
                ...prev,
                [type]: {
                    ...prev[type],
                    [itemId]: { ...currentItem, months: monthsData }
                }
            };
        });
        setMessage({ type: 'success', text: 'Anggaran berhasil disinkronkan ke rincian bulanan.' });
        setTimeout(() => setMessage(null), 3000);
    };

    const incomeExpenseBalances = useMemo(() => {
        const balances = {};
        const settings = state.distributionSettings || [];
        const isField = selectedUnitId.startsWith('FIELD-');
        const fieldId = isField ? selectedUnitId.replace('FIELD-', '') : selectedUnitId;

        (filteredIncomeItems || []).forEach(item => {
            // Find distribution rules where this income item is the source
            // Note: settings already has unitId/fieldId associations
            const itemSettings = settings.filter(s =>
                s.incomeItemId === item.id &&
                s.unitId === (isField ? s.unitId : selectedUnitId) // If field, we look at all units contributing to the field? 
                // Wait, if I'm viewing a field, I want to see how much of the field's income goes where.
                // Actually, settings.unitId is the source unit.
            );

            const totalSpent = itemSettings.reduce((sum, s) => {
                // If the target (destId) matches our current context
                const isMatch = s.destId === (isField ? fieldId : selectedUnitId);
                if (!isMatch) return sum;

                const expenseDetail = currentPlan.expense[s.expenseItemId] || { total: 0 };
                const percentage = parseFloat(s.percentage) || 0;
                return sum + ((expenseDetail.total || 0) * percentage / 100);
            }, 0);
            balances[item.id] = totalSpent;
        });
        return balances;
    }, [filteredIncomeItems, state.distributionSettings, currentPlan.expense, selectedUnitId]);

    // NEW: Calculate spending per unit for field-allocated items
    const rabUnitBreakdown = useMemo(() => {
        const breakdown = {}; // { [expenseItemId]: { [unitId]: totalAmount } }

        Object.entries(currentPlan.expense || {}).forEach(([itemId, detail]) => {
            if (!detail.targetUnitId || !detail.total) return;

            if (!breakdown[itemId]) breakdown[itemId] = {};
            breakdown[itemId][detail.targetUnitId] = (breakdown[itemId][detail.targetUnitId] || 0) + detail.total;
        });

        return breakdown;
    }, [currentPlan.expense]);

    const handleCloseModal = () => {
        setEditingItem(null);
        setMessage({ type: 'success', text: 'Rincian sementara disimpan ke draft. Klik "SIMPAN DRAFT" di atas untuk menyimpan ke database!' });
        setTimeout(() => setMessage(null), 8000);
    };

    const handleMonthlyUpdate = (itemId, planId, monthId, field, value) => {
        const type = activeTab === 'INCOME' ? 'income' : 'expense';
        setCurrentPlan(prev => {
            const plans = prev[type][itemId] || [];
            let planFound = false;

            const updatedPlans = plans.map(p => {
                if (p.id !== planId) return p;
                planFound = true;

                const currentMonths = p.months || {};
                const currentMonthData = currentMonths[monthId] || { jumlah: 0, m: false };
                let updatedMonthData = { ...currentMonthData, [field]: value };

                if (field === 'm' && value === false) updatedMonthData.jumlah = 0;
                if (field === 'jumlah' && (parseFloat(value) || 0) > 0) updatedMonthData.m = true;
                if (field === 'jumlah' && (parseFloat(value) || 0) <= 0) updatedMonthData.m = false;

                const updatedMonths = { ...currentMonths, [monthId]: updatedMonthData };
                const newTotal = Object.values(updatedMonths).reduce((sum, m) => sum + (m?.m ? (parseFloat(m?.jumlah) || 0) : 0), 0);

                return { ...p, months: updatedMonths, total: newTotal };
            });

            if (!planFound && editingItem?.isNewPlan) {
                const updatedMonthData = { jumlah: 0, m: false, [field]: value };
                if (field === 'm' && value === false) updatedMonthData.jumlah = 0;
                if (field === 'jumlah' && (parseFloat(value) || 0) > 0) updatedMonthData.m = true;
                if (field === 'jumlah' && (parseFloat(value) || 0) <= 0) updatedMonthData.m = false;

                const newPlan = {
                    id: planId,
                    itemId: itemId,
                    total: updatedMonthData.m ? (parseFloat(updatedMonthData.jumlah) || 0) : 0,
                    components: [],
                    months: { [monthId]: updatedMonthData },
                    semester: editingItem.semester || '1'
                };
                return { ...prev, [type]: { ...prev[type], [itemId]: [...plans, newPlan] } };
            }

            return { ...prev, [type]: { ...prev[type], [itemId]: updatedPlans } };
        });
    };



    const months = useMemo(() => {
        const selectedYear = academicYears.find(ay => ay.id === selectedYearId);
        return generateMonths(selectedYear);
    }, [selectedYearId, academicYears]);

    const handleAddItem = async () => {
        if (!newItemData.name || !newItemData.incomeItemId || !selectedUnitId) return;
        setIsSaving(true);

        const isField = selectedUnitId.startsWith('FIELD-');
        const unitId = isField ? null : (selectedUnitId === 'FOUNDATION' ? null : selectedUnitId);
        const fieldId = isField ? selectedUnitId.replace('FIELD-', '') : null;

        const incomeItem = incomeItems.find(ii => ii.id === newItemData.incomeItemId);
        const expenseItemId = `EXP-${Date.now().toString(36).toUpperCase()}`;

        const newExpenseItem = {
            id: expenseItemId,
            name: newItemData.name,
            unitId: unitId,
            fieldId: fieldId,
            sourceOfFunds: newItemData.sourceOfFunds,
            isDeleted: false
        };

        // Create 100% distribution rule automatically
        const distributionRule = {
            id: `DIST-${Date.now().toString(36).toUpperCase()}`,
            unitId: isField ? (state.units.find(u => u.fieldId === fieldId)?.id || 'FOUNDATION') : selectedUnitId,
            incomeItemId: newItemData.incomeItemId,
            expenseItemId: expenseItemId,
            percentage: 100,
            destType: isField ? 'field' : 'unit',
            destId: isField ? fieldId : selectedUnitId,
            isDeleted: false
        };

        try {
            // 1. Add Expense Item
            dispatch({ type: 'ADD_EXPENSE_ITEM', payload: newExpenseItem });
            await api.pushAction({ type: 'ADD_EXPENSE_ITEM', payload: newExpenseItem }, state);

            // 2. Update Distribution Settings
            // Note: UPDATE_DISTRIBUTION_SETTINGS usually takes an array of settings for a specific unit-income pair
            // But we just want to add one. For simplicity and to avoid wiping others, we'll use the existing state.
            const existingSettings = state.distributionSettings.filter(s =>
                s.unitId === distributionRule.unitId && s.incomeItemId === distributionRule.incomeItemId
            );
            const updatedSettings = [...existingSettings, distributionRule];

            dispatch({
                type: 'UPDATE_DISTRIBUTION_SETTINGS', payload: {
                    unitId: distributionRule.unitId,
                    incomeItemId: distributionRule.incomeItemId,
                    settings: updatedSettings
                }
            });
            await api.pushAction({
                type: 'UPDATE_DISTRIBUTION_SETTINGS', payload: {
                    unitId: distributionRule.unitId,
                    incomeItemId: distributionRule.incomeItemId,
                    settings: updatedSettings
                }
            }, state);

            setMessage({ type: 'success', text: `Item "${newItemData.name}" berhasil ditambahkan ke RAB.` });
            setIsAddingItem(false);
            setNewItemData({ name: '', incomeItemId: '' });
        } catch (error) {
            setMessage({ type: 'error', text: 'Gagal menambah item: ' + error.message });
        } finally {
            setIsSaving(false);
            setTimeout(() => setMessage(null), 5000);
        }
    };
    const persistPlanToServer = async (planData) => {
        try {
            dispatch({ type: 'SET_RAB_PLAN', payload: planData });
            await api.pushAction({ type: 'SET_RAB_PLAN', payload: planData }, state);
            return true;
        } catch (error) {
            console.error('Failed to persist RAB plan:', error);
            throw error;
        }
    };

    const handleSarprasActionOnAnyPlan = async (targetPlanId, itemId, subGroupId, compIdx, newStatus, notes = '') => {
        try {
            setIsSaving(true);
            const targetPlan = (rabPlans || []).find(p => p.id === targetPlanId);
            if (!targetPlan) {
                throw new Error('RAB target tidak ditemukan');
            }

            const newExpense = { ...(targetPlan.expense || {}) };
            const groups = [...(newExpense[itemId] || [])];
            const groupIndex = groups.findIndex(g => g.id === subGroupId);
            if (groupIndex === -1) {
                throw new Error('Kelompok rincian anggaran tidak ditemukan');
            }

            const targetGroup = { ...groups[groupIndex] };
            const components = [...(targetGroup.components || [])];
            if (!components[compIdx]) {
                throw new Error('Komponen aset tidak ditemukan');
            }

            components[compIdx] = {
                ...components[compIdx],
                sarprasStatus: newStatus,
                sarprasNotes: notes || ''
            };
            targetGroup.components = components;
            groups[groupIndex] = targetGroup;
            newExpense[itemId] = groups;

            const updatedPlan = {
                ...targetPlan,
                expense: newExpense,
                updatedAt: new Date().toISOString(),
                updatedBy: currentUser?.username
            };

            // If targetPlan is the active editing plan, keep currentPlan in sync
            if (targetPlanId === currentPlanId) {
                setCurrentPlan(prev => ({
                    ...prev,
                    expense: newExpense
                }));
            }

            await persistPlanToServer(updatedPlan);
            setMessage({
                type: 'success',
                text: `Rincian aset "${components[compIdx].assetName || components[compIdx].label}" berhasil di-${newStatus === 'APPROVED' ? 'ACC Sarpras' : 'tolak Sarpras'}`
            });
            setRejectModalItem(null);
            setRejectModalReason('');
        } catch (err) {
            setMessage({ type: 'error', text: 'Gagal memperbarui status Sarpras: ' + err.message });
        } finally {
            setIsSaving(false);
            setTimeout(() => setMessage(null), 3500);
        }
    };

    const handleBatchApproveSarprasAssets = async (itemsToApprove) => {
        if (!itemsToApprove || itemsToApprove.length === 0) return;
        if (!window.confirm(`Yakin ingin menyetujui (ACC) sekaligus ${itemsToApprove.length} item pengadaan aset ini?`)) return;

        try {
            setIsSaving(true);
            const itemsByPlan = {};
            itemsToApprove.forEach(item => {
                if (!itemsByPlan[item.planId]) itemsByPlan[item.planId] = [];
                itemsByPlan[item.planId].push(item);
            });

            for (const [planId, items] of Object.entries(itemsByPlan)) {
                const targetPlan = (rabPlans || []).find(p => p.id === planId);
                if (!targetPlan) continue;

                const newExpense = { ...(targetPlan.expense || {}) };

                items.forEach(it => {
                    const groups = [...(newExpense[it.itemId] || [])];
                    const gIdx = groups.findIndex(g => g.id === it.subGroupId);
                    if (gIdx !== -1) {
                        const grp = { ...groups[gIdx] };
                        const comps = [...(grp.components || [])];
                        if (comps[it.compIdx]) {
                            comps[it.compIdx] = {
                                ...comps[it.compIdx],
                                sarprasStatus: 'APPROVED',
                                sarprasNotes: ''
                            };
                            grp.components = comps;
                            groups[gIdx] = grp;
                            newExpense[it.itemId] = groups;
                        }
                    }
                });

                const updatedPlan = {
                    ...targetPlan,
                    expense: newExpense,
                    updatedAt: new Date().toISOString(),
                    updatedBy: currentUser?.username
                };

                if (planId === currentPlanId) {
                    setCurrentPlan(prev => ({
                        ...prev,
                        expense: newExpense
                    }));
                }

                await persistPlanToServer(updatedPlan);
            }

            setMessage({
                type: 'success',
                text: `Berhasil meng-ACC ${itemsToApprove.length} rincian aset!`
            });
        } catch (err) {
            setMessage({ type: 'error', text: 'Gagal melakukan ACC masal: ' + err.message });
        } finally {
            setIsSaving(false);
            setTimeout(() => setMessage(null), 3500);
        }
    };

    const handleSarprasApproveComponent = async (itemId, planId, compIdx, newStatus, notes = '') => {
        return handleSarprasActionOnAnyPlan(currentPlanId, itemId, planId, compIdx, newStatus, notes);
    };



    const handleCreateRevision = async () => {
        if (!activePlan) return;
        if (window.confirm("Apakah Anda yakin ingin mengajukan usulan revisi/pergeseran anggaran untuk unit ini?")) {
            setIsSaving(true);
            try {
                const newRevisionPlan = {
                    ...activePlan,
                    id: revisionPlanId,
                    status: 'DRAFT',
                    rejectionReason: null,
                    updatedAt: new Date().toISOString(),
                    updatedBy: currentUser?.username
                };
                
                await persistPlanToServer(newRevisionPlan);
                setMessage({ type: 'success', text: 'Draf usulan revisi anggaran berhasil dibuat. Anda sekarang dapat melakukan penyesuaian.' });
            } catch (err) {
                alert("Gagal membuat draf revisi: " + err.message);
            } finally {
                setIsSaving(false);
            }
        }
    };

    const handleDeleteRevision = async () => {
        if (!revisionPlan) return;
        if (window.confirm("Apakah Anda yakin ingin menghapus draf revisi anggaran ini? Tindakan ini akan membatalkan semua perubahan yang belum disetujui.")) {
            setIsSaving(true);
            try {
                dispatch({ type: 'DELETE_RAB_PLAN', payload: revisionPlanId });
                await api.pushAction({ type: 'DELETE_RAB_PLAN', payload: revisionPlanId }, state);
                
                setMessage({ type: 'success', text: 'Draf usulan revisi berhasil dihapus.' });
            } catch (err) {
                alert("Gagal menghapus draf revisi: " + err.message);
            } finally {
                setIsSaving(false);
            }
        }
    };
    const handleSave = async () => {
        setIsSaving(true);
        setMessage(null);

        const planId = currentPlanId;
        const newPlan = {
            id: planId,
            academicYearId: selectedYearId,
            unitId: selectedUnitId.startsWith('FIELD-') ? null : (selectedUnitId === 'FOUNDATION' ? 'FOUNDATION' : selectedUnitId),
            fieldId: selectedUnitId.startsWith('FIELD-') ? selectedUnitId.replace('FIELD-', '') : null,
            income: currentPlan.income,
            expense: currentPlan.expense,
            status: currentPlan.status, // Preserve status
            rejectionReason: currentPlan.rejectionReason,
            notified: currentPlan.notified, // PRESERVE NOTIFIED FLAG
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser?.username
        };


        // 4. Strict Validation: Realization/Spending Limit
        const overspentComponent = validatePlan(newPlan);
        if (overspentComponent) {
            setMessage({
                type: 'error',
                text: `DILARANG: Anggaran untuk "${overspentComponent.name}" (${formatRupiah(overspentComponent.budget)}) tidak boleh kurang dari realisasi saat ini (${formatRupiah(overspentComponent.spent)}).`
            });
            setIsSaving(false);
            setTimeout(() => setMessage(null), 7000);
            return;
        }

        // 1. Strict Validation: BOS Limit
        if (isBosRecipient && totalExpenseBos > (totalBosAllocated + 100)) {
            setMessage({
                type: 'error',
                text: `DILARANG: Total rencana belanja BOS (${formatRupiah(totalExpenseBos)}) melebihi total alokasi BOS (${formatRupiah(totalBosAllocated)}).`
            });
            setIsSaving(false);
            setTimeout(() => setMessage(null), 7000);
            return;
        }

        // 2. Strict Validation: Yayasan Item Limits (after BOS savings)
        const overBudgetItem = activeTab === 'EXPENSE' ? filteredExpenseItems.find(item => {
            const detail = newPlan.expense[item.id] || { total: 0 };
            const allocated = rapData.itemAllocations[item.id] || 0;
            if (detail.total <= 0 || allocated === 0) return false;

            const yayasanSpent = detail.total - (parseFloat(detail.bosAmount) || 0);
            return yayasanSpent > (allocated + 100);
        }) : null;

        if (overBudgetItem) {
            setMessage({
                type: 'error',
                text: `DILARANG: Item "${overBudgetItem.name}" melebihi rencana penerimaan Yayasan (setelah dikurangi porsi BOS).`
            });
            setIsSaving(false);
            setTimeout(() => setMessage(null), 7000);
            return;
        }

        // 3. Strict Validation: Per-Item BOS Limits
        const overBosItem = Object.keys(newPlan.expense).find(itemId => {
            const detail = newPlan.expense[itemId];
            const limit = bosItemMap[itemId] || 0;
            const spent = parseFloat(detail.bosAmount) || 0;
            return spent > (limit + 100);
        });

        if (overBosItem) {
            const itm = expenseItems.find(e => e.id === overBosItem);
            setMessage({
                type: 'error',
                text: `DILARANG: Item "${itm?.name || 'terkait'}" melebihi alokasi BOS (${formatRupiah(bosItemMap[overBosItem])}).`
            });
            setIsSaving(false);
            setTimeout(() => setMessage(null), 7000);
            return;
        }

        try {
            await persistPlanToServer(newPlan);
            setMessage({ type: 'success', text: 'Rencana Anggaran (RAB) berhasil disimpan secara permanen.' });
        } catch (error) {
            setMessage({ type: 'error', text: 'Gagal menyimpan RAB: ' + error.message });
        } finally {
            setIsSaving(false);
            setTimeout(() => setMessage(null), 5000);
        }
    };

    const handleSubmitReview = async () => {
        setIsSaving(true);
        const planId = currentPlanId;

        // Validasi Ketat: Jika TA >= 2026-2027, cek seluruh belanja apakah ada aset yang belum di-ACC Sarpras
        if (isSarprasRequiredYear) {
            const unapprovedAssets = [];
            Object.values(currentPlan?.expense || {}).forEach(plans => {
                const plansArr = Array.isArray(plans) ? plans : [plans];
                plansArr.forEach(p => {
                    (p?.components || []).forEach(c => {
                        if (c && c.isAsset && (c.status === 'DRAFT' || c.status === 'REJECTED' || !c.status)) {
                            if (c.sarprasStatus !== 'APPROVED') {
                                const stLabel = c.sarprasStatus === 'REJECTED' ? 'Ditolak Sarpras' : 'Menunggu ACC Sarpras';
                                unapprovedAssets.push(`"${c.assetName || c.label || 'Aset'}" (${stLabel})`);
                            }
                        }
                    });
                });
            });

            if (unapprovedAssets.length > 0) {
                setMessage({
                    type: 'error',
                    text: `PENGAJUAN DITAHAN: Terdapat ${unapprovedAssets.length} rincian belanja aset yang belum disetujui Sarpras (${unapprovedAssets.slice(0, 2).join(', ')}${unapprovedAssets.length > 2 ? '...' : ''}). Harap tunggu persetujuan Sarpras terlebih dahulu.`
                });
                setIsSaving(false);
                setTimeout(() => setMessage(null), 8000);
                return;
            }
        }

        // Automatically sweep and update all DRAFT/REJECTED components in both income and expense to PENDING
        const updatedExpense = { ...currentPlan.expense };
        Object.keys(updatedExpense).forEach(itemId => {
            const plans = updatedExpense[itemId];
            if (Array.isArray(plans)) {
                updatedExpense[itemId] = plans.map(p => {
                    const comps = p.components || [];
                    const updatedComps = comps.map(c => {
                        if (c.status === 'DRAFT' || c.status === 'REJECTED' || !c.status) {
                            return { ...c, status: 'PENDING' };
                        }
                        return c;
                    });
                    return { ...p, components: updatedComps };
                });
            }
        });

        const updatedIncome = { ...currentPlan.income };
        Object.keys(updatedIncome).forEach(itemId => {
            const plans = updatedIncome[itemId];
            if (Array.isArray(plans)) {
                updatedIncome[itemId] = plans.map(p => {
                    const comps = p.components || [];
                    const updatedComps = comps.map(c => {
                        if (c.status === 'DRAFT' || c.status === 'REJECTED' || !c.status) {
                            return { ...c, status: 'PENDING' };
                        }
                        return c;
                    });
                    return { ...p, components: updatedComps };
                });
            }
        });

        const submittedPlan = {
            id: planId,
            academicYearId: selectedYearId,
            unitId: selectedUnitId.startsWith('FIELD-') ? null : (selectedUnitId === 'FOUNDATION' ? 'FOUNDATION' : selectedUnitId),
            fieldId: selectedUnitId.startsWith('FIELD-') ? selectedUnitId.replace('FIELD-', '') : null,
            income: updatedIncome,
            expense: updatedExpense,
            status: 'PENDING',
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser?.username
        };

        // 1. Strict Validation: BOS Limit for Submission
        if (isBosRecipient && totalExpenseBos > (totalBosAllocated + 100)) {
            setMessage({
                type: 'error',
                text: `PENGAJUAN DITOLAK: Total rencana belanja BOS melebihi alokasi tersedia (${formatRupiah(totalBosAllocated)}).`
            });
            setIsSaving(false);
            setTimeout(() => setMessage(null), 7000);
            return;
        }

        // 2. Strict Validation: Yayasan Item Limits for Submission
        const overBudgetItemSubmit = filteredExpenseItems.find(item => {
            const detail = submittedPlan.expense[item.id] || [];
            const allocated = rapData.itemAllocations[item.id] || 0;
            
            const detailTotal = Array.isArray(detail) ? detail.reduce((s, d) => s + (parseFloat(d.total) || 0), 0) : (detail.total || 0);
            const detailBos = Array.isArray(detail) ? detail.reduce((s, d) => s + (parseFloat(d.bosAmount) || 0), 0) : (detail.bosAmount || 0);

            if (detailTotal <= 0 || allocated === 0) return false;

            const yayasanSpent = detailTotal - detailBos;
            return yayasanSpent > (allocated + 100);
        });

        if (overBudgetItemSubmit) {
            setMessage({
                type: 'error',
                text: `PENGAJUAN DITOLAK: Item "${overBudgetItemSubmit.name}" melebihi limit Yayasan.`
            });
            setIsSaving(false);
            setTimeout(() => setMessage(null), 7000);
            return;
        }

        // 3. Strict Validation: Per-Item BOS Limits
        const overBosItemSubmit = Object.keys(submittedPlan.expense).find(itemId => {
            const detail = submittedPlan.expense[itemId];
            const limit = bosItemMap[itemId] || 0;
            
            const spent = Array.isArray(detail) ? detail.reduce((s, d) => s + (parseFloat(d.bosAmount) || 0), 0) : (parseFloat(detail.bosAmount) || 0);
            return spent > (limit + 100);
        });

        if (overBosItemSubmit) {
            const itm = expenseItems.find(e => e.id === overBosItemSubmit);
            setMessage({
                type: 'error',
                text: `PENGAJUAN DITOLAK: Item "${itm?.name || 'terkait'}" melebihi alokasi BOS (${formatRupiah(bosItemMap[overBosItemSubmit])}).`
            });
            setIsSaving(false);
            setTimeout(() => setMessage(null), 7000);
            return;
        }

        try {
            dispatch({ type: 'SET_RAB_PLAN', payload: submittedPlan });
            await api.pushAction({ type: 'SET_RAB_PLAN', payload: submittedPlan }, state);
            
            // Sync local currentPlan state
            setCurrentPlan(prev => ({
                ...prev,
                income: updatedIncome,
                expense: updatedExpense,
                status: 'PENDING'
            }));

            setMessage({ type: 'success', text: 'RAB telah dikirim ke Yayasan untuk direview.' });
        } catch (error) {
            setMessage({ type: 'error', text: 'Gagal mengirim RAB: ' + error.message });
        } finally {
            setIsSaving(false);
            setTimeout(() => setMessage(null), 5000);
        }
    };

    const handleCancelSubmission = async () => {
        if (!selectedYearId || !selectedUnitId) return;
        const planId = currentPlanId;
        const plan = rabPlans.find(p => p.id === planId);
        if (!plan || plan.status !== 'PENDING') return;

        if (!window.confirm('Batalkan pengajuan RAB ini? Status akan kembali ke Draft dan dapat diedit kembali.')) return;

        const updatedExpense = { ...plan.expense };
        Object.keys(updatedExpense).forEach(itemId => {
            const rawPlans = updatedExpense[itemId];
            const plansArr = Array.isArray(rawPlans) ? rawPlans : (rawPlans && typeof rawPlans === 'object' && Object.keys(rawPlans).length > 0 ? [{ id: `P-${itemId}-LEGACY`, itemId, ...rawPlans }] : []);
            
            updatedExpense[itemId] = plansArr.map(p => {
                const comps = p.components || [];
                const updatedComps = comps.map(c => ({
                    ...c,
                    status: 'DRAFT',
                    isApproved: false
                }));
                return { ...p, components: updatedComps };
            });
        });

        const updatedIncome = { ...plan.income };
        Object.keys(updatedIncome).forEach(itemId => {
            const rawPlans = updatedIncome[itemId];
            const plansArr = Array.isArray(rawPlans) ? rawPlans : (rawPlans && typeof rawPlans === 'object' && Object.keys(rawPlans).length > 0 ? [{ id: `P-${itemId}-LEGACY`, itemId, ...rawPlans }] : []);
            
            updatedIncome[itemId] = plansArr.map(p => {
                const comps = p.components || [];
                const updatedComps = comps.map(c => ({
                    ...c,
                    status: 'DRAFT',
                    isApproved: false
                }));
                return { ...p, components: updatedComps };
            });
        });

        const updatedPlan = {
            ...plan,
            status: 'DRAFT',
            expense: updatedExpense,
            income: updatedIncome,
            rejectionReason: null,
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser?.username
        };

        setIsSaving(true);
        try {
            dispatch({ type: 'SET_RAB_PLAN', payload: updatedPlan });
            await api.pushAction({ type: 'SET_RAB_PLAN', payload: updatedPlan }, state);
            setCurrentPlan(prev => ({ ...prev, status: 'DRAFT' }));
            setMessage({ type: 'success', text: 'Pengajuan RAB berhasil dibatalkan. RAB kembali ke status Draft.' });
        } catch (error) {
            setMessage({ type: 'error', text: 'Gagal membatalkan pengajuan: ' + error.message });
        } finally {
            setIsSaving(false);
            setTimeout(() => setMessage(null), 5000);
        }
    };

    const handleApproval = async (planId, status, reason = null) => {
        const plan = rabPlans.find(p => p.id === planId);
        if (!plan) return;

        // Cascade the approval/rejection to all components
        const updatedExpense = { ...plan.expense };
        Object.keys(updatedExpense).forEach(itemId => {
            const rawPlans = updatedExpense[itemId];
            const plansArr = Array.isArray(rawPlans) ? rawPlans : (rawPlans && typeof rawPlans === 'object' && Object.keys(rawPlans).length > 0 ? [{ id: `P-${itemId}-LEGACY`, itemId, ...rawPlans }] : []);
            
            updatedExpense[itemId] = plansArr.map(p => {
                const comps = p.components || [];
                const updatedComps = comps.map(c => ({
                    ...c,
                    status: status,
                    isApproved: status === 'APPROVED'
                }));
                return { ...p, components: updatedComps };
            });
        });

        const updatedIncome = { ...plan.income };
        Object.keys(updatedIncome).forEach(itemId => {
            const rawPlans = updatedIncome[itemId];
            const plansArr = Array.isArray(rawPlans) ? rawPlans : (rawPlans && typeof rawPlans === 'object' && Object.keys(rawPlans).length > 0 ? [{ id: `P-${itemId}-LEGACY`, itemId, ...rawPlans }] : []);
            
            updatedIncome[itemId] = plansArr.map(p => {
                const comps = p.components || [];
                const updatedComps = comps.map(c => ({
                    ...c,
                    status: status,
                    isApproved: status === 'APPROVED'
                }));
                return { ...p, components: updatedComps };
            });
        });

        if (planId.includes('-REVISION-')) {
            if (status === 'APPROVED') {
                const originalId = planId.replace('-REVISION-', '-');
                const origPlan = rabPlans.find(p => p.id === originalId);
                const mergedPlan = {
                    ...(origPlan || {}),
                    id: originalId,
                    academicYearId: plan.academicYearId,
                    unitId: plan.unitId,
                    fieldId: plan.fieldId,
                    status: 'APPROVED',
                    expense: updatedExpense,
                    income: updatedIncome,
                    rejectionReason: null,
                    notified: false,
                    approvedAt: new Date().toISOString(),
                    approvedBy: currentUser.username,
                    updatedAt: new Date().toISOString(),
                    updatedBy: currentUser.username
                };

                try {
                    // Update original plan
                    dispatch({ type: 'SET_RAB_PLAN', payload: mergedPlan });
                    await api.pushAction({ type: 'SET_RAB_PLAN', payload: mergedPlan }, state);

                    // Delete revision plan
                    dispatch({ type: 'DELETE_RAB_PLAN', payload: planId });
                    await api.pushAction({ type: 'DELETE_RAB_PLAN', payload: planId }, state);

                    setMessage({ type: 'success', text: `Usulan revisi berhasil disetujui dan digabungkan ke Anggaran Utama.` });
                    setShowRejectionInput(null);
                    setRejectionReason('');
                } catch (error) {
                    setMessage({ type: 'error', text: 'Gagal memproses persetujuan revisi: ' + error.message });
                }
                return;
            } else {
                // If rejected, write rejection reason to the REVISION plan and keep status REJECTED
                const updatedPlan = {
                    ...plan,
                    status: 'REJECTED',
                    expense: updatedExpense,
                    income: updatedIncome,
                    rejectionReason: reason,
                    notified: false,
                    updatedAt: new Date().toISOString(),
                    updatedBy: currentUser?.username
                };
                try {
                    dispatch({ type: 'SET_RAB_PLAN', payload: updatedPlan });
                    await api.pushAction({ type: 'SET_RAB_PLAN', payload: updatedPlan }, state);
                    setMessage({ type: 'success', text: `Usulan revisi berhasil ditolak.` });
                    setShowRejectionInput(null);
                    setRejectionReason('');
                } catch (error) {
                    setMessage({ type: 'error', text: 'Gagal menolak usulan revisi: ' + error.message });
                }
                return;
            }
        }

        const updatedPlan = {
            ...plan,
            status: status,
            expense: updatedExpense,
            income: updatedIncome,
            rejectionReason: reason,
            notified: false, // For unit notification
            approvedAt: status === 'APPROVED' ? new Date().toISOString() : null,
            approvedBy: status === 'APPROVED' ? currentUser.username : null
        };

        try {
            dispatch({ type: 'SET_RAB_PLAN', payload: updatedPlan });
            await api.pushAction({ type: 'SET_RAB_PLAN', payload: updatedPlan }, state);
            setMessage({ type: 'success', text: `Anggaran berhasil ${status === 'APPROVED' ? 'di-ACC' : 'ditolak'}.` });
            setShowRejectionInput(null);
            setRejectionReason('');
        } catch (error) {
            setMessage({ type: 'error', text: 'Gagal memproses persetujuan: ' + error.message });
        }
    };

    const handleBulkComponentAction = async (action) => {
        if (selectedComponents.size === 0) return;
        setIsSaving(true);

        // Group selections by planId
        const selectionsByPlan = {};
        selectedComponents.forEach(id => {
            const [planId, itemId, pIdx, cIdx] = id.split('|');
            if (!selectionsByPlan[planId]) selectionsByPlan[planId] = [];
            selectionsByPlan[planId].push({ itemId, pIdx: parseInt(pIdx), cIdx: parseInt(cIdx) });
        });

        try {
            let currentPlanUpdated = null;
            
            const modifiedPlans = new Map();

            // Validasi Ketat untuk Aksi SUBMIT (Pengajuan ke Yayasan): Aset wajib di-ACC Sarpras
            if (action === 'SUBMIT' && isSarprasRequiredYear) {
                const unapprovedSelectedAssets = [];
                for (const [planSubId, items] of Object.entries(selectionsByPlan)) {
                    const foundMainPlan = rabPlans.find(p => {
                        if (p.id === planSubId) return true;
                        const nextExpense = p.expense || {};
                        return Object.values(nextExpense).some(plansArr => 
                            Array.isArray(plansArr) && plansArr.some(subP => subP.id === planSubId)
                        );
                    });
                    if (!foundMainPlan) continue;
                    const nextExpense = foundMainPlan.expense || {};
                    items.forEach(({ itemId: rawItemId, pIdx, cIdx }) => {
                        let itemId = rawItemId;
                        if (rawItemId.startsWith('COMP-')) {
                            const foundKey = Object.keys(nextExpense).find(k => {
                                if (Array.isArray(nextExpense[k])) {
                                    return nextExpense[k].some(subP => subP.id === planSubId);
                                }
                                return false;
                            });
                            if (foundKey) itemId = foundKey;
                        }
                        let rawPlanItems = nextExpense[itemId];
                        let planItems = Array.isArray(rawPlanItems) ? rawPlanItems : [rawPlanItems];
                        const actualPIdx = planItems.findIndex(subP => subP.id === planSubId);
                        const targetIdx = actualPIdx !== -1 ? actualPIdx : pIdx;
                        const comp = planItems[targetIdx]?.components?.[cIdx];
                        if (comp && comp.isAsset && comp.sarprasStatus !== 'APPROVED') {
                            const stLabel = comp.sarprasStatus === 'REJECTED' ? 'Ditolak Sarpras' : 'Menunggu ACC Sarpras';
                            unapprovedSelectedAssets.push(`"${comp.assetName || comp.label || 'Aset'}" (${stLabel})`);
                        }
                    });
                }

                if (unapprovedSelectedAssets.length > 0) {
                    alert(`PENGAJUAN DITAHAN:\n\nTerdapat ${unapprovedSelectedAssets.length} rincian belanja aset yang dipilih belum disetujui oleh Bidang Sarpras:\n\n${unapprovedSelectedAssets.map(a => `• ${a}`).join('\n')}\n\nSilakan tunggu persetujuan (ACC) Sarpras terlebih dahulu.`);
                    setIsSaving(false);
                    return;
                }
            }

            for (const [planSubId, items] of Object.entries(selectionsByPlan)) {
                // Find the main plan where plan.expense has a sub-plan with id === planSubId
                const foundMainPlan = rabPlans.find(p => {
                    if (p.id === planSubId) return true;
                    const nextExpense = p.expense || {};
                    
                    // Support for legacy plans
                    if (planSubId.startsWith('P-') && planSubId.endsWith('-LEGACY')) {
                        const expectedItemId = planSubId.replace('P-', '').replace('-LEGACY', '');
                        if (nextExpense[expectedItemId] && !Array.isArray(nextExpense[expectedItemId])) {
                            if (p.id === currentPlanId) return true;
                        }
                    }

                    return Object.values(nextExpense).some(plansArr => 
                        Array.isArray(plansArr) && plansArr.some(subP => subP.id === planSubId)
                    );
                });

                if (!foundMainPlan) continue;
                const mainPlanId = foundMainPlan.id;
                
                let plan = modifiedPlans.get(mainPlanId);
                if (!plan) {
                    plan = JSON.parse(JSON.stringify(foundMainPlan));
                    modifiedPlans.set(mainPlanId, plan);
                }

                const nextExpense = plan.expense || {};
                items.forEach(({ itemId: rawItemId, pIdx, cIdx }) => {
                    // Let's resolve the actual itemId!
                    let itemId = rawItemId;
                    if (rawItemId.startsWith('COMP-')) {
                        const foundKey = Object.keys(nextExpense).find(k => {
                            if (Array.isArray(nextExpense[k])) {
                                return nextExpense[k].some(subP => subP.id === planSubId);
                            } else if (planSubId === `P-${k}-LEGACY`) {
                                return true;
                            }
                            return false;
                        });
                        if (foundKey) itemId = foundKey;
                    }

                    let rawPlanItems = nextExpense[itemId];
                    let planItems = Array.isArray(rawPlanItems) ? rawPlanItems : (rawPlanItems && typeof rawPlanItems === 'object' && Object.keys(rawPlanItems).length > 0 ? [{ id: `P-${itemId}-LEGACY`, itemId: itemId, ...rawPlanItems }] : []);
                    
                    if (activeTab !== 'REVIEW' && planItems.length > 1) {
                        // We forced consolidation in the UI, so cIdx maps to the flattened array!
                        let runningCount = 0;
                        for (let i = 0; i < planItems.length; i++) {
                            const comps = planItems[i].components || [];
                            if (cIdx >= runningCount && cIdx < runningCount + comps.length) {
                                const localCIdx = cIdx - runningCount;
                                const comp = comps[localCIdx];
                                let newStatus = comp.status;
                                let newIsApproved = comp.isApproved;
                                
                                if (action === 'SUBMIT') newStatus = 'PENDING';
                                else if (action === 'APPROVE') { newStatus = 'APPROVED'; newIsApproved = true; }
                                else if (action === 'REJECT') { newStatus = 'REJECTED'; newIsApproved = false; }
                                
                                comp.status = newStatus;
                                comp.isApproved = newIsApproved;
                                break;
                            }
                            runningCount += comps.length;
                        }
                    } else {
                        // Normal logic
                        const actualPIdx = planItems.findIndex(subP => subP.id === planSubId);
                        const targetIdx = actualPIdx !== -1 ? actualPIdx : pIdx;

                        if (planItems[targetIdx] && planItems[targetIdx].components && planItems[targetIdx].components[cIdx]) {
                            const comp = planItems[targetIdx].components[cIdx];
                            let newStatus = comp.status;
                            let newIsApproved = comp.isApproved;
                            
                            if (action === 'SUBMIT') {
                                newStatus = 'PENDING';
                            } else if (action === 'APPROVE') {
                                newStatus = 'APPROVED';
                                newIsApproved = true;
                            } else if (action === 'REJECT') {
                                newStatus = 'REJECTED';
                                newIsApproved = false;
                            }

                            comp.status = newStatus;
                            comp.isApproved = newIsApproved;
                        }
                    }
                    nextExpense[itemId] = planItems;
                });
            }

            // Now dispatch all modified plans!
            for (const plan of modifiedPlans.values()) {
                // Auto-update plan status if no PENDING components remain
                let hasPending = false;
                Object.values(plan.expense || {}).forEach(plansArr => {
                    const arr = Array.isArray(plansArr) ? plansArr : (plansArr && typeof plansArr === 'object' && Object.keys(plansArr).length > 0 ? [plansArr] : []);
                    arr.forEach(p => {
                        (p.components || []).forEach(c => {
                            if (c.status === 'PENDING') hasPending = true;
                        });
                    });
                });
                
                Object.values(plan.income || {}).forEach(plansArr => {
                    const arr = Array.isArray(plansArr) ? plansArr : (plansArr && typeof plansArr === 'object' && Object.keys(plansArr).length > 0 ? [plansArr] : []);
                    arr.forEach(p => {
                        (p.components || []).forEach(c => {
                            if (c.status === 'PENDING') hasPending = true;
                        });
                    });
                });

                let newPlanStatus = plan.status;
                if (hasPending) {
                    newPlanStatus = 'PENDING';
                } else if (!hasPending && plan.status === 'PENDING') {
                    // Check if there's at least one APPROVED component
                    let hasApproved = false;
                    Object.values(plan.expense || {}).forEach(plansArr => {
                        const arr = Array.isArray(plansArr) ? plansArr : (plansArr && typeof plansArr === 'object' && Object.keys(plansArr).length > 0 ? [plansArr] : []);
                        arr.forEach(p => {
                            (p.components || []).forEach(c => {
                                if (c.status === 'APPROVED' || c.isApproved) hasApproved = true;
                            });
                        });
                    });
                    
                    if (hasApproved) {
                        newPlanStatus = 'APPROVED';
                    }
                }

                plan.status = newPlanStatus;
                plan.updatedAt = new Date().toISOString();
                
                dispatch({ type: 'SET_RAB_PLAN', payload: plan });
                await api.pushAction({ type: 'SET_RAB_PLAN', payload: plan }, state);

                if (plan.id === currentPlanId) {
                    currentPlanUpdated = plan;
                }
            }

            if (currentPlanUpdated) {
                setCurrentPlan({
                    income: currentPlanUpdated.income || {},
                    expense: currentPlanUpdated.expense || {},
                    status: currentPlanUpdated.status || 'DRAFT',
                    rejectionReason: currentPlanUpdated.rejectionReason || null,
                    notified: currentPlanUpdated.notified
                });
            }

            let actionText = '';
            if (action === 'SUBMIT') actionText = 'diajukan untuk direview';
            else if (action === 'APPROVE') actionText = 'disetujui';
            else if (action === 'REJECT') actionText = 'ditolak';

            setMessage({ type: 'success', text: `${selectedComponents.size} rincian berhasil ${actionText}.` });
            setSelectedComponents(new Set());
        } catch (error) {
            console.error(error);
            setMessage({ type: 'error', text: 'Gagal memproses perubahan massal.' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancelApproval = async () => {
        if (!selectedYearId || !selectedUnitId) return;
        const planId = currentPlanId;
        const plan = rabPlans.find(p => p.id === planId);
        if (!plan || plan.status !== 'APPROVED') return;

        const reason = window.prompt('Masukkan alasan pembatalan persetujuan (agar unit tahu apa yang harus diperbaiki):', 'Pembatalan persetujuan untuk perbaikan/penambahan data.');
        if (reason === null) return; // User cancelled prompt

        // Cascade the rejection status to all components
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

        const updatedIncome = { ...plan.income };
        Object.keys(updatedIncome).forEach(itemId => {
            const rawPlans = updatedIncome[itemId];
            const plansArr = Array.isArray(rawPlans) ? rawPlans : (rawPlans && typeof rawPlans === 'object' && Object.keys(rawPlans).length > 0 ? [{ id: `P-${itemId}-LEGACY`, itemId, ...rawPlans }] : []);
            
            updatedIncome[itemId] = plansArr.map(p => {
                const comps = p.components || [];
                const updatedComps = comps.map(c => ({
                    ...c,
                    status: 'REJECTED',
                    isApproved: false
                }));
                return { ...p, components: updatedComps };
            });
        });

        const updatedPlan = {
            ...plan,
            status: 'REJECTED',
            expense: updatedExpense,
            income: updatedIncome,
            rejectionReason: reason,
            notified: false,
            approvedAt: null,
            approvedBy: null,
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser?.username
        };

        setIsSaving(true);
        try {
            setCurrentPlan({
                income: updatedIncome,
                expense: updatedExpense,
                status: 'REJECTED',
                rejectionReason: reason,
                notified: false
            });
            dispatch({ type: 'SET_RAB_PLAN', payload: updatedPlan });
            await api.pushAction({ type: 'SET_RAB_PLAN', payload: updatedPlan }, state);
            setMessage({ type: 'success', text: 'Persetujuan dibatalkan. RAB kini terbuka kembali untuk diperbaiki oleh Unit/Bidang.' });
        } catch (error) {
            setMessage({ type: 'error', text: 'Gagal membatalkan persetujuan: ' + error.message });
        } finally {
            setIsSaving(false);
            setTimeout(() => setMessage(null), 5000);
        }
    };

    const handleAcknowledgeStatus = () => {
        const planId = currentPlanId;
        const plan = rabPlans.find(p => p.id === planId);
        if (plan) {
            const updatedPlan = { ...plan, notified: true };
            dispatch({ type: 'SET_RAB_PLAN', payload: updatedPlan });
            api.pushAction({ type: 'SET_RAB_PLAN', payload: updatedPlan }, state);
        }
        setShowStatusModal(false);
    };

    const handleExportRAB = () => {
        const wb = XLSX.utils.book_new();
        
        // 1. Expense Sheet
        const expenseData = [];
        filteredExpenseItems.forEach((item, idx) => {
            const plans = activePlan.expense[item.id] || [];
            const limit = fundSourceFilter === 'BOS' ? (bosItemMap[item.id] || 0) : (rapData.itemAllocations[item.id] || 0);

            if (plans.length === 0) {
                const row = {
                    'No': idx + 1,
                    'Item Belanja': item.name,
                    'Keterangan / Komponen': '',
                    'Program': '',
                    'Limit (RAP)': limit,
                    'Vol': 0, 'Satuan': '', 'Kali': 0, 'Harga': 0, 'Total RAB': 0
                };
                monthsOptions.forEach(m => row[m.name] = 0);
                expenseData.push(row);
            } else {
                plans.forEach((plan, pIdx) => {
                    const components = plan.components || [];
                    if (components.length === 0) {
                        const row = {
                            'No': pIdx === 0 ? idx + 1 : '',
                            'Item Belanja': pIdx === 0 ? item.name : '',
                            'Keterangan / Komponen': plan.description || '',
                            'Program Belanja': allPrograms.find(p => p.id === plan.programId)?.name || '',
                            'Limit (RAP)': pIdx === 0 ? limit : '',
                            'Vol': 0, 'Satuan': '', 'Kali': 0, 'Harga': 0, 'Total RAB': plan.total || 0
                        };
                        monthsOptions.forEach(m => row[m.name] = plan.months?.[m.id]?.jumlah || 0);
                        expenseData.push(row);
                    } else {
                        components.forEach((comp, cIdx) => {
                            const row = {
                                'No': (pIdx === 0 && cIdx === 0) ? idx + 1 : '',
                                'Item Belanja': (pIdx === 0 && cIdx === 0) ? item.name : '',
                                'Keterangan / Komponen': comp.label,
                                'Program Belanja': allPrograms.find(p => p.id === comp.programId)?.name || '',
                                'Limit (RAP)': (pIdx === 0 && cIdx === 0) ? limit : '',
                                'Vol': comp.volume || 0,
                                'Satuan': comp.satuan || '',
                                'Kali': comp.kali || 0,
                                'Harga': comp.harga || 0,
                                'Total RAB': comp.total || 0
                            };
                            monthsOptions.forEach(m => row[m.name] = comp.months?.[m.id]?.jumlah || 0);
                            expenseData.push(row);
                        });
                    }
                });
            }
        });
        const wsExpense = XLSX.utils.json_to_sheet(expenseData);
        XLSX.utils.book_append_sheet(wb, wsExpense, "Rencana Belanja");

        const unitName = selectedUnitId === 'FOUNDATION' ? 'Yayasan' : (units.find(u => u.id === selectedUnitId)?.name || 'Unit');
        XLSX.writeFile(wb, `RAB_${fundSourceFilter}_${unitName}_${activeYear?.name || ''}.xlsx`);
    };

    const handleDownloadRABTemplate = async () => {
        const workbook = new ExcelJS.Workbook();
        const wsExpense = workbook.addWorksheet("Rencana Belanja");
        
        const columns = [
            { header: 'Item Belanja', key: 'item', width: 30 },
            { header: 'Keterangan / Komponen', key: 'komponen', width: 40 },
            { header: 'Program Belanja', key: 'program', width: 30 },
            { header: 'Semester', key: 'semester', width: 15 },
            { header: 'Vol', key: 'vol', width: 10 },
            { header: 'Satuan', key: 'satuan', width: 15 },
            { header: 'Kali', key: 'kali', width: 10 },
            { header: 'Harga', key: 'harga', width: 20 },
        ];
        monthsOptions.forEach(m => {
            columns.push({ header: m.name, key: m.name, width: 15 });
        });
        wsExpense.columns = columns;

        const headerRow = wsExpense.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4F46E5' }
        };
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

        const exampleRow = {
            item: filteredExpenseItems[0]?.name || '',
            komponen: 'Contoh Rincian (Bisa Dihapus)',
            program: '',
            semester: 1,
            vol: 1,
            satuan: 'Pcs',
            kali: 1,
            harga: 100000
        };
        monthsOptions.forEach(m => exampleRow[m.name] = 0);
        wsExpense.addRow(exampleRow);

        // Add empty rows for extra entries
        for(let i=0; i<100; i++) {
             const emptyRow = { item: '', komponen: '', program: '', semester: '', vol: '', satuan: '', kali: '', harga: '' };
             monthsOptions.forEach(m => emptyRow[m.name] = '');
             wsExpense.addRow(emptyRow);
        }

        // Master Data Sheet
        const wsMaster = workbook.addWorksheet("MASTER_DATA");
        wsMaster.state = 'hidden';
        
        const programList = allPrograms.map(p => p.name.replace(/,/g, ' '));
        wsMaster.getColumn('A').values = ['PROGRAM', ...programList];
        
        const itemList = filteredExpenseItems.map(i => i.name.replace(/,/g, ' '));
        wsMaster.getColumn('B').values = ['ITEM', ...itemList];

        const totalRows = 100 + 1 + 1; // 1 example + 100 empty + 1 header
        for (let i = 2; i <= totalRows; i++) {
            if (itemList.length > 0) {
                wsExpense.getCell(`A${i}`).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: [`MASTER_DATA!$B$2:$B$${itemList.length + 1}`]
                };
            }
            if (programList.length > 0) {
                wsExpense.getCell(`C${i}`).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: [`MASTER_DATA!$A$2:$A$${programList.length + 1}`]
                };
            }
            wsExpense.getCell(`D${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: ['"1,2"']
            };
        }

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `Template_RAB_${fundSourceFilter}.xlsx`);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                
                const newExpense = { ...currentPlan.expense };

                // 1. Process Expense
                const wsExpense = wb.Sheets["Belanja"] || wb.Sheets["Rencana Belanja"];
                if (wsExpense) {
                    const data = XLSX.utils.sheet_to_json(wsExpense);

                    // Validate balance for all rows first
                    const errors = [];
                    data.forEach((row, idx) => {
                        const rowKeys = Object.keys(row);
                        const itemNameKey = rowKeys.find(k => k.trim().toLowerCase() === 'item belanja') || 'Item Belanja';
                        const compLabelKey = rowKeys.find(k => k.trim().toLowerCase() === 'keterangan / komponen') || 'Keterangan / Komponen';
                        const volKey = rowKeys.find(k => k.trim().toLowerCase() === 'vol') || 'Vol';
                        const kaliKey = rowKeys.find(k => k.trim().toLowerCase() === 'kali') || 'Kali';
                        const hargaKey = rowKeys.find(k => k.trim().toLowerCase() === 'harga') || 'Harga';

                        const itemName = row[itemNameKey];
                        const compLabel = (row[compLabelKey] || '').toString().trim();
                        
                        const vol = parseExcelNum(row[volKey]);
                        const kali = rowKeys.find(k => k.trim().toLowerCase() === 'kali') ? (parseExcelNum(row[kaliKey]) || 1) : 1;
                        const harga = parseExcelNum(row[hargaKey]);
                        const calculatedTotal = vol * kali * harga;
                        
                        let monthlyTotal = 0;
                        monthsOptions.forEach(m => {
                            const exactKey = findRowKeyForMonth(rowKeys, m);
                            const val = exactKey ? parseExcelNum(row[exactKey]) : 0;
                            monthlyTotal += val;
                        });
                        
                        const hasContent = itemName || compLabel || calculatedTotal > 0 || monthlyTotal > 0;
                        if (hasContent) {
                            if (Math.abs(calculatedTotal - monthlyTotal) > 1.1) {
                                errors.push(`Baris ${idx + 2} (${itemName || 'Tanpa Nama'} - ${compLabel || 'Tanpa Keterangan'}): Total hitung Rp ${calculatedTotal.toLocaleString('id-ID')} vs Terjadwal Rp ${monthlyTotal.toLocaleString('id-ID')}`);
                            }
                        }
                    });

                    if (errors.length > 0) {
                        throw new Error("Alokasi anggaran belum seimbang pada rincian berikut:\n" + errors.slice(0, 10).join('\n') + (errors.length > 10 ? `\n...dan ${errors.length - 10} baris lainnya` : ''));
                    }

                    // Clear existing expenses for imported items to prevent duplicates
                    const importedItemNames = new Set(data.map(row => {
                        const rowKeys = Object.keys(row);
                        const itemNameKey = rowKeys.find(k => k.trim().toLowerCase() === 'item belanja') || 'Item Belanja';
                        return row[itemNameKey];
                    }).filter(Boolean));
                    expenseItems.forEach(ei => {
                        if (importedItemNames.has(ei.name)) newExpense[ei.id] = [];
                    });

                    data.forEach((row, idx) => {
                        const rowKeys = Object.keys(row);
                        const itemNameKey = rowKeys.find(k => k.trim().toLowerCase() === 'item belanja') || 'Item Belanja';
                        const compLabelKey = rowKeys.find(k => k.trim().toLowerCase() === 'keterangan / komponen') || 'Keterangan / Komponen';
                        const volKey = rowKeys.find(k => k.trim().toLowerCase() === 'vol') || 'Vol';
                        const kaliKey = rowKeys.find(k => k.trim().toLowerCase() === 'kali') || 'Kali';
                        const hargaKey = rowKeys.find(k => k.trim().toLowerCase() === 'harga') || 'Harga';
                        const satuanKey = rowKeys.find(k => k.trim().toLowerCase() === 'satuan') || 'Satuan';
                        const progKey = rowKeys.find(k => k.trim().toLowerCase() === 'program belanja') || 'Program Belanja';
                        const semKey = rowKeys.find(k => k.trim().toLowerCase() === 'semester') || 'Semester';

                        const itemName = row[itemNameKey];
                        const item = expenseItems.find(i => i.name === itemName);
                        if (item) {
                            const months = {};
                            let total = 0;
                            monthsOptions.forEach(m => {
                                const exactKey = findRowKeyForMonth(rowKeys, m);
                                const val = exactKey ? parseExcelNum(row[exactKey]) : 0;
                                months[m.id] = { m: val > 0, jumlah: val };
                                total += val;
                            });

                            const progNameStr = (row[progKey]?.toString() || '').trim().toLowerCase();
                            const program = progNameStr ? allPrograms.find(p => p.name.trim().toLowerCase() === progNameStr) : null;
                            const compLabel = (row[compLabelKey] || '').toString().trim();

                            const vol = parseExcelNum(row[volKey]);
                            const kali = rowKeys.find(k => k.trim().toLowerCase() === 'kali') ? (parseExcelNum(row[kaliKey]) || 1) : 1;
                            const harga = parseExcelNum(row[hargaKey]);
                            const calculatedTotal = vol * kali * harga;

                            const comp = {
                                id: `C-${Date.now()}-${idx}`,
                                label: compLabel,
                                volume: vol,
                                satuan: row[satuanKey] || '',
                                kali: kali,
                                harga: harga,
                                total: calculatedTotal,
                                months: months,
                                programId: program?.id || '',
                                semester: row[semKey]?.toString() || '1'
                            };

                            if (!newExpense[item.id]) newExpense[item.id] = [];
                            
                            // Check if we should add to existing plan or create new
                            if (comp.label || comp.total > 0 || comp.programId) {
                                if (!comp.label) comp.label = 'Imported Component';
                                const isBos = fundSourceFilter === 'BOS';
                                newExpense[item.id].push({
                                    id: `P-${Date.now()}-${idx}`,
                                    itemId: item.id,
                                    total: comp.total,
                                    components: [comp],
                                    months: comp.months,
                                    programId: comp.programId,
                                    semester: comp.semester,
                                    description: comp.label,
                                    useBos: isBos,
                                    bosAmount: isBos ? comp.total : 0
                                });
                            }
                        }
                    });
                }

                setCurrentPlan(prev => ({ ...prev, expense: newExpense }));
                setMessage({ type: 'success', text: 'Data Rencana Belanja berhasil diimpor dari Excel.' });
                setShowImportModal(false);
            } catch (error) {
                console.error(error);
                setMessage({ type: 'error', text: 'Gagal memproses file Excel: ' + error.message });
            } finally {
                e.target.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleDownloadLocalTemplate = async (itemName) => {
        const workbook = new ExcelJS.Workbook();
        const ws = workbook.addWorksheet(`Rincian ${itemName.substring(0, 20)}`.replace(/[\\/?*\[\]]/g, ''));
        
        const columns = [
            { header: 'Keterangan', key: 'keterangan', width: 40 },
            { header: 'Program Belanja', key: 'program', width: 30 },
            { header: 'Semester', key: 'semester', width: 15 },
            { header: 'Vol', key: 'vol', width: 10 },
            { header: 'Satuan', key: 'satuan', width: 15 },
            { header: 'Kali', key: 'kali', width: 10 },
            { header: 'Harga', key: 'harga', width: 20 }
        ];
        monthsOptions.forEach(m => {
            columns.push({ header: m.name, key: m.name, width: 15 });
        });
        ws.columns = columns;

        const headerRow = ws.getRow(1);
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4F46E5' }
        };
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

        const rowData = {
            keterangan: 'Contoh Rincian (Bisa Dihapus)',
            program: '',
            semester: 1,
            vol: 1,
            satuan: 'Pcs',
            kali: 1,
            harga: 100000
        };
        monthsOptions.forEach(m => rowData[m.name] = 0);
        ws.addRow(rowData);

        // Add empty rows for extra entries
        for(let i=0; i<99; i++) {
             const emptyRow = { keterangan: '', program: '', semester: '', vol: '', satuan: '', kali: '', harga: '' };
             monthsOptions.forEach(m => emptyRow[m.name] = '');
             ws.addRow(emptyRow);
        }

        const wsMaster = workbook.addWorksheet("MASTER_DATA");
        wsMaster.state = 'hidden';
        const programList = allPrograms.map(p => p.name.replace(/,/g, ' '));
        wsMaster.getColumn('A').values = ['PROGRAM', ...programList];

        for (let i = 2; i <= 101; i++) {
            if (programList.length > 0) {
                ws.getCell(`B${i}`).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: [`MASTER_DATA!$A$2:$A$${programList.length + 1}`]
                };
            }
            ws.getCell(`C${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: ['"1,2"']
            };
        }

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `Template_Rincian_${itemName.replace(/\s+/g, '_')}.xlsx`);
    };

    const handleLocalFileUpload = (e, itemId) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsName = wb.SheetNames[0];
                const data = XLSX.utils.sheet_to_json(wb.Sheets[wsName]);

                const newComponents = data.map((row, idx) => {
                    const months = {};
                    // Flexible column matching for months
                    const rowKeys = Object.keys(row);
                    monthsOptions.forEach(m => {
                        const exactKey = findRowKeyForMonth(rowKeys, m);
                        const val = exactKey ? parseExcelNum(row[exactKey]) : 0;
                        months[m.id] = { m: val > 0, jumlah: val };
                    });

                    const volKey = rowKeys.find(k => k.trim().toLowerCase() === 'vol') || 'Vol';
                    const kaliKey = rowKeys.find(k => k.trim().toLowerCase() === 'kali') || 'Kali';
                    const hargaKey = rowKeys.find(k => k.trim().toLowerCase() === 'harga') || 'Harga';
                    const ketKey = rowKeys.find(k => k.trim().toLowerCase() === 'keterangan') || 'Keterangan';
                    const progKey = rowKeys.find(k => k.trim().toLowerCase() === 'program belanja') || 'Program Belanja';
                    const semKey = rowKeys.find(k => k.trim().toLowerCase() === 'semester') || 'Semester';
                    const satuanKey = rowKeys.find(k => k.trim().toLowerCase() === 'satuan') || 'Satuan';

                    const vol = parseExcelNum(row[volKey]);
                    const kali = rowKeys.find(k => k.trim().toLowerCase() === 'kali') ? (parseExcelNum(row[kaliKey]) || 1) : 1;
                    const harga = parseExcelNum(row[hargaKey]);
                    const total = vol * kali * harga;

                    const progNameStr = (row[progKey]?.toString() || '').trim().toLowerCase();

                    return {
                        id: `C-${Date.now()}-${idx}`,
                        label: row[ketKey] || '',
                        volume: vol,
                        satuan: row[satuanKey] || '',
                        kali: kali,
                        harga: harga,
                        total: total,
                        programId: progNameStr ? (allPrograms.find(p => p.name.trim().toLowerCase() === progNameStr)?.id || null) : null,
                        semester: (row[semKey]?.toString() || '1'),
                        useBos: fundSourceFilter === 'BOS',
                        months: months
                    };
                }).filter(comp => {
                    // Ignore empty template rows
                    const hasLabel = comp.label && comp.label.trim() !== '';
                    const hasTotal = comp.total > 0;
                    const hasProgram = comp.programId !== null;
                    return hasLabel || hasTotal || hasProgram;
                });
                
                // Fallback for label if they provided total/program but no label
                newComponents.forEach(comp => {
                    if (!comp.label || comp.label.trim() === '') {
                        comp.label = 'Imported';
                    }
                });

                if (newComponents.length === 0) {
                    throw new Error("Tidak ada data rincian belanja yang valid untuk diimpor. Pastikan Anda telah mengisi keterangan, jumlah, dan alokasi bulanan.");
                }

                // Validate balance for all components
                const errors = [];
                newComponents.forEach((comp, idx) => {
                    const monthlyTotal = Object.values(comp.months || {}).reduce((sum, m) => sum + (parseFloat(m.jumlah) || 0), 0);
                    if (Math.abs(comp.total - monthlyTotal) > 1.1) {
                        errors.push(`Baris ${idx + 2} (${comp.label || 'Tanpa Keterangan'}): Total hitung Rp ${comp.total.toLocaleString('id-ID')} vs Terjadwal Rp ${monthlyTotal.toLocaleString('id-ID')}`);
                    }
                });

                if (errors.length > 0) {
                    throw new Error("Alokasi anggaran belum seimbang pada rincian berikut:\n" + errors.slice(0, 10).join('\n') + (errors.length > 10 ? `\n...dan ${errors.length - 10} baris lainnya` : ''));
                }

                if (newComponents.length > 0) {
                    const existingPlans = currentPlan.expense[itemId] || [];
                    // Fix: Ensure we use the exact same ID as the existing plan to prevent duplicate rows
                    const existingId = existingPlans[0]?.id || editingItem.planId || editingItem.id;
                    const basePlan = existingPlans[0] || { id: existingId, total: 0, components: [], months: {} };
                    
                    const allComps = [...(basePlan.components || []), ...newComponents];
                    
                    // Aggregate months distribution from all components
                    const aggregateMonths = {};
                    allComps.forEach(c => {
                        Object.entries(c.months || {}).forEach(([mId, mData]) => {
                            if (!mData.m) return;
                            if (!aggregateMonths[mId]) aggregateMonths[mId] = { m: true, jumlah: 0 };
                            aggregateMonths[mId].jumlah += (parseFloat(mData.jumlah) || 0);
                        });
                    });

                    const isBos = fundSourceFilter === 'BOS';
                    const newTotal = allComps.reduce((sum, c) => sum + (parseFloat(c.total) || 0), 0);
                    const updatedPlan = {
                        ...basePlan,
                        components: allComps,
                        total: newTotal,
                        months: aggregateMonths,
                        useBos: isBos,
                        bosAmount: isBos ? newTotal : 0
                    };

                    const nextPlan = {
                        ...currentPlan,
                        expense: { ...currentPlan.expense, [itemId]: [updatedPlan] }
                    };
                    
                    setCurrentPlan(nextPlan);
                    
                    // Auto-save to DB immediately after import
                    const planId = currentPlanId;
                    const dbPlan = {
                        id: planId,
                        academicYearId: selectedYearId,
                        unitId: selectedUnitId.startsWith('FIELD-') ? null : (selectedUnitId === 'FOUNDATION' ? 'FOUNDATION' : selectedUnitId),
                        fieldId: selectedUnitId.startsWith('FIELD-') ? selectedUnitId.replace('FIELD-', '') : null,
                        income: nextPlan.income,
                        expense: nextPlan.expense,
                        status: nextPlan.status,
                        rejectionReason: nextPlan.rejectionReason,
                        updatedAt: new Date().toISOString(),
                        updatedBy: currentUser?.username
                    };

                    // await persistPlanToServer(dbPlan); 
                    setMessage({ type: 'success', text: `${newComponents.length} rincian berhasil diimpor. Klik 'Simpan Rencana Belanja' untuk menyimpan permanen.` });
                    
                    
                    // Force refresh modal by slightly updating editingItem
                    setEditingItem(prev => ({ ...prev, _refresh: Date.now() }));
                    
                    // End of import process
                }
            } catch (err) {
                console.error(err);
                setMessage({ type: 'error', text: 'Gagal mengimpor rincian: ' + err.message });
            } finally {
                e.target.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };


    const renderReviewView = () => {
        return (
            <div className="space-y-8 animate-in fade-in duration-500">
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                            <ShieldCheck size={20} />
                        </div>
                        <div>
                            <h4 className="font-black text-slate-900 uppercase tracking-tight italic">
                                Review Pengajuan {fundSourceFilter === 'BOS' ? 'RAB BOS' : 'RAB Yayasan'}
                            </h4>
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Daftar unit yang telah mengirimkan rancangan anggaran {fundSourceFilter === 'BOS' ? 'BOS' : 'Yayasan'}</p>
                        </div>
                    </div>

                    {selectedComponents.size > 0 && (
                        <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-2xl border border-indigo-100 mb-6 animate-in slide-in-from-top-4">
                            <span className="text-sm font-bold text-indigo-900">{selectedComponents.size} Rincian Terpilih</span>
                            <div className="flex items-center gap-2 ml-auto">
                                <button 
                                    onClick={() => handleBulkComponentAction('APPROVE')}
                                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 shadow-sm transition-all flex items-center gap-2"
                                >
                                    <CheckCircle2 size={14} />
                                    ACC Rincian
                                </button>
                                <button 
                                    onClick={() => handleBulkComponentAction('REJECT')}
                                    className="px-4 py-2 bg-rose-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-700 shadow-sm transition-all flex items-center gap-2"
                                >
                                    <XCircle size={14} />
                                    Batalkan ACC Rincian
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="overflow-x-auto">
                        <table className="w-full border-separate border-spacing-y-2">
                            <thead>
                                <tr className="text-slate-400/80 text-[10px] font-black uppercase tracking-[0.2em] italic">
                                    <th className="px-6 py-2 text-left">Unit / Bidang</th>
                                    <th className="px-6 py-2 text-right">Limit (RAP)</th>
                                    <th className="px-6 py-2 text-right">Total RAB</th>
                                    <th className="px-6 py-2 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pendingPlans.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="p-12 text-center bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                                            <CheckCircle2 size={40} className="mx-auto text-emerald-400 mb-4 opacity-50" />
                                            <p className="font-black text-slate-400 text-xs uppercase tracking-widest italic">Tidak ada pengajuan yang perlu di-review!</p>
                                        </td>
                                    </tr>
                                ) : (
                                    pendingPlans.map(plan => {
                                        const unit = units.find(u => u.id === plan.unitId) || fields.find(f => f.id === plan.fieldId);
                                        // Calculate total by summing all plan totals in each expense category
                                        const total = Object.values(plan.expense || {}).reduce((sum, plans) => {
                                            const planArray = Array.isArray(plans) ? plans : (plans && typeof plans === 'object' && Object.keys(plans).length > 0 ? [plans] : []);
                                            return sum + planArray.reduce((s, p) => s + (parseFloat(p.total) || 0), 0);
                                        }, 0);

                                        // Calculate RAP — BOS plans use bosAllocations, Yayasan plans use calculateRAP
                                        let unitId = null;
                                        let fieldId = null;
                                        if (plan.fieldId) fieldId = plan.fieldId;
                                        else unitId = plan.unitId;

                                        const isBOSPlan = plan.id.endsWith('-BOS');
                                        let rapLimit = 0;
                                        let itemAllocations = {};

                                        if (isBOSPlan) {
                                            // Sum total BOS allocations for this unit from bosAllocations
                                            rapLimit = (bosAllocations || []).filter(a =>
                                                a.unitId === plan.unitId &&
                                                a.academicYearId === selectedYearId &&
                                                !a.isDeleted
                                            ).reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
                                            // Build per-item allocation from bosAllocations
                                            (bosAllocations || []).filter(a =>
                                                a.unitId === plan.unitId &&
                                                a.academicYearId === selectedYearId &&
                                                !a.isDeleted
                                            ).forEach(a => {
                                                itemAllocations[a.expenseItemId] = (itemAllocations[a.expenseItemId] || 0) + (parseFloat(a.amount) || 0);
                                            });
                                        } else {
                                            const planRAP = calculateRAP(state, selectedYearId, unitId, fieldId);
                                            rapLimit = planRAP.totalTarget;
                                            itemAllocations = planRAP.itemAllocations;
                                        }

                                        const originalPlanId = plan.id.replace('-REVISION-', '-');
                                        const originalPlan = rabPlans.find(p => p.id === originalPlanId);
                                        const isRevision = plan.id.includes('-REVISION-');
                                        const typeLabelSuffix = isRevision ? ' (REVISI)' : '';

                                        const allItemIds = new Set([
                                            ...Object.keys(plan.expense || {}),
                                            ...(isRevision && originalPlan ? Object.keys(originalPlan.expense || {}) : [])
                                        ]);

                                        const rowData = {
                                            id: plan.id,
                                            name: unit?.name || 'Unknown',
                                            typeLabel: (isBOSPlan ? 'BOS' : 'YAYASAN') + typeLabelSuffix,
                                            status: plan.status,
                                            rap: rapLimit,
                                            rab: total,
                                            sisa: rapLimit - total,
                                            breakdown: Array.from(allItemIds)
                                                .map(id => {
                                                    const plans = plan.expense?.[id] || [];
                                                    const planArray = Array.isArray(plans) ? plans : (plans && typeof plans === 'object' && Object.keys(plans).length > 0 ? [plans] : []);
                                                    const aggregatedTotal = planArray.reduce((s, p) => s + (parseFloat(p.total) || 0), 0);
                                                    const aggregatedRap = itemAllocations[id] || 0;

                                                    const origPlans = (isRevision && originalPlan) ? (originalPlan.expense?.[id] || []) : [];
                                                    const origPlanArray = Array.isArray(origPlans) ? origPlans : (origPlans && typeof origPlans === 'object' && Object.keys(origPlans).length > 0 ? [origPlans] : []);
                                                    const origComps = origPlanArray.flatMap(p => p.components || []);

                                                    // Collect and diff revision components
                                                    const revComps = planArray.flatMap((p, pIdx) => (p.components || []).map((c, cIdx) => {
                                                        let compStatus = c.status;
                                                        if (!compStatus) {
                                                            if (c.isApproved === true) compStatus = 'APPROVED';
                                                            else compStatus = plan.status === 'APPROVED' ? 'APPROVED' : (plan.status === 'PENDING' ? 'PENDING' : 'DRAFT');
                                                        }
                                                        
                                                        let diffStatus = undefined;
                                                        let oldTotal = undefined;

                                                        if (isRevision && originalPlan) {
                                                            const origC = origComps.find(oc => oc.id === c.id);
                                                            if (!origC) {
                                                                diffStatus = 'ADDED';
                                                            } else if (origC.total !== c.total) {
                                                                diffStatus = 'MODIFIED';
                                                                oldTotal = origC.total;
                                                            }
                                                        }

                                                        return {
                                                            ...c,
                                                            _pIdx: pIdx,
                                                            _cIdx: cIdx,
                                                            status: compStatus,
                                                            diffStatus,
                                                            oldTotal,
                                                            spent: componentSpending[c.id] || 0,
                                                            remaining: (parseFloat(c.total) || 0) - (componentSpending[c.id] || 0)
                                                        };
                                                    }));

                                                    // Find and append deleted components as placeholders
                                                    if (isRevision && originalPlan) {
                                                        const deletedComps = origComps.filter(oc => !revComps.some(rc => rc.id === oc.id));
                                                        deletedComps.forEach((dc, idx) => {
                                                            revComps.push({
                                                                ...dc,
                                                                _pIdx: 0,
                                                                _cIdx: 9999 + idx,
                                                                status: 'APPROVED',
                                                                diffStatus: 'DELETED',
                                                                spent: componentSpending[dc.id] || 0,
                                                                remaining: (parseFloat(dc.total) || 0) - (componentSpending[dc.id] || 0)
                                                            });
                                                        });
                                                    }

                                                    return {
                                                        id,
                                                        name: (expenseItems.find(e => e.id === id)?.name || id),
                                                        rab: aggregatedTotal,
                                                        rap: aggregatedRap,
                                                        sisa: aggregatedRap - aggregatedTotal,
                                                        components: revComps
                                                    };
                                                })
                                                .sort((a, b) => b.rab - a.rab)
                                        };

                                        return (
                                            <BudgetRow
                                                key={plan.id}
                                                data={rowData}
                                                isExpanded={!!expandedReviewPlans[plan.id]}
                                                onToggle={() => toggleReviewPlan(plan.id)}
                                                formatCurrency={formatCurrency}
                                                expandedDetailItems={expandedDetailItems}
                                                onToggleDetailItem={toggleDetailItem}
                                                getUnitName={getUnitName}
                                                isField={!!plan.fieldId}
                                                selectable={true}
                                                isReviewMode={true}
                                                isSuperAdmin={isSuperAdmin}
                                                selectedComponents={selectedComponents}
                                                onComponentToggle={toggleComponentSelection}
                                                actions={
                                                    isSuperAdmin ? (
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleApproval(plan.id, 'APPROVED');
                                                                }}
                                                                className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg font-black text-[9px] uppercase tracking-widest hover:bg-slate-900 transition-all shadow-lg active:scale-95"
                                                            >
                                                                ACC SEMUA
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setShowRejectionInput(plan.id);
                                                                }}
                                                                className="px-4 py-1.5 bg-rose-100 text-rose-600 rounded-lg font-black text-[9px] uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all shadow-sm active:scale-95"
                                                            >
                                                                REVISI
                                                            </button>
                                                        </div>
                                                    ) : null
                                                }
                                            />
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {showRejectionInput && (
                    <div className="bg-rose-50 p-8 rounded-[2rem] border border-rose-100 animate-in slide-in-from-top-4 duration-500">
                        <div className="flex items-start gap-4 mb-6">
                            <div className="p-3 bg-rose-100 rounded-2xl text-rose-600"><AlertCircle size={20} /></div>
                            <div>
                                <h4 className="font-black text-rose-900 uppercase tracking-tight italic">Alasan Penolakan</h4>
                                <p className="text-rose-400 text-[10px] font-black uppercase tracking-widest mt-1">Sertilkan masukan anda agar unit dapat memperbaiki anggaran</p>
                            </div>
                        </div>
                        <textarea
                            className="w-full p-5 bg-white border border-rose-200 rounded-2xl font-medium text-rose-800 outline-none focus:ring-4 focus:ring-rose-100 transition-all min-h-[120px]"
                            placeholder="Tuliskan catatan revisi di sini..."
                            value={rejectionReason}
                            onChange={e => setRejectionReason(e.target.value)}
                        />
                        <div className="flex gap-4 mt-6 justify-end">
                            <button
                                onClick={() => setShowRejectionInput(null)}
                                className="px-6 py-3 text-rose-400 font-black text-xs uppercase"
                            >
                                Batal
                            </button>
                            <button
                                onClick={() => handleApproval(showRejectionInput, 'REJECTED', rejectionReason)}
                                disabled={!rejectionReason.trim()}
                                className="bg-rose-600 text-white px-10 py-3 rounded-xl font-black text-xs uppercase shadow-xl shadow-rose-200 disabled:opacity-50"
                            >
                                KIRIM PENOLAKAN
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderSarprasAssetVerificationView = () => {
        return (
            <div className="space-y-8 animate-in fade-in duration-500">
                {/* Header Information Banner */}
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-8 rounded-[2.5rem] border border-slate-800 text-white shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
                    <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        <div className="flex items-start gap-4">
                            <div className="p-4 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30 shrink-0">
                                <Package size={32} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                        Bidang Sarana Prasarana
                                    </span>
                                    <span className="text-slate-400 text-xs font-bold">
                                        TA {activeYearName || 'Aktif'}
                                    </span>
                                </div>
                                <h3 className="text-2xl font-black tracking-tight text-white">
                                    Verifikasi Pengadaan Aset Seluruh Unit & Bidang
                                </h3>
                                <p className="text-slate-300 text-xs mt-1 max-w-2xl leading-relaxed">
                                    Verifikasi dan berikan persetujuan (ACC) rencana pengadaan barang bersifat aset dari seluruh unit pendidikan dan bidang yayasan agar pengadaan tercatat rapi dan terpantau sebelum realisasi anggaran.
                                </p>
                            </div>
                        </div>

                        {/* Batch Action if any pending */}
                        {sarprasStats.pendingCount > 0 && (
                            <div className="flex items-center gap-3 shrink-0">
                                <button
                                    onClick={() => {
                                        const pendingItems = filteredSarprasAssets.filter(i => i.component?.sarprasStatus === 'PENDING');
                                        handleBatchApproveSarprasAssets(pendingItems);
                                    }}
                                    disabled={isSaving || filteredSarprasAssets.filter(i => i.component?.sarprasStatus === 'PENDING').length === 0}
                                    className="px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/30 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    <CheckCircle2 size={16} />
                                    <span>ACC Semua Menunggu ({filteredSarprasAssets.filter(i => i.component?.sarprasStatus === 'PENDING').length})</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* 4 Quick Stat Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Card 1: Total Pengajuan */}
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between">
                        <div className="flex items-center justify-between text-slate-400 mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest">Total Usulan Aset</span>
                            <Package size={18} className="text-slate-400" />
                        </div>
                        <div>
                            <div className="text-2xl font-black text-slate-900">{sarprasStats.totalCount} <span className="text-sm font-bold text-slate-400">item</span></div>
                            <div className="text-xs font-bold text-slate-500 mt-1">{formatRupiah(sarprasStats.totalNominal)}</div>
                        </div>
                    </div>

                    {/* Card 2: Menunggu ACC */}
                    <div className={`p-6 rounded-[2rem] border shadow-sm flex flex-col justify-between transition-all ${
                        sarprasStats.pendingCount > 0 ? 'bg-amber-50/70 border-amber-200' : 'bg-white border-slate-100'
                    }`}>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-amber-700">Menunggu ACC Sarpras</span>
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping"></span>
                        </div>
                        <div>
                            <div className="text-2xl font-black text-amber-900">{sarprasStats.pendingCount} <span className="text-sm font-bold text-amber-600">item</span></div>
                            <div className="text-xs font-bold text-amber-700 mt-1">{formatRupiah(sarprasStats.pendingNominal)}</div>
                        </div>
                    </div>

                    {/* Card 3: Disetujui ACC */}
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between">
                        <div className="flex items-center justify-between text-emerald-600 mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest">Disetujui (ACC)</span>
                            <CheckCircle2 size={18} />
                        </div>
                        <div>
                            <div className="text-2xl font-black text-emerald-700">{sarprasStats.approvedCount} <span className="text-sm font-bold text-slate-400">item</span></div>
                            <div className="text-xs font-bold text-slate-500 mt-1">{formatRupiah(sarprasStats.approvedNominal)}</div>
                        </div>
                    </div>

                    {/* Card 4: Ditolak */}
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between">
                        <div className="flex items-center justify-between text-rose-600 mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest">Ditolak Sarpras</span>
                            <XCircle size={18} />
                        </div>
                        <div>
                            <div className="text-2xl font-black text-rose-700">{sarprasStats.rejectedCount} <span className="text-sm font-bold text-slate-400">item</span></div>
                            <div className="text-xs font-bold text-slate-400 mt-1">Perlu revisi unit</div>
                        </div>
                    </div>
                </div>

                {/* Filter & Search Bar */}
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                        {/* Status Tabs */}
                        <div className="flex items-center gap-1.5 p-1.5 bg-slate-100/80 rounded-2xl overflow-x-auto shrink-0">
                            {[
                                { id: 'ALL', label: 'Semua', count: sarprasStats.totalCount },
                                { id: 'PENDING', label: '⏳ Menunggu ACC', count: sarprasStats.pendingCount },
                                { id: 'APPROVED', label: '✓ Disetujui', count: sarprasStats.approvedCount },
                                { id: 'REJECTED', label: '✕ Ditolak', count: sarprasStats.rejectedCount }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setSarprasFilterStatus(tab.id)}
                                    className={`px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 ${
                                        sarprasFilterStatus === tab.id
                                            ? 'bg-white text-slate-900 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    <span>{tab.label}</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                                        sarprasFilterStatus === tab.id
                                            ? (tab.id === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-slate-900 text-white')
                                            : 'bg-slate-200/80 text-slate-600'
                                    }`}>
                                        {tab.count}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Search and Unit Filter */}
                        <div className="flex flex-1 items-center gap-3">
                            <div className="relative flex-1">
                                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Cari nama aset, nama barang, unit, ruangan..."
                                    value={sarprasSearchQuery}
                                    onChange={(e) => setSarprasSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                />
                                {sarprasSearchQuery && (
                                    <button
                                        onClick={() => setSarprasSearchQuery('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>

                            <select
                                value={sarprasFilterUnit}
                                onChange={(e) => setSarprasFilterUnit(e.target.value)}
                                className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shrink-0"
                            >
                                <option value="ALL">Semua Unit & Bidang</option>
                                {uniqueAssetUnits.map(u => (
                                    <option key={u.id} value={u.id}>
                                        {u.type === 'BIDANG' ? `Bidang: ${u.name}` : u.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Asset Table */}
                <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                                    <th className="py-4 px-6 w-12 text-center">No</th>
                                    <th className="py-4 px-6">Unit / Bidang</th>
                                    <th className="py-4 px-6">Mata Anggaran</th>
                                    <th className="py-4 px-6">Nama Aset & Spesifikasi</th>
                                    <th className="py-4 px-6 text-right">Vol & Harga</th>
                                    <th className="py-4 px-6 text-right">Total Anggaran</th>
                                    <th className="py-4 px-6 text-center">Status Sarpras</th>
                                    <th className="py-4 px-6 text-center">Aksi Sarpras</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                                {filteredSarprasAssets.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="py-16 text-center">
                                            <div className="flex flex-col items-center justify-center gap-3">
                                                <div className="p-4 bg-amber-50 text-amber-500 rounded-2xl">
                                                    <Package size={36} />
                                                </div>
                                                <p className="font-bold text-slate-600 text-sm">Tidak Ada Rincian Aset yang Sesuai</p>
                                                <p className="text-slate-400 text-xs max-w-sm">
                                                    {sarprasFilterStatus === 'PENDING'
                                                        ? 'Semua pengajuan aset sudah diverifikasi oleh Sarpras. Tidak ada antrean yang menunggu ACC.'
                                                        : 'Belum ada usulan pengadaan aset yang sesuai dengan kriteria pencarian / filter Anda.'}
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredSarprasAssets.map((item, idx) => {
                                        const comp = item.component;
                                        const assetDisplayName = comp.assetName || comp.namaAset || comp.label;
                                        const isDifferentLabel = comp.label && comp.label !== assetDisplayName;
                                        const st = comp.sarprasStatus;
                                        const catObj = assetCategories.find(c => c.name?.toLowerCase() === (comp.assetCategory || '').toLowerCase());
                                        const economicLifeYears = parseInt(catObj?.economicLife) || (comp.economicLife ? parseInt(comp.economicLife) : null);

                                        return (
                                            <tr key={`${item.planId}-${item.itemId}-${item.subGroupId}-${item.compIdx}`} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="py-4 px-6 text-center font-bold text-slate-400">
                                                    {idx + 1}
                                                </td>

                                                {/* Unit / Bidang & Fund Source */}
                                                <td className="py-4 px-6">
                                                    <div className="font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                                                        <span>{item.ownerName}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 mt-1">
                                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${
                                                            item.sourceLabel === 'BOS' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                                                        }`}>
                                                            {item.sourceLabel}
                                                        </span>
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase">
                                                            {item.ownerType}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Mata Anggaran */}
                                                <td className="py-4 px-6">
                                                    <p className="font-bold text-slate-800">{item.expenseItemName}</p>
                                                    <p className="text-[10px] text-slate-400 font-medium truncate max-w-xs">{item.subGroupName}</p>
                                                </td>

                                                {/* Asset Details */}
                                                <td className="py-4 px-6">
                                                    <div className="font-black text-slate-900 text-sm flex items-center gap-2">
                                                        <Package size={14} className="text-amber-500 shrink-0" />
                                                        <span>{assetDisplayName}</span>
                                                    </div>
                                                    {isDifferentLabel && (
                                                        <p className="text-[11px] text-slate-500 font-medium mt-0.5 italic">
                                                            Rincian RAB: "{comp.label}"
                                                        </p>
                                                    )}
                                                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                                        {comp.assetCategory && (
                                                            <span className="text-[9px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
                                                                🏷️ {comp.assetCategory}
                                                            </span>
                                                        )}
                                                        {economicLifeYears && (
                                                            <span className="text-[9px] font-bold bg-amber-50 text-amber-800 px-2 py-0.5 rounded-md border border-amber-200" title={`Umur Ekonomis: ${economicLifeYears} Tahun`}>
                                                                ⏳ {economicLifeYears} Thn
                                                            </span>
                                                        )}
                                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${
                                                            comp.assetProcurementType === 'PENGGANTIAN' ? 'bg-amber-100 text-amber-800' :
                                                            comp.assetProcurementType === 'TAMBAHAN' ? 'bg-purple-100 text-purple-800' :
                                                            'bg-blue-100 text-blue-800'
                                                        }`}>
                                                            {comp.assetProcurementType || 'BARU'}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Volume & Harga */}
                                                <td className="py-4 px-6 text-right">
                                                    <p className="font-bold text-slate-800">
                                                        {comp.volume} {comp.satuan || 'Unit'} {comp.kali > 1 ? `x ${comp.kali}` : ''}
                                                    </p>
                                                    <p className="text-[10px] text-slate-400">@ {formatRupiah(comp.harga)}</p>
                                                </td>

                                                {/* Total */}
                                                <td className="py-4 px-6 text-right font-black text-slate-900 text-sm">
                                                    {formatRupiah(comp.total)}
                                                </td>

                                                {/* Sarpras Status */}
                                                <td className="py-4 px-6 text-center">
                                                    {st === 'PENDING' ? (
                                                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full font-black text-[10px] animate-pulse">
                                                            ⏳ Menunggu ACC
                                                        </span>
                                                    ) : st === 'REJECTED' ? (
                                                        <div className="flex flex-col items-center">
                                                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full font-black text-[10px]" title={comp.sarprasNotes || ''}>
                                                                <XCircle size={12} /> Ditolak Sarpras
                                                            </span>
                                                            {comp.sarprasNotes && (
                                                                <p className="text-[10px] text-rose-600 font-semibold mt-1 max-w-[180px] truncate" title={comp.sarprasNotes}>
                                                                    "{comp.sarprasNotes}"
                                                                </p>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full font-black text-[10px]">
                                                            <CheckCircle2 size={12} /> Disetujui (ACC)
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Actions */}
                                                <td className="py-4 px-6">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button
                                                            onClick={() => setDetailAssetItem(item)}
                                                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all border border-slate-200 hover:border-amber-300"
                                                            title="Lihat Detail & Umur Ekonomis Aset"
                                                        >
                                                            <Eye size={15} />
                                                        </button>

                                                        {st !== 'APPROVED' && (
                                                            <button
                                                                onClick={() => handleSarprasActionOnAnyPlan(item.planId, item.itemId, item.subGroupId, item.compIdx, 'APPROVED')}
                                                                disabled={isSaving}
                                                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-[10px] uppercase tracking-wider shadow-sm transition-all flex items-center gap-1 active:scale-95 disabled:opacity-50"
                                                                title="Setujui (ACC) Usulan Aset Ini"
                                                            >
                                                                <CheckCircle2 size={12} />
                                                                <span>ACC</span>
                                                            </button>
                                                        )}

                                                        {st !== 'REJECTED' && (
                                                            <button
                                                                onClick={() => {
                                                                    setRejectModalItem(item);
                                                                    setRejectModalReason(comp.sarprasNotes || '');
                                                                }}
                                                                disabled={isSaving}
                                                                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all flex items-center gap-1 active:scale-95 disabled:opacity-50"
                                                                title="Tolak Usulan Aset Ini"
                                                            >
                                                                <XCircle size={12} />
                                                                <span>Tolak</span>
                                                            </button>
                                                        )}

                                                        <button
                                                            onClick={() => {
                                                                setSelectedUnitId(item.unitId);
                                                                setFundSourceFilter(item.sourceLabel);
                                                                setActiveTab('EXPENSE');
                                                            }}
                                                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                                            title="Buka RAB Unit Ini"
                                                        >
                                                            <ExternalLink size={15} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Rejection Modal */}
                {rejectModalItem && (
                    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[2500] flex items-center justify-center p-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 max-w-lg w-full p-8 relative overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
                                        <XCircle size={22} />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-slate-900 text-base">Tolak Pengajuan Aset</h4>
                                        <p className="text-slate-400 text-xs font-bold">Berikan alasan agar unit dapat merevisi usulan</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => { setRejectModalItem(null); setRejectModalReason(''); }}
                                    className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-5 space-y-1">
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Unit / Bidang: <span className="text-slate-900 font-black">{rejectModalItem.ownerName}</span></div>
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Aset: <span className="text-slate-900 font-black">{rejectModalItem.component?.assetName || rejectModalItem.component?.label}</span></div>
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Anggaran: <span className="text-emerald-700 font-black">{formatRupiah(rejectModalItem.component?.total)}</span></div>
                            </div>

                            <div className="space-y-2 mb-6">
                                <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                                    Catatan / Alasan Penolakan Sarpras <span className="text-rose-500">*</span>
                                </label>
                                <textarea
                                    rows={4}
                                    placeholder="Contoh: Spesifikasi unit terlalu tinggi, stok di gudang masih mencukupi, atau mohon koordinasi langsung dengan Sarpras..."
                                    value={rejectModalReason}
                                    onChange={(e) => setRejectModalReason(e.target.value)}
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 leading-relaxed"
                                    autoFocus
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => { setRejectModalItem(null); setRejectModalReason(''); }}
                                    className="px-5 py-3 rounded-xl border border-slate-200 text-slate-600 font-black text-xs uppercase tracking-wider hover:bg-slate-50 transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    type="button"
                                    disabled={!rejectModalReason.trim() || isSaving}
                                    onClick={() => {
                                        handleSarprasActionOnAnyPlan(
                                            rejectModalItem.planId,
                                            rejectModalItem.itemId,
                                            rejectModalItem.subGroupId,
                                            rejectModalItem.compIdx,
                                            'REJECTED',
                                            rejectModalReason
                                        );
                                    }}
                                    className="px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-rose-200 transition-all disabled:opacity-50 flex items-center gap-2"
                                >
                                    <XCircle size={14} />
                                    <span>Konfirmasi Tolak Usulan</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Detail & Umur Ekonomis Asset Modal */}
                {detailAssetItem && (() => {
                    const dComp = detailAssetItem.component || {};
                    const dCatObj = assetCategories.find(c => c.name?.toLowerCase() === (dComp.assetCategory || '').toLowerCase());
                    const dEconomicLifeYears = parseInt(dCatObj?.economicLife) || (dComp.economicLife ? parseInt(dComp.economicLife) : 4);
                    const dEconomicLifeMonths = dEconomicLifeYears * 12;
                    const dTotalCost = parseFloat(dComp.total) || 0;
                    const dAnnualDepreciation = dEconomicLifeYears > 0 ? Math.round(dTotalCost / dEconomicLifeYears) : 0;
                    const dMonthlyDepreciation = dEconomicLifeMonths > 0 ? Math.round(dTotalCost / dEconomicLifeMonths) : 0;
                    const dStatus = dComp.sarprasStatus || 'PENDING';

                    return (
                        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[2500] flex items-center justify-center p-4 animate-in fade-in duration-200">
                            <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 max-w-2xl w-full p-8 relative overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                                {/* Header */}
                                <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                                            <Eye size={22} />
                                        </div>
                                        <div>
                                            <h4 className="font-black text-slate-900 text-base">Detail Telaah Aset & Umur Ekonomis</h4>
                                            <p className="text-slate-400 text-xs font-bold">Verifikasi kelayakan & analisis investasi sarana prasarana</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setDetailAssetItem(null)}
                                        className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                <div className="space-y-4 mb-6">
                                    {/* Info Unit & Program */}
                                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-2 gap-3 text-xs">
                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Unit / Bidang</span>
                                            <span className="font-black text-slate-800">{detailAssetItem.ownerName}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Sumber Dana</span>
                                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black mt-0.5 ${
                                                detailAssetItem.sourceLabel === 'BOS' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'
                                            }`}>
                                                {detailAssetItem.sourceLabel}
                                            </span>
                                        </div>
                                        <div className="col-span-2">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Program & Pos Anggaran</span>
                                            <span className="font-bold text-slate-700">{detailAssetItem.programName}</span>
                                            <div className="text-[11px] text-slate-500 font-medium">{detailAssetItem.itemLabel} &bull; {detailAssetItem.subGroupName}</div>
                                        </div>
                                    </div>

                                    {/* Spesifikasi Aset */}
                                    <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Nama / Spesifikasi Aset</span>
                                                <h5 className="font-black text-slate-900 text-sm mt-0.5">{dComp.assetName || dComp.label}</h5>
                                                {dComp.assetName && dComp.label && dComp.assetName.trim().toLowerCase() !== dComp.label.trim().toLowerCase() && (
                                                    <p className="text-xs text-slate-500 italic mt-0.5">Rincian: "{dComp.label}"</p>
                                                )}
                                            </div>
                                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg shrink-0 ${
                                                dComp.assetProcurementType === 'PENGGANTIAN' ? 'bg-amber-100 text-amber-800' :
                                                dComp.assetProcurementType === 'TAMBAHAN' ? 'bg-purple-100 text-purple-800' :
                                                'bg-blue-100 text-blue-800'
                                            }`}>
                                                {dComp.assetProcurementType === 'PENGGANTIAN' ? 'Penggantian Rusak' : 'Pengadaan Baru'}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 text-xs">
                                            <div>
                                                <span className="text-[10px] font-bold text-slate-400 block">Kategori Aset</span>
                                                <span className="font-bold text-slate-700">🏷️ {dComp.assetCategory || '-'}</span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] font-bold text-slate-400 block">Volume & Harga</span>
                                                <span className="font-bold text-slate-700">{dComp.volume} {dComp.satuan || 'Unit'} {dComp.kali > 1 ? `x ${dComp.kali}` : ''} @ {formatRupiah(dComp.harga)}</span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] font-bold text-slate-400 block">Total Anggaran</span>
                                                <span className="font-black text-emerald-700 text-sm">{formatRupiah(dTotalCost)}</span>
                                            </div>
                                        </div>

                                        {dComp.description && (
                                            <div className="pt-2 border-t border-slate-100 text-xs">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Catatan / Justifikasi Unit</span>
                                                <p className="text-slate-600 italic mt-0.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">"{dComp.description}"</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Analisis Umur Ekonomis & Depresiasi */}
                                    <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 space-y-3">
                                        <div className="flex items-center gap-2">
                                            <span className="p-1.5 bg-amber-500 text-white rounded-lg text-xs font-black">📊</span>
                                            <div>
                                                <h6 className="font-black text-amber-950 text-xs uppercase tracking-wider">Analisis Umur Ekonomis & Beban Penyusutan</h6>
                                                <p className="text-[10px] font-bold text-amber-700">Metode Garis Lurus (Straight-Line Depreciation)</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                                            <div className="bg-white/80 backdrop-blur-sm p-3 rounded-xl border border-amber-200">
                                                <span className="text-[9px] font-black uppercase tracking-wider text-amber-800 block">Masa Manfaat / Umur</span>
                                                <div className="text-base font-black text-amber-950 mt-0.5">{dEconomicLifeYears} Tahun</div>
                                                <span className="text-[10px] text-amber-700 font-medium">({dEconomicLifeMonths} Bulan)</span>
                                            </div>
                                            <div className="bg-white/80 backdrop-blur-sm p-3 rounded-xl border border-amber-200">
                                                <span className="text-[9px] font-black uppercase tracking-wider text-amber-800 block">Penyusutan per Tahun</span>
                                                <div className="text-sm font-black text-slate-900 mt-0.5">{formatRupiah(dAnnualDepreciation)}</div>
                                                <span className="text-[10px] text-slate-500 font-medium">per tahun anggaran</span>
                                            </div>
                                            <div className="bg-white/80 backdrop-blur-sm p-3 rounded-xl border border-amber-200">
                                                <span className="text-[9px] font-black uppercase tracking-wider text-amber-800 block">Beban per Bulan</span>
                                                <div className="text-sm font-black text-slate-900 mt-0.5">{formatRupiah(dMonthlyDepreciation)}</div>
                                                <span className="text-[10px] text-slate-500 font-medium">per bulan operasional</span>
                                            </div>
                                        </div>

                                        <p className="text-[10px] text-amber-800 italic bg-amber-100/50 p-2 rounded-lg">
                                            💡 Data umur ekonomis merujuk pada standar kategori <strong>"{dComp.assetCategory || 'Umum'}"</strong>. Beban penyusutan riil akan otomatis berjalan pada modul Inventaris Aset setelah barang dibeli dan diaktifkan.
                                        </p>
                                    </div>

                                    {/* Current Verification Status */}
                                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
                                        <span className="font-bold text-slate-600">Status Telaah Sarpras Saat Ini:</span>
                                        {dStatus === 'APPROVED' ? (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full font-black text-[11px]">
                                                <CheckCircle2 size={13} /> Disetujui (ACC)
                                            </span>
                                        ) : dStatus === 'REJECTED' ? (
                                            <div className="text-right">
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-100 text-rose-800 rounded-full font-black text-[11px]">
                                                    <XCircle size={13} /> Ditolak
                                                </span>
                                                {dComp.sarprasNotes && (
                                                    <p className="text-[11px] text-rose-600 font-semibold mt-1">"{dComp.sarprasNotes}"</p>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-800 rounded-full font-black text-[11px]">
                                                ⏳ Menunggu Telaah
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Footer Buttons */}
                                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => setDetailAssetItem(null)}
                                        className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-black text-xs uppercase tracking-wider hover:bg-slate-50 transition-colors"
                                    >
                                        Tutup
                                    </button>

                                    <div className="flex items-center gap-2">
                                        {dStatus !== 'REJECTED' && (
                                            <button
                                                type="button"
                                                disabled={isSaving}
                                                onClick={() => {
                                                    const targetItem = detailAssetItem;
                                                    setDetailAssetItem(null);
                                                    setRejectModalItem(targetItem);
                                                    setRejectModalReason(dComp.sarprasNotes || '');
                                                }}
                                                className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-black text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                                            >
                                                <XCircle size={14} />
                                                <span>Tolak Usulan</span>
                                            </button>
                                        )}

                                        {dStatus !== 'APPROVED' && (
                                            <button
                                                type="button"
                                                disabled={isSaving}
                                                onClick={async () => {
                                                    await handleSarprasActionOnAnyPlan(
                                                        detailAssetItem.planId,
                                                        detailAssetItem.itemId,
                                                        detailAssetItem.subGroupId,
                                                        detailAssetItem.compIdx,
                                                        'APPROVED'
                                                    );
                                                    setDetailAssetItem(null);
                                                }}
                                                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-200 transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                                            >
                                                <CheckCircle2 size={14} />
                                                <span>Setujui (ACC)</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </div>
        );
    };

    const renderBudgetTable = (type, labelText) => {
        const isIncome = type === 'income';
        const items = isIncome ? filteredIncomeItems : filteredExpenseItems;

        return (
            <div className="space-y-6">
                {hasRevision && (
                    <div className="p-8 bg-gradient-to-r from-blue-50 to-indigo-50/50 rounded-[2.5rem] border border-blue-100 shadow-xl shadow-blue-100/20 flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6 animate-in slide-in-from-top-4 duration-500">
                        <div className="flex items-start gap-4">
                            <div className="p-4 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-200">
                                <Info size={22} />
                            </div>
                            <div>
                                <div className="flex items-center gap-3 flex-wrap">
                                    <h4 className="font-black text-slate-900 uppercase tracking-tight italic text-lg">
                                        Draf Usulan Revisi Anggaran
                                    </h4>
                                    {revisionDiff === 0 ? (
                                        <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full font-black text-[9px] uppercase tracking-wider">
                                            Pergeseran Anggaran (Zero-Sum)
                                        </span>
                                    ) : (
                                        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-black text-[9px] uppercase tracking-wider">
                                            Perubahan Pagu Total
                                        </span>
                                    )}
                                </div>
                                <p className="text-slate-500 text-xs font-medium mt-1">
                                    Anda sedang melakukan perubahan pada anggaran aktif. Data realisasi/belanja riil tidak akan terpengaruh sebelum usulan ini disetujui Yayasan.
                                </p>
                                <div className="flex items-center gap-6 mt-4 flex-wrap">
                                    <div>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">PAGU LAMA</span>
                                        <span className="font-bold text-slate-700 text-sm">{formatCurrency(originalTotal)}</span>
                                    </div>
                                    <div className="h-8 w-px bg-slate-200" />
                                    <div>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">PAGU BARU</span>
                                        <span className="font-bold text-slate-900 text-sm">{formatCurrency(revisionTotal)}</span>
                                    </div>
                                    <div className="h-8 w-px bg-slate-200" />
                                    <div>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">SELISIH PAGU</span>
                                        <span className={`font-black text-sm ${revisionDiff > 0 ? 'text-blue-600' : revisionDiff < 0 ? 'text-rose-600' : 'text-slate-600'}`}>
                                            {revisionDiff > 0 ? '+' : ''}{formatCurrency(revisionDiff)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={handleDeleteRevision}
                            disabled={isSaving}
                            className="self-start md:self-center px-6 py-3.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-sm active:scale-95 flex items-center gap-2"
                        >
                            <Trash2 size={14} />
                            Hapus Draf Revisi
                        </button>
                    </div>
                )}
                {/* Advanced Filter Bar */}
                <div className="p-5 bg-white/60 backdrop-blur-xl rounded-[2.5rem] border border-white shadow-2xl shadow-slate-200/50 flex flex-wrap items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                            <Filter size={18} />
                        </div>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">Filter Tampilan</h4>
                    </div>

                    <div className="h-8 w-px bg-slate-200/50" />

                    {/* Month Filter */}
                    <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-2">Bulan:</span>
                        <select
                            value={filterMonth || ''}
                            onChange={(e) => setFilterMonth(e.target.value || null)}
                            className="bg-slate-50 border-0 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 focus:ring-2 focus:ring-indigo-100 transition-all cursor-pointer flex-1"
                        >
                            <option value="">SELURUH TAHUN (TOTAL)</option>
                            {monthsOptions.map(m => (
                                <option key={m.id} value={m.id}>{m.name.toUpperCase()}</option>
                            ))}
                        </select>
                    </div>

                    <div className="h-8 w-px bg-slate-200/50" />

                    {/* Program Filter */}
                    <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-2">Program:</span>
                        <select
                            value={filterProgram || ''}
                            onChange={(e) => setFilterProgram(e.target.value || null)}
                            className="bg-slate-50 border-0 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 focus:ring-2 focus:ring-indigo-100 transition-all cursor-pointer flex-1"
                        >
                            <option value="">SEMUA PROGRAM</option>
                            {allPrograms.map(p => (
                                <option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>
                            ))}
                        </select>
                    </div>

                    {/* Clear Button */}
                    {(filterMonth || filterProgram) && (
                        <button
                            onClick={() => { setFilterMonth(null); setFilterProgram(null); }}
                            className="p-3 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all group"
                            title="RESET FILTER"
                        >
                            <RotateCcw size={16} className="group-active:rotate-180 transition-transform duration-500" />
                        </button>
                    )}

                    {/* Pilih Semua Button */}
                    {!isConsolidation && (
                        <button
                            onClick={handleSelectAll}
                            className="p-3 ml-auto bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all group font-black text-[10px] uppercase tracking-widest flex items-center gap-2"
                            title="Pilih Semua Rincian"
                        >
                            <CheckSquare size={16} /> PILIH SEMUA
                        </button>
                    )}
                </div>

                <div className="overflow-x-auto scroll-top">
                    <table className="w-full border-separate border-spacing-y-4">
                        <thead>
                            <tr className="text-slate-400/80 text-[10px] font-black uppercase tracking-[0.2em] italic relative">
                                <th className="px-6 py-1 text-left w-12 sticky left-0 z-20 bg-slate-50">#</th>
                                <th className="px-6 py-1 text-left sticky left-[48px] z-20 bg-slate-50" style={{ minWidth: '250px' }}>{labelText}</th>
                                <th className="px-6 py-1 text-center sticky left-[298px] z-20 bg-slate-50">Semester</th>
                                <th className="px-6 py-1 text-right">{isIncome ? 'Target (RAP)' : 'Limit (RAP)'}</th>
                                <th className="px-6 py-1 text-right">Draft RAB</th>
                                <th className="px-6 py-1 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(() => {
                                // Deduplicate items by name for display
                                const uniqueByName = [];
                                const seen = new Set();
                                items.forEach(item => {
                                    if (!seen.has(item.name)) {
                                        uniqueByName.push(item);
                                        seen.add(item.name);
                                    }
                                });
                                return uniqueByName;
                            })().filter(item => {
                                if (searchTerm) return item.name.toLowerCase().includes(searchTerm.toLowerCase());
                                return true;
                            }).filter(itemMaster => {
                                if (isIncome) return true;

                                const sameNamed = items.filter(i => i.name === itemMaster.name);
                                const aggregatedAllocated = sameNamed.reduce((sum, i) => {
                                    return sum + (fundSourceFilter === 'BOS' ? (bosItemMap[i.id] || 0) : (rapData.itemAllocations[i.id] || 0));
                                }, 0);
                                const aggregatedPlans = sameNamed.flatMap(i => activePlan[type][i.id] || []);

                                return (aggregatedAllocated > 0 || aggregatedPlans.length > 0);
                            }).flatMap((itemMaster, mIdx) => {
                                const sameNamed = items.filter(i => i.name === itemMaster.name);
                                const allocated = sameNamed.reduce((sum, i) => {
                                    return sum + (fundSourceFilter === 'BOS' ? (bosItemMap[i.id] || 0) : (rapData.itemAllocations[i.id] || 0));
                                }, 0);

                                let allPlans = sameNamed.flatMap(i => activePlan[type][i.id] || []);
                                
                                // FORCE CONSOLIDATION: Merge multiple plans into ONE for UI consistency in Input view
                                if (activeTab !== 'REVIEW' && allPlans.length > 1) {
                                    const first = allPlans[0];
                                    const allComps = allPlans.flatMap(p => p.components || []);
                                    const aggrMonths = {};
                                    allPlans.forEach(p => {
                                        Object.entries(p.months || {}).forEach(([mId, mData]) => {
                                            if (!mData.m) return;
                                            if (!aggrMonths[mId]) aggrMonths[mId] = { m: true, jumlah: 0 };
                                            aggrMonths[mId].jumlah += (parseFloat(mData.jumlah) || 0);
                                        });
                                    });
                                    allPlans = [{
                                        ...first,
                                        total: allPlans.reduce((s, p) => s + (parseFloat(p.total) || 0), 0),
                                        components: allComps,
                                        months: aggrMonths,
                                        description: allComps.length > 0 ? allComps[0].label : ''
                                    }];
                                }
                                
                                let plans = allPlans;

                                if (plans.length > 0) {
                                    return plans.map((plan, pIdx) => {
                                        const rowData = {
                                            id: plan.id,
                                            name: itemMaster.name,
                                            status: plan.status,
                                            rap: plan.limit || allocated,
                                            rab: plan.total || 0,
                                            sisa: (plan.limit || allocated) - (plan.total || 0),
                                            // Fix: Disable expansion to prevent redundant rows for consolidated items
                                            breakdown: [{ 
                                                id: `COMP-${plan.id}`, 
                                                name: 'RINCIAN BELANJA', 
                                                rab: plan.total || 0, 
                                                rap: plan.limit || allocated, 
                                                components: (plan.components || []).map((c, cIdx) => {
                                                    let compStatus = c.status;
                                                    if (!compStatus) {
                                                        if (c.isApproved === true) compStatus = 'APPROVED';
                                                        else compStatus = activePlan.status === 'APPROVED' ? 'APPROVED' : (activePlan.status === 'PENDING' ? 'PENDING' : 'DRAFT');
                                                    }
                                                    return {
                                                        ...c,
                                                        _pIdx: pIdx,
                                                        _cIdx: cIdx,
                                                        status: compStatus,
                                                        spent: componentSpending[c.id] || 0,
                                                        remaining: (parseFloat(c.total) || 0) - (componentSpending[c.id] || 0)
                                                    };
                                                })
                                            }],
                                        };

                                        return (
                                            <BudgetRow
                                                key={plan.id}
                                                data={rowData}
                                                isExpanded={!!expandedReviewPlans[plan.id]}
                                                onToggle={() => toggleReviewPlan(plan.id)}
                                                formatCurrency={formatRupiah}
                                                expandedDetailItems={{ [`${plan.id}|COMP-${plan.id}`]: true }}
                                                onToggleDetailItem={toggleDetailItem}
                                                isBos={plan.useBos}
                                                selectable={!isConsolidation}
                                                isSuperAdmin={isSuperAdmin}
                                                selectedComponents={selectedComponents}
                                                onComponentToggle={toggleComponentSelection}
                                                nameColSpan={3}
                                                actions={
                                                    (isSuperAdmin || 
                                                     (currentUser?.role === 'admin_unit' && selectedUnitId === currentUser.unitId) ||
                                                     (currentUser?.role === 'admin_bidang' && selectedUnitId === `FIELD-${currentUser.fieldId}`)) ? (
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setEditingItem({
                                                                        ...itemMaster,
                                                                        isNewPlan: false,
                                                                        planId: plan.id
                                                                    });
                                                                }}
                                                                className="w-10 h-10 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                                                                title="REVIEW & EDIT RENCANA"
                                                            >
                                                                <Eye size={18} />
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setEditingItem({
                                                                        ...itemMaster,
                                                                        isNewPlan: true
                                                                    });
                                                                }}
                                                                className="w-10 h-10 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                                                                title="TAMBAH RENCANA BARU"
                                                            >
                                                                <Plus size={18} />
                                                            </button>
                                                            {!isLocked && (
                                                                <button
                                                                    onClick={async (e) => {
                                                                        e.stopPropagation();
                                                                        if (window.confirm(`Hapus rencana belanja "${plan.description || itemMaster.name}"?`)) {
                                                                            const updatedPlans = (activePlan[type][itemMaster.id] || []).filter(p => p.id !== plan.id);
                                                                            const nextPlan = {
                                                                                ...activePlan,
                                                                                [type]: {
                                                                                    ...activePlan[type],
                                                                                    [itemMaster.id]: updatedPlans
                                                                                }
                                                                            };
                                                                            setCurrentPlan(nextPlan);
                                                                            const planId = currentPlanId;
                                                                            const dbPlan = {
                                                                                id: planId,
                                                                                academicYearId: selectedYearId,
                                                                                unitId: selectedUnitId.startsWith('FIELD-') ? null : (selectedUnitId === 'FOUNDATION' ? 'FOUNDATION' : selectedUnitId),
                                                                                fieldId: selectedUnitId.startsWith('FIELD-') ? selectedUnitId.replace('FIELD-', '') : null,
                                                                                income: nextPlan.income,
                                                                                expense: nextPlan.expense,
                                                                                status: nextPlan.status,
                                                                                rejectionReason: nextPlan.rejectionReason,
                                                                                updatedAt: new Date().toISOString(),
                                                                                updatedBy: currentUser?.username
                                                                            };
                                                                            await persistPlanToServer(dbPlan); 
                                                                            setMessage({ type: 'success', text: 'Item rincian berhasil dihapus secara permanen.' });
                                                                        }
                                                                    }}
                                                                    className="w-10 h-10 flex items-center justify-center bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                                                                    title="HAPUS RENCANA"
                                                                >
                                                                    <Trash2 size={18} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : null
                                                }
                                            />
                                        );
                                    });
                                }

                                if (filterMonth || filterProgram) return [];

                                return (
                                    <tr key={`TEMP-${itemMaster.id}`} className="group bg-white hover:bg-slate-50 transition-all duration-300">
                                        <td className="px-6 py-4 border-y border-l border-slate-100 font-black text-slate-300 text-xs italic sticky left-0 z-10 bg-inherit">--</td>
                                        <td className="px-6 py-4 border-y border-slate-100 sticky left-[48px] z-10 bg-inherit">
                                            <div className="flex items-center gap-4 opacity-40">
                                                <div className="p-4 rounded-2xl bg-slate-50 text-slate-300">
                                                    {isIncome ? <DollarSign size={18} /> : <TrendingUp size={18} />}
                                                </div>
                                                <span className="font-black text-slate-800 text-sm">{itemMaster.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 border-y border-slate-100 text-center text-slate-300 font-black text-[9px] sticky left-[298px] z-10 bg-inherit">BELUM ADA INPUT</td>
                                        <td className="px-6 py-4 border-y border-slate-100 text-right font-black text-slate-400 text-xs italic">{formatRupiah(allocated)}</td>
                                        <td className="px-6 py-4 border-y border-slate-100 text-right font-black text-slate-300 text-sm italic">{formatRupiah(0)}</td>
                                        <td className="px-6 py-4 border-y border-r border-slate-100 text-right">
                                            {(isSuperAdmin || 
                                              (currentUser?.role === 'admin_unit' && selectedUnitId === currentUser.unitId) ||
                                              (currentUser?.role === 'admin_bidang' && selectedUnitId === `FIELD-${currentUser.fieldId}`)) && (
                                                <button
                                                    onClick={() => {
                                                        const newPlanId = `P-${itemMaster.id}-${Date.now()}`;
                                                        setEditingItem({
                                                            id: newPlanId,
                                                            itemId: itemMaster.id,
                                                            name: itemMaster.name,
                                                            isNewPlan: true,
                                                            semester: '1'
                                                        });
                                                    }}
                                                    className="w-10 h-10 flex items-center justify-center bg-blue-600 text-white rounded-xl shadow-lg hover:bg-slate-900 transition-all active:scale-95"
                                                >
                                                    <Plus size={18} strokeWidth={3} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Sticky Table Footer / Save Bar */}
                <div className="mt-8 p-10 bg-slate-900 rounded-[3rem] text-white flex items-center justify-between shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none group-hover:scale-110 transition-transform">
                        <Save size={160} />
                    </div>
                    <div className="relative z-10 flex items-center gap-10">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 italic mb-1">Total Sisa Anggaran</span>
                            <h4 className={`text-5xl font-black italic tracking-tighter ${balance < 0 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}>
                                {formatRupiah(balance)}
                            </h4>
                        </div>
                    </div>
                    <div className="relative z-10 flex items-center gap-4">
                        {!isLocked && !isConsolidation && (
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="group flex items-center gap-4 bg-white text-slate-900 px-10 py-5 rounded-[2rem] font-black text-sm tracking-tight transition-all hover:scale-105 active:scale-95 shadow-xl disabled:opacity-50"
                            >
                                <Save size={20} className="text-blue-600 group-hover:rotate-12 transition-transform" />
                                {isSaving ? 'MEMPROSES...' : 'SIMPAN SEMUA DATA'}
                            </button>
                        )}
                        {activePlan?.status === 'APPROVED' && !hasRevision && !isConsolidation && (
                            <button
                                onClick={handleCreateRevision}
                                className="group flex items-center gap-4 bg-amber-600 hover:bg-slate-900 text-white px-10 py-5 rounded-[2rem] font-black text-sm tracking-tight transition-all hover:scale-105 active:scale-95 shadow-xl"
                            >
                                <Plus size={20} className="group-hover:rotate-180 transition-transform" />
                                AJUKAN REVISI / PERGESERAN ANGGARAN
                            </button>
                        )}
                        {isAddendumMode && (
                            <button
                                onClick={() => setIsAddendumMode(false)}
                                className="group flex items-center gap-4 bg-rose-500 text-white px-10 py-5 rounded-[2rem] font-black text-sm tracking-tight transition-all hover:scale-105 active:scale-95 shadow-xl"
                            >
                                <X size={20} className="group-hover:rotate-90 transition-transform" />
                                BATAL TAMBAHAN
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const totalIncome = useMemo(() => {
        return Object.values(activePlan?.income || {}).flat().reduce((sum, val) => {
            if (filterProgram && val.programId !== filterProgram && !val.components?.some(c => c.programId === filterProgram)) return sum;
            if (filterMonth) return sum + (parseFloat(val.months?.[filterMonth]?.jumlah) || 0);
            return sum + (val?.total || 0);
        }, 0);
    }, [activePlan?.income, filterMonth, filterProgram]);

    const totalExpense = useMemo(() => {
        return Object.values(activePlan?.expense || {}).flat().reduce((sum, val) => {
            if (filterProgram && val.programId !== filterProgram && !val.components?.some(c => c.programId === filterProgram)) return sum;
            if (filterMonth) return sum + (parseFloat(val.months?.[filterMonth]?.jumlah) || 0);
            return sum + (val?.total || 0);
        }, 0);
    }, [activePlan?.expense, filterMonth, filterProgram]);

    // NEW: Calculate BOS Specifics
    const totalBosAllocated = useMemo(() => {
        const unitId = selectedUnitId.startsWith('FIELD-') ? null : (selectedUnitId === 'FOUNDATION' ? null : selectedUnitId);
        if (!unitId || !selectedYearId) return 0;

        return (bosAllocations || []).filter(a =>
            !a.isDeleted &&
            a.academicYearId === selectedYearId &&
            a.unitId === unitId
        ).reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
    }, [bosAllocations, selectedYearId, selectedUnitId]);


    const totalExpenseBos = useMemo(() => {
        return Object.values(activePlan?.expense || {}).flat().reduce((sum, val) => {
            if (filterProgram && val.programId !== filterProgram && !val.components?.some(c => c.programId === filterProgram)) return sum;
            if (filterMonth) {
                const monthTotal = parseFloat(val.months?.[filterMonth]?.jumlah) || 0;
                return sum + (val?.useBos ? monthTotal : 0);
            }
            return sum + (val?.useBos ? (parseFloat(val?.bosAmount) || 0) : 0);
        }, 0);
    }, [activePlan?.expense, filterMonth, filterProgram]);

    const balance = useMemo(() => {
        if (fundSourceFilter === 'BOS') {
            return totalBosAllocated - totalExpenseBos;
        }
        if (fundSourceFilter === 'Yayasan') {
            // totalExpense includes totalExpenseBos, so we isolate Yayasan portion
            const yayasanExpense = totalExpense - totalExpenseBos;
            return (rapData?.totalTarget || 0) + totalIncome - yayasanExpense;
        }
        // Fallback for 'all' or default view (Global Balance)
        return (rapData?.totalTarget || 0) + totalIncome + totalBosAllocated - totalExpense;
    }, [fundSourceFilter, rapData?.totalTarget, totalIncome, totalBosAllocated, totalExpense, totalExpenseBos]);

    return (
        <div className="p-4 lg:p-10 max-w-[1440px] mx-auto space-y-8 animate-in fade-in duration-700">
            {/* Top Toolbar */}
            <div className="flex flex-col gap-6">
                <div className="flex items-center gap-4 flex-wrap">
                    {isSuperAdmin ? (
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowDashboard(!showDashboard)}
                                className={`p-3 rounded-lg font-black text-xs transition-all flex items-center gap-2 shadow-sm ${showDashboard
                                    ? 'bg-slate-900 text-white'
                                    : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                                    }`}
                            >
                                <Layers size={16} />
                                {showDashboard ? 'TUTUP IKHTISAR' : 'LIHAT SEMUA UNIT'}
                            </button>

                            <select
                                className="p-3 bg-white border border-slate-300 rounded-lg font-bold text-slate-700 min-w-[250px] shadow-sm focus:ring-2 focus:ring-blue-100 outline-none"
                                value={selectedUnitId}
                                onChange={e => {
                                    setSelectedUnitId(e.target.value);
                                    setShowDashboard(false);
                                }}
                            >
                                <option value="FOUNDATION">Yayasan (Konsolidasi)</option>
                                <optgroup label="UNIT">
                                    {units.filter(u => !u.isDeleted).map(u => {
                                        const isPending = (rabPlans || []).some(p => p.unitId === u.id && p.status === 'PENDING' && p.academicYearId === selectedYearId && (fundSourceFilter === 'BOS' ? p.id.endsWith('-BOS') : !p.id.endsWith('-BOS')));
                                        return (
                                            <option key={u.id} value={u.id}>
                                                {u.name} {isPending ? '🔴' : ''}
                                            </option>
                                        );
                                    })}
                                </optgroup>
                                <optgroup label="BIDANG / LAPANGAN">
                                    {fields.map(f => {
                                        const isPending = (rabPlans || []).some(p => p.fieldId === f.id && p.status === 'PENDING' && p.academicYearId === selectedYearId && (fundSourceFilter === 'BOS' ? p.id.endsWith('-BOS') : !p.id.endsWith('-BOS')));
                                        return (
                                            <option key={f.id} value={`FIELD-${f.id}`}>
                                                {f.name} {isPending ? '🔴' : ''}
                                            </option>
                                        );
                                    })}
                                </optgroup>
                            </select>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 px-5 py-3 bg-blue-50 border border-blue-200 rounded-lg shadow-sm min-w-[200px]">
                            <Building2 size={16} className="text-blue-500 shrink-0" />
                            <span className="font-bold text-blue-800 text-sm">
                                {currentUser?.role === 'admin_unit'
                                    ? (units.find(u => u.id === currentUser.unitId)?.name || 'Unit Saya')
                                    : (fields.find(f => f.id === currentUser.fieldId)?.name || 'Bidang Saya')
                                }
                            </span>
                        </div>
                    )}



                    <div className="flex flex-col gap-1">
                        <select
                            className="p-3 bg-white border border-slate-300 rounded-lg font-bold text-slate-700 min-w-[200px] shadow-sm"
                            value={selectedYearId}
                            onChange={e => setSelectedYearId(e.target.value)}
                        >
                            {academicYears?.filter(y => y.isActive || y.id === selectedYearId).map(y => (
                                <option key={y.id} value={y.id}>TA {y.name}</option>
                            ))}
                        </select>
                    </div>
                </div>


                <div className="flex items-center gap-3 ml-auto">
                    <button
                        onClick={handleExportRAB}
                        className="bg-emerald-50 text-emerald-600 border border-emerald-200 px-6 py-3 rounded-2xl font-black text-xs transition-all flex items-center gap-2 hover:bg-emerald-600 hover:text-white active:scale-95 shadow-sm"
                    >
                        <Download size={16} />
                        EXPORT EXCEL
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 p-6 bg-slate-50 border border-slate-200 rounded-2xl shadow-inner">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sumber Dana</p>
                        <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${fundSourceFilter === 'BOS' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                            {fundSourceFilter === 'BOS' ? '🏫 Dana BOS' : '🏛️ Dana Yayasan'}
                        </span>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status Pengajuan</p>
                        <div className="flex items-center justify-between">
                            <p className={`font-black uppercase tracking-tight text-[11px] ${(activePlan.status === 'APPROVED' || activePlan.status === 'PENDING') ? 'text-indigo-600' : 'text-rose-600'}`}>
                                {(() => {
                                    if (!activePlan || !activePlan.expense) return activePlan.status === 'APPROVED' ? 'Disetujui' : (activePlan.status === 'PENDING' ? 'Menunggu Review' : 'Draft / Belum Dikirim');
                                    
                                    let approvedCount = 0;
                                    let pendingCount = 0;
                                    let draftCount = 0;
                                    let totalComps = 0;

                                    Object.values(activePlan.expense).forEach(plans => {
                                        const planArray = Array.isArray(plans) ? plans : (plans && typeof plans === 'object' && Object.keys(plans).length > 0 ? [plans] : []);
                                        planArray.forEach(p => {
                                            (p.components || []).forEach(c => {
                                                totalComps++;
                                                if (c.status === 'APPROVED' || c.isApproved) approvedCount++;
                                                else if (c.status === 'PENDING') pendingCount++;
                                                else draftCount++;
                                            });
                                        });
                                    });

                                    if (totalComps === 0) return activePlan.status === 'APPROVED' ? 'Disetujui' : (activePlan.status === 'PENDING' ? 'Menunggu Review' : 'Draft / Belum Dikirim');

                                    if (activePlan.status === 'APPROVED' && approvedCount === totalComps) return 'SEMUA DISETUJUI';

                                    const texts = [];
                                    if (approvedCount > 0) texts.push(`${approvedCount} DI-ACC`);
                                    if (pendingCount > 0) texts.push(`${pendingCount} MENUNGGU`);
                                    if (draftCount > 0) texts.push(`${draftCount} DRAFT`);

                                    return texts.length > 0 ? texts.join(' • ') : 'Belum Ada Rincian';
                                })()}
                            </p>
                            {isSuperAdmin && activePlan.status === 'APPROVED' && (
                                <button
                                    onClick={handleCancelApproval}
                                    disabled={isSaving}
                                    className="px-4 py-1.5 bg-rose-100 text-rose-600 rounded-lg font-black text-[9px] uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all shadow-sm active:scale-95 disabled:opacity-50"
                                >
                                    Batalkan Persetujuan
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Periode Anggaran</p>
                        <p className="font-black text-slate-700 italic">
                            Full Year {academicYears.find(ay => ay.id === selectedYearId)?.name}
                        </p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pesan Peninjauan</p>
                        <p className="font-black text-slate-400 text-xs italic">{activePlan.rejectionReason || '-'}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mode Tampilan</p>
                        <p className={`font-black tracking-tight ${isConsolidation ? 'text-indigo-600 italic' : 'text-slate-700'}`}>
                            {isConsolidation ? 'KONSOLIDASI YAYASAN' : 'ENTITAS UNIT DATA'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Main Display Logic */}
            {isSuperAdmin && showDashboard ? (
                /* DASHBOARD VIEW */
                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {fundSourceFilter === 'BOS' ? (
                        /* ===== BOS CONSOLIDATION DASHBOARD ===== */
                        <>
                            <div className="bg-gradient-to-r from-emerald-900 to-teal-950 rounded-[2.5rem] p-8 lg:p-12 text-white shadow-2xl relative overflow-hidden ring-8 ring-emerald-100/20">
                                <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
                                    <Database size={240} />
                                </div>
                                <div className="relative z-10 max-w-4xl">
                                    <div className="flex items-center gap-4 mb-6">
                                        <span className="px-5 py-2 bg-emerald-500 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-lg">
                                            IKHTISAR DANA BOS
                                        </span>
                                        <span className="text-emerald-400 font-bold text-xs uppercase tracking-widest italic">Tahun Ajaran {academicYears.find(ay => ay.id === selectedYearId)?.name}</span>
                                    </div>
                                    <h2 className="text-4xl lg:text-5xl font-black tracking-tighter italic leading-none mb-8">
                                        Konsolidasi <span className="text-emerald-400">RAB BOS</span>
                                    </h2>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black text-emerald-300 uppercase tracking-widest opacity-60">Total Alokasi BOS</p>
                                            <h3 className="text-2xl font-black italic">{formatRupiah((bosAllocations || []).filter(a => a.academicYearId === selectedYearId && !a.isDeleted).reduce((s, a) => s + (parseFloat(a.amount) || 0), 0))}</h3>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black text-emerald-300 uppercase tracking-widest opacity-60">Total RAB BOS Diajukan</p>
                                            <h3 className="text-2xl font-black italic">{formatRupiah((rabPlans || []).filter(p => p.id.endsWith('-BOS') && p.academicYearId === selectedYearId && p.status !== 'DRAFT').reduce((s, p) => s + Object.values(p.expense || {}).reduce((ps, pl) => ps + (Array.isArray(pl) ? pl.reduce((ss, i) => ss + (parseFloat(i.total) || 0), 0) : 0), 0), 0))}</h3>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black text-emerald-300 uppercase tracking-widest opacity-60">Unit Sudah Mengajukan</p>
                                            <h3 className="text-2xl font-black italic">{(rabPlans || []).filter(p => p.id.endsWith('-BOS') && p.academicYearId === selectedYearId && (p.status === 'PENDING' || p.status === 'APPROVED')).length} Unit</h3>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* BOS Per-Unit Status Table */}
                            <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
                                <div className="flex items-center gap-5 mb-8">
                                    <div className="p-4 bg-emerald-50 rounded-[1.5rem] text-emerald-600 shadow-sm">
                                        <BarChart3 size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-900 tracking-tight leading-none italic uppercase">Monitoring RAB BOS Per Unit</h3>
                                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1.5 italic">Status pengajuan RAB BOS setiap unit penerima</p>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full border-separate border-spacing-y-2">
                                        <thead>
                                            <tr className="text-slate-400/80 text-[10px] font-black uppercase tracking-[0.2em] italic">
                                                <th className="px-6 py-2 text-left">Unit</th>
                                                <th className="px-6 py-2 text-right">Alokasi BOS</th>
                                                <th className="px-6 py-2 text-right">RAB BOS Diajukan</th>
                                                <th className="px-6 py-2 text-right">Status</th>
                                                <th className="px-6 py-2 text-right">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {units.filter(u => !u.isDeleted).map(u => {
                                                const unitAlloc = (bosAllocations || []).filter(a => a.unitId === u.id && a.academicYearId === selectedYearId && !a.isDeleted).reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
                                                const bosPlan = (rabPlans || []).find(p => p.id === `${selectedYearId}-${u.id}-BOS`);
                                                const bosRab = bosPlan ? Object.values(bosPlan.expense || {}).reduce((s, pl) => s + (Array.isArray(pl) ? pl.reduce((ss, i) => ss + (parseFloat(i.total) || 0), 0) : 0), 0) : 0;
                                                const status = bosPlan?.status || 'EMPTY';
                                                if (unitAlloc === 0 && !bosPlan) return null;
                                                return (
                                                    <tr key={u.id} className="bg-slate-50/50 hover:bg-emerald-50/30 rounded-2xl transition-colors">
                                                        <td className="px-6 py-4 font-black text-slate-800 text-sm rounded-l-2xl">{u.name}</td>
                                                        <td className="px-6 py-4 text-right font-bold text-slate-600 text-sm">{formatRupiah(unitAlloc)}</td>
                                                        <td className="px-6 py-4 text-right font-bold text-slate-800 text-sm">{formatRupiah(bosRab)}</td>
                                                        <td className="px-6 py-4 text-right">
                                                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : status === 'PENDING' ? 'bg-indigo-100 text-indigo-700' : status === 'REJECTED' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>
                                                                {status === 'APPROVED' ? 'Disetujui' : status === 'PENDING' ? 'Menunggu Review' : status === 'REJECTED' ? 'Ditolak' : 'Belum Mengajukan'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-right rounded-r-2xl">
                                                            <button onClick={(e) => { e.stopPropagation(); setSelectedUnitId(u.id); setShowDashboard(false); }} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all shadow-sm" title="Buka RAB BOS Unit">
                                                                <ChevronRight size={14} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            }).filter(Boolean)}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    ) : (
                        /* ===== YAYASAN CONSOLIDATION DASHBOARD ===== */
                        <>
                    {/* Hero Card: Yayasan Consolidation */}
                    <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-[2.5rem] p-8 lg:p-12 text-white shadow-2xl relative overflow-hidden ring-8 ring-slate-100">
                        <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
                            <Building2 size={240} />
                        </div>
                        <div className="relative z-10 w-full xl:max-w-7xl">
                            <div className="flex items-center gap-4 mb-6">
                                <span className="px-5 py-2 bg-blue-500 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-blue-500/20">
                                    IKHTISAR YAYASAN
                                </span>
                                <span className="text-slate-400 font-bold text-xs uppercase tracking-widest italic">Tahun Ajaran {academicYears.find(ay => ay.id === selectedYearId)?.name}</span>
                            </div>

                            <h2 className="text-4xl lg:text-5xl font-black tracking-tighter italic leading-none mb-8">
                                Konsolidasi <span className="text-blue-400">Anggaran</span>
                            </h2>

                            <div className={`grid grid-cols-1 md:grid-cols-2 ${(isBosRecipient && fundSourceFilter === 'BOS') ? 'xl:grid-cols-4' : 'xl:grid-cols-3'} gap-6 lg:gap-8`}>
                                <div className="space-y-2 min-w-0">
                                    <p className="text-[10px] font-black text-blue-300 uppercase tracking-widest opacity-60 truncate" title="Total RAP">Total RAP</p>
                                    <h3 className="text-2xl font-black italic truncate" title={formatRupiah(rapData.totalTarget)}>{formatRupiah(rapData.totalTarget)}</h3>
                                </div>
                                {isBosRecipient && fundSourceFilter === 'BOS' && (
                                    <div className="space-y-2 min-w-0">
                                        <p className="text-[10px] font-black text-emerald-300 uppercase tracking-widest opacity-60 truncate" title="Total RAP BOS">Total RAP BOS</p>
                                        <h3 className="text-2xl font-black italic truncate" title={formatRupiah(totalBosAllocated)}>{formatRupiah(totalBosAllocated)}</h3>
                                    </div>
                                )}
                                <div className="space-y-2 min-w-0">
                                    <p className="text-[10px] font-black text-blue-300 uppercase tracking-widest opacity-60 truncate" title="Total RAB">Total RAB</p>
                                    <h3 className="text-2xl font-black italic truncate" title={formatRupiah(fundSourceFilter === 'Yayasan' ? (totalExpense - totalExpenseBos) : totalExpense)}>{formatRupiah(fundSourceFilter === 'Yayasan' ? (totalExpense - totalExpenseBos) : totalExpense)}</h3>
                                </div>
                                <div className="space-y-2 min-w-0">
                                    <p className="text-[10px] font-black text-blue-300 uppercase tracking-widest opacity-60 truncate" title="Sisa Rencana Anggaran">Sisa Rencana Anggaran</p>
                                    <h3 className={`text-2xl font-black italic truncate ${balance < 0 ? 'text-rose-400' : 'text-emerald-400'}`} title={formatRupiah(balance)}>
                                        {formatRupiah(balance)}
                                    </h3>
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    setSelectedUnitId('FOUNDATION');
                                    setShowDashboard(false);
                                }}
                                className="mt-12 group flex items-center gap-3 bg-white text-slate-900 px-8 py-4 rounded-2xl font-black text-sm transition-all hover:scale-105 active:scale-95 shadow-xl"
                            >
                                Buka Rincian Konsolidasi
                                <ChevronRight className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>

                    {/* Unit Status Grid */}
                    <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-5">
                                <div className="p-4 bg-blue-50 rounded-[1.5rem] text-blue-600 shadow-sm">
                                    <BarChart3 size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 tracking-tight leading-none italic uppercase">Monitoring Status Anggaran</h3>
                                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1.5 italic">Ringkasan Unit dan Bidang Pendidikan</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Disetujui</span>
                                <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-rose-500" /> Menunggu Review</span>
                                <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-slate-200" /> Draft/Awal</span>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full border-separate border-spacing-y-2">
                                <thead>
                                    <tr className="text-slate-400/80 text-[10px] font-black uppercase tracking-[0.2em] italic">
                                        <th className="px-6 py-2 text-left">Unit / Bidang</th>
                                        <th className="px-6 py-2 text-right">Target (RAP)</th>
                                        <th className="px-6 py-2 text-right">Target RAB</th>
                                        <th className="px-6 py-2 text-right">Status / Sisa</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[...units.filter(u => !u.isDeleted), ...fields.map(f => ({ ...f, isField: true }))].map(item => {
                                        const planId = `${selectedYearId}-${item.isField ? `FIELD-${item.id}` : item.id}-YAYASAN`;
                                        const plan = rabPlans.find(p => p.id === planId);
                                        const status = plan?.status || 'EMPTY';
                                        const total = Object.values(plan?.expense || {}).reduce((sum, v) => sum + (Array.isArray(v) ? v.reduce((s, i) => s + (parseFloat(i.total) || 0), 0) : 0), 0);

                                        const itemRAP = calculateRAP(state, selectedYearId, item.isField ? null : item.id, item.isField ? item.id : null);

                                        const rowData = {
                                            id: item.isField ? `FIELD-${item.id}` : item.id,
                                            name: item.name,
                                            status: status,
                                            rap: itemRAP.totalTarget,
                                            rab: total,
                                            sisa: itemRAP.totalTarget - total,
                                            breakdown: plan ? Object.entries(plan.expense || {})
                                                .map(([id, detail]) => ({
                                                    id,
                                                    name: (expenseItems.find(e => e.id === id)?.name || id),
                                                    rab: Array.isArray(detail) ? detail.reduce((s, i) => s + (parseFloat(i.total) || 0), 0) : (detail.total || 0),
                                                    rap: itemRAP.itemAllocations[id] || 0,
                                                    sisa: (itemRAP.itemAllocations[id] || 0) - (Array.isArray(detail) ? detail.reduce((s, i) => s + (parseFloat(i.total) || 0), 0) : (detail.total || 0))
                                                }))
                                                .sort((a, b) => b.rab - a.rab)
                                                .slice(0, 5) : []
                                        };

                                        return (
                                            <BudgetRow
                                                key={rowData.id}
                                                data={rowData}
                                                isExpanded={!!expandedDashboardPlans[rowData.id]}
                                                onToggle={() => toggleDashboardPlan(rowData.id)}
                                                formatCurrency={formatCurrency}
                                                expandedDetailItems={expandedDetailItems}
                                                onToggleDetailItem={toggleDetailItem}
                                                getUnitName={getUnitName}
                                                isField={!!item.isField}
                                                actions={
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedUnitId(rowData.id);
                                                            setShowDashboard(false);
                                                        }}
                                                        className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                                        title="INPUT ANGGARAN"
                                                    >
                                                        <ChevronRight size={14} />
                                                    </button>
                                                }
                                            />
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                        </>
                    )}
                </div>
            ) : (

                /* DETAIL VIEW (HEADER + TABLE/REVIEW) */
                <div className="flex flex-col gap-6 min-h-[70vh]">
                    {/* Header Info */}
                    <div className="w-full flex flex-col xl:flex-row gap-6">
                        {/* Selected Entity Card */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-6 xl:w-1/3">
                            <div className="p-4 bg-blue-50 rounded-2xl">
                                <Building2 size={32} className="text-blue-600" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-900 tracking-tight leading-tight">
                                    {isConsolidation ? 'Yayasan (Konsolidasi)' : (
                                        selectedUnitId.startsWith('FIELD-')
                                            ? (fields.find(f => f.id === selectedUnitId.replace('FIELD-', ''))?.name)
                                            : (units.find(u => u.id === selectedUnitId)?.name || 'Pilih Unit')
                                    )}
                                </h3>
                                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1 italic">
                                    {isConsolidation ? 'KONSOLIDASI DATA STRATEGIS' : (selectedUnitId.startsWith('FIELD-') ? 'BIDANG STRUKTURAL' : 'UNIT PENDIDIKAN')}
                                </p>
                            </div>
                        </div>

                        {/* Quick Stats Cards in Header */}
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-6 rounded-[2rem] text-white shadow-xl shadow-emerald-100 relative overflow-hidden group flex flex-col justify-center">
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-2">
                                    {fundSourceFilter === 'BOS' ? 'RAP BOS' : 'RAP'}
                                </p>
                                <h3 className="text-2xl font-black italic">
                                    {formatRupiah(fundSourceFilter === 'BOS' ? totalBosAllocated : rapData.totalTarget)}
                                </h3>
                            </div>
                            {isBosRecipient && fundSourceFilter === 'all' && (
                                <div className="bg-gradient-to-br from-indigo-500 to-blue-600 p-6 rounded-[2rem] text-white shadow-xl shadow-indigo-100 relative overflow-hidden group flex flex-col justify-center">
                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-2">RAP BOS</p>
                                    <h3 className="text-2xl font-black italic">{formatRupiah(totalBosAllocated)}</h3>
                                </div>
                            )}
                            <div className="bg-gradient-to-br from-rose-500 to-pink-600 p-6 rounded-[2rem] text-white shadow-xl shadow-rose-100 relative overflow-hidden group flex flex-col justify-center">
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-2">Rencana RAB (Total)</p>
                                <h3 className="text-2xl font-black italic">{formatRupiah(fundSourceFilter === 'BOS' ? totalExpenseBos : (fundSourceFilter === 'Yayasan' ? (totalExpense - totalExpenseBos) : totalExpense))}</h3>
                            </div>
                        </div>
                    </div>

                    {/* Sarpras Pending Asset Notification Banner */}
                    {isSarprasAdmin && pendingSarprasCount > 0 && activeTab !== 'SARPRAS_ASSETS' && (
                        <div className="w-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 rounded-[2rem] p-6 text-white shadow-xl shadow-amber-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-amber-400/40 animate-in fade-in slide-in-from-top-4 duration-300">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md shadow-inner shrink-0">
                                    <Package size={28} className="text-white animate-bounce" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="bg-white/25 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider text-amber-50 border border-white/20">
                                            Perhatian Sarpras
                                        </span>
                                        <span className="text-xs font-bold text-amber-100">TA {activeYearName || '2026-2027'}</span>
                                    </div>
                                    <h4 className="text-base font-black tracking-tight text-white mt-1">
                                        Ada {pendingSarprasCount} Pengajuan Aset Baru Menunggu Verifikasi Sarpras!
                                    </h4>
                                    <p className="text-xs text-amber-100/90 font-medium">
                                        Unit/bidang telah mengajukan rincian pengadaan aset. Silakan lakukan verifikasi dan persetujuan agar perencanaan aset terdata rapi.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setActiveTab('SARPRAS_ASSETS')}
                                className="px-6 py-3.5 bg-white text-amber-800 font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg hover:bg-amber-50 hover:shadow-xl transition-all shrink-0 flex items-center gap-2 active:scale-95"
                            >
                                <Package size={16} className="text-amber-600" />
                                Buka Verifikasi Aset ({pendingSarprasCount})
                            </button>
                        </div>
                    )}

                    {/* Content Component */}
                    <div className="w-full flex-1 bg-white border border-slate-100 rounded-[2rem] shadow-sm overflow-hidden flex flex-col">
                        {/* Tab Switcher */}
                        <div className="bg-slate-50/50 flex border-b border-slate-100 overflow-x-auto">
                            <button
                                onClick={() => setActiveTab('EXPENSE')}
                                className={`px-10 py-6 font-black text-xs uppercase tracking-[0.2em] transition-all relative ${activeTab === 'EXPENSE' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                {activeTab === 'EXPENSE' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600" />}
                                <div className="flex items-center gap-2">
                                    <ArrowUpCircle size={16} />
                                    Input Anggaran
                                </div>
                            </button>
                            {isSuperAdmin && (
                                <button
                                    onClick={() => setActiveTab('REVIEW')}
                                    className={`px-10 py-6 font-black text-xs uppercase tracking-[0.2em] transition-all relative ${activeTab === 'REVIEW' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    {activeTab === 'REVIEW' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600" />}
                                    <div className="flex items-center gap-2">
                                        <Wallet size={16} />
                                        Review Pengajuan
                                    </div>
                                </button>
                            )}
                            {isSarprasAdmin && (
                                <button
                                    onClick={() => setActiveTab('SARPRAS_ASSETS')}
                                    className={`px-8 py-6 font-black text-xs uppercase tracking-[0.2em] transition-all relative ${activeTab === 'SARPRAS_ASSETS' ? 'text-amber-600' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    {activeTab === 'SARPRAS_ASSETS' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-600" />}
                                    <div className="flex items-center gap-2">
                                        <Package size={16} />
                                        <span>Verifikasi Aset Unit</span>
                                        {pendingSarprasCount > 0 && (
                                            <span className="bg-amber-500 text-white text-[10px] px-2.5 py-0.5 rounded-full font-black animate-pulse shadow-sm shadow-amber-500/50">
                                                {pendingSarprasCount}
                                            </span>
                                        )}
                                    </div>
                                </button>
                            )}
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 p-8 lg:p-12">
                            {activeTab === 'SARPRAS_ASSETS' ? (
                                renderSarprasAssetVerificationView()
                            ) : activeTab === 'REVIEW' ? (
                                renderReviewView()
                            ) : (
                                renderBudgetTable(activeTab === 'INCOME' ? 'income' : 'expense', activeTab === 'INCOME' ? 'Sumber Pendapatan' : 'Mata Anggaran (Biaya)')
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Float Info Box */}
            {message && (
                <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-8 py-5 rounded-[2rem] shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-10 duration-500 z-[2000] ${message.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                    }`}>
                    <div className="p-2 bg-white/20 rounded-xl">
                        {message.type === 'success' ? <ShieldCheck size={20} /> : <AlertCircle size={20} />}
                    </div>
                    <div>
                        <p className="font-black text-sm tracking-tight">{message.text}</p>
                    </div>
                    <button onClick={() => setMessage(null)} className="ml-4 p-1 hover:bg-white/10 rounded-lg transition-colors">
                        <ChevronRight size={18} />
                    </button>
                </div>
            )}

            {/* Detail Modal */}
            {editingItem && (
                <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setEditingItem(null)} />
                    <div className="bg-white rounded-[3.5rem] w-full max-w-[95vw] relative z-10 shadow-2xl overflow-hidden animate-in zoom-in duration-300 flex flex-col max-h-[95vh] ring-12 ring-white/10">
                        {(() => {
                            const type = activeTab === 'INCOME' ? 'income' : 'expense';
                            const itemId = editingItem.itemId || editingItem.id;
                            const plans = activePlan[type][itemId] || [];

                            // If multiple plans exist for one item, merge them into one "workspace" item
                            let item;
                            if (plans.length > 1) {
                                // Merge multiple plans into one virtual plan
                                const first = plans[0];
                                const allComponents = plans.flatMap(p => p.components || []);
                                const aggrMonths = {};
                                plans.forEach(p => {
                                    Object.entries(p.months || {}).forEach(([mId, mData]) => {
                                        if (!mData.m) return;
                                        if (!aggrMonths[mId]) aggrMonths[mId] = { m: true, jumlah: 0 };
                                        aggrMonths[mId].jumlah += (parseFloat(mData.jumlah) || 0);
                                    });
                                });

                                item = {
                                    ...first,
                                    id: first.id, // Keep the first ID
                                    total: plans.reduce((s, p) => s + (p.total || 0), 0),
                                    bosAmount: plans.reduce((s, p) => s + (p.bosAmount || 0), 0),
                                    useBos: plans.some(p => p.useBos),
                                    components: allComponents,
                                    months: aggrMonths,
                                    description: allComponents.length > 0 ? allComponents[0].label : ''
                                };
                            } else {
                                item = plans.find(p => p.id === editingItem.planId) || plans.find(p => p.id === editingItem.id) || plans[0] || {
                                    id: editingItem.planId || editingItem.id, total: 0, bosAmount: 0, useBos: false, components: [], months: {}, semester: editingItem.semester || '1'
                                };
                            }

                            return (
                                <>
                                    {/* Modal Header */}
                                    <div className="p-8 lg:p-10 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                                        <div>
                                            <h2 className="text-2xl font-black text-slate-900 tracking-tight italic uppercase">{editingItem.name}</h2>
                                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-1">
                                                {editingItem.isNewPlan ? 'RENCANA BARU • ' : `ID: ${item.id} • `}
                                                TA {academicYears.find(ay => ay.id === selectedYearId)?.name}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            {(() => {
                                                const detail = item;
                                                const allocated = rapData.itemAllocations[itemId] || 0;
                                                const yayasanSpent = Math.max(0, detail.total - (detail.useBos ? (parseFloat(detail.bosAmount) || 0) : 0));
                                                const isOver = yayasanSpent > (allocated + 100);

                                                if (isOver) {
                                                    return (
                                                        <div className="px-6 py-3 bg-rose-50 border-2 border-rose-200 rounded-2xl flex items-center gap-3 text-rose-600 font-black text-xs animate-bounce">
                                                            <AlertCircle size={18} />
                                                            MELEBIHI LIMIT!
                                                        </div>
                                                    );
                                                }
                                                return (
                                                    <div className="px-6 py-3 bg-blue-50 border border-blue-100 rounded-2xl flex flex-col items-end">
                                                        <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Sisa Budget Yayasan</span>
                                                        <span className="text-sm font-black text-blue-700">{formatRupiah(allocated - yayasanSpent)}</span>
                                                    </div>
                                                );
                                            })()}
                                            <button
                                                onClick={() => setEditingItem(null)}
                                                className="p-4 hover:bg-slate-200 rounded-2xl text-slate-400 transition-colors"
                                            >
                                                <XCircle size={24} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-8 lg:p-10 space-y-8 bg-slate-50/20">
                                        {message && (
                                            <div className={`p-6 rounded-[2rem] flex items-start gap-4 animate-in slide-in-from-top-4 duration-300 ${
                                                message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                                            }`}>
                                                <div className={`p-2 rounded-xl shrink-0 ${message.type === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                    {message.type === 'success' ? <ShieldCheck size={20} /> : <AlertCircle size={20} />}
                                                </div>
                                                <div className="flex-1 space-y-1.5 min-w-0">
                                                    <h5 className="font-black text-sm tracking-tight">{message.type === 'success' ? 'Berhasil' : 'Gagal Mengimpor'}</h5>
                                                    <p className="text-xs font-semibold leading-relaxed whitespace-pre-line">{message.text}</p>
                                                </div>
                                                <button onClick={() => setMessage(null)} className="p-1.5 rounded-lg transition-colors hover:bg-black/5 text-slate-400 hover:text-slate-600">
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        )}
                                        {/* Summary Table */}
                                        <div className="p-8 bg-slate-50/50 rounded-[2.5rem] border border-slate-100 space-y-6">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-1.5 h-6 bg-blue-600 rounded-full" />
                                                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest italic">Ringkasan Daftar Rincian</h4>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={() => handleDownloadLocalTemplate(editingItem.name)}
                                                        className="px-4 py-2 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-2"
                                                    >
                                                        <Download size={14} />
                                                        Template
                                                    </button>
                                                    <div className="relative">
                                                        <input
                                                            type="file"
                                                            accept=".xlsx, .xls"
                                                            onChange={(e) => handleLocalFileUpload(e, itemId)}
                                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                        />
                                                        <button
                                                            className="px-4 py-2 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-2"
                                                        >
                                                            <CloudUpload size={14} />
                                                            Import Excel
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-6">
                                                {(() => {
                                                    const comps = item?.components || [];
                                                    const draftIndexes = comps.map((c, idx) => (c.status === 'DRAFT' || c.status === 'REJECTED' || !c.status) ? idx : -1).filter(i => i !== -1);
                                                    
                                                    // Map components with their original index to avoid indexing bugs when editing/deleting/etc.
                                                    const compsWithOriginalIndex = comps.map((c, originalIdx) => ({
                                                        ...c,
                                                        originalIdx
                                                    }));

                                                    // Apply search & status filter
                                                    const filteredComps = compsWithOriginalIndex.filter(comp => {
                                                        // 1. Search filter
                                                        if (compSearchQuery) {
                                                            const query = compSearchQuery.toLowerCase();
                                                            const matchesLabel = (comp.label || '').toLowerCase().includes(query);
                                                            const matchesProgram = (allPrograms.find(p => p.id === comp.programId)?.name || 'Tanpa Program').toLowerCase().includes(query);
                                                            const matchesSatuan = (comp.satuan || '').toLowerCase().includes(query);
                                                            if (!matchesLabel && !matchesProgram && !matchesSatuan) return false;
                                                        }

                                                        // 2. Status filter
                                                        if (compStatusFilter && compStatusFilter !== 'ALL') {
                                                            const isDraft = comp.status === 'DRAFT' || comp.status === 'REJECTED' || !comp.status;
                                                            const isApproved = comp.status === 'APPROVED';
                                                            const isPending = comp.status === 'PENDING';

                                                            if (compStatusFilter === 'DRAFT' && !isDraft) return false;
                                                            if (compStatusFilter === 'APPROVED' && !isApproved) return false;
                                                            if (compStatusFilter === 'PENDING' && !isPending) return false;
                                                        }

                                                        return true;
                                                    });

                                                    return (
                                                        <>
                                                            {draftIndexes.length > 0 && (() => {
                                                                const pendingSarprasDrafts = draftIndexes.filter(idx => {
                                                                    const c = comps[idx];
                                                                    return c && c.isAsset && isSarprasRequiredYear && c.sarprasStatus !== 'APPROVED';
                                                                });
                                                                const hasUnapprovedAssets = pendingSarprasDrafts.length > 0;

                                                                return (
                                                                    <div className={`card p-6 border shadow-sm rounded-3xl ${hasUnapprovedAssets ? 'bg-amber-50/80 border-amber-200' : 'bg-blue-50/70 border-blue-200'}`}>
                                                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                                            <div>
                                                                                <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                                                                                    <Package size={18} className={hasUnapprovedAssets ? 'text-amber-600' : 'text-blue-600'} /> Rincian Belum Diajukan (Draft)
                                                                                </h3>
                                                                                <p className="text-xs text-slate-600 font-medium mt-1">
                                                                                    Ada {draftIndexes.length} rincian yang belum dikirim ke Yayasan.
                                                                                    {hasUnapprovedAssets && (
                                                                                        <span className="block mt-1 text-amber-700 font-bold">
                                                                                            ⚠️ Perhatian: {pendingSarprasDrafts.length} rincian belanja aset masih menunggu verifikasi/ACC dari Bidang Sarpras sebelum bisa diajukan ke Yayasan.
                                                                                        </span>
                                                                                    )}
                                                                                </p>
                                                                            </div>
                                                                            <button 
                                                                                onClick={() => handleAjukanDraftsInModal(draftIndexes)}
                                                                                className={`px-5 py-3 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-md transition-colors shrink-0 flex items-center gap-2 ${hasUnapprovedAssets ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                                                                            >
                                                                                <Send size={16} /> Ajukan RAB ke Yayasan
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })()}

                                                            {/* Search and Filters Bar */}
                                                            {comps.length > 0 && (
                                                                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
                                                                    <div className="relative w-full sm:max-w-md">
                                                                        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                                                        <input
                                                                            type="text"
                                                                            placeholder="Cari rincian belanja (nama, program, dll)..."
                                                                            value={compSearchQuery}
                                                                            onChange={(e) => setCompSearchQuery(e.target.value)}
                                                                            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200/60 rounded-xl text-xs font-bold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                                                        />
                                                                        {compSearchQuery && (
                                                                            <button 
                                                                                onClick={() => setCompSearchQuery('')}
                                                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                                                                            >
                                                                                <X size={14} />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0 justify-end">
                                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Filter Status:</span>
                                                                        <select
                                                                            value={compStatusFilter || 'ALL'}
                                                                            onChange={(e) => setCompStatusFilter(e.target.value)}
                                                                            className="px-3.5 py-2.5 bg-slate-50 border border-slate-200/60 rounded-xl text-[10px] font-black uppercase tracking-wider text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                                                                        >
                                                                            <option value="ALL">Semua Status</option>
                                                                            <option value="DRAFT">Draft</option>
                                                                            <option value="PENDING">Menunggu (Pending)</option>
                                                                            <option value="APPROVED">Disetujui</option>
                                                                        </select>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {comps.length === 0 ? (
                                                                <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 border-dashed">
                                                                    <Package size={40} className="mx-auto text-slate-300 mb-4 opacity-30" />
                                                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest opacity-50">Belum ada rincian belanja</p>
                                                                    <button
                                                                        onClick={() => { setEntryForm({ label: '', volume: 0, satuan: '', kali: 1, harga: 0, programId: '', semester: '1', months: {}, useBos: fundSourceFilter === 'BOS', isAsset: false, assetCategory: '', assetRoom: '', assetProcurementType: 'BARU', sarprasStatus: null, sarprasNotes: '' }); setEditingCompIdx(null); setIsReadOnlyComp(false); setShowCompModal(true); }}
                                                                        className="mt-6 px-6 py-3 bg-blue-50 text-blue-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all mx-auto inline-flex items-center gap-2"
                                                                    >
                                                                        <Plus size={16} strokeWidth={3} /> Tambah Rincian Pertama
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <div className="space-y-4">
                                                                    {filteredComps.length === 0 ? (
                                                                        <div className="p-12 text-center bg-white rounded-[2rem] border border-slate-200 border-dashed">
                                                                            <Search size={32} className="mx-auto text-slate-300 mb-3 opacity-40" />
                                                                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest opacity-60">Tidak ditemukan rincian yang cocok</p>
                                                                            <button
                                                                                onClick={() => { setCompSearchQuery(''); setCompStatusFilter('ALL'); }}
                                                                                className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all"
                                                                            >
                                                                                Reset Pencarian
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        filteredComps.map((comp) => {
                                                                            const idx = comp.originalIdx;
                                                                            const isDraft = comp.status === 'DRAFT' || comp.status === 'REJECTED' || !comp.status;
                                                                            const isApproved = comp.status === 'APPROVED';
                                                                            const isPending = comp.status === 'PENDING';
                                                                            const monthlyTotal = Object.values(comp.months || {}).reduce((sum, m) => sum + (parseFloat(m.jumlah) || 0), 0);
                                                                            const isUnbalanced = Math.abs((comp.total || 0) - monthlyTotal) > 1.1;
                                                                            return (
                                                                                <div key={idx} className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                                                                                    <div className="flex-1">
                                                                                        <h4 className="font-black text-slate-800 text-base mb-2">{comp.label}</h4>
                                                                                        <div className="flex flex-wrap items-center gap-3">
                                                                                            {comp.isAsset && (
                                                                                                <>
                                                                                                    <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-xs">
                                                                                                        <Package size={11} className="text-indigo-600" /> {comp.assetName ? `${comp.assetName} (${comp.assetCategory || 'Aset'})` : (comp.assetCategory ? `Aset: ${comp.assetCategory}` : 'Aset Sarpras')}
                                                                                                    </span>
                                                                                                    {comp.sarprasStatus === 'REJECTED' ? (
                                                                                                        <span className="text-[9px] font-black text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md flex items-center gap-1" title={comp.sarprasNotes || ''}>
                                                                                                            <XCircle size={11} /> Ditolak Sarpras
                                                                                                        </span>
                                                                                                    ) : comp.sarprasStatus !== 'APPROVED' ? (
                                                                                                        <span className="text-[9px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                                                                                                            ⏳ Menunggu Sarpras
                                                                                                        </span>
                                                                                                    ) : isApproved ? (
                                                                                                        <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                                                                                                            <CheckCircle2 size={11} /> Disetujui Yayasan
                                                                                                        </span>
                                                                                                    ) : isPending ? (
                                                                                                        <span className="text-[9px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                                                                                                            ⏳ Menunggu Yayasan
                                                                                                        </span>
                                                                                                    ) : (
                                                                                                        <span className="text-[9px] font-black text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                                                                                                            <CheckCircle2 size={11} /> Lolos Sarpras (Draft)
                                                                                                        </span>
                                                                                                    )}
                                                                                                    {isSarprasAdmin && (
                                                                                                        <div className="flex items-center gap-1.5 ml-1">
                                                                                                            {comp.sarprasStatus !== 'APPROVED' && (
                                                                                                                <button
                                                                                                                    type="button"
                                                                                                                    onClick={(e) => {
                                                                                                                        e.stopPropagation();
                                                                                                                        handleSarprasApproveComponent(itemId, item.id, idx, 'APPROVED');
                                                                                                                    }}
                                                                                                                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm transition-all"
                                                                                                                    title="ACC Spesifikasi Aset oleh Sarpras"
                                                                                                                >
                                                                                                                    <CheckCircle2 size={10} /> ACC Sarpras
                                                                                                                </button>
                                                                                                            )}
                                                                                                            {comp.sarprasStatus !== 'REJECTED' && (
                                                                                                                <button
                                                                                                                    type="button"
                                                                                                                    onClick={(e) => {
                                                                                                                        e.stopPropagation();
                                                                                                                        const reason = window.prompt('Masukkan catatan penolakan / revisi Sarpras:', comp.sarprasNotes || '');
                                                                                                                        if (reason !== null) {
                                                                                                                            handleSarprasApproveComponent(itemId, item.id, idx, 'REJECTED', reason);
                                                                                                                        }
                                                                                                                    }}
                                                                                                                    className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all"
                                                                                                                    title="Tolak / Beri Catatan Revisi Sarpras"
                                                                                                                >
                                                                                                                    <XCircle size={10} /> Tolak Sarpras
                                                                                                                </button>
                                                                                                            )}
                                                                                                        </div>
                                                                                                    )}
                                                                                                    <span className="w-1 h-1 rounded-full bg-slate-200" />
                                                                                                </>
                                                                                            )}
                                                                                            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md line-clamp-1 max-w-[200px]">{allPrograms.find(p => p.id === comp.programId)?.name || 'Tanpa Program'}</span>
                                                                                            <span className="w-1 h-1 rounded-full bg-slate-200" />
                                                                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Vol: {comp.volume} {comp.satuan} &times; {comp.kali}</span>
                                                                                            <span className="w-1 h-1 rounded-full bg-slate-200" />
                                                                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Harga: {formatRupiah(comp.harga)}</span>
                                                                                        </div>
                                                                                        {isUnbalanced && (
                                                                                            <div className="mt-3 flex items-center gap-2 bg-rose-50 border border-rose-100 text-rose-700 px-4 py-2.5 rounded-2xl w-fit">
                                                                                                <AlertCircle size={14} className="text-rose-500 flex-shrink-0" />
                                                                                                <span className="text-[10px] font-black uppercase tracking-wider">
                                                                                                    Alokasi Bulanan Belum Seimbang (Selisih: {formatRupiah(Math.abs((comp.total || 0) - monthlyTotal))})
                                                                                                </span>
                                                                                            </div>
                                                                                        )}
                                                                                        {(() => {
                                                                                            const selectedMonths = monthsOptions.filter(m => comp.months?.[m.id]?.m === true || comp.months?.[m.id]?.jumlah > 0);
                                                                                            if (selectedMonths.length === 12) {
                                                                                                return <div className="mt-3 flex flex-wrap gap-2"><span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded text-[9px] font-black uppercase tracking-widest border border-emerald-100">Setiap Bulan (12 Bulan Penuh)</span></div>;
                                                                                            } else if (selectedMonths.length > 0) {
                                                                                                return (
                                                                                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                                                                                        {selectedMonths.map(m => (
                                                                                                            <span key={m.id} className="px-2 py-1 bg-slate-50 text-slate-500 rounded text-[9px] font-black uppercase tracking-widest border border-slate-200">
                                                                                                                {m.label || m.name || m.id}
                                                                                                            </span>
                                                                                                        ))}
                                                                                                    </div>
                                                                                                );
                                                                                            }
                                                                                            return null;
                                                                                        })()}
                                                                                    </div>
                                                                                    <div className="flex items-center gap-6 mt-6 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 border-slate-100">
                                                                                        <div className="text-right">
                                                                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic mb-1">Subtotal</p>
                                                                                            <span className="font-black text-slate-900 text-lg">{formatRupiah(comp.total)}</span>
                                                                                        </div>
                                                                                        <div className="flex items-center gap-2 border-l border-slate-100 pl-6 h-full min-h-[40px]">
                                                                                            {(isPending || isApproved) && !isSuperAdmin ? (
                                                                                                <div className="flex items-center gap-2">
                                                                                                    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${isApproved ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                                                                                        <Lock size={14} /> {isApproved ? 'Disetujui Yayasan' : 'Menunggu Yayasan'}
                                                                                                    </div>
                                                                                                    <button
                                                                                                        onClick={() => {
                                                                                                            setEntryForm({ programId: '', semester: '1', months: {}, useBos: fundSourceFilter === 'BOS', isAsset: false, assetCategory: '', assetRoom: '', assetProcurementType: 'BARU', sarprasStatus: null, sarprasNotes: '', ...comp, assetName: comp.assetName || comp.namaAset || comp.label || '' });
                                                                                                            setEditingCompIdx(idx);
                                                                                                            setIsReadOnlyComp(true);
                                                                                                            setShowCompModal(true);
                                                                                                        }}
                                                                                                        className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition-colors shadow-sm"
                                                                                                        title="Lihat Rincian Anggaran"
                                                                                                    >
                                                                                                        <Eye size={15} />
                                                                                                    </button>
                                                                                                    {isPending && !isSuperAdmin && activePlan.status !== 'APPROVED' && (
                                                                                                        <button
                                                                                                            onClick={() => handleBatalkanRincian(idx)}
                                                                                                            className="p-2 bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl transition-colors shadow-sm"
                                                                                                            title="Batalkan Pengajuan Rincian Ini"
                                                                                                        >
                                                                                                            <XCircle size={15} />
                                                                                                        </button>
                                                                                                    )}
                                                                                                </div>
                                                                                            ) : (
                                                                                                <>
                                                                                                    <button onClick={() => { setEntryForm({ programId: '', semester: '1', months: {}, useBos: fundSourceFilter === 'BOS', isAsset: false, assetCategory: '', assetRoom: '', assetProcurementType: 'BARU', sarprasStatus: null, sarprasNotes: '', ...comp, assetName: comp.assetName || comp.namaAset || comp.label || '' }); setEditingCompIdx(idx); setIsReadOnlyComp(false); setShowCompModal(true); }} className="p-2 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors" title="Edit"><Pencil size={18} /></button>
                                                                                                    <button onClick={() => handleRemoveComponent(itemId, item.id, idx)} className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors" title="Hapus"><Trash2 size={18} /></button>
                                                                                                    {isDraft && (
                                                                                                        <button 
                                                                                                            onClick={() => handleAjukanDraftsInModal([idx])} 
                                                                                                            className={`p-2 rounded-xl transition-colors shadow-sm ml-1 ${comp.isAsset && isSarprasRequiredYear && comp.sarprasStatus !== 'APPROVED' ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' : 'bg-amber-500 text-white hover:bg-amber-600'}`} 
                                                                                                            title={comp.isAsset && isSarprasRequiredYear && comp.sarprasStatus !== 'APPROVED' ? 'Menunggu ACC Sarpras sebelum dapat diajukan ke Yayasan' : 'Ajukan Rincian Ini'}
                                                                                                        >
                                                                                                            <Send size={16} />
                                                                                                        </button>
                                                                                                    )}
                                                                                                    {isSuperAdmin && (isApproved || isPending) && (
                                                                                                        <button
                                                                                                            onClick={() => handleSuperAdminCancelComponent(idx)}
                                                                                                            className="p-2 bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl transition-colors shadow-sm active:scale-95 ml-1"
                                                                                                            title="Batalkan Persetujuan/Pengajuan Rincian Ini"
                                                                                                        >
                                                                                                            <XCircle size={15} />
                                                                                                        </button>
                                                                                                    )}
                                                                                                </>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })
                                                                    )}
                                                                    
                                                                    <div className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-slate-50/80 rounded-[2rem] border border-slate-200 border-dashed mt-6 gap-6 md:gap-0">
                                                                        <div className="flex items-center gap-5">
                                                                            <button
                                                                                onClick={() => { setEntryForm({ label: '', volume: 0, satuan: '', kali: 1, harga: 0, programId: '', semester: '1', months: {}, useBos: fundSourceFilter === 'BOS', isAsset: false, assetName: '', assetCategory: '', assetRoom: '', assetProcurementType: 'BARU', sarprasStatus: null, sarprasNotes: '' }); setEditingCompIdx(null); setIsReadOnlyComp(false); setShowCompModal(true); }}
                                                                                className="w-14 h-14 flex items-center justify-center bg-blue-600 text-white rounded-[1.25rem] shadow-lg shadow-blue-200 hover:scale-105 transition-all"
                                                                            >
                                                                                <Plus size={24} strokeWidth={3} />
                                                                            </button>
                                                                            <div>
                                                                                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Akumulasi Rincian</p>
                                                                                <p className="font-black text-2xl text-slate-900 tracking-tight">{formatRupiah(item.total)}</p>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Modal Footer */}
                                    <div className="p-10 border-t border-slate-100 bg-white flex items-center justify-between">
                                        <button onClick={() => setEditingItem(null)} className="px-10 py-5 bg-slate-100 text-slate-500 rounded-[2rem] font-black text-xs uppercase hover:bg-slate-200 transition-all">TUTUP</button>
                                        {(() => {
                                            const canSave = item.total > 0;
                                            return (
                                                <button
                                                    disabled={!canSave}
                                                    onClick={async () => {
                                                        const mId = editingItem.itemId || editingItem.id;

                                                        // Always collapse multiple plans into exactly ONE plan during save
                                                        const updatedPlans = [item];

                                                        const nextPlan = { ...currentPlan, expense: { ...currentPlan.expense, [mId]: updatedPlans } };

                                                        // Update Local UI State
                                                        setCurrentPlan(nextPlan);
                                                        setEditingItem(null);

                                                        // Auto-save to DB immediately
                                                        const planId = currentPlanId;
                                                        const dbPlan = {
                                                            id: planId,
                                                            academicYearId: selectedYearId,
                                                            unitId: selectedUnitId.startsWith('FIELD-') ? null : (selectedUnitId === 'FOUNDATION' ? 'FOUNDATION' : selectedUnitId),
                                                            fieldId: selectedUnitId.startsWith('FIELD-') ? selectedUnitId.replace('FIELD-', '') : null,
                                                            income: nextPlan.income,
                                                            expense: nextPlan.expense,
                                                            status: nextPlan.status,
                                                            rejectionReason: nextPlan.rejectionReason,
                                                            updatedAt: new Date().toISOString(),
                                                            updatedBy: currentUser?.username
                                                        };

                                                        await persistPlanToServer(dbPlan);
                                                    }}
                                                    className={`px-12 py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-2xl transition-all active:scale-95 flex items-center gap-3 ${canSave ? 'bg-blue-600 text-white hover:bg-slate-900 shadow-blue-200' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                                                >
                                                    <Save size={18} />
                                                    SIMPAN RENCANA BELANJA
                                                </button>
                                            );
                                        })()}
                                    </div>

                                    {/* Sub-Modal (Rincian Entry) */}
                                    {showCompModal && (
                                         <div className="fixed inset-0 z-[5000] flex items-center justify-center p-6 animate-in fade-in duration-200">
                                            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowCompModal(false)} />
                                            <div className="bg-white rounded-[3rem] w-full max-w-5xl relative z-10 shadow-2xl overflow-hidden animate-in zoom-in slide-in-from-bottom-8 duration-300 flex flex-col ring-8 ring-white/10 max-h-[85vh]">
                                                <div className="bg-slate-900 p-8 text-white flex items-center justify-between">
                                                    <div>
                                                        <h3 className="text-xl font-black italic uppercase tracking-tight">{isReadOnlyComp ? 'Lihat Rincian' : 'Detail Rincian'}</h3>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                                            {isReadOnlyComp ? 'Rincian Telah Disetujui/Mengantre' : (editingCompIdx !== null ? 'Perbarui Rincian' : 'Tambah Rincian Baru')}
                                                        </p>
                                                    </div>
                                                    <button onClick={() => setShowCompModal(false)} className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all"><X size={20} /></button>
                                                </div>

                                                <div className="flex-1 overflow-y-auto p-8 lg:p-10 space-y-8">
                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                                        {/* Left Column: Basic Info */}
                                                        <div className="space-y-6">
                                                            <div className="space-y-2">
                                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic ml-1">Keterangan Barang</label>
                                                                <input autoFocus={!isReadOnlyComp} readOnly={isReadOnlyComp} type="text" className={`w-full bg-slate-50 border-2 border-slate-100 p-4 font-black text-slate-800 text-sm rounded-2xl outline-none focus:border-blue-500 transition-all shadow-inner ${isReadOnlyComp ? 'opacity-70 pointer-events-none' : ''}`} placeholder="Peralatan Kantor..." value={entryForm.label} onChange={e => setEntryForm({ ...entryForm, label: e.target.value })} />
                                                            </div>
                                                            <div className="grid grid-cols-3 gap-4">
                                                                {['volume', 'satuan', 'kali'].map(field => (
                                                                    <div key={field} className="space-y-2">
                                                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic ml-1 capitalize">{field}</label>
                                                                        <input type="text" readOnly={isReadOnlyComp} className={`w-full bg-slate-50 border-2 border-slate-100 p-4 font-black text-slate-700 text-sm rounded-2xl outline-none focus:border-blue-500 text-center ${isReadOnlyComp ? 'opacity-70 pointer-events-none' : ''}`} value={entryForm[field]} onChange={e => setEntryForm({ ...entryForm, [field]: field === 'satuan' ? e.target.value : e.target.value.replace(/\D/g, '') })} />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-6">
                                                                <div className="space-y-2">
                                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic ml-1">Harga Satuan (Rp)</label>
                                                                    <div className="relative">
                                                                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xs italic">Rp</span>
                                                                        <input type="text" readOnly={isReadOnlyComp} className={`w-full bg-slate-50 border-2 border-slate-100 p-4 pl-12 font-black text-slate-900 text-lg rounded-2xl outline-none focus:border-blue-500 transition-all shadow-inner ${isReadOnlyComp ? 'opacity-70 pointer-events-none' : ''}`} value={Number(entryForm.harga || 0).toLocaleString('id-ID')} onChange={e => setEntryForm({ ...entryForm, harga: parseFloat(e.target.value.replace(/\D/g, '') || 0) })} />
                                                                    </div>
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic ml-1">Semester</label>
                                                                    <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                                                                        {['1', '2'].map(s => (
                                                                            <button key={s} disabled={isReadOnlyComp} onClick={() => setEntryForm({ ...entryForm, semester: s })} className={`flex-1 py-3 rounded-xl font-black text-[10px] transition-all ${entryForm.semester === s ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'} ${isReadOnlyComp ? 'cursor-default' : ''}`}>SMT {s}</button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="space-y-2">
                                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic ml-1">Program Belanja</label>
                                                                <div className="relative" data-program-dropdown>
                                                                    <div
                                                                        className={`w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-slate-700 text-xs outline-none flex items-center justify-between ${isReadOnlyComp ? 'opacity-70 cursor-default' : 'cursor-pointer'}`}
                                                                        onClick={() => !isReadOnlyComp && setShowProgramDropdown(v => !v)}
                                                                    >
                                                                        <span className={entryForm.programId ? 'text-slate-700' : 'text-slate-400'}>
                                                                            {entryForm.programId
                                                                                ? expensePrograms?.find(p => p.id === entryForm.programId)?.name || 'Pilih Program...'
                                                                                : 'Pilih Program...'}
                                                                        </span>
                                                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform text-slate-400 ${showProgramDropdown ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"></polyline></svg>
                                                                    </div>
                                                                    {!isReadOnlyComp && showProgramDropdown && (
                                                                        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border-2 border-slate-100 rounded-2xl shadow-2xl overflow-hidden">
                                                                            <div className="p-2 border-b border-slate-100">
                                                                                <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
                                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                                                                    <input
                                                                                        autoFocus
                                                                                        type="text"
                                                                                        className="flex-1 bg-transparent text-xs font-bold text-slate-700 outline-none placeholder-slate-400"
                                                                                        placeholder="Ketik untuk cari program..."
                                                                                        value={programSearchQuery}
                                                                                        onChange={e => setProgramSearchQuery(e.target.value)}
                                                                                        onClick={e => e.stopPropagation()}
                                                                                    />
                                                                                    {programSearchQuery && (
                                                                                        <button onClick={e => { e.stopPropagation(); setProgramSearchQuery(''); }} className="text-slate-300 hover:text-slate-500">
                                                                                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                            <div className="max-h-52 overflow-y-auto">
                                                                                <div
                                                                                    className="px-4 py-2.5 text-xs text-slate-400 font-bold cursor-pointer hover:bg-slate-50"
                                                                                    onClick={() => { setEntryForm({ ...entryForm, programId: '' }); setShowProgramDropdown(false); setProgramSearchQuery(''); }}
                                                                                >
                                                                                    — Pilih Program —
                                                                                </div>
                                                                                {expensePrograms?.filter(p => !p?.isDeleted && p.name?.toLowerCase().includes(programSearchQuery.toLowerCase())).map(p => (
                                                                                    <div
                                                                                        key={p.id}
                                                                                        className={`px-4 py-2.5 text-xs font-bold cursor-pointer transition-colors ${
                                                                                            entryForm.programId === p.id
                                                                                                ? 'bg-blue-600 text-white'
                                                                                                : 'text-slate-700 hover:bg-slate-50'
                                                                                        }`}
                                                                                        onClick={() => { setEntryForm({ ...entryForm, programId: p.id }); setShowProgramDropdown(false); setProgramSearchQuery(''); }}
                                                                                    >
                                                                                        {p.name}
                                                                                    </div>
                                                                                ))}
                                                                                {expensePrograms?.filter(p => !p?.isDeleted && p.name?.toLowerCase().includes(programSearchQuery.toLowerCase())).length === 0 && (
                                                                                    <div className="px-4 py-4 text-xs text-slate-400 italic text-center">Tidak ada program yang cocok</div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div className="space-y-2">
                                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic ml-1">Sumber Dana</label>
                                                                <div className="flex gap-2">
                                                                    <div className={`flex-1 py-3 rounded-2xl font-black text-[10px] border-2 text-center uppercase ${fundSourceFilter === 'BOS' || entryForm.useBos ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                                                                        {fundSourceFilter === 'BOS' || entryForm.useBos ? 'BOS' : 'YAYASAN'}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {entryForm.useBos && (
                                                                <div className="grid grid-cols-2 gap-4 animate-in fade-in">
                                                                    <div className="space-y-1">
                                                                        <label className="text-[9px] font-black text-emerald-600 uppercase tracking-widest italic ml-1">POS BOS</label>
                                                                        <select disabled={isReadOnlyComp} className="w-full p-3 bg-emerald-50 border-2 border-emerald-100 rounded-xl text-[10px] font-black outline-none disabled:opacity-75" value={entryForm.bosPosId || ''} onChange={e => setEntryForm({ ...entryForm, bosPosId: e.target.value })}>
                                                                            <option value="">Pilih POS...</option>
                                                                            {bosPosList?.filter(p => !p?.isDeleted).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                                        </select>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <label className="text-[9px] font-black text-emerald-600 uppercase tracking-widest italic ml-1">Tahap BOS</label>
                                                                        <select disabled={isReadOnlyComp} className="w-full p-3 bg-emerald-50 border-2 border-emerald-100 rounded-xl text-[10px] font-black outline-none disabled:opacity-75" value={entryForm.bosStageId || ''} onChange={e => setEntryForm({ ...entryForm, bosStageId: e.target.value })}>
                                                                            <option value="">Pilih Tahap...</option>
                                                                            {bosStages?.filter(s => !s?.isDeleted).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                                        </select>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Opsi Pengadaan Aset / Sarpras */}
                                                            <div className={`p-5 rounded-2xl border-2 transition-all ${entryForm.isAsset ? 'bg-indigo-50/70 border-indigo-200 shadow-sm' : 'bg-slate-50 border-slate-100'}`}>
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${entryForm.isAsset ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-slate-200 text-slate-500'}`}>
                                                                            <Package size={18} />
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-xs font-black text-slate-800 tracking-tight block">Pembelian Bersifat Aset</span>
                                                                            <span className="text-[10px] font-bold text-slate-400">Pengadaan peralatan/sarana prasarana yang dicatat ke buku inventaris aset</span>
                                                                        </div>
                                                                    </div>
                                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                                        <input 
                                                                            type="checkbox" 
                                                                            disabled={isReadOnlyComp} 
                                                                            checked={!!entryForm.isAsset} 
                                                                            onChange={e => setEntryForm({ 
                                                                                ...entryForm, 
                                                                                isAsset: e.target.checked,
                                                                                assetName: e.target.checked ? (entryForm.assetName || entryForm.label || '') : '',
                                                                                assetCategory: e.target.checked ? (entryForm.assetCategory || assetCategories[0]?.name || '') : ''
                                                                            })} 
                                                                            className="sr-only peer" 
                                                                        />
                                                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                                                    </label>
                                                                </div>

                                                                {entryForm.isAsset && (
                                                                    <div className="mt-4 pt-4 border-t border-indigo-100 space-y-4 animate-in fade-in duration-200">
                                                                        {/* Tahun Ajaran Notice */}
                                                                        <div className={`p-3.5 rounded-xl flex items-start gap-2.5 text-[10px] font-medium leading-relaxed ${isSarprasRequiredYear ? 'bg-amber-50 text-amber-900 border border-amber-200' : 'bg-blue-50 text-blue-900 border border-blue-100'}`}>
                                                                            <Info size={15} className={`shrink-0 mt-0.5 ${isSarprasRequiredYear ? 'text-amber-600' : 'text-blue-600'}`} />
                                                                            <div>
                                                                                {isSarprasRequiredYear ? (
                                                                                    <span><strong>Ketentuan TA {activeYearObj?.name || '2026-2027'}:</strong> Rencana pembelian aset baru wajib diverifikasi dan di-ACC oleh <strong>Bidang Sarana Prasarana</strong>. Rincian anggaran lama yang sudah berjalan tetap berlaku (otomatis disetujui).</span>
                                                                                ) : (
                                                                                    <span><strong>Masa Transisi ({activeYearObj?.name || 'Tahun Berjalan'}):</strong> Pembelian aset tetap dapat direncanakan, status verifikasi Sarpras otomatis disetujui (tidak mengunci).</span>
                                                                                )}
                                                                            </div>
                                                                        </div>

                                                                        {/* Input Nama Aset */}
                                                                        <div className="space-y-1">
                                                                            <label className="text-[10px] font-black text-indigo-950 uppercase tracking-widest italic ml-1">
                                                                                Nama Aset {isSarprasRequiredYear && <span className="text-rose-500">*</span>}
                                                                            </label>
                                                                            <input 
                                                                                type="text" 
                                                                                readOnly={isReadOnlyComp} 
                                                                                list="asset-names-datalist"
                                                                                placeholder="Contoh: Laptop Core i7, Proyektor Epson, PC Lab, Meja..."
                                                                                className="w-full p-3 bg-white border-2 border-indigo-100 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 transition-all disabled:opacity-75"
                                                                                value={entryForm.assetName || ''} 
                                                                                onChange={e => setEntryForm({ ...entryForm, assetName: e.target.value })}
                                                                            />
                                                                            <datalist id="asset-names-datalist">
                                                                                {assets.filter(a => !a.isDeleted).map((a, idx) => (
                                                                                    <option key={a.id || idx} value={a.name} />
                                                                                ))}
                                                                            </datalist>
                                                                        </div>

                                                                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                            {/* Dropdown Kategori Aset */}
                                                                            <div className="space-y-1">
                                                                                <label className="text-[10px] font-black text-indigo-950 uppercase tracking-widest italic ml-1">
                                                                                    Kategori Aset {isSarprasRequiredYear && <span className="text-rose-500">*</span>}
                                                                                </label>
                                                                                <select 
                                                                                    disabled={isReadOnlyComp} 
                                                                                    className="w-full p-3 bg-white border-2 border-indigo-100 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 transition-all disabled:opacity-75"
                                                                                    value={entryForm.assetCategory || ''} 
                                                                                    onChange={e => setEntryForm({ ...entryForm, assetCategory: e.target.value })}
                                                                                >
                                                                                    <option value="">— Pilih Kategori Aset —</option>
                                                                                    {assetCategories.map(cat => (
                                                                                        <option key={cat.id || cat.name} value={cat.name}>
                                                                                            {cat.name} {cat.economicLife ? `(Umur: ${cat.economicLife} thn)` : ''}
                                                                                        </option>
                                                                                    ))}
                                                                                </select>
                                                                            </div>

                                                                            {/* Sifat Pengadaan */}
                                                                            <div className="space-y-1">
                                                                                <label className="text-[10px] font-black text-indigo-950 uppercase tracking-widest italic ml-1">Sifat Pengadaan Aset</label>
                                                                                <div className="grid grid-cols-2 gap-2 h-[46px]">
                                                                                    {[
                                                                                        { id: 'BARU', label: 'Penambahan Baru' },
                                                                                        { id: 'PENGGANTIAN', label: 'Penggantian Rusak' }
                                                                                    ].map(opt => (
                                                                                        <button
                                                                                            key={opt.id}
                                                                                            type="button"
                                                                                            disabled={isReadOnlyComp}
                                                                                            onClick={() => setEntryForm({ ...entryForm, assetProcurementType: opt.id })}
                                                                                            className={`h-full px-2 rounded-xl text-[10px] font-black tracking-tight transition-all border flex items-center justify-center text-center ${entryForm.assetProcurementType === opt.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-600 border-indigo-100 hover:bg-indigo-50/50'}`}
                                                                                        >
                                                                                            {opt.label}
                                                                                        </button>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        {/* Status ACC Sarpras Badge if already reviewed */}
                                                                        {entryForm.sarprasStatus && (
                                                                            <div className="p-3 bg-white rounded-xl border border-indigo-100 flex items-center justify-between text-xs">
                                                                                <span className="font-bold text-slate-500">Status Verifikasi Sarpras:</span>
                                                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                                                                                    entryForm.sarprasStatus === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                                                                                    entryForm.sarprasStatus === 'REJECTED' ? 'bg-rose-100 text-rose-700' :
                                                                                    'bg-amber-100 text-amber-700'
                                                                                }`}>
                                                                                    {entryForm.sarprasStatus === 'APPROVED' ? '✓ Disetujui Sarpras' :
                                                                                     entryForm.sarprasStatus === 'REJECTED' ? '✕ Ditolak Sarpras' :
                                                                                     '⏳ Menunggu Telaah Sarpras'}
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="space-y-2">
                                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic ml-1">Catatan / Justifikasi</label>
                                                                <textarea readOnly={isReadOnlyComp} className={`w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-[11px] italic font-medium min-h-[60px] outline-none focus:border-blue-500 ${isReadOnlyComp ? 'opacity-70' : ''}`} value={entryForm.description || ''} onChange={e => setEntryForm({ ...entryForm, description: e.target.value })} placeholder={isReadOnlyComp ? '' : "Alasan pengadaan rincian ini..."} />
                                                            </div>

                                                            <div className="bg-blue-600 rounded-3xl p-6 text-white shadow-xl flex items-center justify-between">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Subtotal Terhitung</span>
                                                                    <span className="text-xl font-black italic">{formatRupiah((parseFloat(entryForm.volume) || 0) * (parseFloat(entryForm.kali) || 1) * (parseFloat(entryForm.harga) || 0))}</span>
                                                                </div>
                                                                <Calculator size={32} className="opacity-20" />
                                                            </div>
                                                        </div>

                                                        {/* Right Column: Monthly Allocation */}
                                                        <div className="p-8 bg-slate-900 rounded-[2.5rem] text-white flex flex-col">
                                                            <div className="flex items-center justify-between mb-6">
                                                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] italic text-blue-400">Alokasi Bulanan Rincian</h4>
                                                                {!isReadOnlyComp && (
                                                                    <button onClick={handleSyncEntryMonthly} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-2">
                                                                        <RefreshCw size={12} />
                                                                        Sync
                                                                    </button>
                                                                )}
                                                            </div>

                                                            <div className="grid grid-cols-2 gap-3 flex-1">
                                                                {generateMonths(academicYears.find(a => a.id === selectedYearId)).map((m) => {
                                                                    const mData = entryForm.months?.[m.id] || { m: false, jumlah: 0 };
                                                                    const isSelectable = true;


                                                                    return (
                                                                        <div key={m.id} className={`p-3 rounded-2xl border-2 transition-all ${mData.m ? 'bg-blue-600 border-blue-400' : (isSelectable ? 'bg-white/5 border-white/10 hover:border-blue-500/30' : 'opacity-10 pointer-events-none')} ${isReadOnlyComp ? 'pointer-events-none' : ''}`}>
                                                                            <div className="flex items-center justify-between mb-1.5">
                                                                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{m.shortLabel}</span>
                                                                                <input type="checkbox" disabled={isReadOnlyComp} checked={mData.m} onChange={e => handleEntryMonthlyUpdate(m.id, 'm', e.target.checked)} className="w-3.5 h-3.5 rounded bg-slate-800 border-slate-700 text-blue-500 disabled:opacity-50" />
                                                                            </div>
                                                                            <div className="relative mt-1">
                                                                                <span className={`absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] font-bold transition-colors ${mData.m ? 'text-blue-200' : 'text-white/40'}`}>Rp</span>
                                                                                <input 
                                                                                    type="text" 
                                                                                    readOnly={isReadOnlyComp} 
                                                                                    className={`w-full pl-7 pr-2 py-1.5 rounded-xl font-black text-[11px] outline-none placeholder-white/20 transition-all border ${
                                                                                        mData.m 
                                                                                            ? 'bg-blue-700/40 border-blue-400/40 text-white focus:bg-blue-800/40 focus:border-blue-300' 
                                                                                            : 'bg-white/5 border-white/10 text-white focus:bg-white/10 focus:border-white/30'
                                                                                    } ${isReadOnlyComp ? 'pointer-events-none opacity-70' : 'cursor-text'}`} 
                                                                                    placeholder="0" 
                                                                                    value={mData.jumlah > 0 ? Number(mData.jumlah).toLocaleString('id-ID') : ''} 
                                                                                    onChange={e => handleEntryMonthlyUpdate(m.id, 'jumlah', parseFloat(e.target.value.replace(/\D/g, '') || 0))} 
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>

                                                            <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
                                                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Total Terdistribusi</span>
                                                                <span className="text-sm font-black italic">{formatRupiah(Object.values(entryForm.months || {}).reduce((sum, m) => sum + (m?.m ? (parseFloat(m?.jumlah) || 0) : 0), 0))}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="p-8 pt-0 flex gap-4 bg-slate-50/50">
                                                    {isReadOnlyComp ? (
                                                        <button onClick={() => setShowCompModal(false)} className="w-full py-5 bg-blue-600 hover:bg-slate-900 text-white rounded-2xl font-black text-xs uppercase transition-all flex items-center justify-center gap-2">TUTUP DETIL</button>
                                                    ) : (
                                                        <>
                                                            <button onClick={() => setShowCompModal(false)} className="flex-1 py-5 bg-white border border-slate-200 text-slate-500 rounded-2xl font-black text-xs uppercase hover:bg-slate-50 transition-all">BATAL</button>
                                                            {(() => {
                                                                const total = (parseFloat(entryForm.volume) || 0) * (parseFloat(entryForm.kali) || 1) * (parseFloat(entryForm.harga) || 0);
                                                                const monthlyTotal = Object.values(entryForm.months || {}).reduce((sum, m) => sum + (m?.m ? (parseFloat(m?.jumlah) || 0) : 0), 0);
                                                                const isBalanced = Math.abs(total - monthlyTotal) < 1.1;
                                                                const canSave = entryForm.label && entryForm.volume && entryForm.harga && isBalanced;

                                                                return (
                                                                    <button
                                                                        disabled={!canSave}
                                                                        onClick={() => handlePushComponent(itemId, item.id)}
                                                                        className={`flex-[2] py-5 rounded-2xl font-black text-xs uppercase transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3 ${!canSave ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-slate-900'}`}
                                                                    >
                                                                        {!isBalanced && total > 0 ? 'ALOKASI BELUM SEIMBANG' : (editingCompIdx !== null ? 'PERBARUI RINCIAN' : 'SIMPAN RINCIAN')}
                                                                    </button>
                                                                );
                                                            })()}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}
            {/* Status Feedback Modal */}
            {showStatusModal && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md" onClick={handleAcknowledgeStatus} />
                    <div className={`bg-white rounded-[3rem] w-full max-w-lg relative z-10 shadow-2xl overflow-hidden animate-in zoom-in duration-300 border-b-[12px] ${currentPlan.status === 'APPROVED' ? 'border-emerald-500' : 'border-rose-500'
                        }`}>
                        <div className="p-10 text-center">
                            <div className={`w-24 h-24 mx-auto mb-6 rounded-[2rem] flex items-center justify-center shadow-2xl ${currentPlan.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                                }`}>
                                {currentPlan.status === 'APPROVED' ? <CheckCircle2 size={48} strokeWidth={2.5} /> : <AlertCircle size={48} strokeWidth={2.5} />}
                            </div>

                            <h2 className="text-3xl font-black text-slate-900 mb-2 font-display">
                                Anggaran {currentPlan.status === 'APPROVED' ? 'Telah Di-ACC!' : 'Perlu Revisi'}
                            </h2>
                            <p className="text-slate-500 font-medium mb-8">
                                {currentPlan.status === 'APPROVED'
                                    ? `Alhamdulillah, rencana anggaran unit Anda untuk periode ${academicYears.find(ay => ay.id === selectedYearId)?.name} telah disetujui oleh Yayasan.`
                                    : 'Mohon maaf, rencana anggaran Anda belum dapat disetujui dan memerlukan beberapa perbaikan.'
                                }
                            </p>

                            {currentPlan.status === 'REJECTED' && currentPlan.rejectionReason && (
                                <div className="mb-8 p-6 bg-rose-50 rounded-3xl border border-rose-100 text-left">
                                    <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <MessageSquare size={14} />
                                        Alasan Penolakan:
                                    </p>
                                    <p className="text-sm font-bold text-rose-800 leading-relaxed italic">
                                        "{currentPlan.rejectionReason}"
                                    </p>
                                </div>
                            )}

                            <button
                                onClick={handleAcknowledgeStatus}
                                className={`w-full py-5 rounded-2xl font-black text-sm tracking-tight transition-all shadow-xl active:scale-95 ${currentPlan.status === 'APPROVED'
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200'
                                    : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200'
                                    }`}
                            >
                                SAYA MENGERTI
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Bulk Action Bar */}
            {selectedComponents.size > 0 && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[5000] animate-in slide-in-from-bottom-20 duration-500">
                    <div className="bg-slate-900 text-white px-8 py-6 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex items-center gap-8 ring-8 ring-white/10 backdrop-blur-md">
                        <div className="flex items-center gap-4 border-r border-white/10 pr-8">
                            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg shadow-blue-500/20">
                                {selectedComponents.size}
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Rincian Terpilih</p>
                                <p className="text-sm font-black italic">Siap untuk diproses</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {isSuperAdmin ? (
                                <>
                                    <button
                                        onClick={() => handleBulkComponentAction('APPROVE')}
                                        disabled={isSaving}
                                        className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all hover:scale-105 active:scale-95 flex items-center gap-3 disabled:opacity-50"
                                    >
                                        <CheckCircle2 size={18} />
                                        SETUJUI
                                    </button>
                                    <button
                                        onClick={() => handleBulkComponentAction('REJECT')}
                                        disabled={isSaving}
                                        className="px-8 py-4 bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-600/30 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center gap-3 disabled:opacity-50"
                                    >
                                        <XCircle size={18} />
                                        TOLAK
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => handleBulkComponentAction('SUBMIT')}
                                    disabled={isSaving}
                                    className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all hover:scale-105 active:scale-95 flex items-center gap-3 disabled:opacity-50"
                                >
                                    <CheckCircle2 size={18} />
                                    AJUKAN RINCIAN
                                </button>
                            )}
                            <button
                                onClick={() => setSelectedComponents(new Set())}
                                className="ml-4 p-4 text-slate-400 hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Import Modal */}
            {showImportModal && (
                <div className="fixed inset-0 z-[2000] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-xl overflow-hidden border border-white animate-in zoom-in-95 duration-300">
                        <div className="bg-indigo-600 p-10 text-white relative">
                            <button
                                onClick={() => setShowImportModal(false)}
                                className="absolute top-8 right-8 text-white/50 hover:text-white transition-colors"
                            >
                                <X size={24} />
                            </button>
                            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-md">
                                <CloudUpload size={32} />
                            </div>
                            <h3 className="text-3xl font-black italic tracking-tight">Import Masal RAB</h3>
                            <p className="text-indigo-100 font-medium text-sm mt-2">Unggah file Excel RAB {fundSourceFilter} untuk mengisi data secara otomatis.</p>
                        </div>

                        <div className="p-10 space-y-8">
                            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Langkah-langkah:</h4>
                                <ol className="text-xs font-bold text-slate-600 space-y-3">
                                    <li className="flex gap-3">
                                        <span className="w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0">1</span>
                                        <span>Unduh template Excel yang sudah disiapkan di bawah.</span>
                                    </li>
                                    <li className="flex gap-3">
                                        <span className="w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0">2</span>
                                        <span>Isi data rencana belanja (pengeluaran) sesuai format.</span>
                                    </li>
                                    <li className="flex gap-3">
                                        <span className="w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0">3</span>
                                        <span>Unggah kembali file tersebut ke sistem ini.</span>
                                    </li>
                                </ol>
                                <button
                                    onClick={handleDownloadRABTemplate}
                                    className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-indigo-200 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-sm"
                                >
                                    <Download size={14} />
                                    Unduh Template Excel
                                </button>
                            </div>

                            <div className="relative group">
                                <input
                                    type="file"
                                    accept=".xlsx, .xls"
                                    onChange={handleFileUpload}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                />
                                <div className="p-12 border-4 border-dashed border-slate-100 rounded-[2.5rem] flex flex-col items-center justify-center text-center group-hover:border-indigo-200 group-hover:bg-indigo-50/30 transition-all">
                                    <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 group-hover:text-indigo-500 transition-all duration-500">
                                        <CloudUpload size={32} />
                                    </div>
                                    <p className="text-sm font-black text-slate-400 group-hover:text-indigo-600 transition-colors">Klik atau Seret File ke Sini</p>
                                    <p className="text-[10px] font-bold text-slate-300 mt-1 uppercase tracking-widest">Maksimal 10MB (.xlsx)</p>
                                </div>
                            </div>

                            <button
                                onClick={() => setShowImportModal(false)}
                                className="w-full py-4 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-600 transition-colors"
                            >
                                Batal
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function RAB() {
    const [isMounting, setIsMounting] = useState(true);
    const [searchParams] = useSearchParams();
    const sourceParam = searchParams.get('source');

    useEffect(() => {
        setIsMounting(true);
        // Timeout allows browser to render loading spinner before main thread is blocked by RABContent
        const timer = setTimeout(() => {
            setIsMounting(false);
        }, 50);
        return () => clearTimeout(timer);
    }, [sourceParam]);

    if (isMounting) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] w-full animate-in fade-in duration-300">
                <div className="flex flex-col items-center gap-6 bg-white/80 backdrop-blur-md p-10 rounded-[2rem] shadow-xl border border-slate-100">
                    <div className="relative">
                        <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full animate-pulse" />
                        <div className="relative w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                            <RefreshCw className="text-white animate-spin" size={32} />
                        </div>
                    </div>
                    <div className="text-center space-y-1">
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">Memuat Data RAB...</h3>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Kalkulasi Anggaran Berlangsung</p>
                    </div>
                </div>
            </div>
        );
    }

    return <RABContent />;
}

