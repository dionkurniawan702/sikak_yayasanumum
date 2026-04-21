import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
    Calendar, Building2, Layers, Save, RefreshCw, 
    ArrowUpCircle, ArrowDownCircle, Info, ChevronRight,
    TrendingUp, Wallet, ShieldCheck, Download, Filter, 
    Send, CheckCircle2, XCircle, AlertCircle, MessageSquare,
    Edit3, PlusCircle, Database, Plus, X,
    Calculator, Trash2, Pencil
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatRupiah } from '../../utils/format';
import { api } from '../../services/api';
import { calculateRAP } from '../../utils/budgetEngine';
import BudgetRow from '../../components/BudgetRow';

// Helper to generate months for an academic year based on its settings
const generateMonths = (ay) => {
    if (!ay) return [];
    
    const months = [];
    const monthNames = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    try {
        // Option 1: Use explicit start and end dates from settings
        if (ay.startDate && ay.endDate) {
            let current = new Date(ay.startDate);
            const end = new Date(ay.endDate);
            
            // Limit to a reasonable range to prevent infinite loops (e.g., 24 months)
            let safetyCounter = 0;
            while (current <= end && safetyCounter < 24) {
                const year = current.getFullYear();
                const monthIdx = current.getMonth();
                const monthNum = monthIdx + 1;
                
                months.push({
                    id: `${year}-${String(monthNum).padStart(2, '0')}`,
                    name: `${monthNames[monthIdx]}-${year}`,
                    label: `${monthNames[monthIdx]} '${String(year).slice(-2)}`,
                    shortLabel: monthNames[monthIdx].substring(0, 3).toUpperCase(),
                    year: year
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
            sequence.forEach((monthNum) => {
                const year = monthNum >= 7 ? startYear : endYear;
                months.push({
                    id: `${year}-${String(monthNum).padStart(2, '0')}`,
                    name: `${monthNames[monthNum - 1]}-${year}`,
                    label: `${monthNames[monthNum - 1]} '${String(year).slice(-2)}`,
                    shortLabel: monthNames[monthNum - 1].substring(0, 3).toUpperCase(),
                    year: year
                });
            });
        }
    } catch (err) {
        console.error('[Month Generation Error]:', err);
    }
    
    return months;
};

export default function RAB() {
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
    const currentUserUnit = units.find(u => u.id === currentUser?.unitId);
    const isBosRecipient = isSuperAdmin || (currentUserUnit && currentUserUnit.receivesBos);

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
    const [fundSourceFilter, setFundSourceFilter] = useState('all');
    const [editingItem, setEditingItem] = useState(null); // { id, name, sourceOfFunds }
    const [isAddingItem, setIsAddingItem] = useState(false);
    const [newItemData, setNewItemData] = useState({ name: '', incomeItemId: '', sourceOfFunds: 'Yayasan' });

    // States for Journal-style component entry
    const [entryForm, setEntryForm] = useState({ label: '', volume: 0, satuan: '', kali: 1, harga: 0 });
    const [editingCompIdx, setEditingCompIdx] = useState(null);
    const [expandedReviewPlans, setExpandedReviewPlans] = useState({});
    const [expandedDashboardPlans, setExpandedDashboardPlans] = useState({});
    const [expandedDetailItems, setExpandedDetailItems] = useState({});

    const toggleReviewPlan = (id) => setExpandedReviewPlans(prev => ({ ...prev, [id]: !prev[id] }));
    const toggleDashboardPlan = (id) => setExpandedDashboardPlans(prev => ({ ...prev, [id]: !prev[id] }));
    const toggleDetailItem = (parentId, itemId) => {
        const key = `${parentId}-${itemId}`;
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

    // Load existing plan when filters change
    useEffect(() => {
        if (!selectedYearId || !selectedUnitId) return;

        const planId = `${selectedYearId}-${selectedUnitId}`;
        const existingPlan = (rabPlans || []).find(p => p.id === planId);

        // ONLY overwrite currentPlan if we switched to a DIFFERENT plan
        // This prevents background syncs from wiping unsaved local work on the same plan
        if (lastPlanIdRef.current !== planId) {
            if (existingPlan) {
                setCurrentPlan({
                    income: existingPlan.income || {},
                    expense: existingPlan.expense || {},
                    status: existingPlan.status || 'DRAFT',
                    rejectionReason: existingPlan.rejectionReason || null
                });

                if ((existingPlan.status === 'APPROVED' || existingPlan.status === 'REJECTED') && !existingPlan.notified) {
                    setShowStatusModal(true);
                }
            } else {
                setCurrentPlan({ income: {}, expense: {}, status: 'DRAFT', rejectionReason: null });
            }
            lastPlanIdRef.current = planId;
        }
    }, [selectedYearId, selectedUnitId, rabPlans]);
    // Compute consolidated data if Yayasan is selected
    const consolidatedPlan = useMemo(() => {
        try {
            if (selectedUnitId !== 'FOUNDATION' || !selectedYearId) return null;
            
            const yearPlans = (rabPlans || []).filter(p => 
                p && p.academicYearId === selectedYearId && 
                p.unitId !== 'FOUNDATION'
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
                // Merge Expense
                const planExpense = plan.expense || {};
                Object.entries(planExpense).forEach(([itemId, data]) => {
                    if (!data) return;
                    if (!consolidated.expense[itemId]) {
                        consolidated.expense[itemId] = JSON.parse(JSON.stringify(data));
                    } else {
                        const existing = consolidated.expense[itemId];
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
            });

            return consolidated;
        } catch (err) {
            console.error('[Consolidation Error]:', err);
            return null;
        }
    }, [rabPlans, selectedYearId, selectedUnitId]);

    // Determine which plan data to display
    const activePlan = (selectedUnitId === 'FOUNDATION' && consolidatedPlan) ? consolidatedPlan : (currentPlan || { income: {}, expense: {}, status: 'DRAFT' });

    const isConsolidation = selectedUnitId === 'FOUNDATION';
    const isLocked = activePlan?.status === 'APPROVED' || activePlan?.status === 'PENDING' || isConsolidation;

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
    const handleItemUpdate = (itemId, field, value) => {
        const type = activeTab === 'INCOME' ? 'income' : 'expense';
        setCurrentPlan(prev => {
            const currentItem = prev[type][itemId] || {
                volume: 0, satuan: '', kali: 1, harga: 0, total: 0, months: {}, components: []
            };
            
            const updatedItem = { ...currentItem, [field]: value };
            
            // Recalculate total if volume, kali, or harga changes (Legacy / Single Mode)
            if (['volume', 'kali', 'harga'].includes(field)) {
                updatedItem.total = (parseFloat(updatedItem.volume) || 0) * 
                                   (parseFloat(updatedItem.kali) || 0) * 
                                   (parseFloat(updatedItem.harga) || 0);
            }
            
            // If we have components, the total is ALWAYS the sum of components
            if (updatedItem.components && updatedItem.components.length > 0) {
                updatedItem.total = updatedItem.components.reduce((sum, c) => sum + (parseFloat(c.total) || 0), 0);
            }
            
            // Special logic if semester changes: auto-toggle checkboxes
            if (field === 'semester') {
                const ay = academicYears.find(ay => ay.id === selectedYearId);
                const yearMonths = generateMonths(ay);
                const monthsData = { ...(updatedItem.months || {}) };
                
                yearMonths.forEach((m, idx) => {
                    const isSemester1 = idx < 6;
                    const targetSemester = value === '1' ? isSemester1 : !isSemester1;
                    monthsData[m.id] = {
                        ...(monthsData[m.id] || { jumlah: 0 }),
                        m: targetSemester
                    };
                });
                updatedItem.months = monthsData;
            }
            
            return {
                ...prev,
                [type]: { ...prev[type], [itemId]: updatedItem }
            };
        });
    };

    const handleComponentUpdate = (itemId, index, field, value) => {
        const type = activeTab === 'INCOME' ? 'income' : 'expense';
        setCurrentPlan(prev => {
            const currentItem = prev[type][itemId] || { components: [] };
            const components = [...(currentItem.components || [])];
            
            // Initialize component if it doesn't exist (though it should by index)
            if (!components[index]) {
                components[index] = { label: '', volume: 0, satuan: '', kali: 1, harga: 0, total: 0 };
            }

            const updatedComp = { ...components[index], [field]: value };

            // Calc subtotal
            if (['volume', 'kali', 'harga'].includes(field)) {
                updatedComp.total = (parseFloat(updatedComp.volume) || 0) * 
                                   (parseFloat(updatedComp.kali) || 0) * 
                                   (parseFloat(updatedComp.harga) || 0);
            }

            components[index] = updatedComp;
            
            const updatedItem = { 
                ...currentItem, 
                components,
                // Always sync top-level total
                total: components.reduce((sum, c) => sum + (parseFloat(c.total) || 0), 0)
            };

            return {
                ...prev,
                [type]: { ...prev[type], [itemId]: updatedItem }
            };
        });
    };

    const handlePushComponent = (itemId) => {
        if (!entryForm.label || !entryForm.volume || !entryForm.harga) {
            setMessage({ type: 'error', text: 'Mohon isi Keterangan, Volume, dan Harga!' });
            setTimeout(() => setMessage(null), 3000);
            return;
        }

        const type = activeTab === 'INCOME' ? 'income' : 'expense';
        const total = (parseFloat(entryForm.volume) || 0) * (parseFloat(entryForm.kali) || 0) * (parseFloat(entryForm.harga) || 0);
        
        const newComp = {
            ...entryForm,
            volume: parseFloat(entryForm.volume),
            kali: parseFloat(entryForm.kali),
            harga: parseFloat(entryForm.harga),
            total
        };

        setCurrentPlan(prev => {
            const currentItem = prev[type][itemId] || { components: [] };
            
            // If item has legacy data and 0 components, convert it first
            let components = currentItem.components && currentItem.components.length > 0 
                ? [...currentItem.components] 
                : [];

            if (editingCompIdx !== null) {
                // Update mode
                components[editingCompIdx] = newComp;
            } else {
                // Add mode
                components.push(newComp);
            }

            const newTotal = components.reduce((sum, c) => sum + (parseFloat(c.total) || 0), 0);
            
            const updatedItem = { 
                ...currentItem, 
                components, 
                total: newTotal
            };

            // If it's a BOS view/item, sync bosAmount too
            if (fundSourceFilter === 'BOS' || editingItem?.sourceOfFunds === 'BOS') {
                updatedItem.useBos = true;
                updatedItem.bosAmount = newTotal;
            }

            return {
                ...prev,
                [type]: {
                    ...prev[type],
                    [itemId]: updatedItem
                }
            };
        });

        // Reset Form & Refocus
        setEntryForm({ label: '', volume: 0, satuan: '', kali: 1, harga: 0 });
        setEditingCompIdx(null);
        if (labelInputRef.current) labelInputRef.current.focus();
    };

    const handleLoadToEdit = (index, component) => {
        setEntryForm({
            label: component.label,
            volume: component.volume,
            satuan: component.satuan,
            kali: component.kali,
            harga: component.harga
        });
        setEditingCompIdx(index);
        if (labelInputRef.current) labelInputRef.current.focus();
    };

    const handleCancelEdit = () => {
        setEntryForm({ label: '', volume: 0, satuan: '', kali: 1, harga: 0 });
        setEditingCompIdx(null);
    };

    const handleAddComponent = (itemId) => {
        const type = activeTab === 'INCOME' ? 'income' : 'expense';
        setCurrentPlan(prev => {
            const currentItem = prev[type][itemId] || { components: [] };
            
            // If item has legacy data and 0 components, convert it first
            let components = currentItem.components && currentItem.components.length > 0 
                ? [...currentItem.components] 
                : [];

            components.push({ label: '', volume: 1, satuan: '', kali: 1, harga: 0, total: 0 });

            const newTotal = components.reduce((sum, c) => sum + (parseFloat(c.total) || 0), 0);
            const updatedItem = { 
                ...currentItem, 
                components, 
                total: newTotal 
            };

            // If it's a BOS view/item, sync bosAmount too
            if (fundSourceFilter === 'BOS' || editingItem?.sourceOfFunds === 'BOS') {
                updatedItem.useBos = true;
                updatedItem.bosAmount = newTotal;
            }

            return {
                ...prev,
                [type]: {
                    ...prev[type],
                    [itemId]: updatedItem
                }
            };
        });
    };

    const handleRemoveComponent = (itemId, index) => {
        const type = activeTab === 'INCOME' ? 'income' : 'expense';
        setCurrentPlan(prev => {
            const currentItem = prev[type][itemId] || { components: [] };
            const components = (currentItem.components || []).filter((_, i) => i !== index);
            
            const newTotal = components.reduce((sum, c) => sum + (parseFloat(c.total) || 0), 0);
            const updatedItem = { 
                ...currentItem, 
                components, 
                total: newTotal 
            };

            // If it's a BOS view/item, sync bosAmount too
            if (fundSourceFilter === 'BOS' || editingItem?.sourceOfFunds === 'BOS') {
                updatedItem.useBos = true;
                updatedItem.bosAmount = newTotal;
            }

            return {
                ...prev,
                [type]: {
                    ...prev[type],
                    [itemId]: updatedItem
                }
            };
        });
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

    const handleMonthlyUpdate = (itemId, monthId, field, value) => {
        const type = activeTab === 'INCOME' ? 'income' : 'expense';
        setCurrentPlan(prev => {
            const currentItem = prev[type][itemId] || {
                volume: 0, satuan: '', kali: 1, harga: 0, total: 0, months: {}
            };
            
            const currentMonths = currentItem.months || {};
            const currentMonthData = currentMonths[monthId] || { jumlah: 0, m: false };
            
            let updatedMonthData = { ...currentMonthData, [field]: value };

            // Logic 1: If unchecking, zero out the amount
            if (field === 'm' && value === false) {
                updatedMonthData.jumlah = 0;
            }
            // Logic 2: If typing an amount > 0, auto-check the month
            if (field === 'jumlah' && (parseFloat(value) || 0) > 0) {
                updatedMonthData.m = true;
            }
            // Logic 3: If typing 0 or empty, uncheck the month
            if (field === 'jumlah' && (parseFloat(value) || 0) <= 0) {
                updatedMonthData.m = false;
            }
            
            const updatedMonths = { ...currentMonths, [monthId]: updatedMonthData };
            
            return {
                ...prev,
                [type]: {
                    ...prev[type],
                    [itemId]: { ...currentItem, months: updatedMonths }
                }
            };
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
            
            dispatch({ type: 'UPDATE_DISTRIBUTION_SETTINGS', payload: { 
                unitId: distributionRule.unitId, 
                incomeItemId: distributionRule.incomeItemId, 
                settings: updatedSettings 
            }});
            await api.pushAction({ type: 'UPDATE_DISTRIBUTION_SETTINGS', payload: { 
                unitId: distributionRule.unitId, 
                incomeItemId: distributionRule.incomeItemId, 
                settings: updatedSettings 
            }}, state);

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

    const handleSave = async () => {
        setIsSaving(true);
        setMessage(null);

        const planId = `${selectedYearId}-${selectedUnitId}`;
        const newPlan = {
            id: planId,
            academicYearId: selectedYearId,
            unitId: selectedUnitId.startsWith('FIELD-') ? null : (selectedUnitId === 'FOUNDATION' ? 'FOUNDATION' : selectedUnitId),
            fieldId: selectedUnitId.startsWith('FIELD-') ? selectedUnitId.replace('FIELD-', '') : null,
            income: currentPlan.income,
            expense: currentPlan.expense,
            status: currentPlan.status, // Preserve status
            rejectionReason: currentPlan.rejectionReason,
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
            dispatch({ type: 'SET_RAB_PLAN', payload: newPlan });
            await api.pushAction({ type: 'SET_RAB_PLAN', payload: newPlan }, state);
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
        const planId = `${selectedYearId}-${selectedUnitId}`;
        const submittedPlan = {
            id: planId,
            academicYearId: selectedYearId,
            unitId: selectedUnitId.startsWith('FIELD-') ? null : (selectedUnitId === 'FOUNDATION' ? 'FOUNDATION' : selectedUnitId),
            fieldId: selectedUnitId.startsWith('FIELD-') ? selectedUnitId.replace('FIELD-', '') : null,
            income: currentPlan.income,
            expense: currentPlan.expense,
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
            const detail = submittedPlan.expense[item.id] || { total: 0 };
            const allocated = rapData.itemAllocations[item.id] || 0;
            if (detail.total <= 0 || allocated === 0) return false;

            const yayasanSpent = detail.total - (parseFloat(detail.bosAmount) || 0);
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
            const spent = parseFloat(detail.bosAmount) || 0;
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
            setMessage({ type: 'success', text: 'RAB telah dikirim ke Yayasan untuk direview.' });
        } catch (error) {
            setMessage({ type: 'error', text: 'Gagal mengirim RAB: ' + error.message });
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

    const handleCancelApproval = async () => {
        if (!selectedYearId || !selectedUnitId) return;
        const planId = `${selectedYearId}-${selectedUnitId}`;
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
        const planId = `${selectedYearId}-${selectedUnitId}`;
        const plan = rabPlans.find(p => p.id === planId);
        if (plan) {
            const updatedPlan = { ...plan, notified: true };
            dispatch({ type: 'SET_RAB_PLAN', payload: updatedPlan });
            api.pushAction({ type: 'SET_RAB_PLAN', payload: updatedPlan }, state);
        }
        setShowStatusModal(false);
    };

    const renderReviewView = () => {
        const pendingPlans = rabPlans.filter(p => p.status === 'PENDING' && p.academicYearId === selectedYearId);

        return (
            <div className="space-y-8 animate-in fade-in duration-500">
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                            <ShieldCheck size={20} />
                        </div>
                        <div>
                            <h4 className="font-black text-slate-900 uppercase tracking-tight italic">Review Pengajuan Unit</h4>
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Daftar unit yang telah mengirimkan rancangan anggaran</p>
                        </div>
                    </div>

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
                                        const total = Object.values(plan.expense || {}).reduce((sum, v) => sum + (v.total || 0), 0);
                                        
                                        // Calculate RAP for this specific plan's unit/field for the row display
                                        let unitId = null;
                                        let fieldId = null;
                                        if (plan.fieldId) fieldId = plan.fieldId;
                                        else unitId = plan.unitId;
                                        
                                        const planRAP = calculateRAP(state, selectedYearId, unitId, fieldId);
                                        
                                        const rowData = {
                                            id: plan.id,
                                            name: unit?.name || 'Unknown',
                                            status: plan.status,
                                            rap: planRAP.totalTarget,
                                            rab: total,
                                            sisa: planRAP.totalTarget - total,
                                            breakdown: Object.entries(plan.expense || {})
                                                .map(([id, detail]) => ({
                                                    id,
                                                    name: (expenseItems.find(e => e.id === id)?.name || id),
                                                    rab: detail.total || 0,
                                                    rap: planRAP.itemAllocations[id] || 0,
                                                    sisa: (planRAP.itemAllocations[id] || 0) - (detail.total || 0)
                                                }))
                                                .sort((a, b) => b.rab - a.rab)
                                                .slice(0, 5)
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
                                                actions={
                                                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                                        <button 
                                                            onClick={() => handleApproval(plan.id, 'APPROVED')}
                                                            className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                                                            title="SETUJUI (ACC)"
                                                        >
                                                            <CheckCircle2 size={14} />
                                                        </button>
                                                        <button 
                                                            onClick={() => setShowRejectionInput(plan.id)}
                                                            className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                                                            title="TOLAK / REVISI"
                                                        >
                                                            <XCircle size={14} />
                                                        </button>
                                                        <button 
                                                            onClick={() => {
                                                                setSelectedUnitId(plan.fieldId ? `FIELD-${plan.fieldId}` : (plan.unitId || 'FOUNDATION'));
                                                                setActiveTab('EXPENSE');
                                                                setShowDashboard(false);
                                                            }}
                                                            className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                                                            title="LIHAT RINCIAN"
                                                        >
                                                            <ChevronRight size={14} />
                                                        </button>
                                                    </div>
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

    const renderBudgetTable = () => (
        <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-y-4">
                <thead>
                    <tr className="text-slate-400/80 text-[10px] font-black uppercase tracking-[0.2em] italic">
                        <th className="px-6 py-1 text-left w-12">#</th>
                        <th className="px-6 py-1 text-left">Item pengeluaran</th>
                        <th className="px-6 py-1 text-center">Semester</th>
                        <th className="px-6 py-1 text-right">Limit</th>
                        <th className="px-6 py-1 text-right">Draft RAB</th>
                        <th className="px-6 py-2 text-right">Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredExpenseItems.filter(item => {
                        if (searchTerm) return item.name.toLowerCase().includes(searchTerm.toLowerCase());
                        return true;
                    }).filter(item => {
                        if (fundSourceFilter === 'Yayasan') {
                            // Hide items that are strictly BOS OR items that have a BOS allocation for this unit
                            return item.sourceOfFunds !== 'BOS' && !bosItemMap[item.id];
                        }
                        if (fundSourceFilter === 'BOS') return !!bosItemMap[item.id];
                        return true;
                    }).map((item, index) => {
                        const detail = activePlan.expense[item.id] || { total: 0, semester: '1', bosAmount: 0, useBos: false };
                        
                        const allocated = fundSourceFilter === 'BOS' 
                            ? (bosItemMap[item.id] || 0) 
                            : (rapData.itemAllocations[item.id] || 0);

                        const draftValue = fundSourceFilter === 'BOS' 
                            ? (parseFloat(detail.bosAmount) || 0) 
                            : (detail.total - (detail.useBos ? (parseFloat(detail.bosAmount) || 0) : 0));

                        const isOver = draftValue > (allocated + 100);
                        const progress = allocated > 0 ? (draftValue / allocated * 100) : 0;
                        
                        return (
                            <tr key={item.id} className="group bg-white hover:bg-slate-50 transition-all duration-300">
                                <td className="px-6 py-4 first:rounded-l-[2rem] border-y border-l border-slate-100 font-black text-slate-300 text-xs italic">
                                    {(index + 1).toString().padStart(2, '0')}
                                </td>
                                <td className="px-6 py-4 border-y border-slate-100">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-4 rounded-2xl bg-slate-50 group-hover:bg-white transition-all shadow-sm ${detail.total > 0 ? 'text-indigo-600' : 'text-slate-300'}`}>
                                            <TrendingUp size={18} />
                                        </div>
                                        <div>
                                            <p className="font-black text-slate-800 text-sm tracking-tight mb-1 group-hover:text-indigo-900">{item.name}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic leading-none">{item.sourceOfFunds || 'Yayasan'}</p>
                                                {detail.useBos && (
                                                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-md border border-emerald-100 text-[8px] font-black uppercase tracking-widest flex items-center gap-1">
                                                        <Wallet size={10} />
                                                        BOS: {formatRupiah(detail.bosAmount)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 border-y border-slate-100 text-center">
                                    <span className="px-3 py-1 bg-slate-50 rounded-full font-black text-[9px] text-slate-400">SMT {detail.semester || '1'}</span>
                                </td>
                                <td className="px-6 py-4 border-y border-slate-100 text-right">
                                    <p className="font-black text-slate-700 text-xs italic">{formatRupiah(allocated)}</p>
                                </td>
                                <td className="px-6 py-4 border-y border-slate-100 text-right">
                                    <div className="flex flex-col items-end gap-1">
                                        <p className={`font-black text-sm italic ${isOver ? 'text-rose-600 animate-pulse' : (draftValue > 0 ? 'text-indigo-600' : 'text-slate-300')}`}>
                                            {formatRupiah(draftValue)}
                                        </p>
                                        {allocated > 0 && (
                                            <div className="w-24 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                <div className={`h-full transition-all ${isOver ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(progress, 100)}%` }} />
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 border-y border-r border-slate-100 last:rounded-r-[2rem] text-right">
                                    <button 
                                        onClick={() => setEditingItem(item)}
                                        disabled={(() => {
                                            if (isSuperAdmin) return false;
                                            if (isLocked) return true;

                                            const isAdminUnit = currentUser?.role === 'admin_unit';
                                            const isAdminBidang = currentUser?.role === 'admin_bidang';
                                            const sdmField = fields.find(f => f.name === 'Bidang SDM');
                                            const isSdmAdmin = isAdminBidang && currentUser?.fieldId === sdmField?.id;

                                            const financeField = fields.find(f => f.name === 'Bidang Keuangan');
                                            const isFinanceAdmin = isAdminBidang && currentUser?.fieldId === financeField?.id;

                                            const sarprasField = fields.find(f => f.name === 'Bidang Sarpras');
                                            const isSarprasAdmin = isAdminBidang && currentUser?.fieldId === sarprasField?.id;

                                            // Special Logic: Shared Edit for Building/Sarpras
                                            if (item.name === 'Gedung' || item.name === 'Perawatan Sarpras dan Bangunan') {
                                                if (isAdminUnit || isSarprasAdmin) return false;
                                            }

                                            // Special Logic: Shared Edit for Payroll (Penggajian)
                                            if (item.name === 'Penggajian') {
                                                if (isAdminUnit || isSdmAdmin) return false;
                                            }

                                            // Special Logic: Development (Pengembangan (umum))
                                            if (item.name === 'Pengembangan (umum)') {
                                                if (isFinanceAdmin) return false;
                                                return true; 
                                            }

                                            return false;
                                        })()}
                                        className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95 ${
                                            (() => {
                                                if (isSuperAdmin) return false;
                                                if (isLocked) return true;
                                                const isAdminUnit = currentUser?.role === 'admin_unit';
                                                const isAdminBidang = currentUser?.role === 'admin_bidang';
                                                const sdmField = fields.find(f => f.name === 'Bidang SDM');
                                                const isSdmAdmin = isAdminBidang && currentUser?.fieldId === sdmField?.id;
                                                const financeField = fields.find(f => f.name === 'Bidang Keuangan');
                                                const isFinanceAdmin = isAdminBidang && currentUser?.fieldId === financeField?.id;
                                                const sarprasField = fields.find(f => f.name === 'Bidang Sarpras');
                                                const isSarprasAdmin = isAdminBidang && currentUser?.fieldId === sarprasField?.id;

                                                if ((item.name === 'Gedung' || item.name === 'Perawatan Sarpras dan Bangunan') && (isAdminUnit || isSarprasAdmin)) return false;
                                                if (isAdminUnit && (item.name === 'Gedung' || item.name === 'Perawatan Sarpras dan Bangunan')) return true;
                                                if (item.name === 'Penggajian' && (isAdminUnit || isSdmAdmin)) return false;
                                                if (item.name === 'Pengembangan (umum)' && isFinanceAdmin) return false;
                                                if (item.name === 'Pengembangan (umum)') return true;
                                                return false;
                                            })()
                                            ? 'bg-slate-100 text-slate-300 shadow-none' 
                                            : 'bg-indigo-600 text-white shadow-indigo-100 hover:bg-slate-900 group-hover:shadow-indigo-200'
                                        }`}
                                    >
                                        {(() => {
                                             if (isSuperAdmin) return 'ATUR BUDGET';
                                             if (isLocked) return 'TERKUNCI';
                                             const isAdminUnit = currentUser?.role === 'admin_unit';
                                             const isAdminBidang = currentUser?.role === 'admin_bidang';
                                             const sdmField = fields.find(f => f.name === 'Bidang SDM');
                                             const isSdmAdmin = isAdminBidang && currentUser?.fieldId === sdmField?.id;
                                             const financeField = fields.find(f => f.name === 'Bidang Keuangan');
                                             const isFinanceAdmin = isAdminBidang && currentUser?.fieldId === financeField?.id;
                                             const sarprasField = fields.find(f => f.name === 'Bidang Sarpras');
                                             const isSarprasAdmin = isAdminBidang && currentUser?.fieldId === sarprasField?.id;

                                             if ((item.name === 'Gedung' || item.name === 'Perawatan Sarpras dan Bangunan') && (isAdminUnit || isSarprasAdmin)) return 'ATUR BUDGET';
                                             if (item.name === 'Gedung' || item.name === 'Perawatan Sarpras dan Bangunan') return 'HANYA LIHAT';
                                             if (item.name === 'Penggajian' && (isAdminUnit || isSdmAdmin)) return 'ATUR BUDGET';
                                             if (item.name === 'Pengembangan (umum)') return isFinanceAdmin ? 'ATUR BUDGET' : 'HANYA LIHAT';
                                             return 'ATUR BUDGET';
                                        })()}
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

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

    const totalIncome = useMemo(() => 
        Object.values(activePlan?.income || {}).reduce((sum, val) => sum + (val?.total || 0), 0)
    , [activePlan?.income]);

    const totalExpense = useMemo(() => 
        Object.values(activePlan?.expense || {}).reduce((sum, val) => sum + (val?.total || 0), 0)
    , [activePlan?.expense]);

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

    const bosItemMap = useMemo(() => {
        const unitId = selectedUnitId.startsWith('FIELD-') ? null : (selectedUnitId === 'FOUNDATION' ? null : selectedUnitId);
        if (!unitId || !selectedYearId) return {};
        
        return (bosAllocations || []).filter(a => 
            !a.isDeleted && 
            a.academicYearId === selectedYearId && 
            a.unitId === unitId
        ).reduce((acc, a) => {
            acc[a.expenseItemId] = (acc[a.expenseItemId] || 0) + (parseFloat(a.amount) || 0);
            return acc;
        }, {});
    }, [bosAllocations, selectedYearId, selectedUnitId]);

    const totalExpenseBos = useMemo(() => {
        return Object.values(activePlan?.expense || {}).reduce((sum, val) => {
            return sum + (val?.useBos ? (parseFloat(val?.bosAmount) || 0) : 0);
        }, 0);
    }, [activePlan?.expense]);

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
                                className={`p-3 rounded-lg font-black text-xs transition-all flex items-center gap-2 shadow-sm ${
                                    showDashboard 
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
                                        const isPending = (rabPlans || []).some(p => p.unitId === u.id && p.status === 'PENDING' && p.academicYearId === selectedYearId);
                                        return (
                                            <option key={u.id} value={u.id}>
                                                {u.name} {isPending ? '🔴' : ''}
                                            </option>
                                        );
                                    })}
                                </optgroup>
                                <optgroup label="BIDANG / LAPANGAN">
                                    {fields.map(f => {
                                        const isPending = (rabPlans || []).some(p => p.fieldId === f.id && p.status === 'PENDING' && p.academicYearId === selectedYearId);
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
                        {!isConsolidation && (
                            <button 
                                onClick={handleSubmitReview}
                                disabled={isSaving || !selectedYearId || isLocked}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-lg font-black text-xs transition-all shadow-md disabled:opacity-50"
                            >
                                KIRIM KE YAYASAN
                            </button>
                        )}
                        {/* Button TAMBAH ITEM RAB dihapus agar input hanya melalui logika otomatis (Konfigurasi Peruntukan) */}
                        {/* {!isConsolidation && !isLocked && (
                            <button 
                                onClick={() => {
                                    const availableFunds = rapData.totalTarget - totalExpense;
                                    if (availableFunds <= 100) {
                                        window.alert(`Anggaran/Dana tidak tersedia untuk penambahan item baru.\nSisa saldo saat ini: ${formatRupiah(availableFunds)}`);
                                    } else {
                                        setIsAddingItem(true);
                                    }
                                }}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-black text-xs transition-all shadow-md flex items-center gap-2"
                            >
                                <PlusCircle size={14} />
                                TAMBAH ITEM RAB
                            </button>
                        )} */}
                    </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-6 bg-slate-50 border border-slate-200 rounded-2xl shadow-inner">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status Pengajuan</p>
                        <div className="flex items-center justify-between">
                            <p className={`font-black uppercase tracking-tight ${
                                activePlan.status === 'APPROVED' ? 'text-emerald-600' : 
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
                    {/* Hero Card: Yayasan Consolidation */}
                    <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-[2.5rem] p-8 lg:p-12 text-white shadow-2xl relative overflow-hidden ring-8 ring-slate-100">
                        <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
                            <Building2 size={240} />
                        </div>
                        <div className="relative z-10 max-w-4xl">
                            <div className="flex items-center gap-4 mb-6">
                                <span className="px-5 py-2 bg-blue-500 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-blue-500/20">
                                    IKHTISAR YAYASAN
                                </span>
                                <span className="text-slate-400 font-bold text-xs uppercase tracking-widest italic">Tahun Ajaran {academicYears.find(ay => ay.id === selectedYearId)?.name}</span>
                            </div>
                            
                            <h2 className="text-4xl lg:text-5xl font-black tracking-tighter italic leading-none mb-8">
                                Konsolidasi <span className="text-blue-400">Anggaran</span>
                            </h2>
                            
                            <div className={`grid grid-cols-1 ${isBosRecipient ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-8`}>
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-blue-300 uppercase tracking-widest opacity-60">Total RAP</p>
                                    <h3 className="text-2xl font-black italic">{formatRupiah(rapData.totalTarget)}</h3>
                                </div>
                                {isBosRecipient && (
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black text-emerald-300 uppercase tracking-widest opacity-60">Total RAP BOS</p>
                                        <h3 className="text-2xl font-black italic">{formatRupiah(totalBosAllocated)}</h3>
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-blue-300 uppercase tracking-widest opacity-60">Total Rencana Belanja</p>
                                    <h3 className="text-2xl font-black italic">{formatRupiah(totalExpense)}</h3>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-blue-300 uppercase tracking-widest opacity-60">Sisa Dana Strategis</p>
                                    <h3 className={`text-2xl font-black italic ${balance < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
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
                                        const planId = `${selectedYearId}-${item.isField ? `FIELD-${item.id}` : item.id}`;
                                        const plan = rabPlans.find(p => p.id === planId);
                                        const status = plan?.status || 'EMPTY';
                                        const total = Object.values(plan?.expense || {}).reduce((sum, v) => sum + (v?.total || 0), 0);
                                        
                                        // Dynamic RAP calculation for the row
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
                                                    rab: detail.total || 0,
                                                    rap: itemRAP.itemAllocations[id] || 0,
                                                    sisa: (itemRAP.itemAllocations[id] || 0) - (detail.total || 0)
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
                            {activeTab === 'REVIEW' ? renderReviewView() : renderBudgetTable()}
                        </div>
                    </div>
                </div>
            )}

            {/* Float Info Box */}
            {message && (
                <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-8 py-5 rounded-[2rem] shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-10 duration-500 z-[2000] ${
                    message.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
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
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setEditingItem(null)} />
                    <div className="bg-white rounded-[3rem] w-full max-w-7xl relative z-10 shadow-2xl overflow-hidden animate-in zoom-in duration-300 flex flex-col max-h-[90vh]">
                        {(() => {
                            const type = activeTab === 'INCOME' ? 'income' : 'expense';
                            const item = activePlan[type][editingItem.id] || { total: 0, bosAmount: 0, useBos: false, components: [], months: {} };
                            return (
                                <>
                        {/* Modal Header */}
                        <div className="p-8 lg:p-10 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 tracking-tight italic uppercase">{editingItem.name}</h2>
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-1">
                                    Sumber Dana: {editingItem.sourceOfFunds || 'Umum'} • TA {academicYears.find(ay => ay.id === selectedYearId)?.name}
                                </p>
                            </div>
                            <div className="flex items-center gap-4">
                                {(() => {
                                    const detail = activePlan[type][editingItem.id] || { total: 0, bosAmount: 0, useBos: false };
                                    const allocated = rapData.itemAllocations[editingItem.id] || 0;
                                    const yayasanSpent = Math.max(0, detail.total - (detail.useBos ? (parseFloat(detail.bosAmount) || 0) : 0));
                                    const isOver = yayasanSpent > (allocated + 100);
                                    
                                    if (isOver) {
                                        return (
                                            <div className="px-6 py-3 bg-rose-50 border-2 border-rose-200 rounded-2xl flex items-center gap-3 text-rose-600 font-black text-xs animate-bounce">
                                                <AlertCircle size={18} />
                                                DILARANG: BEBAN YAYASAN MELEBIHI LIMIT!
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

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-8 lg:p-10 space-y-8">
                            {/* Section 1: Basic Info & Program (Tidied Up) */}
                            <div className="p-8 bg-slate-50/30 rounded-[2.5rem] border border-slate-100/50 shadow-sm space-y-6">
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    <div className="lg:col-span-1 space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Program Belanja</label>
                                        <select 
                                            className="w-full p-4 bg-white border-2 border-slate-100 rounded-2xl font-black text-slate-700 outline-none focus:border-blue-500 transition-all shadow-sm"
                                            value={activePlan[type][editingItem.id]?.programId || ''}
                                            onChange={e => handleItemUpdate(editingItem.id, 'programId', e.target.value)}
                                        >
                                            <option value="">Pilih Program Belanja...</option>
                                            {expensePrograms?.filter(p => !p?.isDeleted)?.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            )) || <option disabled>Tidak ada program tersedia</option>}
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Periode Semester</label>
                                        <select 
                                            className="w-full p-4 bg-white border-2 border-slate-100 rounded-2xl font-black text-slate-700 outline-none focus:border-blue-500 transition-all shadow-sm"
                                            value={activePlan[type][editingItem.id]?.semester || '1'}
                                            onChange={e => handleItemUpdate(editingItem.id, 'semester', e.target.value)}
                                        >
                                            <option value="1">Semester 1 (Ganjil)</option>
                                            <option value="2">Semester 2 (Genap)</option>
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sumber Dana & Status</label>
                                        <div className="flex items-center gap-3 h-[58px]">
                                            {isBosRecipient && fundSourceFilter === 'all' && (
                                                <button 
                                                    onClick={() => {
                                                        const detail = activePlan[type][editingItem.id] || {};
                                                        const nextState = !detail.useBos;
                                                        handleItemUpdate(editingItem.id, 'useBos', nextState);
                                                        if (nextState && (detail.bosAmount === undefined)) handleItemUpdate(editingItem.id, 'bosAmount', 0);
                                                    }}
                                                    className={`flex-1 h-full rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-3 border-2 ${
                                                        activePlan[type][editingItem.id]?.useBos 
                                                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-100' 
                                                            : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                                                    }`}
                                                >
                                                    <Wallet size={14} />
                                                    {activePlan[type][editingItem.id]?.useBos ? 'DANA BOS : ON' : 'DANA BOS : OFF'}
                                                </button>
                                            )}
                                            <div className={`flex-1 h-full rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 border-2 ${currentPlan.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                                                {currentPlan.status === 'APPROVED' ? <CheckCircle2 size={14}/> : <div className="w-2 h-2 rounded-full bg-slate-300 animate-pulse" />}
                                                {currentPlan.status === 'APPROVED' ? 'Disetujui' : 'Draft'}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {(() => {
                                    const detail = activePlan[type][editingItem.id] || {};
                                    const isBosView = fundSourceFilter === 'BOS';
                                    const isYayasanView = fundSourceFilter === 'Yayasan';
                                    const showBos = isBosView || (detail.useBos && !isYayasanView);

                                    if (showBos) {
                                        return (
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-slate-100/50 animate-in fade-in slide-in-from-top-2 duration-300">
                                                {!isBosView && (
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest ml-1 flex justify-between">
                                                            Porsi Dana BOS (Rp)
                                                        </label>
                                                        <div className="relative">
                                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400 font-black text-xs italic">Rp</span>
                                                            <input 
                                                                type="text"
                                                                className="w-full p-4 pl-10 bg-emerald-50/50 border-2 border-emerald-100 rounded-2xl font-black text-slate-700 outline-none focus:border-emerald-500 transition-all"
                                                                value={parseInt(detail.bosAmount || 0).toLocaleString('id-ID')}
                                                                onChange={e => handleItemUpdate(editingItem.id, 'bosAmount', parseInt(e.target.value.replace(/\D/g, '') || 0))}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest ml-1">POS BOS</label>
                                                    <select 
                                                        className="w-full p-4 bg-emerald-50/50 border-2 border-emerald-100 rounded-2xl font-black text-slate-700 text-xs outline-none focus:border-emerald-500 transition-all shadow-sm"
                                                        value={detail.bosPosId || ''}
                                                        onChange={e => handleItemUpdate(editingItem.id, 'bosPosId', e.target.value)}
                                                    >
                                                        <option value="">Pilih POS...</option>
                                                        {bosPosList?.filter(p => !p?.isDeleted)?.map(p => (
                                                            <option key={p.id} value={p.id}>{p.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest ml-1">Tahap Pencairan</label>
                                                    <select 
                                                        className="w-full p-4 bg-emerald-50/50 border-2 border-emerald-100 rounded-2xl font-black text-slate-700 text-xs outline-none focus:border-emerald-500 transition-all shadow-sm"
                                                        value={detail.bosStageId || ''}
                                                        onChange={e => handleItemUpdate(editingItem.id, 'bosStageId', e.target.value)}
                                                    >
                                                        <option value="">Pilih Tahap...</option>
                                                        {bosStages?.filter(s => !s?.isDeleted && (s?.academicYearId === selectedYearId || !s?.academicYearId))?.map(s => (
                                                            <option key={s.id} value={s.id}>{s.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}
                            </div>

                                {/* Unit Peruntukan (Bottom-Full width in Section 1) */}
                                {selectedUnitId.startsWith('FIELD-') && ['Penggajian', 'Gedung', 'Perawatan Sarpras'].some(n => editingItem.name.includes(n)) && (
                                    <div className="md:col-span-2 space-y-2 pt-2 border-t border-slate-100 animate-in slide-in-from-bottom-2">
                                        <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                                            <Building2 size={12} />
                                            Unit Peruntukan Belanja (Penting)
                                        </label>
                                        <select 
                                            className="w-full p-4 bg-blue-50 border-2 border-blue-100 rounded-2xl font-black text-slate-700 outline-none focus:border-blue-500 transition-all"
                                            value={activePlan[type][editingItem.id]?.targetUnitId || ''}
                                            onChange={e => handleItemUpdate(editingItem.id, 'targetUnitId', e.target.value)}
                                        >
                                            <option value="">Pilih Unit Penerima Manfaat...</option>
                                            {(() => {
                                                const fieldId = selectedUnitId.replace('FIELD-', '');
                                                const fieldUnits = units.filter(u => !u.isDeleted && u.fieldId === fieldId);
                                                const displayUnits = fieldUnits.length > 0 ? fieldUnits : units.filter(u => !u.isDeleted);
                                                return displayUnits;
                                            })().map(u => (
                                                <option key={u.id} value={u.id}>{u.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                            {/* Section 2: Calculation Breakdown (Journal Style) */}
                            <div className="p-8 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm space-y-10">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                                            <Calculator size={20} />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest italic leading-none">Perhitungan Anggaran</h4>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1 italic">Line Item Entry System</p>
                                        </div>
                                    </div>
                                    {editingCompIdx !== null && (
                                        <button 
                                            onClick={handleCancelEdit}
                                            className="px-4 py-2 bg-rose-50 text-rose-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all"
                                        >
                                            Batal Edit
                                        </button>
                                    )}
                                </div>

                                {/* INPUT FORM (Journal Style) */}
                                <div className={`p-8 rounded-[2rem] border-2 transition-all duration-500 ${editingCompIdx !== null ? 'bg-indigo-50/50 border-indigo-100' : 'bg-slate-50 border-slate-50'}`}>
                                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                                        <div className="lg:col-span-2 space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Keterangan / Label Rincian</label>
                                            <input 
                                                ref={labelInputRef}
                                                type="text"
                                                className="w-full p-4 bg-white border-2 border-transparent rounded-2xl font-black text-slate-700 outline-none focus:border-blue-500 transition-all shadow-sm"
                                                value={entryForm.label}
                                                onChange={e => setEntryForm({...entryForm, label: e.target.value})}
                                                placeholder="Contoh: Honor GKB, Tunjangan, dll"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Volume</label>
                                            <input 
                                                type="number"
                                                className="w-full p-4 bg-white border-2 border-transparent rounded-2xl font-black text-slate-700 outline-none focus:border-blue-500 transition-all shadow-sm"
                                                value={entryForm.volume}
                                                onChange={e => setEntryForm({...entryForm, volume: e.target.value})}
                                                placeholder="0"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Satuan</label>
                                            <input 
                                                type="text"
                                                className="w-full p-4 bg-white border-2 border-transparent rounded-2xl font-black text-slate-700 outline-none focus:border-blue-500 transition-all shadow-sm uppercase placeholder:lowercase"
                                                value={entryForm.satuan}
                                                onChange={e => setEntryForm({...entryForm, satuan: e.target.value})}
                                                placeholder="org/jam/unit"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kali (Freq)</label>
                                            <input 
                                                type="number"
                                                className="w-full p-4 bg-white border-2 border-transparent rounded-2xl font-black text-slate-700 outline-none focus:border-blue-500 transition-all shadow-sm"
                                                value={entryForm.kali}
                                                onChange={e => setEntryForm({...entryForm, kali: e.target.value})}
                                                placeholder="0"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Harga Satuan</label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 font-black text-xs italic">Rp</span>
                                                <input 
                                                    type="text"
                                                    inputMode="numeric"
                                                    className="w-full p-4 pl-10 bg-white border-2 border-transparent rounded-2xl font-black text-slate-700 outline-none focus:border-blue-500 transition-all shadow-sm"
                                                    value={entryForm.harga !== undefined && entryForm.harga !== null ? Number(entryForm.harga).toLocaleString('id-ID') : '0'}
                                                    onChange={e => {
                                                        const numeric = e.target.value.replace(/\D/g, '');
                                                        setEntryForm({...entryForm, harga: numeric ? parseFloat(numeric) : 0});
                                                    }}
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>
                                        <div className="lg:col-span-1 flex items-end">
                                            <button 
                                                onClick={() => handlePushComponent(editingItem.id)}
                                                className={`w-full py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3 ${
                                                    editingCompIdx !== null 
                                                    ? 'bg-indigo-600 text-white shadow-indigo-100' 
                                                    : 'bg-blue-600 text-white shadow-blue-100'
                                                }`}
                                            >
                                                {editingCompIdx !== null ? <Save size={16} /> : <Plus size={16} />}
                                                {editingCompIdx !== null ? 'Perbarui Baris' : 'Tambahkan Baris'}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* LIST OF SAVED COMPONENTS */}
                                <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest italic">Ringkasan Daftar Rincian (Summary Table)</h4>
                                    </div>
                                    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg">
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-900 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">
                                                <tr>
                                                    <th className="px-6 py-5">Keterangan / Rincian</th>
                                                    <th className="px-6 py-5 text-center">Volume</th>
                                                    <th className="px-6 py-5 text-center">Satuan</th>
                                                    <th className="px-6 py-5 text-center">Kali</th>
                                                    <th className="px-6 py-5 text-right">Harga Satuan</th>
                                                    <th className="px-6 py-5 text-right">Subtotal</th>
                                                    <th className="px-6 py-5 text-center">Aksi</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 italic">
                                                {(() => {
                                                    const item = activePlan[type][editingItem.id] || {};
                                                    const comps = item.components || [];
                                                    
                                                    if (comps.length === 0) {
                                                        return (
                                                            <tr>
                                                                <td colSpan={7} className="px-6 py-12 text-center text-slate-300 font-black text-xs uppercase tracking-widest italic opacity-50">
                                                                    Belum ada rincian belanja terinput...
                                                                </td>
                                                            </tr>
                                                        );
                                                    }

                                                    return comps.map((comp, idx) => (
                                                        <tr key={idx} className={`group hover:bg-slate-50 transition-colors ${editingCompIdx === idx ? 'bg-indigo-50/30' : ''}`}>
                                                            <td className="px-6 py-4">
                                                                <p className="font-black text-slate-800 text-xs tracking-tight">{comp.label}</p>
                                                            </td>
                                                            <td className="px-6 py-4 text-center font-black text-slate-600 text-[11px]">{comp.volume}</td>
                                                            <td className="px-6 py-4 text-center font-black text-slate-400 text-[10px] uppercase">{comp.satuan || '-'}</td>
                                                            <td className="px-6 py-4 text-center font-black text-slate-600 text-[11px]">{comp.kali || 1}</td>
                                                            <td className="px-6 py-4 text-right font-black text-slate-500 text-[11px]">{formatRupiah(comp.harga)}</td>
                                                            <td className="px-6 py-4 text-right font-black text-slate-900 text-xs">{formatRupiah(comp.total)}</td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center justify-center gap-2">
                                                                    <button 
                                                                        onClick={() => handleLoadToEdit(idx, comp)}
                                                                        className="p-2 text-slate-300 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-all"
                                                                    >
                                                                        <Pencil size={14} />
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => handleRemoveComponent(editingItem.id, idx)}
                                                                        className="p-2 text-slate-300 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-all"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ));
                                                })()}
                                            </tbody>
                                            {(() => {
                                                const item = activePlan[type][editingItem.id] || {};
                                                const total = item.total || 0;
                                                if (!item.components || item.components.length === 0) return null;
                                                return (
                                                    <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                                                        <tr>
                                                            <td colSpan={5} className="px-6 py-5 font-black text-[11px] uppercase tracking-widest italic text-slate-500">Total Akumulasi Rincian</td>
                                                            <td className="px-6 py-5 text-right font-black text-sm italic text-slate-900">{formatRupiah(total)}</td>
                                                            <td></td>
                                                        </tr>
                                                    </tfoot>
                                                );
                                            })()}
                                        </table>
                                    </div>
                                    <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                                        <Info size={16} className="text-amber-600 shrink-0" />
                                        <p className="text-[10px] font-bold text-amber-800 tracking-tight leading-relaxed italic">
                                            Periksa kembali daftar di atas. Total Akumulasi Rincian harus sama dengan alokasi bulanan yang Anda tentukan di bawah ini.
                                        </p>
                                    </div>
                                </div>

                                {/* Monthly Breakdown Table */}
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight italic">Rincian Alokasi Per Bulan</h4>
                                            <button 
                                                onClick={() => handleResetBudget(editingItem.id)}
                                                className="px-4 py-1.5 bg-rose-50 text-rose-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all flex items-center gap-2 border border-rose-100"
                                            >
                                                <Trash2 size={12} />
                                                KOSONGKAN BULAN
                                            </button>
                                        </div>
                                        <div className="px-4 py-1 bg-slate-900 text-white rounded-full text-[9px] font-black uppercase tracking-widest">
                                            Periode Aktif: {months.length} Bulan
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                        {months.map(m => {
                                            const mData = activePlan[type][editingItem.id]?.months?.[m.id] || { jumlah: 0, m: false };
                                            const jumlahVal = parseFloat(mData.jumlah) || 0;
                                            return (
                                                <div key={m.id} className={`p-4 rounded-2xl border flex flex-col gap-3 transition-all ${
                                                    jumlahVal > 0 
                                                        ? 'bg-blue-50 border-blue-200 shadow-sm' 
                                                        : 'bg-slate-50 border-slate-100'
                                                }`}>
                                                    <div className="flex items-center justify-between">
                                                        <span className={`text-[10px] font-black uppercase tracking-widest ${
                                                            jumlahVal > 0 ? 'text-blue-600' : 'text-slate-400'
                                                        }`}>
                                                            {m.label}
                                                        </span>
                                                        <input 
                                                            type="checkbox"
                                                            checked={mData.m}
                                                            onChange={e => handleMonthlyUpdate(editingItem.id, m.id, 'm', e.target.checked)}
                                                            className="w-4 h-4 rounded text-blue-600"
                                                        />
                                                    </div>
                                                    {/* Formatted rupiah input */}
                                                    <input 
                                                        type="text"
                                                        inputMode="numeric"
                                                        className={`w-full bg-transparent font-black text-slate-800 outline-none border-b-2 border-dashed pb-1 transition-all text-right ${
                                                            jumlahVal > 0 
                                                                ? 'border-blue-400 text-blue-800' 
                                                                : 'border-slate-200 focus:border-blue-500'
                                                        }`}
                                                        value={jumlahVal > 0 ? jumlahVal.toLocaleString('id-ID') : ''}
                                                        onChange={e => {
                                                            const numeric = e.target.value.replace(/\D/g, '');
                                                            handleMonthlyUpdate(editingItem.id, m.id, 'jumlah', numeric ? parseFloat(numeric) : 0);
                                                        }}
                                                        placeholder="0"
                                                    />
                                                    {/* Per-month formatted hint */}
                                                    {jumlahVal > 0 && (
                                                        <span className="text-[9px] font-bold text-blue-500 text-right">
                                                            Rp {jumlahVal.toLocaleString('id-ID')}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Live Running Total */}
                                    {(() => {
                                        const monthsData = item.months || {};
                                        const monthlyTotal = Object.values(monthsData).reduce((sum, m) => sum + (m?.m ? (parseFloat(m?.jumlah) || 0) : 0), 0);
                                        const activeMonths = Object.values(monthsData).filter(m => m.m).length;

                                        return (
                                            <div className={`flex flex-col md:flex-row items-center justify-between gap-6 px-8 py-6 rounded-3xl ${
                                                monthlyTotal > 0 ? 'bg-emerald-50 border-2 border-emerald-200 shadow-lg shadow-emerald-500/5' : 'bg-slate-100 border border-dashed border-slate-300'
                                            }`}>
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-3 h-3 rounded-full ${ monthlyTotal > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400' }`} />
                                                    <div>
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 leading-none mb-1">Total Alokasi Bulanan</p>
                                                        <p className="text-[10px] text-slate-400 font-bold">{activeMonths} bulan terpilih</p>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex items-center gap-8">
                                                    <div className="text-right">
                                                        <p className={`text-2xl font-black tabular-nums leading-none ${ monthlyTotal > 0 ? 'text-emerald-700' : 'text-slate-400' }`}>
                                                            Rp {monthlyTotal.toLocaleString('id-ID')}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        {(() => {
                            const monthsData = item.months || {};
                            const monthlyTotal = Object.values(monthsData).reduce((sum, m) => sum + (m?.m ? (parseFloat(m?.jumlah) || 0) : 0), 0);

                            return (
                                <div className="p-8 bg-slate-900 flex items-center justify-between text-white">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50">Total Anggaran Akhir</span>
                                        <h3 className="text-3xl font-black italic">{formatRupiah(monthlyTotal)}</h3>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <button 
                                            onClick={() => {
                                                // Sync item total with monthly total on close/save
                                                setCurrentPlan(prev => {
                                                    const itemData = prev[type][editingItem.id];
                                                    return {
                                                        ...prev,
                                                        [type]: {
                                                            ...prev[type],
                                                            [editingItem.id]: {
                                                                ...itemData,
                                                                total: monthlyTotal
                                                            }
                                                        }
                                                    };
                                                });
                                                handleCloseModal();
                                            }}
                                            className="px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-black/20 bg-white text-slate-900 hover:bg-emerald-400 hover:text-white"
                                        >
                                            SIMPAN RINCIAN
                                        </button>
                                    </div>
                                </div>
                            );
                        })()}
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}
            {/* Add Item Modal */}
            {isAddingItem && (
                <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsAddingItem(false)} />
                    <div className="bg-white rounded-[3rem] w-full max-w-md relative z-10 shadow-2xl overflow-hidden animate-in zoom-in duration-300">
                        <div className="p-8 border-b border-slate-100 bg-slate-50">
                            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Tambah Item Belanja Baru</h2>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                                Sisa Dana: {formatRupiah(rapData.totalTarget - totalExpense)}
                            </p>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Nama Item Belanja</label>
                                <input 
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
                                    placeholder="Contoh: ATK Kantor, Biaya Lomba..."
                                    value={newItemData.name}
                                    onChange={e => setNewItemData({ ...newItemData, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Sumber Dana</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <button 
                                        onClick={() => setNewItemData(prev => ({ ...prev, sourceOfFunds: 'Yayasan' }))}
                                        className={`p-4 rounded-2xl border-2 font-black text-xs uppercase tracking-widest transition-all ${
                                            newItemData.sourceOfFunds === 'Yayasan' ? 'bg-slate-900 border-slate-900 text-white shadow-xl' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'
                                        }`}
                                    >
                                        Yayasan
                                    </button>
                                    <button 
                                        onClick={() => setNewItemData(prev => ({ ...prev, sourceOfFunds: 'BOS' }))}
                                        className={`p-4 rounded-2xl border-2 font-black text-xs uppercase tracking-widest transition-all ${
                                            newItemData.sourceOfFunds === 'BOS' ? 'bg-slate-900 border-slate-900 text-white shadow-xl' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'
                                        }`}
                                    >
                                        BOS
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Kaitan Pendapatan</label>
                                <select 
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
                                    value={newItemData.incomeItemId}
                                    onChange={e => setNewItemData({ ...newItemData, incomeItemId: e.target.value })}
                                >
                                    <option value="">Pilih Sumber...</option>
                                    {filteredIncomeItems.filter(ii => {
                                        if (newItemData.sourceOfFunds === 'BOS') return ii.name.toUpperCase().includes('BOS');
                                        return !ii.name.toUpperCase().includes('BOS');
                                    }).map(ii => (
                                        <option key={ii.id} value={ii.id}>{ii.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button 
                                    onClick={() => setIsAddingItem(false)}
                                    className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase"
                                >
                                    Batal
                                </button>
                                <button 
                                    onClick={handleAddItem}
                                    disabled={isSaving || !newItemData.name || !newItemData.incomeItemId}
                                    className="flex-2 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase shadow-lg shadow-indigo-100 disabled:opacity-50"
                                >
                                    {isSaving ? 'Menyimpan...' : 'Tambahkan Ke RAB'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Status Feedback Modal */}
            {showStatusModal && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md" onClick={handleAcknowledgeStatus} />
                    <div className={`bg-white rounded-[3rem] w-full max-w-lg relative z-10 shadow-2xl overflow-hidden animate-in zoom-in duration-300 border-b-[12px] ${
                        currentPlan.status === 'APPROVED' ? 'border-emerald-500' : 'border-rose-500'
                    }`}>
                        <div className="p-10 text-center">
                            <div className={`w-24 h-24 mx-auto mb-6 rounded-[2rem] flex items-center justify-center shadow-2xl ${
                                currentPlan.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
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
                                className={`w-full py-5 rounded-2xl font-black text-sm tracking-tight transition-all shadow-xl active:scale-95 ${
                                    currentPlan.status === 'APPROVED' 
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
        </div>
    );
}
