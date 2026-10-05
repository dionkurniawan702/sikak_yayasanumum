import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Wallet, Plus, Clock, CheckCircle, XCircle, FileText, ChevronRight, TrendingUp, AlertCircle, Calendar, Send, Building2, Landmark, Check, Search, Loader2, Gem, RotateCcw, Save, ChevronDown, ChevronUp, Package, ShieldCheck, Banknote, ArrowRightLeft, BookOpen, Layers } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatRupiah, generateId } from '../../utils/format';
import { api } from '../../services/api';

// ─── Helper to Check Prior Unreturned Balances ───────────────────────────────
function getUnreturnedBalanceInfo(state, unitId, fieldId, targetMonth, targetSource = 'YAYASAN', academicYearId = null) {
    const { budgetRequests = [], budgetReports = [], globalAcademicYearId } = state;
    if (!targetMonth) return { hasUnreturned: false, amount: 0, isBos: false };

    const effectiveYearId = academicYearId || globalAcademicYearId;
    const [targetYear, targetMonthNum] = targetMonth.split('-').map(Number);
    const isTargetBos = targetSource === 'BOS';

    // Helper for matching entity (fieldId or unitId)
    const isSameEntity = (item) => {
        if (!item) return false;
        if (fieldId) {
            return item.fieldId === fieldId || item.unitId === fieldId;
        }
        if (unitId && unitId !== 'FOUNDATION') {
            return item.unitId === unitId || item.fieldId === unitId;
        }
        if (unitId === 'FOUNDATION') {
            return item.unitId === 'FOUNDATION' || (!item.unitId && !item.fieldId);
        }
        return false;
    };

    // Helper to check if a request or report is BOS
    const checkIsBos = (item) => {
        if (!item) return false;
        if (item.source === 'BOS') return true;
        if (item.planId?.endsWith('-BOS')) return true;
        if ((item.items || []).some(i => i.planId?.endsWith('-BOS'))) return true;
        if (item.category?.toLowerCase().includes('bos')) return true;
        if (item.id?.startsWith('RET-BOS-')) return true;
        if (item.budgetRequestId) {
            const parentReq = budgetRequests.find(b => b.id === item.budgetRequestId);
            if (parentReq && (parentReq.source === 'BOS' || (parentReq.items || []).some(i => i.planId?.endsWith('-BOS')))) {
                return true;
            }
        }
        return false;
    };

    // Find all approved requests in the same academic year for prior months matching target source
    const priorRequests = budgetRequests.filter(r => {
        if (r.status !== 'APPROVED' || r.isDeleted || !r.month) return false;
        if (!isSameEntity(r)) return false;
        if (effectiveYearId && r.academicYearId && r.academicYearId !== effectiveYearId) return false;

        const isBosRequest = checkIsBos(r);
        if (isTargetBos && !isBosRequest) return false;
        if (!isTargetBos && isBosRequest) return false;

        const [rYear, rMonthNum] = r.month.split('-').map(Number);
        if (rYear < targetYear) return true;
        if (rYear === targetYear && rMonthNum < targetMonthNum) return true;
        return false;
    });

    if (priorRequests.length === 0) return { hasUnreturned: false, amount: 0, isBos: isTargetBos };

    const totalCair = priorRequests.reduce((sum, r) => sum + (parseFloat(r.totalAmount) || 0), 0);
    const priorRequestIds = priorRequests.map(r => r.id);

    // Find all approved expenses for prior months / requests matching target source
    const priorReports = budgetReports.filter(r => {
        if (r.status !== 'APPROVED' || r.isDeleted) return false;
        if (r.kategoriAset === 'PENGEMBALIAN') return false;
        if (!isSameEntity(r)) return false;
        if (effectiveYearId && r.academicYearId && r.academicYearId !== effectiveYearId) return false;

        const isBosReport = checkIsBos(r);
        if (isTargetBos && !isBosReport) return false;
        if (!isTargetBos && isBosReport) return false;

        // Matches if explicitly linked to a prior request OR if report date month < targetMonth
        if (r.budgetRequestId && priorRequestIds.includes(r.budgetRequestId)) return true;
        if (r.requestId && priorRequestIds.includes(r.requestId)) return true;
        if (r.date) {
            const reportMonth = r.date.substring(0, 7);
            if (reportMonth < targetMonth) return true;
        }
        return false;
    });
    const totalUsed = priorReports.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

    // Find all returns (approved or pending verification) matching target source
    const approvedReturns = budgetReports.filter(r => {
        if (r.status === 'REJECTED' || r.isDeleted) return false;
        if (r.kategoriAset !== 'PENGEMBALIAN') return false;
        if (!isSameEntity(r)) return false;
        if (effectiveYearId && r.academicYearId && r.academicYearId !== effectiveYearId) return false;

        const isBosReport = checkIsBos(r);
        if (isTargetBos && !isBosReport) return false;
        if (!isTargetBos && isBosReport) return false;

        // If explicitly linked to a prior request, count it
        if (r.budgetRequestId && priorRequestIds.includes(r.budgetRequestId)) return true;
        if (r.requestId && priorRequestIds.includes(r.requestId)) return true;

        if (r.date) {
            const returnMonth = r.date.substring(0, 7);
            if (returnMonth > targetMonth) return false;
        }
        return true;
    });
    const totalReturned = approvedReturns.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

    const unreturned = Math.max(0, totalCair - totalUsed - totalReturned);
    return {
        hasUnreturned: unreturned > 100,
        amount: unreturned,
        totalCair,
        totalUsed,
        totalReturned,
        isBos: isTargetBos
    };
}

