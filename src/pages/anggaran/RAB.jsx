import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Calendar, Building2, Layers, Save, RefreshCw,
    ArrowUpCircle, ArrowDownCircle, Info, ChevronRight,
    TrendingUp, Wallet, ShieldCheck, Download, Filter,
    Send, CheckCircle2, XCircle, AlertCircle, MessageSquare,
    Edit3, PlusCircle, Database, Plus, X, RotateCcw, Package,
    Calculator, Trash2, Pencil, DollarSign, BarChart3, CloudUpload, Eye, EyeOff, Lock
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
        currentUser
    } = state;

    // Role helpers
    const isSuperAdmin = currentUser?.role === 'superadmin';
    const isAdminBidang = currentUser?.role === 'admin_bidang';
    const currentUserUnit = units.find(u => u.id === currentUser?.unitId);
    const isBosRecipient = isSuperAdmin || isAdminBidang || (currentUserUnit && currentUserUnit.receivesBos);

    const selectedYearId = state.globalAcademicYearId || '';
    const setSelectedYearId = (id) => dispatch({ type: 'SET_GLOBAL_YEAR', payload: id });
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
    const [filterMonth, setFilterMonth] = useState(null); // monthId (e.g. 2026-07)
    const [filterProgram, setFilterProgram] = useState(null); // programId


    // States for Journal-style component entry
    const [entryForm, setEntryForm] = useState({
        label: '',
        volume: 0,
        satuan: '',
        kali: 1,
        harga: 0,
        programId: '',
        semester: '1',
        months: {}
    });
    const [editingCompIdx, setEditingCompIdx] = useState(null);
    const [showCompModal, setShowCompModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [expandedReviewPlans, setExpandedReviewPlans] = useState({});
    const [expandedDashboardPlans, setExpandedDashboardPlans] = useState({});
    const [expandedDetailItems, setExpandedDetailItems] = useState({});
    const [selectedComponents, setSelectedComponents] = useState(new Set());
    const [programSearchQuery, setProgramSearchQuery] = useState('');
    const [showProgramDropdown, setShowProgramDropdown] = useState(false);

    const toggleComponentSelection = (id) => {
        setSelectedComponents(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleReviewPlan = (id) => setExpandedReviewPlans(prev => ({ ...prev, [id]: !prev[id] }));
    const toggleDashboardPlan = (id) => setExpandedDashboardPlans(prev => ({ ...prev, [id]: !prev[id] }));

    // Mapped data for the Review and Consolidated views (Extracted Hooks)
    const incomePrograms = useMemo(() => programs.filter(p => !p.isDeleted && p.type === 'INCOME'), [programs]);
    const pendingPlans = useMemo(() =>
        rabPlans.filter(p => p.status === 'PENDING' && p.academicYearId === selectedYearId && (fundSourceFilter === 'BOS' ? p.id.endsWith('-BOS') : !p.id.endsWith('-BOS'))),
        [rabPlans, selectedYearId, fundSourceFilter]
    );
    const filteredReviewPlans = useMemo(() =>
        pendingPlans.filter(p => p.academicYearId === selectedYearId),
        [pendingPlans, selectedYearId]);

    const activeYear = useMemo(() => academicYears.find(ay => ay.id === selectedYearId), [academicYears, selectedYearId]);
    const monthsOptions = useMemo(() => activeYear ? generateMonths(activeYear) : [], [activeYear]);
    const allPrograms = useMemo(() => {
        if (activeTab === 'INCOME') return programs.filter(p => !p.isDeleted && p.type === 'INCOME');
        return expensePrograms.filter(p => !p.isDeleted);
    }, [programs, expensePrograms, activeTab]);

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
        const existingPlan = (rabPlans || []).find(p => p.id === planId);
        
        // Track status and notified changes so the modal can show up even if data loads late
        const planKey = existingPlan ? `${planId}-${existingPlan.status}-${existingPlan.notified}` : planId;

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
                        description: Array.from(new Set(allComponents.map(c => c.label))).join(', ')
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
    const isLocked = activePlan?.status === 'APPROVED' || activePlan?.status === 'PENDING' || isConsolidation;

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

        const type = activeTab === 'INCOME' ? 'income' : 'expense';
        const total = (parseFloat(entryForm.volume) || 0) * (parseFloat(entryForm.kali) || 0) * (parseFloat(entryForm.harga) || 0);
        
        let newStatus = entryForm.status;
        if (newStatus === 'REJECTED' || !newStatus) newStatus = 'DRAFT';

        const newComp = {
            ...entryForm,
            volume: parseFloat(entryForm.volume),
            kali: parseFloat(entryForm.kali),
            harga: parseFloat(entryForm.harga),
            total,
            status: newStatus
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
            months: {}
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
                    description: components.map(c => c.label).join(', ')
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
        draftIndexes.forEach(idx => {
            if (newComps[idx]) {
                newComps[idx] = { ...newComps[idx], status: 'PENDING' };
            }
        });

        const updatedPlan = { ...plan, components: newComps };
        const newPlans = [...plans];
        newPlans[planIndex] = updatedPlan;

        // Sweep ALL expense items: mark all DRAFT/REJECTED components as PENDING
        const sweepedExpense = { ...currentPlan.expense };
        Object.keys(sweepedExpense).forEach(itemId => {
            const itemPlans = sweepedExpense[itemId];
            if (Array.isArray(itemPlans)) {
                sweepedExpense[itemId] = itemPlans.map(p => ({
                    ...p,
                    components: (p.components || []).map(c =>
                        (c.status === 'DRAFT' || c.status === 'REJECTED' || !c.status)
                            ? { ...c, status: 'PENDING' }
                            : c
                    )
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

        const basePlanId = `${selectedYearId}-${selectedUnitId}`;
        const planId = `${basePlanId}-${fundSourceFilter === 'BOS' ? 'BOS' : 'YAYASAN'}`;
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

        const nextPlan = {
            ...currentPlan,
            expense: { ...currentPlan.expense, [mId]: newPlans },
            status: 'DRAFT',
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser?.username
        };
        setCurrentPlan(nextPlan);

        const basePlanId = `${selectedYearId}-${selectedUnitId}`;
        const planId = `${basePlanId}-${fundSourceFilter === 'BOS' ? 'BOS' : 'YAYASAN'}`;
        const dbPlan = {
            id: planId,
            academicYearId: selectedYearId,
            unitId: selectedUnitId.startsWith('FIELD-') ? null : (selectedUnitId === 'FOUNDATION' ? 'FOUNDATION' : selectedUnitId),
            fieldId: selectedUnitId.startsWith('FIELD-') ? selectedUnitId.replace('FIELD-', '') : null,
            income: nextPlan.income,
            expense: nextPlan.expense,
            status: 'DRAFT',
            rejectionReason: null,
            updatedAt: nextPlan.updatedAt,
            updatedBy: nextPlan.updatedBy
        };
        await persistPlanToServer(dbPlan);
        setMessage({ type: 'success', text: 'Pengajuan rincian dibatalkan. Rincian kembali ke status Draft.' });
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
            setMessage({ type: 'error', text: 'Koneksi bermasalah: Data tersimpan di draf lokal, namun gagal sinkron ke server.' });
            return false;
        }
    };



    const handleSave = async () => {
        setIsSaving(true);
        setMessage(null);

        const basePlanId = `${selectedYearId}-${selectedUnitId}`;
        const planId = `${basePlanId}-${fundSourceFilter === 'BOS' ? 'BOS' : 'YAYASAN'}`;
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
        const basePlanId = `${selectedYearId}-${selectedUnitId}`;
        const planId = `${basePlanId}-${fundSourceFilter === 'BOS' ? 'BOS' : 'YAYASAN'}`;

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
        const basePlanId = `${selectedYearId}-${selectedUnitId}`;
        const planId = `${basePlanId}-${fundSourceFilter === 'BOS' ? 'BOS' : 'YAYASAN'}`;
        const plan = rabPlans.find(p => p.id === planId);
        if (!plan || plan.status !== 'PENDING') return;

        if (!window.confirm('Batalkan pengajuan RAB ini? Status akan kembali ke Draft dan dapat diedit kembali.')) return;

        const updatedPlan = {
            ...plan,
            status: 'DRAFT',
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

        const updatedPlan = {
            ...plan,
            status: status,
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
            setMessage({ type: 'error', text: 'Gagal memproses persetujuan.' });
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
            const basePlanId = `${selectedYearId}-${selectedUnitId}`;
            const currentPlanId = `${basePlanId}-${fundSourceFilter === 'BOS' ? 'BOS' : 'YAYASAN'}`;
            let currentPlanUpdated = null;

            for (const [planSubId, items] of Object.entries(selectionsByPlan)) {
                // Find the main plan where plan.expense has a sub-plan with id === planSubId
                // OR where plan.id === planSubId (if it's the main plan ID)
                const plan = rabPlans.find(p => {
                    if (p.id === planSubId) return true;
                    const nextExpense = p.expense || {};
                    return Object.values(nextExpense).some(plansArr => 
                        Array.isArray(plansArr) && plansArr.some(subP => subP.id === planSubId)
                    );
                });

                if (!plan) continue;

                const nextExpense = { ...plan.expense };
                items.forEach(({ itemId: rawItemId, pIdx, cIdx }) => {
                    // Let's resolve the actual itemId!
                    // If rawItemId starts with 'COMP-', it's not the real itemId.
                    // We must find which key in nextExpense contains the sub-plan with id === planSubId.
                    let itemId = rawItemId;
                    if (rawItemId.startsWith('COMP-')) {
                        const foundKey = Object.keys(nextExpense).find(k => 
                            Array.isArray(nextExpense[k]) && nextExpense[k].some(subP => subP.id === planSubId)
                        );
                        if (foundKey) itemId = foundKey;
                    }

                    let rawPlanItems = nextExpense[itemId];
                    let planItems = Array.isArray(rawPlanItems) ? rawPlanItems : (rawPlanItems && typeof rawPlanItems === 'object' && Object.keys(rawPlanItems).length > 0 ? [{ id: `P-${itemId}-LEGACY`, itemId: itemId, ...rawPlanItems }] : []);
                    
                    // Find the exact index of the sub-plan with id === planSubId
                    const actualPIdx = planItems.findIndex(subP => subP.id === planSubId);
                    const targetIdx = actualPIdx !== -1 ? actualPIdx : pIdx;

                    if (planItems[targetIdx] && planItems[targetIdx].components && planItems[targetIdx].components[cIdx]) {
                        const newComps = [...planItems[targetIdx].components];
                        
                        let newStatus = newComps[cIdx].status;
                        let newIsApproved = newComps[cIdx].isApproved;
                        
                        if (action === 'SUBMIT') {
                            newStatus = 'PENDING';
                        } else if (action === 'APPROVE') {
                            newStatus = 'APPROVED';
                            newIsApproved = true;
                        } else if (action === 'REJECT') {
                            newStatus = 'REJECTED';
                            newIsApproved = false;
                        }

                        newComps[cIdx] = { ...newComps[cIdx], isApproved: newIsApproved, status: newStatus };
                        
                        const newPlanItems = [...planItems];
                        newPlanItems[targetIdx] = { ...newPlanItems[targetIdx], components: newComps };
                        
                        nextExpense[itemId] = newPlanItems;
                    }
                });

                const updatedPlan = { ...plan, expense: nextExpense, updatedAt: new Date().toISOString() };
                dispatch({ type: 'SET_RAB_PLAN', payload: updatedPlan });
                await api.pushAction({ type: 'SET_RAB_PLAN', payload: updatedPlan }, state);

                if (plan.id === currentPlanId || planSubId === currentPlanId) {
                    currentPlanUpdated = updatedPlan;
                }
            }

            if (currentPlanUpdated) {
                const rawExpense = currentPlanUpdated.expense || {};
                const migratedExpense = {};
                Object.entries(rawExpense).forEach(([itemId, data]) => {
                    if (Array.isArray(data)) {
                        migratedExpense[itemId] = data;
                    } else if (data && typeof data === 'object' && Object.keys(data).length > 0) {
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
                    income: currentPlanUpdated.income || {},
                    expense: migratedExpense,
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
        const basePlanId = `${selectedYearId}-${selectedUnitId}`;
        const planId = `${basePlanId}-${fundSourceFilter === 'BOS' ? 'BOS' : 'YAYASAN'}`;
        const plan = rabPlans.find(p => p.id === planId);
        if (!plan || plan.status !== 'APPROVED') return;

        const reason = window.prompt('Masukkan alasan pembatalan persetujuan (agar unit tahu apa yang harus diperbaiki):', 'Pembatalan persetujuan untuk perbaikan/penambahan data.');
        if (reason === null) return; // User cancelled prompt

        const updatedPlan = {
            ...plan,
            status: 'REJECTED',
            rejectionReason: reason,
            notified: false,
            approvedAt: null,
            approvedBy: null,
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser?.username
        };

        setIsSaving(true);
        try {
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
        const basePlanId = `${selectedYearId}-${selectedUnitId}`;
        const planId = `${basePlanId}-${fundSourceFilter === 'BOS' ? 'BOS' : 'YAYASAN'}`;
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
                    // Clear existing expenses for imported items to prevent duplicates
                    const importedItemNames = new Set(data.map(r => r['Item Belanja']).filter(Boolean));
                    expenseItems.forEach(ei => {
                        if (importedItemNames.has(ei.name)) newExpense[ei.id] = [];
                    });

                    data.forEach((row, idx) => {
                        const itemName = row['Item Belanja'];
                        const item = expenseItems.find(i => i.name === itemName);
                        if (item) {
                            const months = {};
                            let total = 0;
                            monthsOptions.forEach(m => {
                                const val = parseFloat(row[m.name]) || 0;
                                months[m.id] = { m: val > 0, jumlah: val };
                                total += val;
                            });

                            const progNameStr = (row['Program Belanja']?.toString() || '').trim().toLowerCase();
                            const program = progNameStr ? allPrograms.find(p => p.name.trim().toLowerCase() === progNameStr) : null;
                            const compLabel = (row['Keterangan / Komponen'] || '').toString().trim();

                            const comp = {
                                id: `C-${Date.now()}-${idx}`,
                                label: compLabel,
                                volume: parseFloat(row['Vol']) || 0,
                                satuan: row['Satuan'] || '',
                                kali: parseFloat(row['Kali']) || 1,
                                harga: parseFloat(row['Harga']) || 0,
                                total: total,
                                months: months,
                                programId: program?.id || '',
                                semester: row['Semester'] || '1'
                            };

                            if (!newExpense[item.id]) newExpense[item.id] = [];
                            
                            // Check if we should add to existing plan or create new
                            if (comp.label || comp.total > 0 || comp.programId) {
                                if (!comp.label) comp.label = 'Imported Component';
                                newExpense[item.id].push({
                                    id: `P-${Date.now()}-${idx}`,
                                    itemId: item.id,
                                    total: comp.total,
                                    components: [comp],
                                    months: comp.months,
                                    programId: comp.programId,
                                    semester: comp.semester,
                                    description: comp.label
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
                        const exactKey = rowKeys.find(k => k.trim().toLowerCase() === m.name.toLowerCase());
                        const val = exactKey ? (parseFloat(row[exactKey]) || 0) : 0;
                        months[m.id] = { m: val > 0, jumlah: val };
                    });

                    const volKey = rowKeys.find(k => k.trim().toLowerCase() === 'vol') || 'Vol';
                    const kaliKey = rowKeys.find(k => k.trim().toLowerCase() === 'kali') || 'Kali';
                    const hargaKey = rowKeys.find(k => k.trim().toLowerCase() === 'harga') || 'Harga';
                    const ketKey = rowKeys.find(k => k.trim().toLowerCase() === 'keterangan') || 'Keterangan';
                    const progKey = rowKeys.find(k => k.trim().toLowerCase() === 'program belanja') || 'Program Belanja';
                    const semKey = rowKeys.find(k => k.trim().toLowerCase() === 'semester') || 'Semester';

                    const vol = parseFloat(row[volKey]) || 0;
                    const kali = parseFloat(row[kaliKey]) || 1;
                    const harga = parseFloat(row[hargaKey]) || 0;
                    const total = vol * kali * harga;

                    const progNameStr = (row[progKey]?.toString() || '').trim().toLowerCase();

                    return {
                        id: `C-${Date.now()}-${idx}`,
                        label: row[ketKey] || '',
                        volume: vol,
                        satuan: row['Satuan'] || '',
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

                    const updatedPlan = {
                        ...basePlan,
                        components: allComps,
                        total: allComps.reduce((sum, c) => sum + (parseFloat(c.total) || 0), 0),
                        months: aggregateMonths
                    };

                    const nextPlan = {
                        ...currentPlan,
                        expense: { ...currentPlan.expense, [itemId]: [updatedPlan] }
                    };
                    
                    setCurrentPlan(nextPlan);
                    
                    // Auto-save to DB immediately after import
                    const planId = `${selectedYearId}-${selectedUnitId}-${fundSourceFilter === 'BOS' ? 'BOS' : 'YAYASAN'}`;
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

                                        const rowData = {
                                            id: plan.id,
                                            name: unit?.name || 'Unknown',
                                            typeLabel: isBOSPlan ? 'BOS' : 'YAYASAN',
                                            status: plan.status,
                                            rap: rapLimit,
                                            rab: total,
                                            sisa: rapLimit - total,
                                            breakdown: Object.entries(plan.expense || {})
                                                .map(([id, plans]) => {
                                                    const planArray = Array.isArray(plans) ? plans : (plans && typeof plans === 'object' && Object.keys(plans).length > 0 ? [plans] : []);
                                                    const aggregatedTotal = planArray.reduce((s, p) => s + (parseFloat(p.total) || 0), 0);
                                                    const aggregatedRap = itemAllocations[id] || 0;
                                                    // Collect all components from all plans for this item
                                                    const allComponents = planArray.flatMap((p, pIdx) => (p.components || []).map((c, cIdx) => {
                                                        let compStatus = c.status;
                                                        if (!compStatus) {
                                                            if (c.isApproved === true) compStatus = 'APPROVED';
                                                            else compStatus = plan.status === 'APPROVED' ? 'APPROVED' : (plan.status === 'PENDING' ? 'PENDING' : 'DRAFT');
                                                        }
                                                        return {
                                                            ...c,
                                                            _pIdx: pIdx,
                                                            _cIdx: cIdx,
                                                            status: compStatus
                                                        };
                                                    }));

                                                    return {
                                                        id,
                                                        name: (expenseItems.find(e => e.id === id)?.name || id),
                                                        rab: aggregatedTotal,
                                                        rap: aggregatedRap,
                                                        sisa: aggregatedRap - aggregatedTotal,
                                                        components: allComponents
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

    const renderBudgetTable = (type, labelText) => {
        const isIncome = type === 'income';
        const items = isIncome ? filteredIncomeItems : filteredExpenseItems;

        return (
            <div className="space-y-6">
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
                </div>

                <div className="overflow-x-auto scroll-top">
                    <table className="w-full border-separate border-spacing-y-4">
                        <thead>
                            <tr className="text-slate-400/80 text-[10px] font-black uppercase tracking-[0.2em] italic">
                                <th className="px-6 py-1 text-left w-12">#</th>
                                <th className="px-6 py-1 text-left">{labelText}</th>
                                <th className="px-6 py-1 text-center">Semester</th>
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
                                        description: Array.from(new Set(allComps.map(c => c.label))).join(', ')
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
                                                        status: compStatus
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
                                                selectable={!isSuperAdmin && !isConsolidation}
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
                                                                            const basePlanId = `${selectedYearId}-${selectedUnitId}`;
                                                                            const planId = `${basePlanId}-${fundSourceFilter === 'BOS' ? 'BOS' : 'YAYASAN'}`;
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
                                        <td className="px-6 py-4 border-y border-l border-slate-100 font-black text-slate-300 text-xs italic">--</td>
                                        <td className="px-6 py-4 border-y border-slate-100">
                                            <div className="flex items-center gap-4 opacity-40">
                                                <div className="p-4 rounded-2xl bg-slate-50 text-slate-300">
                                                    {isIncome ? <DollarSign size={18} /> : <TrendingUp size={18} />}
                                                </div>
                                                <span className="font-black text-slate-800 text-sm">{itemMaster.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 border-y border-slate-100 text-center text-slate-300 font-black text-[9px]">BELUM ADA INPUT</td>
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
                    {!isLocked && !isConsolidation && (
                        <div className="relative z-10">
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="group flex items-center gap-4 bg-white text-slate-900 px-10 py-5 rounded-[2rem] font-black text-sm tracking-tight transition-all hover:scale-105 active:scale-95 shadow-xl disabled:opacity-50"
                            >
                                <Save size={20} className="text-blue-600 group-hover:rotate-12 transition-transform" />
                                {isSaving ? 'MEMPROSES...' : 'SIMPAN SEMUA DATA'}
                            </button>
                        </div>
                    )}
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
                            <p className={`font-black uppercase tracking-tight ${activePlan.status === 'APPROVED' ? 'text-emerald-600' :
                                (activePlan.status === 'PENDING' ? 'text-indigo-600' : 'text-rose-600')
                                }`}>
                                {activePlan.status === 'APPROVED' ? 'Disetujui' : (activePlan.status === 'PENDING' ? 'Menunggu Review' : 'Draft / Belum Dikirim')}
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

                            <div className={`grid grid-cols-1 md:grid-cols-2 ${isBosRecipient ? 'xl:grid-cols-4' : 'xl:grid-cols-3'} gap-6 lg:gap-8`}>
                                <div className="space-y-2 min-w-0">
                                    <p className="text-[10px] font-black text-blue-300 uppercase tracking-widest opacity-60 truncate" title="Total RAP">Total RAP</p>
                                    <h3 className="text-2xl font-black italic truncate" title={formatRupiah(rapData.totalTarget)}>{formatRupiah(rapData.totalTarget)}</h3>
                                </div>
                                {isBosRecipient && (
                                    <div className="space-y-2 min-w-0">
                                        <p className="text-[10px] font-black text-emerald-300 uppercase tracking-widest opacity-60 truncate" title="Total RAP BOS">Total RAP BOS</p>
                                        <h3 className="text-2xl font-black italic truncate" title={formatRupiah(totalBosAllocated)}>{formatRupiah(totalBosAllocated)}</h3>
                                    </div>
                                )}
                                <div className="space-y-2 min-w-0">
                                    <p className="text-[10px] font-black text-blue-300 uppercase tracking-widest opacity-60 truncate" title="Total Rencana Belanja">Total Rencana Belanja</p>
                                    <h3 className="text-2xl font-black italic truncate" title={formatRupiah(fundSourceFilter === 'Yayasan' ? (totalExpense - totalExpenseBos) : totalExpense)}>{formatRupiah(fundSourceFilter === 'Yayasan' ? (totalExpense - totalExpenseBos) : totalExpense)}</h3>
                                </div>
                                <div className="space-y-2 min-w-0">
                                    <p className="text-[10px] font-black text-blue-300 uppercase tracking-widest opacity-60 truncate" title="Sisa Dana Strategis">Sisa Dana Strategis</p>
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
                                        <th className="px-6 py-2 text-right">Realisasi RAB</th>
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

                /* DETAIL VIEW (SIDEBAR + TABLE/REVIEW) */
                <div className="flex flex-col lg:flex-row gap-6 min-h-[70vh]">
                    {/* Sidebar */}
                    <div className="w-full lg:w-[320px] space-y-6">
                        {/* Selected Entity Card */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col items-center">
                            <div className="p-3 bg-blue-50 rounded-2xl mb-3">
                                <Building2 size={24} className="text-blue-600" />
                            </div>
                            <h3 className="text-lg font-black text-slate-900 text-center tracking-tight leading-tight">
                                {isConsolidation ? 'Yayasan (Konsolidasi)' : (
                                    selectedUnitId.startsWith('FIELD-')
                                        ? (fields.find(f => f.id === selectedUnitId.replace('FIELD-', ''))?.name)
                                        : (units.find(u => u.id === selectedUnitId)?.name || 'Pilih Unit')
                                )}
                            </h3>
                            <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest mt-1 italic">
                                {isConsolidation ? 'KONSOLIDASI DATA STRATEGIS' : (selectedUnitId.startsWith('FIELD-') ? 'BIDANG STRUKTURAL' : 'UNIT PENDIDIKAN')}
                            </p>
                        </div>

                        {/* Quick Stats Cards in Sidebar */}
                        <div className="grid grid-cols-1 gap-3">
                            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-5 rounded-[2rem] text-white shadow-xl shadow-emerald-100 relative overflow-hidden group">
                                <p className="text-[8px] font-black uppercase tracking-widest opacity-80 mb-1">
                                    {fundSourceFilter === 'BOS' ? 'RAP BOS' : 'RAP'}
                                </p>
                                <h3 className="text-xl font-black italic">
                                    {formatRupiah(fundSourceFilter === 'BOS' ? totalBosAllocated : rapData.totalTarget)}
                                </h3>
                            </div>
                            {isBosRecipient && fundSourceFilter === 'all' && (
                                <div className="bg-gradient-to-br from-indigo-500 to-blue-600 p-5 rounded-[2rem] text-white shadow-xl shadow-indigo-100 relative overflow-hidden group">
                                    <p className="text-[8px] font-black uppercase tracking-widest opacity-80 mb-1">RAP BOS</p>
                                    <h3 className="text-xl font-black italic">{formatRupiah(totalBosAllocated)}</h3>
                                </div>
                            )}
                            <div className="bg-gradient-to-br from-rose-500 to-pink-600 p-5 rounded-[2rem] text-white shadow-xl shadow-rose-100 relative overflow-hidden group">
                                <p className="text-[8px] font-black uppercase tracking-widest opacity-80 mb-1">Rencana RAB (Total)</p>
                                <h3 className="text-xl font-black italic">{formatRupiah(fundSourceFilter === 'BOS' ? totalExpenseBos : (fundSourceFilter === 'Yayasan' ? (totalExpense - totalExpenseBos) : totalExpense))}</h3>
                            </div>
                        </div>

                        {/* Financial Analysis Tooltip / Mini Panel */}
                    </div>

                    {/* Content Component */}
                    <div className="flex-1 bg-white border border-slate-100 rounded-[2rem] shadow-sm overflow-hidden flex flex-col">
                        {/* Tab Switcher */}
                        <div className="bg-slate-50/50 flex border-b border-slate-100">
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
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 p-8 lg:p-12">
                            {activeTab === 'REVIEW' ? renderReviewView() : renderBudgetTable(activeTab === 'INCOME' ? 'income' : 'expense', activeTab === 'INCOME' ? 'Sumber Pendapatan' : 'Mata Anggaran (Biaya)')}
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
                                    description: Array.from(new Set(allComponents.map(c => c.label))).join(', ')
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
                                                    
                                                    return (
                                                        <>
                                                            {draftIndexes.length > 0 && (
                                                                <div className="card p-6 bg-amber-50 border-amber-200 shadow-sm rounded-3xl">
                                                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                                        <div>
                                                                            <h3 className="font-black text-amber-900 text-lg flex items-center gap-2">
                                                                                <Package size={18} /> Rincian Belum Diajukan (Draft)
                                                                            </h3>
                                                                            <p className="text-xs text-amber-700 font-medium mt-1">Ada {draftIndexes.length} rincian yang belum dikirim. Klik tombol di bawah untuk mengajukan RAB ini ke Yayasan untuk direview.</p>
                                                                        </div>
                                                                        <button 
                                                                            onClick={() => handleAjukanDraftsInModal(draftIndexes)}
                                                                            className="px-5 py-3 bg-amber-500 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-md hover:bg-amber-600 transition-colors shrink-0 flex items-center gap-2"
                                                                        >
                                                                            <Send size={16} /> Ajukan RAB ke Yayasan
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {comps.length === 0 ? (
                                                                <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 border-dashed">
                                                                    <Package size={40} className="mx-auto text-slate-300 mb-4 opacity-30" />
                                                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest opacity-50">Belum ada rincian belanja</p>
                                                                    <button
                                                                        onClick={() => { setEntryForm({ label: '', volume: 0, satuan: '', kali: 1, harga: 0, programId: '', semester: '1', months: {}, useBos: fundSourceFilter === 'BOS' }); setEditingCompIdx(null); setShowCompModal(true); }}
                                                                        className="mt-6 px-6 py-3 bg-blue-50 text-blue-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all mx-auto inline-flex items-center gap-2"
                                                                    >
                                                                        <Plus size={16} strokeWidth={3} /> Tambah Rincian Pertama
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <div className="space-y-4">
                                                                    {comps.map((comp, idx) => {
                                                                        const isDraft = comp.status === 'DRAFT' || comp.status === 'REJECTED' || !comp.status;
                                                                        const isApproved = comp.status === 'APPROVED';
                                                                        const isPending = comp.status === 'PENDING';
                                                                        return (
                                                                            <div key={idx} className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                                                                                <div className="flex-1">
                                                                                    <h4 className="font-black text-slate-800 text-base mb-2">{comp.label}</h4>
                                                                                    <div className="flex flex-wrap items-center gap-3">
                                                                                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md line-clamp-1 max-w-[200px]">{allPrograms.find(p => p.id === comp.programId)?.name || 'Tanpa Program'}</span>
                                                                                        <span className="w-1 h-1 rounded-full bg-slate-200" />
                                                                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Vol: {comp.volume} {comp.satuan} &times; {comp.kali}</span>
                                                                                        <span className="w-1 h-1 rounded-full bg-slate-200" />
                                                                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Harga: {formatRupiah(comp.harga)}</span>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="flex items-center gap-6 mt-6 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 border-slate-100">
                                                                                    <div className="text-right">
                                                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic mb-1">Subtotal</p>
                                                                                        <span className="font-black text-slate-900 text-lg">{formatRupiah(comp.total)}</span>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-2 border-l border-slate-100 pl-6 h-full min-h-[40px]">
                                                                                        {(isPending || isApproved) ? (
                                                                                            <div className="flex items-center gap-2">
                                                                                                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${isApproved ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                                                                                    <Lock size={14} /> {isApproved ? 'Disetujui' : 'Menunggu'}
                                                                                                </div>
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
                                                                                                <button onClick={() => { setEntryForm({ programId: '', semester: '1', months: {}, useBos: fundSourceFilter === 'BOS', ...comp }); setEditingCompIdx(idx); setShowCompModal(true); }} className="p-2 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors" title="Edit"><Pencil size={18} /></button>
                                                                                                <button onClick={() => handleRemoveComponent(itemId, item.id, idx)} className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors" title="Hapus"><Trash2 size={18} /></button>
                                                                                                <button onClick={() => handleAjukanDraftsInModal([idx])} className="p-2 bg-amber-500 text-white hover:bg-amber-600 rounded-xl transition-colors shadow-sm ml-1" title="Ajukan Rincian Ini"><Send size={16} /></button>
                                                                                            </>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                    
                                                                    <div className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-slate-50/80 rounded-[2rem] border border-slate-200 border-dashed mt-6 gap-6 md:gap-0">
                                                                        <div className="flex items-center gap-5">
                                                                            <button
                                                                                onClick={() => { setEntryForm({ label: '', volume: 0, satuan: '', kali: 1, harga: 0, programId: '', semester: '1', months: {}, useBos: fundSourceFilter === 'BOS' }); setEditingCompIdx(null); setShowCompModal(true); }}
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
                                                        const basePlanId = `${selectedYearId}-${selectedUnitId}`;
                                                        const planId = `${basePlanId}-${fundSourceFilter === 'BOS' ? 'BOS' : 'YAYASAN'}`;
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
                                                        <h3 className="text-xl font-black italic uppercase tracking-tight">Detail Rincian</h3>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{editingCompIdx !== null ? 'Perbarui Rincian' : 'Tambah Rincian Baru'}</p>
                                                    </div>
                                                    <button onClick={() => setShowCompModal(false)} className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all"><X size={20} /></button>
                                                </div>

                                                <div className="flex-1 overflow-y-auto p-8 lg:p-10 space-y-8">
                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                                        {/* Left Column: Basic Info */}
                                                        <div className="space-y-6">
                                                            <div className="space-y-2">
                                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic ml-1">Keterangan Barang</label>
                                                                <input autoFocus type="text" className="w-full bg-slate-50 border-2 border-slate-100 p-4 font-black text-slate-800 text-sm rounded-2xl outline-none focus:border-blue-500 transition-all shadow-inner" placeholder="Peralatan Kantor..." value={entryForm.label} onChange={e => setEntryForm({ ...entryForm, label: e.target.value })} />
                                                            </div>
                                                            <div className="grid grid-cols-3 gap-4">
                                                                {['volume', 'satuan', 'kali'].map(field => (
                                                                    <div key={field} className="space-y-2">
                                                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic ml-1 capitalize">{field}</label>
                                                                        <input type="text" className="w-full bg-slate-50 border-2 border-slate-100 p-4 font-black text-slate-700 text-sm rounded-2xl outline-none focus:border-blue-500 text-center" value={entryForm[field]} onChange={e => setEntryForm({ ...entryForm, [field]: field === 'satuan' ? e.target.value : e.target.value.replace(/\D/g, '') })} />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-6">
                                                                <div className="space-y-2">
                                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic ml-1">Harga Satuan (Rp)</label>
                                                                    <div className="relative">
                                                                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xs italic">Rp</span>
                                                                        <input type="text" className="w-full bg-slate-50 border-2 border-slate-100 p-4 pl-12 font-black text-slate-900 text-lg rounded-2xl outline-none focus:border-blue-500 transition-all shadow-inner" value={Number(entryForm.harga || 0).toLocaleString('id-ID')} onChange={e => setEntryForm({ ...entryForm, harga: parseFloat(e.target.value.replace(/\D/g, '') || 0) })} />
                                                                    </div>
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic ml-1">Semester</label>
                                                                    <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                                                                        {['1', '2'].map(s => (
                                                                            <button key={s} onClick={() => setEntryForm({ ...entryForm, semester: s })} className={`flex-1 py-3 rounded-xl font-black text-[10px] transition-all ${entryForm.semester === s ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}>SMT {s}</button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="space-y-2">
                                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic ml-1">Program Belanja</label>
                                                                <div className="relative" data-program-dropdown>
                                                                    <div
                                                                        className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-slate-700 text-xs outline-none cursor-pointer flex items-center justify-between"
                                                                        onClick={() => setShowProgramDropdown(v => !v)}
                                                                    >
                                                                        <span className={entryForm.programId ? 'text-slate-700' : 'text-slate-400'}>
                                                                            {entryForm.programId
                                                                                ? expensePrograms?.find(p => p.id === entryForm.programId)?.name || 'Pilih Program...'
                                                                                : 'Pilih Program...'}
                                                                        </span>
                                                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform text-slate-400 ${showProgramDropdown ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"></polyline></svg>
                                                                    </div>
                                                                    {showProgramDropdown && (
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
                                                                        <select className="w-full p-3 bg-emerald-50 border-2 border-emerald-100 rounded-xl text-[10px] font-black outline-none" value={entryForm.bosPosId || ''} onChange={e => setEntryForm({ ...entryForm, bosPosId: e.target.value })}>
                                                                            <option value="">Pilih POS...</option>
                                                                            {bosPosList?.filter(p => !p?.isDeleted).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                                        </select>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <label className="text-[9px] font-black text-emerald-600 uppercase tracking-widest italic ml-1">Tahap BOS</label>
                                                                        <select className="w-full p-3 bg-emerald-50 border-2 border-emerald-100 rounded-xl text-[10px] font-black outline-none" value={entryForm.bosStageId || ''} onChange={e => setEntryForm({ ...entryForm, bosStageId: e.target.value })}>
                                                                            <option value="">Pilih Tahap...</option>
                                                                            {bosStages?.filter(s => !s?.isDeleted).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                                        </select>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            <div className="space-y-2">
                                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic ml-1">Catatan / Justifikasi</label>
                                                                <textarea className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-[11px] italic font-medium min-h-[60px] outline-none focus:border-blue-500" value={entryForm.description || ''} onChange={e => setEntryForm({ ...entryForm, description: e.target.value })} placeholder="Alasan pengadaan rincian ini..." />
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
                                                                <button onClick={handleSyncEntryMonthly} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-2">
                                                                    <RefreshCw size={12} />
                                                                    Sync
                                                                </button>
                                                            </div>

                                                            <div className="grid grid-cols-2 gap-3 flex-1">
                                                                {generateMonths(academicYears.find(a => a.id === selectedYearId)).map((m) => {
                                                                    const mData = entryForm.months?.[m.id] || { m: false, jumlah: 0 };
                                                                    const isSelectable = true;


                                                                    return (
                                                                        <div key={m.id} className={`p-3 rounded-2xl border-2 transition-all ${mData.m ? 'bg-blue-600 border-blue-400' : (isSelectable ? 'bg-white/5 border-white/10 hover:border-blue-500/30' : 'opacity-10 pointer-events-none')}`}>
                                                                            <div className="flex items-center justify-between mb-1.5">
                                                                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{m.shortLabel}</span>
                                                                                <input type="checkbox" checked={mData.m} onChange={e => handleEntryMonthlyUpdate(m.id, 'm', e.target.checked)} className="w-3.5 h-3.5 rounded bg-slate-800 border-slate-700 text-blue-500" />
                                                                            </div>
                                                                            <input type="text" className="w-full bg-transparent font-black text-[11px] outline-none p-0 text-white placeholder-white/20" placeholder="Rp 0" value={mData.jumlah > 0 ? Number(mData.jumlah).toLocaleString('id-ID') : ''} onChange={e => handleEntryMonthlyUpdate(m.id, 'jumlah', parseFloat(e.target.value.replace(/\D/g, '') || 0))} />
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
                            {isSuperAdmin || isAdminBidang ? (
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