export default function MonthlyRequest() {
    const { state, dispatch } = useApp();
    const { currentUser, rabPlans, budgetRequests, units, fields, academicYears, globalAcademicYearId, accounts = [], expenseItems = [] } = state;
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [processingId, setProcessingId] = useState(null);
    const [selectedComponents, setSelectedComponents] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [sourceMode, setSourceMode] = useState('YAYASAN'); // 'YAYASAN' or 'BOS'
    const [reviewRequest, setReviewRequest] = useState(null); // { req, accIds: [], tolakIds: [] }
    const [toast, setToast] = useState(null); // { message, type: 'success'|'error'|'warning' }
    
    // NEW FILTERS FOR SUPERADMIN
    const [filterUnit, setFilterUnit] = useState('NONE');
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [modalSearchTerm, setModalSearchTerm] = useState('');
    const [expandedCards, setExpandedCards] = useState({});

    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type });
    }, []);

    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), 3500);
        return () => clearTimeout(timer);
    }, [toast]);

    // Filter postable accounts for COA mapping
    const postableAccounts = useMemo(() => {
        return (accounts || [])
            .filter(a => !a.isParent && !a.isDeleted)
            .sort((a, b) => (a.code || '').localeCompare(b.code || ''));
    }, [accounts]);

    const cashBankAccounts = useMemo(() => {
        return postableAccounts.filter(a => 
            a.code?.startsWith('1-11') || 
            a.name?.toLowerCase().includes('kas') || 
            a.name?.toLowerCase().includes('bank')
        );
    }, [postableAccounts]);

    const expenseAccounts = useMemo(() => {
        return postableAccounts.filter(a => 
            a.code?.startsWith('5') || 
            a.type?.toLowerCase().includes('beban') || 
            a.type?.toLowerCase().includes('biaya')
        );
    }, [postableAccounts]);

    const assetAccounts = useMemo(() => {
        return postableAccounts.filter(a => 
            a.code?.startsWith('1-2') || 
            a.code?.startsWith('1-3') || 
            a.name?.toLowerCase().includes('aset') || 
            a.name?.toLowerCase().includes('peralatan') || 
            a.name?.toLowerCase().includes('inventaris')
        );
    }, [postableAccounts]);

    // Add month selection for the request
    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const currentYear = academicYears.find(y => y.id === globalAcademicYearId);

    const yearMonths = useMemo(() => {
        if (!currentYear) return [];
        const months = [];

        try {
            // Robust Generation from settings
            if (currentYear.startDate && currentYear.endDate) {
                const start = new Date(currentYear.startDate);
                const end = new Date(currentYear.endDate);
                const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;

                let current = new Date(start);
                let safetyCounter = 0;
                while (current <= end && safetyCounter < 24) {
                    const year = current.getFullYear();
                    const monthIdx = current.getMonth();
                    const monthNum = monthIdx + 1;
                    const shortYear = String(year).slice(-2);

                    months.push({
                        id: `${year}-${String(monthNum).padStart(2, '0')}`,
                        label: `${monthNames[monthIdx]} '${shortYear}`,
                        year,
                        monthNum
                    });
                    current.setMonth(current.getMonth() + 1);
                    safetyCounter++;
                }
            }

            // Fallback to 12-month standard if still empty
            if (months.length === 0) {
                const [startYearStr, endYearStr] = (currentYear.name || '').split((currentYear.name || '').includes('/') ? '/' : '-');
                const startYear = parseInt(startYearStr) || new Date().getFullYear();
                const endYear = parseInt(endYearStr) || (startYear + 1);

                const sequence = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];
                sequence.forEach((monthNum) => {
                    const year = monthNum >= 7 ? startYear : endYear;
                    const monthIdx = monthNum - 1;
                    const shortYear = String(year).slice(-2);
                    months.push({
                        id: `${year}-${String(monthNum).padStart(2, '0')}`,
                        label: `${monthNames[monthIdx]} '${shortYear}`,
                        year,
                        monthNum
                    });
                });
            }
        } catch (err) {
            console.error('Error generating months:', err);
        }
        return months;
    }, [currentYear]);

    // Set default month to current month if in the list, otherwise first month
    const getDefaultMonth = () => {
        const now = new Date();
        const nowId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        return yearMonths.find(m => m.id === nowId)?.id || yearMonths[0]?.id || '';
    };

    const [requestMonth, setRequestMonth] = useState(getDefaultMonth());

    // Filter unit/field
    const isSuperAdmin = currentUser?.role === 'superadmin';
    const myUnitId = currentUser?.unitId;
    const myFieldId = currentUser?.fieldId;

    const userField = fields.find(f => f.id === currentUser?.fieldId);
    const isSarprasUser = isSuperAdmin || (currentUser && (
        currentUser.fieldId === 'sarpras' ||
        currentUser.fieldId === 'SARPRAS' ||
        currentUser.unitId === 'sarpras' ||
        currentUser.unitId === 'SARPRAS' ||
        currentUser.role === 'sarpras' ||
        (currentUser.role === 'admin_bidang' && (
            userField?.name?.toLowerCase().includes('sarana') ||
            userField?.name?.toLowerCase().includes('sarpras') ||
            currentUser?.name?.toLowerCase().includes('sarana') ||
            currentUser?.name?.toLowerCase().includes('sarpras') ||
            currentUser?.username?.toLowerCase().includes('sarana') ||
            currentUser?.username?.toLowerCase().includes('sarpras')
        ))
    ));
    const isSarprasOnly = Boolean(isSarprasUser && !isSuperAdmin);

    const [sarprasViewTab, setSarprasViewTab] = useState(isSarprasOnly ? 'VERIFIKASI_ASET' : 'REGULAR');
    const [sarprasReviewModal, setSarprasReviewModal] = useState(null);

    // Helper to determine if an item is an asset
    const isItemAsset = useCallback((item) => {
        if (item.isAsset !== undefined) return Boolean(item.isAsset);
        if (rabPlans && Array.isArray(rabPlans)) {
            for (const plan of rabPlans) {
                if (item.planId && plan.id !== item.planId) continue;
                for (const rawPlans of Object.values(plan.expense || {})) {
                    const plansArr = Array.isArray(rawPlans) ? rawPlans : (rawPlans && typeof rawPlans === 'object' && Object.keys(rawPlans).length > 0 ? [rawPlans] : []);
                    for (const p of plansArr) {
                        for (const comp of p?.components || []) {
                            if (comp.id === item.componentId || comp.label === item.name || comp.name === item.name) {
                                if (comp.isAsset) return true;
                            }
                        }
                    }
                }
            }
        }
        return false;
    }, [rabPlans]);

    // Helper to get item's Sarpras status
    const getItemSarprasStatus = useCallback((item, parentReq) => {
        if (!isItemAsset(item)) return 'APPROVED';
        if (item.sarprasStatus) return item.sarprasStatus;
        if (parentReq?.status === 'APPROVED') return 'APPROVED';
        return 'PENDING';
    }, [isItemAsset]);

    // Helper to check if request has any asset item
    const requestHasAsset = useCallback((req) => {
        if (req.hasAsset !== undefined) return Boolean(req.hasAsset);
        return (req.items || []).some(i => isItemAsset(i));
    }, [isItemAsset]);

    // Requests with pending assets that need Sarpras verification
    const pendingSarprasFundRequests = useMemo(() => {
        return (budgetRequests || []).filter(req => {
            if (req.status === 'REJECTED' || req.isDeleted) return false;
            return (req.items || []).some(item => isItemAsset(item) && getItemSarprasStatus(item, req) === 'PENDING');
        });
    }, [budgetRequests, isItemAsset, getItemSarprasStatus]);

    const pendingSarprasFundCount = pendingSarprasFundRequests.length;

    // Requests containing assets for Sarpras view
    const sarprasAssetRequests = useMemo(() => {
        return (budgetRequests || []).filter(req => {
            if (req.isDeleted) return false;
            if (!requestHasAsset(req)) return false;

            // Status Filter
            if (filterStatus === 'PENDING') {
                const hasPending = (req.items || []).some(i => isItemAsset(i) && getItemSarprasStatus(i, req) === 'PENDING');
                if (!hasPending) return false;
            } else if (filterStatus === 'APPROVED') {
                const allApp = (req.items || []).filter(i => isItemAsset(i)).every(i => getItemSarprasStatus(i, req) === 'APPROVED');
                if (!allApp) return false;
            } else if (filterStatus === 'REJECTED') {
                const hasRej = (req.items || []).some(i => isItemAsset(i) && getItemSarprasStatus(i, req) === 'REJECTED');
                if (!hasRej) return false;
            }

            // Unit Filter
            if (filterUnit !== 'NONE' && filterUnit !== 'ALL') {
                if (req.unitId !== filterUnit && req.fieldId !== filterUnit) return false;
            }

            return true;
        }).sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [budgetRequests, requestHasAsset, isItemAsset, getItemSarprasStatus, filterStatus, filterUnit]);

    const handleOpenSarprasReview = (req) => {
        const itemDecisions = {};
        (req.items || []).forEach(item => {
            if (isItemAsset(item)) {
                itemDecisions[item.componentId] = {
                    status: getItemSarprasStatus(item, req),
                    notes: item.sarprasNotes || ''
                };
            }
        });
        setSarprasReviewModal({
            req,
            itemDecisions
        });
    };

    const handleSaveSarprasModal = async () => {
        if (!sarprasReviewModal) return;
        setProcessingId('saving-sarpras-review');
        window.dispatchEvent(new CustomEvent('app-processing-start', { 
            detail: { 
                title: 'Menyimpan Verifikasi Sarpras...', 
                message: 'Mohon tunggu sebentar, verifikasi Sarpras sedang dicatat ke server...', 
                type: 'approving' 
            } 
        }));

        try {
            const { req, itemDecisions } = sarprasReviewModal;
            const updatedItems = (req.items || []).map(item => {
                if (isItemAsset(item) && itemDecisions[item.componentId]) {
                    const dec = itemDecisions[item.componentId];
                    return {
                        ...item,
                        sarprasStatus: dec.status,
                        sarprasNotes: dec.notes || '',
                        sarprasVerifiedAt: new Date().toISOString(),
                        sarprasVerifiedBy: currentUser?.username || 'sarpras'
                    };
                }
                return item;
            });

            const assetItems = updatedItems.filter(i => isItemAsset(i));
            let overallSarpras = 'APPROVED';
            if (assetItems.length > 0) {
                const allApp = assetItems.every(i => i.sarprasStatus === 'APPROVED');
                const allRej = assetItems.every(i => i.sarprasStatus === 'REJECTED');
                if (allApp) overallSarpras = 'APPROVED';
                else if (allRej) overallSarpras = 'REJECTED';
                else overallSarpras = 'PARTIAL';
            }

            const updatedReq = {
                ...req,
                items: updatedItems,
                hasAsset: true,
                sarprasStatus: overallSarpras,
                sarprasVerifiedAt: new Date().toISOString(),
                sarprasVerifiedBy: currentUser?.username || 'sarpras'
            };

            dispatch({ type: 'EDIT_BUDGET_REQUEST', payload: updatedReq });
            await api.pushAction({ type: 'EDIT_BUDGET_REQUEST', payload: updatedReq }, state);

            showToast('Verifikasi aset Sarpras berhasil disimpan!');
            setSarprasReviewModal(null);
        } catch (err) {
            console.error('Error saving sarpras review:', err);
            showToast('Gagal menyimpan verifikasi Sarpras: ' + err.message, 'error');
        } finally {
            setProcessingId(null);
            window.dispatchEvent(new CustomEvent('app-processing-end'));
        }
    };

    // Clear notifications for unit admin when they visit (local state update only, no background network push)
    React.useEffect(() => {
        if (!isSuperAdmin && budgetRequests?.length > 0) {
            const unnotified = budgetRequests.filter(r => {
                const isMine = (myUnitId && r.unitId === myUnitId) || (myFieldId && r.fieldId === myFieldId);
                return isMine && (r.status === 'APPROVED' || r.status === 'REJECTED') && !r.notified;
            });
            if (unnotified.length > 0) {
                unnotified.forEach(r => {
                    const updated = { ...r, notified: true };
                    dispatch({ type: 'EDIT_BUDGET_REQUEST', payload: updated });
                });
            }
        }
    }, [budgetRequests, isSuperAdmin, myUnitId, myFieldId, dispatch]);

    const filteredRequests = useMemo(() => {
        return (budgetRequests || []).filter(req => {
            // Filter by source (Yayasan vs BOS)
            const isBosRequest = req.source === 'BOS' || req.items?.some(i => i.planId?.endsWith('-BOS'));
            if (sourceMode === 'BOS' && !isBosRequest) return false;
            if (sourceMode === 'YAYASAN' && isBosRequest) return false;

            // Status Filter
            if (filterStatus !== 'ALL' && req.status !== filterStatus) return false;

            if (isSuperAdmin) {
                // Require Superadmin to select a unit first
                if (filterUnit === 'NONE') return false;

                // Unit Filter for Superadmin
                if (filterUnit !== 'ALL') {
                    return req.unitId === filterUnit || req.fieldId === filterUnit;
                }
                return true;
            }
            if (myUnitId) return req.unitId === myUnitId;
            if (myFieldId) return req.fieldId === myFieldId;
            return false;
        }).sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [budgetRequests, isSuperAdmin, myUnitId, myFieldId, sourceMode, filterStatus, filterUnit]);

    // Calculate which units have pending requests for the red dot indicator
    const pendingUnitIds = useMemo(() => {
        const ids = new Set();
        (budgetRequests || []).forEach(req => {
            const isBosRequest = req.source === 'BOS' || req.items?.some(i => i.planId?.endsWith('-BOS'));
            if (sourceMode === 'BOS' && !isBosRequest) return;
            if (sourceMode === 'YAYASAN' && isBosRequest) return;

            if (req.status === 'PENDING') {
                if (req.unitId) ids.add(req.unitId);
                if (req.fieldId) ids.add(req.fieldId);
            }
        });
        return ids;
    }, [budgetRequests, sourceMode]);

    const monthlyTotals = useMemo(() => {
        if (!rabPlans) return {};
        
        const myPlans = rabPlans.filter(p => {
            if (isSuperAdmin) return true;
            if (myUnitId) return p.unitId === myUnitId;
            if (myFieldId) return p.fieldId === myFieldId;
            return false;
        }).filter(p => {
            if (p.id?.includes('-REVISION-')) return false;
            const isBosPlan = p.id?.endsWith('-BOS');
            if (sourceMode === 'BOS' && !isBosPlan) return false;
            if (sourceMode === 'YAYASAN' && isBosPlan) return false;
            return p.academicYearId === globalAcademicYearId;
        });

        const totals = {};
        yearMonths.forEach(m => totals[m.id] = 0);

        myPlans.forEach(plan => {
            Object.entries(plan.expense || {}).forEach(([itemId, rawItemPlans]) => {
                const itemPlans = Array.isArray(rawItemPlans) ? rawItemPlans : (rawItemPlans && typeof rawItemPlans === 'object' && Object.keys(rawItemPlans).length > 0 ? [{ id: `P-${itemId}-LEGACY`, itemId: itemId, ...rawItemPlans }] : []);
                
                itemPlans.forEach((p, pIdx) => {
                    (p.components || []).forEach((comp, cIdx) => {
                        const isActuallyApproved = 
                            (comp.status === 'APPROVED' || (!comp.status && (plan.status === 'APPROVED' || comp.isApproved === true))) &&
                            comp.status !== 'PENDING' && comp.status !== 'DRAFT' && comp.status !== 'REJECTED' &&
                            (!comp.isAsset || comp.sarprasStatus === 'APPROVED');
                        if (!isActuallyApproved) return;
                        
                        const compId = comp.id || `COMP-${plan.id}-${itemId}-${pIdx}-${cIdx}`;
                        
                        yearMonths.forEach(m => {
                            const monthId = m.id;
                            const isScheduledInMonth = comp.months?.[monthId]?.m === true;
                            const monthlyAmount = parseFloat(comp.months?.[monthId]?.jumlah) || 0;
                            
                            if (isScheduledInMonth && monthlyAmount > 0) {
                                const alreadyRequested = (budgetRequests || []).some(req =>
                                    req.month === monthId && req.items?.some(reqItem => reqItem.componentId === compId)
                                );
                                
                                if (!alreadyRequested) {
                                    totals[monthId] += monthlyAmount;
                                }
                            }
                        });
                    });
                });
            });
        });
        return totals;
    }, [rabPlans, budgetRequests, globalAcademicYearId, isSuperAdmin, myUnitId, myFieldId, sourceMode]);

    // Aggregate Approved components from RAB Plans that are NOT yet requested
    const approvedComponents = useMemo(() => {
        if (!rabPlans || !requestMonth) return [];

        const myPlans = rabPlans.filter(p => {
            if (isSuperAdmin) return true;
            if (myUnitId) return p.unitId === myUnitId;
            if (myFieldId) return p.fieldId === myFieldId;
            return false;
        }).filter(p => {
            if (p.id?.includes('-REVISION-')) return false;
            const isBosPlan = p.id?.endsWith('-BOS');
            if (sourceMode === 'BOS' && !isBosPlan) return false;
            if (sourceMode === 'YAYASAN' && isBosPlan) return false;
            return p.academicYearId === globalAcademicYearId;
        });

        const components = [];
        myPlans.forEach(plan => {
            Object.entries(plan.expense || {}).forEach(([itemId, rawItemPlans]) => {
                // Handle legacy single-object format
                const itemPlans = Array.isArray(rawItemPlans) ? rawItemPlans : (rawItemPlans && typeof rawItemPlans === 'object' && Object.keys(rawItemPlans).length > 0 ? [{ id: `P-${itemId}-LEGACY`, itemId: itemId, ...rawItemPlans }] : []);
                
                itemPlans.forEach((p, pIdx) => {
                    (p.components || []).forEach((comp, cIdx) => {
                        const compId = comp.id || `COMP-${plan.id}-${itemId}-${pIdx}-${cIdx}`;
                        
                        // NEW: Filter by selected month's allocation
                        const isScheduledInMonth = comp.months?.[requestMonth]?.m === true;
                        const monthlyAmount = parseFloat(comp.months?.[requestMonth]?.jumlah) || 0;

                        // Strictly require Yayasan approval (comp.status === 'APPROVED') and Sarpras approval (if asset)
                        const isActuallyApproved = 
                            (comp.status === 'APPROVED' || (!comp.status && (plan.status === 'APPROVED' || comp.isApproved === true))) &&
                            comp.status !== 'PENDING' && comp.status !== 'DRAFT' && comp.status !== 'REJECTED' &&
                            (!comp.isAsset || comp.sarprasStatus === 'APPROVED');

                        if (isActuallyApproved && isScheduledInMonth && monthlyAmount > 0) {
                            // Check if already requested in budgetRequests for THIS month
                            const alreadyRequested = (budgetRequests || []).some(req =>
                                req.month === requestMonth && req.items?.some(reqItem => reqItem.componentId === compId)
                            );

                            if (!alreadyRequested) {
                                components.push({
                                    ...comp,
                                    id: compId,
                                    total: monthlyAmount, // Only request the amount planned for THIS month
                                    planId: plan.id,
                                    itemMasterName: state.expenseItems.find(i => i.id === itemId)?.name || 'Item',
                                    planDescription: p.description,
                                    expenseItemId: itemId
                                });
                            }
                        }
                    });
                });
            });
        });
        return components;
    }, [rabPlans, budgetRequests, globalAcademicYearId, isSuperAdmin, myUnitId, myFieldId, state.expenseItems, requestMonth]);

    const filteredComps = useMemo(() => {
        if (!searchTerm) return approvedComponents;
        return approvedComponents.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || (c.label && c.label.toLowerCase().includes(searchTerm.toLowerCase())));
    }, [approvedComponents, searchTerm]);

    const isAllSelected = useMemo(() => {
        if (filteredComps.length === 0) return false;
        return filteredComps.every(c => selectedComponents.includes(c.id));
    }, [filteredComps, selectedComponents]);

    const handleToggleSelectAll = () => {
        if (isAllSelected) {
            // Deselect all filtered components
            const filteredIds = filteredComps.map(c => c.id);
            setSelectedComponents(prev => prev.filter(id => !filteredIds.includes(id)));
        } else {
            // Select all filtered components
            const filteredIds = filteredComps.map(c => c.id);
            setSelectedComponents(prev => {
                const newSelection = [...prev];
                filteredIds.forEach(id => {
                    if (!newSelection.includes(id)) {
                        newSelection.push(id);
                    }
                });
                return newSelection;
            });
        }
    };

    const stats = useMemo(() => {
        const approved = approvedComponents.reduce((sum, c) => sum + (parseFloat(c.total) || 0), 0);
        const inProcess = filteredRequests.filter(r => r.status === 'PENDING').reduce((sum, r) => sum + (parseFloat(r.totalAmount) || 0), 0);
        return { approved, inProcess };
    }, [approvedComponents, filteredRequests]);

    const handleCreateRequest = async (e) => {
        e.preventDefault();
        if (selectedComponents.length === 0) return alert('Pilih komponen belanja terlebih dahulu');

        window.dispatchEvent(new CustomEvent('app-processing-start', { 
            detail: { 
                title: 'Mengirim Pengajuan Unit...', 
                message: 'Mohon tunggu sebentar, Surat Permintaan Dana sedang diunggah dan dicatat ke server...', 
                type: 'submitting' 
            } 
        }));

        try {
            const selectedData = approvedComponents.filter(c => selectedComponents.includes(c.id));
            const totalAmount = selectedData.reduce((sum, c) => sum + (parseFloat(c.total) || 0), 0);
            const hasAsset = selectedData.some(c => Boolean(c.isAsset));

            const newRequest = {
                id: generateId('REQ'),
                unitId: myUnitId || 'FOUNDATION',
                fieldId: myFieldId,
                academicYearId: globalAcademicYearId,
                month: requestMonth, // Add target month
                date: new Date().toISOString().split('T')[0],
                status: 'PENDING',
                totalAmount,
                source: sourceMode, // Tag as YAYASAN or BOS
                description: selectedData.length > 0 ? (selectedData[0].label || selectedData[0].name) : 'Pengajuan Dana',
                hasAsset: hasAsset,
                sarprasStatus: hasAsset ? 'PENDING' : 'APPROVED',
                items: selectedData.map(c => {
                    const isAsset = Boolean(c.isAsset);
                    return {
                        componentId: c.id,
                        name: c.label || c.name,
                        amount: c.total,
                        volume: (parseFloat(c.harga || c.price) > 0) ? (parseFloat(c.total) / parseFloat(c.harga || c.price)) : (parseFloat(c.volume) || 1),
                        satuan: c.satuan || c.unit || '-',
                        harga: parseFloat(c.harga || c.price) || 0,
                        planId: c.planId,
                        expenseItemId: c.expenseItemId,
                        isAsset: isAsset,
                        assetCategory: c.assetCategory || '',
                        assetRoom: c.assetRoom || '',
                        assetProcurementType: c.assetProcurementType || 'BARU',
                        assetName: c.assetName || c.namaAset || c.label || c.name || '',
                        sarprasStatus: isAsset ? 'PENDING' : 'APPROVED',
                        sarprasNotes: '',
                        keterangan: c.keterangan || '',
                        description: c.description || '',
                        planDescription: ''
                    };
                })
            };

            await api.pushAction({ type: 'ADD_BUDGET_REQUEST', payload: newRequest }, state); // Immediate push
            dispatch({ type: 'ADD_BUDGET_REQUEST', payload: newRequest });
            setShowRequestModal(false);
            setSelectedComponents([]);
            showToast('Permintaan dana berhasil diajukan!');
        } catch (err) {
            console.error('Error creating request:', err);
            showToast('Gagal mengajukan permintaan dana', 'error');
        } finally {
            window.dispatchEvent(new CustomEvent('app-processing-end'));
        }
    };

    const handleOpenReview = (req) => {
        const isBosReq = req.source === 'BOS' || (req.items || []).some(i => i.planId?.endsWith('-BOS'));
        // Find default cash/bank account
        const defaultCashAcc = cashBankAccounts.find(a => 
            isBosReq ? (a.code === '1-1112' || a.name?.toLowerCase().includes('terikat') || a.name?.toLowerCase().includes('bos')) 
                     : (a.code === '1-1111' || a.code === '1-1101' || a.name?.toLowerCase().includes('bsi') || a.name?.toLowerCase().includes('yayasan'))
        ) || cashBankAccounts[0] || null;

        const defaultCreditId = req.creditAccountId || defaultCashAcc?.id || '';

        const initialMappings = {};
        (req.items || []).forEach(item => {
            let defaultDebitId = item.debitAccountId || '';
            
            // If not set, check from master expenseItems
            if (!defaultDebitId && item.expenseItemId) {
                const exp = (expenseItems || []).find(e => e.id === item.expenseItemId);
                if (exp) defaultDebitId = exp.debitAccountId || exp.accountId || '';
            }

            // Smart guess if still not set
            if (!defaultDebitId) {
                if (isItemAsset(item)) {
                    const assetAcc = assetAccounts[0] || postableAccounts.find(a => a.code?.startsWith('1-2') || a.code?.startsWith('1-3'));
                    if (assetAcc) defaultDebitId = assetAcc.id;
                } else {
                    const lowerName = (item.name || '').toLowerCase();
                    if (lowerName.includes('listrik') || lowerName.includes('air') || lowerName.includes('internet') || lowerName.includes('telkom')) {
                        defaultDebitId = postableAccounts.find(a => a.code === '5-2102')?.id || '';
                    } else if (lowerName.includes('gaji') || lowerName.includes('honor') || lowerName.includes('insentif')) {
                        defaultDebitId = postableAccounts.find(a => a.code === '5-2101')?.id || '';
                    } else if (lowerName.includes('atk') || lowerName.includes('kertas') || lowerName.includes('kantor') || lowerName.includes('konsumsi') || lowerName.includes('snack') || lowerName.includes('makan')) {
                        defaultDebitId = postableAccounts.find(a => a.code === '5-2103')?.id || '';
                    } else if (lowerName.includes('pendidikan') || lowerName.includes('santri') || lowerName.includes('siswa') || lowerName.includes('buku') || lowerName.includes('kurikulum')) {
                        defaultDebitId = postableAccounts.find(a => a.code === '5-1101')?.id || '';
                    } else {
                        defaultDebitId = postableAccounts.find(a => a.code === '5-2103')?.id || expenseAccounts[0]?.id || '';
                    }
                }
            }

            initialMappings[item.componentId] = {
                debitAccountId: defaultDebitId,
                creditAccountId: item.creditAccountId || defaultCreditId
            };
        });

        setReviewRequest({
            req,
            accIds: [],
            tolakIds: [],
            globalCreditAccountId: defaultCreditId,
            itemMappings: initialMappings
        });
    };

    const handleUpdateItemMapping = (componentId, field, value) => {
        setReviewRequest(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                itemMappings: {
                    ...(prev.itemMappings || {}),
                    [componentId]: {
                        ...(prev.itemMappings?.[componentId] || {}),
                        [field]: value
                    }
                }
            };
        });
    };

    const handleApplyGlobalCredit = (creditId) => {
        setReviewRequest(prev => {
            if (!prev) return prev;
            const updatedMappings = { ...(prev.itemMappings || {}) };
            (prev.req.items || []).forEach(item => {
                updatedMappings[item.componentId] = {
                    ...(updatedMappings[item.componentId] || {}),
                    creditAccountId: creditId
                };
            });
            return {
                ...prev,
                globalCreditAccountId: creditId,
                itemMappings: updatedMappings
            };
        });
    };

    const handleSaveReview = async (bypassBalance = false) => {
        setProcessingId('saving-review');
        window.dispatchEvent(new CustomEvent('app-processing-start', { 
            detail: { 
                title: 'Memproses ACC Superadmin...', 
                message: 'Mohon tunggu sebentar, verifikasi persetujuan Surat Permintaan Dana sedang dicatat ke server...', 
                type: 'approving' 
            } 
        }));
        try {
            const { req, accIds, tolakIds } = reviewRequest;

            // Peringatan Keuangan: Periksa apakah ada item belanja aset yang belum di-ACC Sarpras
            const unapprovedAssetsAcc = req.items.filter(i => accIds.includes(i.componentId) && isItemAsset(i) && getItemSarprasStatus(i, req) !== 'APPROVED');
            if (unapprovedAssetsAcc.length > 0) {
                const proceed = window.confirm(`PERHATIAN SARPRAS:\n\nTerdapat ${unapprovedAssetsAcc.length} rincian belanja aset yang belum disetujui (ACC) oleh Bidang Sarana Prasarana:\n\n${unapprovedAssetsAcc.map(a => `• ${a.name} (${getItemSarprasStatus(a, req) === 'REJECTED' ? 'Ditolak Sarpras' : 'Menunggu ACC Sarpras'})`).join('\n')}\n\nApakah Anda (Superadmin/Keuangan) yakin tetap ingin mencairkan dana untuk aset tersebut?`);
                if (!proceed) {
                    setProcessingId(null);
                    window.dispatchEvent(new CustomEvent('app-processing-end'));
                    return;
                }
            }
            
            // Helper to enrich items with COA mappings chosen by Superadmin
            const enrichItems = (itemList) => {
                return itemList.map(item => {
                    const mapping = reviewRequest.itemMappings?.[item.componentId] || {};
                    const debitAccountId = mapping.debitAccountId || item.debitAccountId || '';
                    const creditAccountId = mapping.creditAccountId || reviewRequest.globalCreditAccountId || item.creditAccountId || '';
                    
                    const debitAcc = accounts.find(a => a.id === debitAccountId);
                    const creditAcc = accounts.find(a => a.id === creditAccountId);

                    return {
                        ...item,
                        debitAccountId,
                        creditAccountId,
                        debitAccountName: debitAcc ? `${debitAcc.code} - ${debitAcc.name}` : (item.debitAccountName || ''),
                        creditAccountName: creditAcc ? `${creditAcc.code} - ${creditAcc.name}` : (item.creditAccountName || '')
                    };
                });
            };

            const accItems = enrichItems(req.items.filter(i => accIds.includes(i.componentId)));
            const tolakItems = req.items.filter(i => tolakIds.includes(i.componentId));
            const pendingItems = req.items.filter(i => !accIds.includes(i.componentId) && !tolakIds.includes(i.componentId));
            
            // If all are ACC
            if (accItems.length === req.items.length) {
                const updated = { 
                    ...req, 
                    status: 'APPROVED', 
                    items: accItems, 
                    creditAccountId: reviewRequest.globalCreditAccountId || req.creditAccountId,
                    notified: false 
                };
                dispatch({ type: 'EDIT_BUDGET_REQUEST', payload: updated });
                await api.pushAction({ type: 'EDIT_BUDGET_REQUEST', payload: { ...updated, ...(bypassBalance ? { bypassBalanceCheck: true } : {}) } }, state);
            } 
            // If all are TOLAK
            else if (tolakItems.length === req.items.length) {
                const reason = window.prompt('Alasan penolakan keseluruhan:');
                const updated = { ...req, status: 'REJECTED', rejectionReason: reason || 'Ditolak Superadmin', notified: false };
                dispatch({ type: 'EDIT_BUDGET_REQUEST', payload: updated });
                await api.pushAction({ type: 'EDIT_BUDGET_REQUEST', payload: updated }, state);
            }
            // Partial Action
            else {
                // 1. Handle ACC Items
                if (accItems.length > 0) {
                    if (pendingItems.length === 0 && tolakItems.length > 0) {
                        // Original request becomes the APPROVED one
                        const accTotal = accItems.reduce((s, i) => s + (parseFloat(i.amount)||0), 0);
                        const updated = { 
                            ...req, 
                            status: 'APPROVED', 
                            items: accItems, 
                            totalAmount: accTotal, 
                            creditAccountId: reviewRequest.globalCreditAccountId || req.creditAccountId,
                            notified: false 
                        };
                        dispatch({ type: 'EDIT_BUDGET_REQUEST', payload: updated });
                        await api.pushAction({ type: 'EDIT_BUDGET_REQUEST', payload: { ...updated, ...(bypassBalance ? { bypassBalanceCheck: true } : {}) } }, state);
                    } else {
                        // Create a NEW request for the APPROVED items
                        const accTotal = accItems.reduce((s, i) => s + (parseFloat(i.amount)||0), 0);
                        const newAcc = { 
                            ...req, 
                            id: generateId('REQ') + '-ACC', 
                            status: 'APPROVED', 
                            items: accItems, 
                            totalAmount: accTotal, 
                            creditAccountId: reviewRequest.globalCreditAccountId || req.creditAccountId,
                            notified: false 
                        };
                        dispatch({ type: 'ADD_BUDGET_REQUEST', payload: newAcc });
                        await api.pushAction({ type: 'ADD_BUDGET_REQUEST', payload: { ...newAcc, ...(bypassBalance ? { bypassBalanceCheck: true } : {}) } }, state);
                    }
                }
                
                // 2. Handle TOLAK Items
                if (tolakItems.length > 0) {
                    const tolakTotal = tolakItems.reduce((s, i) => s + (parseFloat(i.amount)||0), 0);
                    const newRej = { ...req, id: req.id + '-REJ', status: 'REJECTED', items: tolakItems, totalAmount: tolakTotal, rejectionReason: 'Sebagian ditolak', notified: false };
                    dispatch({ type: 'ADD_BUDGET_REQUEST', payload: newRej });
                    await api.pushAction({ type: 'ADD_BUDGET_REQUEST', payload: newRej }, state);
                }
                
                // 3. Handle PENDING Items (Remaining original request)
                if (pendingItems.length > 0) {
                    const pendingTotal = pendingItems.reduce((s, i) => s + (parseFloat(i.amount)||0), 0);
                    const updatedPending = { ...req, items: pendingItems, totalAmount: pendingTotal, status: 'PENDING' };
                    dispatch({ type: 'EDIT_BUDGET_REQUEST', payload: updatedPending });
                    await api.pushAction({ type: 'EDIT_BUDGET_REQUEST', payload: updatedPending }, state);
                }
            }
            
            showToast('Persetujuan berhasil disimpan!');
            setReviewRequest(null);
        } catch (err) {
            console.error(err);
            showToast(`Gagal memproses persetujuan: ${err.message || 'Terjadi kesalahan pada server.'}`, 'error');
        } finally {
            setProcessingId(null);
            window.dispatchEvent(new CustomEvent('app-processing-end'));
        }
    };

    const resolveItemDetails = (item) => {
        let originalSatuan = item.satuan || '-';
        let originalHarga = parseFloat(item.harga) || 0;
        let originalVolume = parseFloat(item.volume) || 1;

        if (rabPlans && Array.isArray(rabPlans)) {
            const plan = rabPlans.find(p => p.id === item.planId);
            if (plan && plan.expense && typeof plan.expense === 'object') {
                outerLoop: for (const [itemId, rawItemPlans] of Object.entries(plan.expense)) {
                    const itemPlans = Array.isArray(rawItemPlans) 
                        ? rawItemPlans 
                        : (rawItemPlans && typeof rawItemPlans === 'object' && Object.keys(rawItemPlans).length > 0 
                            ? [{ id: `P-${itemId}-LEGACY`, itemId: itemId, ...rawItemPlans }] 
                            : []);
                    for (let pIdx = 0; pIdx < itemPlans.length; pIdx++) {
                        const p = itemPlans[pIdx];
                        if (p.components && Array.isArray(p.components)) {
                            for (let cIdx = 0; cIdx < p.components.length; cIdx++) {
                                const comp = p.components[cIdx];
                                const compId = comp.id || `COMP-${plan.id}-${itemId}-${pIdx}-${cIdx}`;
                                if (compId === item.componentId || comp.label === item.name || comp.name === item.name) {
                                    originalSatuan = comp.satuan || comp.unit || originalSatuan;
                                    originalHarga = comp.harga !== undefined ? parseFloat(comp.harga) : originalHarga;
                                    originalVolume = comp.volume !== undefined ? parseFloat(comp.volume) : originalVolume;
                                    break outerLoop;
                                }
                            }
                        }
                    }
                }
            }
        } else {
            originalSatuan = item.satuan || originalSatuan;
            originalHarga = item.harga !== undefined ? parseFloat(item.harga) : originalHarga;
            originalVolume = item.volume !== undefined ? parseFloat(item.volume) : originalVolume;
        }

        const amount = parseFloat(item.amount || item.total) || 0;
        const vol = originalHarga > 0 ? (amount / originalHarga) : originalVolume;

        const tolerance = 0.001;
        const isCloseToInteger = Math.abs(vol - Math.round(vol)) < tolerance;

        if (originalHarga > 0 && !isCloseToInteger) {
            return {
                volume: 1,
                satuan: originalSatuan,
                harga: amount
            };
        }

        return {
            volume: isCloseToInteger ? Math.round(vol) : parseFloat(vol.toFixed(2)),
            satuan: originalSatuan,
            harga: originalHarga > 0 ? originalHarga : amount
        };
    };

    const handlePrint = (req) => {
        const printWindow = window.open('', '_blank');
        const unitName = units.find(u => u.id === req.unitId)?.name || fields.find(f => f.id === req.fieldId)?.name || 'Unit/Bidang';

        let periodLabel = '-';
        if (req.month) {
            const found = yearMonths.find(m => m.id === req.month);
            if (found) {
                periodLabel = found.label;
            } else {
                const [yyyy, mm] = req.month.split('-');
                if (yyyy && mm) {
                    const monthNamesArr = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
                    periodLabel = `${monthNamesArr[parseInt(mm, 10) - 1]} '${yyyy.slice(-2)}`;
                } else {
                    periodLabel = req.month;
                }
            }
        }

        let formattedDate = req.date;
        try {
            formattedDate = new Date(req.date).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
        } catch (e) {
            console.error(e);
        }

        const html = `
            <html>
                <head>
                    <title>Surat Pengajuan Dana - ${req.id}</title>
                    <style>
                        body { font-family: 'Times New Roman', serif; padding: 50px; line-height: 1.6; }
                        .header { display: flex; align-items: center; justify-content: center; position: relative; border-bottom: 3px double #000; padding-bottom: 20px; margin-bottom: 30px; text-align: center; }
                        .header img.logo { position: absolute; left: 0; top: 0; width: 80px; height: auto; }
                        .header .header-text { flex: 1; }
                        .header h1 { margin: 0; font-size: 24px; text-transform: uppercase; font-weight: bold; }
                        .header p { margin: 5px 0; font-size: 14px; }
                        .info { margin-bottom: 30px; }
                        .info table { width: 100%; }
                        .info td { vertical-align: top; }
                        .content { margin-bottom: 40px; }
                        .content table { width: 100%; border-collapse: collapse; margin-top: 20px; line-height: 1.3; font-size: 14px; }
                        .content th, .content td { border: 1px solid #000; padding: 4px 8px; text-align: left; }
                        .content th { background: #f2f2f2; text-align: center; }
                        .footer { margin-top: 50px; display: flex; justify-content: space-between; }
                        .signature { text-align: center; width: 200px; }
                        .signature p { margin: 0; }
                        .signature .space { height: 80px; }
                        @media print { .no-print { display: none; } }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <img src="${window.location.origin}/logo-yayasan.png" alt="Logo" class="logo" onerror="this.style.display='none'" />
                        <div class="header-text">
                            <h1>YAYASAN DAR EL-IMAN</h1>
                            <p>Jl. Gajah Mada Gang BPKP II No.Dalam, Kp. Olo, Kec. Nanggalo, Kota Padang, Sumatera Barat 25173</p>
                            <p>Tlp: (0751) 447950 &bull; Email: sekreydi@gmail.com</p>
                        </div>
                    </div>

                    <div class="info">
                        <h2 style="text-align: center; text-decoration: underline; margin-bottom: 5px;">SURAT PERMINTAAN DANA</h2>
                        <p style="text-align: center; margin-top: 0;">Nomor: ${req.id}</p>
                        
                        <table style="margin-top: 20px;">
                            <tr>
                                <td width="150">Tanggal</td>
                                <td>: ${formattedDate}</td>
                            </tr>
                            <tr>
                                <td>Unit / Bidang</td>
                                <td>: ${unitName}</td>
                            </tr>
                            <tr>
                                <td>Sumber Dana</td>
                                <td>: ${req.source || 'YAYASAN'}</td>
                            </tr>
                        </table>
                    </div>

                    <div class="content">
                        <p>Dengan hormat,</p>
                        <p>Bersama ini kami mengajukan permintaan dana untuk keperluan rencana belanja periode <b>${periodLabel}</b> yang telah disetujui (ACC) sebagai berikut:</p>
                        
                        <table>
                            <thead>
                                <tr>
                                    <th width="30">No</th>
                                    <th>Item Pengeluaran</th>
                                    <th>Rincian Pengeluaran</th>
                                    <th style="text-align: center; width: 60px;">Jumlah</th>
                                    <th style="text-align: center; width: 80px;">Satuan</th>
                                    <th style="text-align: right; width: 120px;">Harga Satuan</th>
                                    <th style="text-align: right; width: 130px;">Total Dana</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${req.items.map((item, idx) => {
                                    const maName = state.expenseItems?.find(e => e.id === item.expenseItemId)?.name || '-';
                                    const details = resolveItemDetails(item);
                                    return `
                                    <tr>
                                        <td style="text-align: center;">${idx + 1}</td>
                                        <td>${maName}</td>
                                        <td>${item.name}</td>
                                        <td style="text-align: center;">${details.volume}</td>
                                        <td style="text-align: center;">${details.satuan}</td>
                                        <td style="text-align: right;">${formatRupiah(details.harga)}</td>
                                        <td style="text-align: right;">${formatRupiah(item.amount)}</td>
                                    </tr>
                                    `;
                                }).join('')}
                                <tr>
                                    <th colspan="6" style="text-align: right;">TOTAL PENGAJUAN</th>
                                    <th style="text-align: right;">${formatRupiah(req.totalAmount)}</th>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div class="footer">
                        <div class="left-side" style="width: 45%;">
                            <div class="signature" style="margin: 0 auto; margin-bottom: 40px;">
                                <p>Menyetujui,</p>
                                <p>Bendahara Yayasan</p>
                                <div class="space"></div>
                                <p>____________________</p>
                            </div>
                            <div class="signature" style="margin: 0 auto;">
                                <p>Memeriksa,</p>
                                <p>Kabid. Keuangan</p>
                                <div class="space"></div>
                                <p>____________________</p>
                            </div>
                        </div>
                        <div class="right-side" style="width: 45%;">
                            <div class="signature" style="margin: 0 auto; margin-bottom: 40px;">
                                <p>Pemohon,</p>
                                <p>Kepala Unit / Bidang</p>
                                <div class="space"></div>
                                <p>____________________</p>
                            </div>
                            <div class="signature" style="margin: 0 auto;">
                                <p>Pemohon,</p>
                                <p>Bendahara Unit</p>
                                <div class="space"></div>
                                <p>____________________</p>
                            </div>
                        </div>
                    </div>

                    <div class="no-print" style="margin-top: 50px; text-align: center;">
                        <button onclick="window.print()" style="padding: 10px 30px; background: #4f46e5; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">CETAK SEKARANG</button>
                    </div>
                </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    const getStatusStyles = (status) => {
        switch (status) {
            case 'APPROVED': return 'bg-emerald-500 shadow-emerald-500/20';
            case 'REJECTED': return 'bg-rose-500 shadow-rose-500/20';
            default: return 'bg-amber-500 shadow-amber-500/20';
        }
    };

    return (
        <div className="p-8 animate-in text-slate-900">
            {/* Toast Notification */}
            {toast && (
                <div
                    className={`fixed top-6 right-6 z-[9999] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl text-white font-black text-sm uppercase tracking-widest animate-in slide-in-from-top-4 transition-all ${
                        toast.type === 'success' ? 'bg-emerald-500 shadow-emerald-500/30' :
                        toast.type === 'error'   ? 'bg-rose-500 shadow-rose-500/30' :
                                                   'bg-amber-500 shadow-amber-500/30'
                    }`}
                >
                    {toast.type === 'success' ? <CheckCircle size={18} /> : toast.type === 'error' ? <XCircle size={18} /> : <AlertCircle size={18} />}
                    {toast.message}
                    <button onClick={() => setToast(null)} className="ml-2 opacity-60 hover:opacity-100 transition-opacity">
                        <XCircle size={16} />
                    </button>
                </div>
            )}
            {/* Header */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div className="lg:col-span-2 bg-gradient-to-br from-indigo-700 to-blue-900 rounded-[40px] p-10 text-white shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:scale-110 transition-transform">
                        <Send size={160} />
                    </div>
                    <div className="relative z-10">
                        <h1 className="text-3xl font-black mb-1">Permintaan Dana</h1>
                        <p className="text-blue-100/70 font-medium mb-4 uppercase text-[10px] tracking-widest italic">
                            TA {currentYear?.name || '-'} • {isSuperAdmin ? 'SELURUH YAYASAN' : (units.find(u => u.id === myUnitId)?.name || fields.find(f => f.id === myFieldId)?.name || 'Unit Saya')}
                        </p>

                        <div className="flex bg-white/10 backdrop-blur-md p-1 rounded-2xl border border-white/20 mb-8 inline-flex">
                            <button 
                                onClick={() => setSourceMode('YAYASAN')}
                                className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sourceMode === 'YAYASAN' ? 'bg-white text-indigo-700 shadow-xl' : 'text-white/60 hover:text-white'}`}
                            >
                                <Building2 size={12} className="inline mr-2" />
                                Dana Yayasan
                            </button>
                            {(!myFieldId || isSuperAdmin) && (
                                <button 
                                    onClick={() => setSourceMode('BOS')}
                                    className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sourceMode === 'BOS' ? 'bg-white text-emerald-600 shadow-xl' : 'text-white/60 hover:text-white'}`}
                                >
                                    <Gem size={12} className="inline mr-2" />
                                    Dana BOS
                                </button>
                            )}
                        </div>

                        {!isSuperAdmin ? (
                            <button
                                onClick={() => setShowRequestModal(true)}
                                className="bg-white text-indigo-700 font-black px-8 py-4 rounded-2xl flex items-center gap-3 hover:shadow-2xl hover:scale-105 active:scale-95 transition-all"
                            >
                                <Plus size={20} strokeWidth={3} />
                                <span> BUAT PENGAJUAN DANA</span>
                            </button>
                        ) : (
                            <div className="flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
                                <AlertCircle size={16} />
                                <span className="text-[10px] font-black uppercase tracking-widest">MODE MONITORING SUPERADMIN</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="card p-8 bg-white/40 backdrop-blur-xl border-white rounded-[32px] flex flex-col items-center justify-center text-center group hover:bg-white transition-all shadow-xl text-slate-900">
                    <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Clock size={24} />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Dalam Pengajuan</p>
                    <h2 className="text-2xl font-black text-amber-600">{formatRupiah(stats.inProcess)}</h2>
                </div>
            </div>

            {/* Sarpras Pending Asset Notification Banner */}
            {isSarprasUser && pendingSarprasFundCount > 0 && sarprasViewTab !== 'VERIFIKASI_ASET' && (
                <div className="w-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 rounded-[2rem] p-6 text-white shadow-xl shadow-amber-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-amber-400/40 mb-8 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md shadow-inner shrink-0">
                            <Package size={28} className="text-white animate-bounce" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="bg-white/25 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider text-amber-50 border border-white/20">
                                    Perhatian Sarpras
                                </span>
                                <span className="text-xs font-bold text-amber-100">Realisasi Anggaran</span>
                            </div>
                            <h4 className="text-base font-black tracking-tight text-white mt-1">
                                Ada {pendingSarprasFundCount} Permintaan Dana Belanja Aset Menunggu Verifikasi Sarpras!
                            </h4>
                            <p className="text-xs text-amber-100/90 font-medium">
                                Unit/bidang telah mengajukan pencairan dana untuk pengadaan aset. Silakan lakukan verifikasi teknis aset sebelum dana dicairkan.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setSarprasViewTab('VERIFIKASI_ASET')}
                        className="px-6 py-3.5 bg-white text-amber-800 font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg hover:bg-amber-50 hover:shadow-xl transition-all shrink-0 flex items-center gap-2 active:scale-95"
                    >
                        <Package size={16} className="text-amber-600" />
                        Buka Verifikasi Aset ({pendingSarprasFundCount})
                    </button>
                </div>
            )}

            {/* Sarpras Tab Switcher */}
            {isSarprasUser && (
                <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-6 w-fit gap-1 border border-slate-200">
                    <button
                        onClick={() => setSarprasViewTab('REGULAR')}
                        className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${sarprasViewTab === 'REGULAR' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                        <Send size={14} />
                        <span>Permintaan Dana Bidang</span>
                    </button>
                    <button
                        onClick={() => setSarprasViewTab('VERIFIKASI_ASET')}
                        className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${sarprasViewTab === 'VERIFIKASI_ASET' ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                        <Package size={14} />
                        <span>Verifikasi Aset Unit</span>
                        {pendingSarprasFundCount > 0 && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${sarprasViewTab === 'VERIFIKASI_ASET' ? 'bg-white text-amber-600' : 'bg-amber-500 text-white animate-pulse'}`}>
                                {pendingSarprasFundCount}
                            </span>
                        )}
                    </button>
                </div>
            )}

            {/* Request History */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><Calendar size={18} /></div>
                    <h3 className="font-black text-slate-900 uppercase text-xs tracking-widest">
                        {sarprasViewTab === 'VERIFIKASI_ASET' ? 'Daftar Pengajuan Dana Aset dari Seluruh Unit/Bidang' : 'Riwayat Permintaan Dana'}
                    </h3>
                </div>
                
                {/* Filters */}
                <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
                    {isSuperAdmin && (
                        <select 
                            value={filterUnit} 
                            onChange={(e) => setFilterUnit(e.target.value)}
                            className="bg-slate-50 border-0 rounded-xl px-4 py-2 text-[10px] font-black text-slate-600 uppercase tracking-widest focus:ring-2 focus:ring-indigo-100 outline-none cursor-pointer"
                        >
                            <option value="NONE" disabled>Pilih Unit & Bidang</option>
                            <option value="ALL">Semua Unit & Bidang (Tampilkan Semua)</option>
                            <optgroup label="Unit Pendidikan">
                                {units.map(u => <option key={u.id} value={u.id}>{pendingUnitIds.has(u.id) ? '🔴 ' : ''}{u.name}</option>)}
                            </optgroup>
                            <optgroup label="Bidang">
                                {fields.map(f => <option key={f.id} value={f.id}>{pendingUnitIds.has(f.id) ? '🔴 ' : ''}{f.name}</option>)}
                            </optgroup>
                        </select>
                    )}
                    <select 
                        value={filterStatus} 
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="bg-slate-50 border-0 rounded-xl px-4 py-2 text-[10px] font-black text-slate-600 uppercase tracking-widest focus:ring-2 focus:ring-indigo-100 outline-none cursor-pointer"
                    >
                        <option value="ALL">Semua Status</option>
                        <option value="PENDING">Menunggu (Pending)</option>
                        <option value="APPROVED">Disetujui (ACC)</option>
                        <option value="REJECTED">Ditolak</option>
                    </select>
                </div>
            </div>

            {sarprasViewTab === 'VERIFIKASI_ASET' ? (
                /* ── TAB VERIFIKASI ASET KHUSUS SARPRAS ── */
                <div className="grid grid-cols-1 gap-4">
                    {sarprasAssetRequests.length === 0 ? (
                        <div className="p-20 text-center bg-white/40 backdrop-blur-md rounded-[32px] border-2 border-dashed border-slate-200">
                            <Package size={48} className="mx-auto text-amber-300 mb-3" />
                            <h4 className="text-base font-black text-slate-700">Tidak Ada Permintaan Dana Pengadaan Aset</h4>
                            <p className="text-xs text-slate-400 mt-1">Belum ada unit atau bidang yang mengajukan pencairan dana pembelian aset untuk filter saat ini.</p>
                        </div>
                    ) : (
                        sarprasAssetRequests.map(req => {
                            const assetItems = (req.items || []).filter(i => isItemAsset(i));
                            const totalAssetNominal = assetItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
                            const pendingCount = assetItems.filter(i => getItemSarprasStatus(i, req) === 'PENDING').length;
                            const approvedCount = assetItems.filter(i => getItemSarprasStatus(i, req) === 'APPROVED').length;
                            const rejectedCount = assetItems.filter(i => getItemSarprasStatus(i, req) === 'REJECTED').length;
                            const unitName = units.find(u => u.id === req.unitId)?.name || fields.find(f => f.id === req.fieldId)?.name || (req.unitId === 'FOUNDATION' ? 'YAYASAN' : 'Unit');

                            return (
                                <div key={req.id} className="card p-6 bg-white hover:shadow-2xl transition-all border-2 border-slate-100 hover:border-amber-200 rounded-[2rem] group relative overflow-hidden">
                                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${pendingCount > 0 ? 'bg-amber-500 animate-pulse' : (rejectedCount > 0 ? 'bg-rose-500' : 'bg-emerald-500')}`} />
                                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                                        <div className="space-y-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-black uppercase tracking-wider border border-indigo-100">
                                                    {unitName}
                                                </span>
                                                <span className="text-xs font-bold text-slate-400">
                                                    Bulan: <b>{req.month}</b> • Tanggal: <b>{req.date}</b>
                                                </span>
                                                <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg">
                                                    {req.id}
                                                </span>
                                            </div>
                                            <h4 className="text-lg font-black text-slate-900">
                                                {req.description || 'Pengajuan Dana Pembelian Aset'}
                                            </h4>
                                            
                                            {/* Preview Rincian Barang Aset */}
                                            <div className="flex flex-wrap items-center gap-2 pt-1">
                                                <span className="text-xs font-semibold text-slate-500 mr-1">Rincian Aset ({assetItems.length}):</span>
                                                {assetItems.slice(0, 3).map((ai, aIdx) => (
                                                    <span key={aIdx} className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-50 text-slate-700 border border-slate-200">
                                                        {ai.name} ({ai.volume || 1} {ai.satuan || 'Unit'})
                                                    </span>
                                                ))}
                                                {assetItems.length > 3 && (
                                                    <span className="text-[10px] text-slate-400 font-bold">+{assetItems.length - 3} lainnya</span>
                                                )}
                                            </div>

                                            {/* Status Badges */}
                                            <div className="flex flex-wrap items-center gap-2 pt-1">
                                                {pendingCount > 0 && (
                                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200 animate-pulse flex items-center gap-1">
                                                        <Clock size={10} /> {pendingCount} Menunggu ACC Sarpras
                                                    </span>
                                                )}
                                                {approvedCount > 0 && (
                                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                                                        <CheckCircle size={10} /> {approvedCount} Disetujui Sarpras
                                                    </span>
                                                )}
                                                {rejectedCount > 0 && (
                                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                                                        <XCircle size={10} /> {rejectedCount} Ditolak Sarpras
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6 self-end lg:self-center">
                                            <div className="text-right">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">
                                                    Total Dana Aset
                                                </p>
                                                <h4 className="text-2xl font-black text-amber-600 italic tracking-tighter">
                                                    {formatRupiah(totalAssetNominal)}
                                                </h4>
                                            </div>
                                            <button
                                                onClick={() => handleOpenSarprasReview(req)}
                                                className="px-6 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 active:scale-95"
                                            >
                                                <Package size={16} />
                                                <span>Verifikasi Aset</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            ) : (
                /* ── TAB REGULAR RIWAYAT PERMINTAAN DANA ── */
                <div className="grid grid-cols-1 gap-4">
                {filteredRequests.length === 0 ? (
                    <div className="p-20 text-center bg-white/40 backdrop-blur-md rounded-[32px] border-2 border-dashed border-slate-200">
                        {isSuperAdmin && filterUnit === 'NONE' ? (
                            <>
                                <Search size={48} className="mx-auto text-indigo-300 mb-4" />
                                <h3 className="text-xl font-black text-slate-700 mb-2">Silakan Pilih Unit/Bidang Terlebih Dahulu</h3>
                                <p className="font-medium text-slate-500 max-w-md mx-auto">
                                    Pilih unit pendidikan atau bidang pada menu di atas untuk memunculkan riwayat pengajuan dananya.
                                </p>
                            </>
                        ) : (
                            <>
                                <FileText size={48} className="mx-auto text-slate-300 mb-4" />
                                <p className="font-bold text-slate-400 italic">Belum ada riwayat permintaan dana.</p>
                            </>
                        )}
                    </div>
                ) : (
                    filteredRequests.map(req => (
                        <div key={req.id} className="card p-6 bg-white hover:shadow-2xl transition-all border-white group relative overflow-hidden">
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${req.status === 'APPROVED' ? 'bg-emerald-500' : (req.status === 'REJECTED' ? 'bg-rose-500' : 'bg-amber-500')}`} />
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner">
                                        <FileText size={28} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ID: {req.id}</span>
                                            <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                            <span className="text-[10px] font-bold text-slate-400">{req.date}</span>
                                            {req.month && (
                                                <>
                                                    <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                                    <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-widest">
                                                        {yearMonths.find(m => m.id === req.month)?.label || req.month}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-2 my-4">
                                            {req.items && req.items.length > 0 ? (
                                                <div>
                                                    <button 
                                                        onClick={() => {
                                                             setExpandedCards(prev => ({...prev, [req.id]: !prev[req.id]}));
                                                        }}
                                                        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors"
                                                    >
                                                        {expandedCards[req.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                        {expandedCards[req.id] ? 'Sembunyikan Rincian' : `Lihat ${req.items.length} Rincian Item`}
                                                    </button>
                                                    
                                                    {expandedCards[req.id] && (
                                                        <div className="mt-3 pl-3 border-l-2 border-indigo-100 flex flex-col gap-2">
                                                            {req.items.map((item, idx) => (
                                                                <div key={idx} className="flex items-start md:items-center justify-between gap-4 text-sm bg-slate-50/50 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                                                                    <div className="flex items-center gap-3">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0"></span>
                                                                        <span className="font-bold text-slate-700">{item.name}</span>
                                                                        {isItemAsset(item) && (
                                                                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                                                                ASET
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <span className="font-black text-slate-500 italic text-[11px] whitespace-nowrap bg-white px-2 py-1 rounded shadow-sm">{formatRupiah(item.amount)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <h4 className="font-black text-slate-900 text-lg leading-tight mb-1">{req.description}</h4>
                                            )}
                                        </div>

                                        {/* Status Aset Indicator */}
                                        {requestHasAsset(req) && (() => {
                                            const assetItems = (req.items || []).filter(i => isItemAsset(i));
                                            const allApproved = assetItems.length > 0 && assetItems.every(i => getItemSarprasStatus(i, req) === 'APPROVED');
                                            const hasRejected = assetItems.some(i => getItemSarprasStatus(i, req) === 'REJECTED');
                                            return (
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${allApproved ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : hasRejected ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'}`}>
                                                        <Package size={12} />
                                                        {allApproved ? 'Aset Disetujui Sarpras' : hasRejected ? 'Aset Ditolak Sarpras' : `Aset Menunggu Sarpras (${assetItems.filter(i => getItemSarprasStatus(i, req) === 'PENDING').length})`}
                                                    </span>
                                                </div>
                                            );
                                        })()}

                                        {isSuperAdmin && (
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-black uppercase tracking-widest border border-slate-200">
                                                    {req.unitId === 'FOUNDATION' ? 'YAYASAN' : (state.units.find(u => u.id === req.unitId)?.name || req.unitId)}
                                                </div>
                                                {req.fieldId && (
                                                    <div className="px-2 py-0.5 bg-indigo-50 text-indigo-500 rounded text-[9px] font-black uppercase tracking-widest border border-indigo-100">
                                                        {state.fields.find(f => f.id === req.fieldId)?.name || req.fieldId}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {isSuperAdmin && (
                                            <div className="flex items-center gap-2 text-indigo-600 text-[10px] font-black uppercase tracking-widest">
                                                <Building2 size={12} />
                                                {units.find(u => u.id === req.unitId)?.name || fields.find(f => f.id === req.fieldId)?.name}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-6">
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Nominal Pengajuan</p>
                                        <h4 className="text-2xl font-black text-slate-900 italic tracking-tighter">{formatRupiah(req.totalAmount)}</h4>
                                    </div>
                                    <div className={`px-6 py-2 rounded-2xl text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg ${getStatusStyles(req.status)}`}>
                                        {req.status === 'APPROVED' ? <CheckCircle size={14} /> : (req.status === 'REJECTED' ? <XCircle size={14} /> : <Clock size={14} />)}
                                        {req.status}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {(isSarprasUser || isSuperAdmin) && requestHasAsset(req) && req.status !== 'REJECTED' && (
                                            <button
                                                onClick={() => handleOpenSarprasReview(req)}
                                                className="p-3 bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white rounded-xl transition-all shadow-sm flex items-center gap-2 font-black text-[10px] uppercase tracking-widest border border-amber-200"
                                                title="Verifikasi Aset oleh Sarpras"
                                            >
                                                <Package size={16} />
                                                VERIFIKASI ASET
                                            </button>
                                        )}
                                        {isSuperAdmin && req.status === 'PENDING' && (
                                            <button
                                                onClick={() => handleOpenReview(req)}
                                                className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm flex items-center gap-2 font-black text-[10px] uppercase tracking-widest"
                                            >
                                                <Search size={16} strokeWidth={3} />
                                                REVIEW RINCIAN
                                            </button>
                                        )}
                                        {isSuperAdmin && (req.status === 'APPROVED' || req.status === 'REJECTED') && (
                                            <button
                                                onClick={async () => {
                                                    const confirmed = window.confirm(`Batalkan ${req.status === 'APPROVED' ? 'persetujuan' : 'penolakan'} ini dan kembalikan ke status PENDING?`);
                                                    if (confirmed) {
                                                        setProcessingId(req.id);
                                                        try {
                                                            const updated = { ...req, status: 'PENDING', notified: false };
                                                            dispatch({ type: 'EDIT_BUDGET_REQUEST', payload: updated });
                                                            await api.pushAction({ type: 'EDIT_BUDGET_REQUEST', payload: updated }, state);
                                                            showToast('Persetujuan berhasil dibatalkan, status kembali ke PENDING.');
                                                        } catch (err) {
                                                            console.error('[BATAL Error]', err);
                                                            showToast('Gagal sinkron ke server, coba lagi.', 'error');
                                                        } finally {
                                                            setProcessingId(null);
                                                        }
                                                    }
                                                }}
                                                disabled={processingId === req.id}
                                                title="Batalkan persetujuan / penolakan ini"
                                                className="p-3 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-500 hover:text-white transition-all shadow-sm flex items-center gap-2 font-black text-[10px] uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {processingId === req.id ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} strokeWidth={2.5} />}
                                                BATAL
                                            </button>
                                        )}
                                        {req.status === 'PENDING' && (
                                            <button
                                                onClick={async () => {
                                                    const confirmed = window.confirm('Apakah Anda yakin ingin membatalkan pengajuan dana ini? Seluruh rincian item di dalamnya akan dikembalikan ke status belum diajukan.');
                                                    if (confirmed) {
                                                        setProcessingId(req.id);
                                                        try {
                                                            dispatch({ type: 'DELETE_BUDGET_REQUEST', payload: req.id });
                                                            await api.pushAction({ type: 'DELETE_BUDGET_REQUEST', payload: req.id }, state);
                                                            showToast('Pengajuan dana berhasil dibatalkan.');
                                                        } catch (err) {
                                                            console.error('[BATAL_REQ Error]', err);
                                                            showToast('Gagal membatalkan pengajuan.', 'error');
                                                            const freshData = await api.fetchAllData();
                                                            if (freshData) dispatch({ type: 'SET_ALL_DATA', payload: freshData });
                                                        } finally {
                                                            setProcessingId(null);
                                                        }
                                                    }
                                                }}
                                                disabled={processingId === req.id}
                                                className="p-3 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all font-black text-[10px] border border-transparent hover:border-rose-100 flex items-center gap-2 uppercase tracking-widest disabled:opacity-50"
                                            >
                                                {processingId === req.id ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                                                Batalkan
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handlePrint(req)}
                                            className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-all italic font-black text-[10px] border border-transparent hover:border-indigo-100 flex items-center gap-2 uppercase tracking-widest"
                                        >
                                            <FileText size={16} />
                                            Cetak Surat
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
            )}

            {/* Modal Pengajuan Baru */}
            {showRequestModal && (
                <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setShowRequestModal(false)} />
                    <div className="bg-slate-50 rounded-[3rem] w-full max-w-4xl max-h-[90vh] overflow-hidden relative z-10 shadow-2xl flex flex-col animate-in slide-in-from-bottom-8">
                        <div className="p-10 bg-white border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h2 className="text-3xl font-black text-slate-900 mb-1">Rincian Dana {sourceMode === 'BOS' ? 'BOS' : 'Yayasan'}</h2>
                                <p className="text-slate-500 font-medium italic">Hanya menampilkan rincian {sourceMode} yang telah disetujui (ACC) oleh Superadmin.</p>

                                <div className="flex items-center gap-4 mt-6">
                                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl shadow-inner"><Calendar size={20} /></div>
                                    <div className="flex flex-col">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Periode Pencairan Dana</label>
                                        <select
                                            value={requestMonth}
                                            onChange={(e) => {
                                                setRequestMonth(e.target.value);
                                                setSelectedComponents([]);
                                            }}
                                            className="bg-white border-2 border-indigo-100 rounded-xl px-4 py-2 text-sm font-black text-indigo-900 focus:ring-4 focus:ring-indigo-50 outline-none transition-all cursor-pointer shadow-sm"
                                        >
                                            {yearMonths.map(m => (
                                                <option key={m.id} value={m.id}>
                                                    BULAN: {m.label.toUpperCase()} {monthlyTotals[m.id] > 0 ? `- Rp ${monthlyTotals[m.id].toLocaleString('id-ID')}` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    {approvedComponents.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={handleToggleSelectAll}
                                            className={`self-end px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm flex items-center gap-2 ${
                                                isAllSelected
                                                    ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                    : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white'
                                            }`}
                                        >
                                            {isAllSelected ? (
                                                <>
                                                    <XCircle size={14} strokeWidth={3} />
                                                    Batal Pilih Semua
                                                </>
                                            ) : (
                                                <>
                                                    <CheckCircle size={14} strokeWidth={3} />
                                                    Pilih Semua
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    className="bg-slate-50 border-0 rounded-2xl pl-12 pr-6 py-3 w-64 text-sm font-bold focus:ring-2 focus:ring-indigo-100 text-slate-800"
                                    placeholder="Cari rincian..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        {(() => {
                            const unreturnedInfo = getUnreturnedBalanceInfo(state, myUnitId || 'FOUNDATION', myFieldId, requestMonth, sourceMode, globalAcademicYearId);
                            if (!unreturnedInfo.hasUnreturned) return null;
                            return (
                                <div className="mx-10 mt-6 p-4 bg-amber-50 rounded-2xl border border-amber-200 flex items-start gap-3 text-amber-800">
                                    <AlertCircle className="shrink-0 text-amber-600 mt-0.5" size={18} />
                                    <div>
                                        <h5 className="font-black text-xs uppercase tracking-widest text-amber-900 mb-1">Peringatan: Saldo Belum Dikembalikan</h5>
                                        <p className="text-xs font-semibold">
                                            Unit Anda memiliki sisa saldo dari bulan sebelumnya yang belum dikembalikan ke Yayasan sebesar <span className="font-black">{formatRupiah(unreturnedInfo.amount)}</span>. 
                                            Harap lakukan pengembalian saldo terlebih dahulu di menu Ketersediaan Dana sebelum pengajuan ini disetujui.
                                        </p>
                                    </div>
                                </div>
                            );
                        })()}

                        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar text-slate-900">
                            {filteredComps.length === 0 ? (
                                <div className="p-20 text-center border-2 border-dashed border-slate-200 rounded-[2.5rem]">
                                    <AlertCircle size={48} className="mx-auto text-amber-400 mb-4" />
                                    <h4 className="font-black text-slate-800 text-xl mb-1">Tidak Ada Rincian ACC</h4>
                                    <p className="text-slate-400 font-medium italic">Tidak ditemukan rincian belanja berstatus ACC yang tersedia untuk ditarik dananya.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-4">
                                    {filteredComps.map(comp => (
                                        <div
                                            key={comp.id}
                                            onClick={() => {
                                                setSelectedComponents(prev =>
                                                    prev.includes(comp.id) ? prev.filter(id => id !== comp.id) : [...prev, comp.id]
                                                );
                                            }}
                                            className={`p-6 rounded-[2rem] border-2 transition-all cursor-pointer flex items-center justify-between group ${selectedComponents.includes(comp.id)
                                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-600/20'
                                                : 'bg-white border-white hover:border-indigo-100 shadow-sm'
                                                }`}
                                        >
                                            <div className="flex items-center gap-6">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${selectedComponents.includes(comp.id) ? 'bg-white/20' : 'bg-slate-50 text-slate-400'
                                                    }`}>
                                                    {selectedComponents.includes(comp.id) ? <Check size={24} strokeWidth={4} /> : <Plus size={20} />}
                                                </div>
                                                <div>
                                                    <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${selectedComponents.includes(comp.id) ? 'text-indigo-100' : 'text-slate-400'}`}>
                                                        {comp.itemMasterName}
                                                    </p>
                                                    <h4 className="font-black text-lg tracking-tight leading-tight">{comp.label || comp.name}</h4>
                                                    {(() => {
                                                        const details = resolveItemDetails(comp);
                                                        return (
                                                            <p className={`text-[10px] font-bold ${selectedComponents.includes(comp.id) ? 'text-indigo-200' : 'text-slate-400'}`}>
                                                                {details.volume} {details.satuan} x {formatRupiah(details.harga)}
                                                            </p>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className={`text-[10px] font-black uppercase tracking-widest mb-1 italic ${selectedComponents.includes(comp.id) ? 'text-indigo-100' : 'text-slate-400'}`}>Nominal Rincian</p>
                                                <h4 className="text-xl font-black italic tracking-tighter">{formatRupiah(comp.total)}</h4>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-10 bg-white border-t border-slate-100 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Terpilih</p>
                                <h3 className="text-3xl font-black text-indigo-700 italic tracking-tighter">
                                    {formatRupiah(approvedComponents.filter(c => selectedComponents.includes(c.id)).reduce((s, c) => s + (parseFloat(c.total) || 0), 0))}
                                </h3>
                            </div>
                            <div className="flex gap-4">
                                <button onClick={() => setShowRequestModal(false)} className="btn bg-slate-100 text-slate-600 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">Batal</button>
                                <button
                                    onClick={handleCreateRequest}
                                    disabled={selectedComponents.length === 0}
                                    className={`btn ${sourceMode === 'BOS' ? 'bg-emerald-600' : 'bg-indigo-600'} text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-slate-900 transition-all disabled:opacity-50 active:scale-95 flex items-center gap-3`}
                                >
                                    <Send size={18} />
                                    AJUKAN PENCAIRAN {sourceMode}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal Review Permintaan (Superadmin) */}
            {reviewRequest && (
                <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setReviewRequest(null)} />
                    <div className="bg-slate-50 rounded-[3rem] w-full max-w-4xl max-h-[90vh] overflow-hidden relative z-10 shadow-2xl flex flex-col animate-in slide-in-from-bottom-8">
                        <div className="p-10 bg-white border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div>
                                <h2 className="text-3xl font-black text-slate-900 mb-1">Review Rincian Dana</h2>
                                <p className="text-slate-500 font-medium italic">Anda dapat menyetujui (ACC) atau Menolak per-rincian. ID: <span className="font-bold text-indigo-600">{reviewRequest.req.id}</span></p>
                            </div>
                            <div className="flex flex-col gap-3">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input 
                                        type="text" 
                                        placeholder="Cari rincian..." 
                                        value={modalSearchTerm}
                                        onChange={(e) => setModalSearchTerm(e.target.value)}
                                        className="w-full bg-slate-50 border-0 rounded-xl pl-10 pr-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-100 outline-none"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => {
                                        setReviewRequest(prev => ({ ...prev, accIds: prev.req.items.map(i => i.componentId), tolakIds: [] }));
                                    }} className="flex-1 px-4 py-3 bg-emerald-50 text-emerald-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all shadow-sm flex items-center justify-center gap-2"><Check size={16}/> ACC SEMUA</button>
                                    <button onClick={() => {
                                        setReviewRequest(prev => ({ ...prev, tolakIds: prev.req.items.map(i => i.componentId), accIds: [] }));
                                    }} className="flex-1 px-4 py-3 bg-rose-50 text-rose-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all shadow-sm flex items-center justify-center gap-2"><XCircle size={16}/> TOLAK SEMUA</button>
                                </div>
                            </div>
                        </div>

                        {(() => {
                            const reqSource = reviewRequest.req.source || ((reviewRequest.req.items || []).some(item => item.planId?.endsWith('-BOS')) ? 'BOS' : 'YAYASAN');
                            const superadminUnreturnedInfo = getUnreturnedBalanceInfo(state, reviewRequest.req.unitId, reviewRequest.req.fieldId, reviewRequest.req.month, reqSource, reviewRequest.req.academicYearId);
                            if (!superadminUnreturnedInfo.hasUnreturned) return null;
                            return (
                                <div className="mx-10 mt-6 p-5 bg-rose-50 rounded-2xl border border-rose-200 flex items-start gap-3 text-rose-800">
                                    <AlertCircle className="shrink-0 text-rose-600 mt-0.5" size={20} />
                                    <div className="flex-1">
                                        <h5 className="font-black text-xs uppercase tracking-widest text-rose-900 mb-1">Pencairan Ditangguhkan (Blocked)</h5>
                                        <p className="text-xs font-semibold leading-relaxed">
                                            Unit/Bidang pemohon memiliki sisa saldo dana <b>{superadminUnreturnedInfo.isBos ? 'BOS' : 'Yayasan'}</b> bulan sebelumnya yang belum dipertanggungjawabkan/dikembalikan sebesar <span className="font-black text-rose-700">{formatRupiah(superadminUnreturnedInfo.amount)}</span>.
                                            Pencairan otomatis ditangguhkan sampai sisa saldo dikembalikan dan disetujui.
                                        </p>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Banner Kas/Bank Pencairan Global */}
                        <div className="mx-10 mt-6 p-5 bg-gradient-to-r from-indigo-50/90 via-sky-50/80 to-indigo-50/90 border border-indigo-100 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                            <div className="flex items-center gap-3.5">
                                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
                                    <Banknote size={20} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h4 className="text-xs font-black uppercase tracking-wider text-indigo-950">Rekening Kas / Bank Pencairan (Kredit Utama)</h4>
                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-indigo-200/60 text-indigo-800">COA Otomatis</span>
                                    </div>
                                    <p className="text-[11px] font-medium text-slate-500">Pilih rekening kas/bank yayasan yang akan dicatat pada sisi Kredit jurnal untuk seluruh rincian</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <select
                                    value={reviewRequest.globalCreditAccountId || ''}
                                    onChange={(e) => handleApplyGlobalCredit(e.target.value)}
                                    className="bg-white border border-indigo-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-300 outline-none shadow-sm min-w-[260px]"
                                >
                                    <option value="" disabled>-- Pilih Rekening Kas / Bank --</option>
                                    {cashBankAccounts.length > 0 && (
                                        <optgroup label="Kas & Bank Yayasan / BOS">
                                            {cashBankAccounts.map(a => (
                                                <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                                            ))}
                                        </optgroup>
                                    )}
                                    <optgroup label="Daftar Akun Lainnya">
                                        {postableAccounts.filter(a => !cashBankAccounts.some(c => c.id === a.id)).map(a => (
                                            <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                                        ))}
                                    </optgroup>
                                </select>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar text-slate-900 bg-slate-50/50">
                            <div className="grid grid-cols-1 gap-4">
                                {(modalSearchTerm ? reviewRequest.req.items.filter(i => i.name.toLowerCase().includes(modalSearchTerm.toLowerCase())) : reviewRequest.req.items).map(item => {
                                    const isAcc = reviewRequest.accIds.includes(item.componentId);
                                    const isTolak = reviewRequest.tolakIds.includes(item.componentId);
                                    const itemDebitId = reviewRequest.itemMappings?.[item.componentId]?.debitAccountId || '';
                                    const itemCreditId = reviewRequest.itemMappings?.[item.componentId]?.creditAccountId || reviewRequest.globalCreditAccountId || '';
                                    
                                    return (
                                        <div key={item.componentId} className={`p-6 rounded-[2rem] border-2 transition-all flex flex-col gap-4 group bg-white ${isAcc ? 'border-emerald-500 shadow-xl shadow-emerald-500/20' : isTolak ? 'border-rose-500 shadow-xl shadow-rose-500/20' : 'border-slate-200 hover:border-indigo-200 shadow-sm'}`}>
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                <div className="flex items-center gap-5">
                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all shrink-0 ${isAcc ? 'bg-emerald-50 text-emerald-600' : isTolak ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-400'}`}>
                                                        {isAcc ? <Check size={24} strokeWidth={3} /> : isTolak ? <XCircle size={24} strokeWidth={3} /> : <FileText size={20} />}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-black text-lg tracking-tight leading-tight mb-1">{item.name}</h4>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <p className={`text-[13px] font-black ${isAcc ? 'text-emerald-600' : isTolak ? 'text-rose-600' : 'text-slate-700'}`}>{formatRupiah(item.amount)}</p>
                                                            {(item.volume && item.satuan) && (
                                                                <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                                                                    {item.volume} {item.satuan}
                                                                </span>
                                                            )}
                                                            {isItemAsset(item) && (() => {
                                                                const st = getItemSarprasStatus(item, reviewRequest.req);
                                                                return (
                                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black border ${st === 'APPROVED' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : st === 'REJECTED' ? 'bg-rose-100 text-rose-800 border-rose-200' : 'bg-amber-100 text-amber-800 border-amber-200'}`}>
                                                                        <Package size={10} />
                                                                        {st === 'APPROVED' ? '✓ Disetujui Sarpras' : st === 'REJECTED' ? `✕ Ditolak Sarpras` : '⏳ Menunggu Sarpras'}
                                                                    </span>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                                    <button onClick={() => {
                                                        setReviewRequest(prev => ({
                                                            ...prev,
                                                            accIds: isAcc ? prev.accIds.filter(id => id !== item.componentId) : [...prev.accIds, item.componentId],
                                                            tolakIds: prev.tolakIds.filter(id => id !== item.componentId)
                                                        }));
                                                    }} className={`px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border-2 ${isAcc ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-transparent border-slate-200 text-slate-400 hover:border-emerald-500 hover:text-emerald-500'}`}>
                                                        <Check size={14} className="inline mr-1.5" /> ACC
                                                    </button>
                                                    <button onClick={() => {
                                                        setReviewRequest(prev => ({
                                                            ...prev,
                                                            tolakIds: isTolak ? prev.tolakIds.filter(id => id !== item.componentId) : [...prev.tolakIds, item.componentId],
                                                            accIds: prev.accIds.filter(id => id !== item.componentId)
                                                        }));
                                                    }} className={`px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border-2 ${isTolak ? 'bg-rose-500 border-rose-500 text-white' : 'bg-transparent border-slate-200 text-slate-400 hover:border-rose-500 hover:text-rose-500'}`}>
                                                        <XCircle size={14} className="inline mr-1.5" /> TOLAK
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Mapping COA Selector Per Item */}
                                            <div className={`pt-3.5 border-t border-slate-100 rounded-2xl p-4 transition-all ${isAcc ? 'bg-emerald-50/40 border border-emerald-100' : 'bg-slate-50/80 border border-slate-200/60'}`}>
                                                <div className="flex items-center justify-between mb-2.5">
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                                        <BookOpen size={12} className="text-indigo-600" />
                                                        Penentuan Akun Jurnal Otomatis (COA):
                                                    </span>
                                                    {itemDebitId && itemCreditId ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                            <Check size={10} /> COA Siap Di-Jurnal
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                                                            <AlertCircle size={10} /> Lengkapi COA
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {/* Akun Debit */}
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block"></span>
                                                            Debit (Beban / Aset):
                                                        </label>
                                                        <select
                                                            value={itemDebitId}
                                                            onChange={(e) => handleUpdateItemMapping(item.componentId, 'debitAccountId', e.target.value)}
                                                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-200 outline-none shadow-sm"
                                                        >
                                                            <option value="">-- Pilih Akun Beban / Aset --</option>
                                                            {expenseAccounts.length > 0 && (
                                                                <optgroup label="Beban Operasional (5-xxxx)">
                                                                    {expenseAccounts.map(a => (
                                                                        <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                                                                    ))}
                                                                </optgroup>
                                                            )}
                                                            {assetAccounts.length > 0 && (
                                                                <optgroup label="Aset / Peralatan (1-xxxx)">
                                                                    {assetAccounts.map(a => (
                                                                        <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                                                                    ))}
                                                                </optgroup>
                                                            )}
                                                            <optgroup label="Daftar Akun Lainnya">
                                                                {postableAccounts.filter(a => !expenseAccounts.some(e => e.id === a.id) && !assetAccounts.some(as => as.id === a.id)).map(a => (
                                                                    <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                                                                ))}
                                                            </optgroup>
                                                        </select>
                                                    </div>

                                                    {/* Akun Kredit */}
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                                                            Kredit (Kas / Bank):
                                                        </label>
                                                        <select
                                                            value={itemCreditId}
                                                            onChange={(e) => handleUpdateItemMapping(item.componentId, 'creditAccountId', e.target.value)}
                                                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-200 outline-none shadow-sm"
                                                        >
                                                            <option value="">-- Pilih Rekening Kas / Bank --</option>
                                                            {cashBankAccounts.length > 0 && (
                                                                <optgroup label="Kas & Bank">
                                                                    {cashBankAccounts.map(a => (
                                                                        <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                                                                    ))}
                                                                </optgroup>
                                                            )}
                                                            <optgroup label="Daftar Akun Lainnya">
                                                                {postableAccounts.filter(a => !cashBankAccounts.some(c => c.id === a.id)).map(a => (
                                                                    <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                                                                ))}
                                                            </optgroup>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {(() => {
                            const reqSource = reviewRequest.req.source || ((reviewRequest.req.items || []).some(item => item.planId?.endsWith('-BOS')) ? 'BOS' : 'YAYASAN');
                            const superadminUnreturnedInfo = getUnreturnedBalanceInfo(state, reviewRequest.req.unitId, reviewRequest.req.fieldId, reviewRequest.req.month, reqSource, reviewRequest.req.academicYearId);
                            const hasBlock = superadminUnreturnedInfo.hasUnreturned;

                            return (
                                <div className="p-10 bg-white border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Di-ACC</p>
                                        <h3 className="text-3xl font-black text-emerald-600 italic tracking-tighter">
                                            {formatRupiah(reviewRequest.req.items.filter(i => reviewRequest.accIds.includes(i.componentId)).reduce((s, i) => s + (parseFloat(i.amount)||0), 0))}
                                        </h3>
                                    </div>
                                    <div className="flex flex-wrap gap-3 items-center">
                                        <button onClick={() => setReviewRequest(null)} className="btn bg-slate-100 text-slate-600 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">Batal</button>
                                        
                                        <button
                                            onClick={() => handleSaveReview()}
                                            disabled={processingId === 'saving-review' || (reviewRequest.accIds.length === 0 && reviewRequest.tolakIds.length === 0) || hasBlock}
                                            className="btn bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 shadow-xl hover:bg-indigo-700 disabled:opacity-50 disabled:scale-100 transition-all"
                                        >
                                            {processingId === 'saving-review' ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                            SIMPAN PERSETUJUAN
                                        </button>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* Modal Verifikasi Aset untuk Sarpras */}
            {sarprasReviewModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setSarprasReviewModal(null)} />
                    <div className="relative bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="p-8 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                                    <Package size={28} className="text-white" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="bg-white/25 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider text-amber-50">
                                            Verifikasi Aset Sarpras
                                        </span>
                                        <span className="text-xs font-bold text-amber-100">
                                            {sarprasReviewModal.req.month} • {units.find(u => u.id === sarprasReviewModal.req.unitId)?.name || fields.find(f => f.id === sarprasReviewModal.req.fieldId)?.name || 'Unit'}
                                        </span>
                                    </div>
                                    <h3 className="text-xl font-black mt-1">
                                        Persetujuan Belanja Aset — Permintaan Dana
                                    </h3>
                                </div>
                            </div>
                            <button
                                onClick={() => setSarprasReviewModal(null)}
                                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                            >
                                <XCircle size={24} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
                                <div>
                                    <h4 className="font-black text-slate-800 text-sm uppercase tracking-wider">
                                        Daftar Rincian Pengadaan Aset
                                    </h4>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Silakan periksa spesifikasi barang dan tentukan persetujuan sebelum dana dicairkan oleh Keuangan.
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        const newDecisions = { ...sarprasReviewModal.itemDecisions };
                                        Object.keys(newDecisions).forEach(id => {
                                            newDecisions[id] = { status: 'APPROVED', notes: '' };
                                        });
                                        setSarprasReviewModal(prev => ({ ...prev, itemDecisions: newDecisions }));
                                    }}
                                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors shadow-sm flex items-center gap-2 shrink-0 self-start sm:self-auto"
                                >
                                    <Check size={14} strokeWidth={3} />
                                    ACC Semua Aset
                                </button>
                            </div>

                            <div className="space-y-4">
                                {(sarprasReviewModal.req.items || []).filter(i => isItemAsset(i)).map((item, idx) => {
                                    const decision = sarprasReviewModal.itemDecisions[item.componentId] || { status: 'PENDING', notes: '' };
                                    const isAcc = decision.status === 'APPROVED';
                                    const isRej = decision.status === 'REJECTED';

                                    return (
                                        <div
                                            key={item.componentId || idx}
                                            className={`p-5 rounded-2xl border-2 transition-all bg-white ${isAcc ? 'border-emerald-400 bg-emerald-50/20' : isRej ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200'}`}
                                        >
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                <div className="space-y-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="font-black text-base text-slate-900">{item.name}</span>
                                                        {item.assetCategory && (
                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                                                {item.assetCategory}
                                                            </span>
                                                        )}
                                                        {item.assetRoom && (
                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                                                                Ruang: {item.assetRoom}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-slate-500 font-medium flex flex-wrap items-center gap-3">
                                                        <span>Volume: <b>{item.volume || 1} {item.satuan || 'Unit'}</b></span>
                                                        <span>•</span>
                                                        <span>Harga Satuan: <b>{formatRupiah(item.harga || item.amount)}</b></span>
                                                        <span>•</span>
                                                        <span className="text-indigo-600 font-black">Total: {formatRupiah(item.amount)}</span>
                                                    </div>
                                                    {isRej && (
                                                        <div className="mt-2">
                                                            <input
                                                                type="text"
                                                                placeholder="Alasan penolakan Sarpras (wajib)..."
                                                                value={decision.notes || ''}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    setSarprasReviewModal(prev => ({
                                                                        ...prev,
                                                                        itemDecisions: {
                                                                            ...prev.itemDecisions,
                                                                            [item.componentId]: { ...decision, notes: val }
                                                                        }
                                                                    }));
                                                                }}
                                                                className="w-full text-xs px-3 py-2 rounded-xl border border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-400 bg-white"
                                                            />
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-2 shrink-0">
                                                    <button
                                                        onClick={() => {
                                                            setSarprasReviewModal(prev => ({
                                                                ...prev,
                                                                itemDecisions: {
                                                                    ...prev.itemDecisions,
                                                                    [item.componentId]: { status: isAcc ? 'PENDING' : 'APPROVED', notes: '' }
                                                                }
                                                            }));
                                                        }}
                                                        className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 ${isAcc ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-emerald-100 hover:text-emerald-700'}`}
                                                    >
                                                        <Check size={14} strokeWidth={3} />
                                                        {isAcc ? '✓ Di-ACC' : 'ACC'}
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            const reason = !isRej ? (decision.notes || window.prompt('Masukkan alasan penolakan Sarpras:') || 'Ditolak Sarpras') : '';
                                                            setSarprasReviewModal(prev => ({
                                                                ...prev,
                                                                itemDecisions: {
                                                                    ...prev.itemDecisions,
                                                                    [item.componentId]: { status: isRej ? 'PENDING' : 'REJECTED', notes: reason }
                                                                }
                                                            }));
                                                        }}
                                                        className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 ${isRej ? 'bg-rose-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-rose-100 hover:text-rose-700'}`}
                                                    >
                                                        <XCircle size={14} />
                                                        {isRej ? '✕ Ditolak' : 'Tolak'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                            <button
                                onClick={() => setSarprasReviewModal(null)}
                                className="px-6 py-3 rounded-xl text-slate-600 font-black text-xs uppercase tracking-wider hover:bg-slate-200 transition-colors"
                            >
                                Tutup
                            </button>
                            <button
                                onClick={handleSaveSarprasModal}
                                disabled={processingId === 'saving-sarpras-review'}
                                className="px-8 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
                            >
                                {processingId === 'saving-sarpras-review' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                Simpan Verifikasi Sarpras
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
