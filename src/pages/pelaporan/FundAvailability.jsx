import React, { useMemo, useState, useEffect } from 'react';
import { Landmark, TrendingUp, Info, ShieldCheck, HelpCircle, Layers, Wallet, Clock, CheckCircle, Building2, ChevronDown, ChevronRight, Users, HandCoins, X, UploadCloud, Save, Loader2, FileCheck, Eye, Calendar, Tag, Filter, Lock, Unlock } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatRupiah } from '../../utils/format';
import { api } from '../../services/api';

// Helper formatting bulan ID
function formatMonthLabel(mStr) {
    if (!mStr || mStr === 'ALL') return 'Semua Bulan';
    if (mStr.includes('-')) {
        const [y, m] = mStr.split('-');
        const date = new Date(parseInt(y), parseInt(m) - 1, 1);
        return date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    }
    return mStr;
}

// Helper resolve report to budget request
function resolveReportRequest(report, budgetRequests, globalAcademicYearId) {
    if (!report || !budgetRequests || budgetRequests.length === 0) return null;

    // 1. Check exact matching componentId FIRST in approved budgetRequests
    if (report.componentId) {
        const found = budgetRequests.find(r => 
            r.status === 'APPROVED' && 
            (report.unitId ? (r.unitId === report.unitId || r.fieldId === report.unitId) : true) &&
            r.items && 
            r.items.some(i => i.componentId === report.componentId)
        );
        if (found) return found;
    }

    const rReqId = report.budgetRequestId || report.requestId;
    const reportItemName = (report.category || report.description || '').trim().toLowerCase();

    // 2. Check exact budgetRequestId if it exists AND its items contain the report item name/category
    if (rReqId) {
        const found = budgetRequests.find(r => r.id === rReqId);
        if (found) {
            if (report.kategoriAset === 'PENGEMBALIAN') return found;
            if (!reportItemName || !found.items || found.items.length === 0) {
                return found;
            } else {
                const hasItem = found.items.some(i => (i.name || '').trim().toLowerCase() === reportItemName);
                if (hasItem) return found;
            }
        }
    }

    // 3. Search for approved budgetRequest by category / name
    if (reportItemName) {
        const found = budgetRequests.find(r => 
            r.status === 'APPROVED' &&
            (report.unitId ? (r.unitId === report.unitId || r.fieldId === report.unitId) : true) &&
            r.items &&
            r.items.some(i => (i.name || '').trim().toLowerCase() === reportItemName)
        );
        if (found) return found;
    }

    // 4. Special handling for PENGEMBALIAN (Refund) reports:
    if (report.kategoriAset === 'PENGEMBALIAN' && report.date) {
        if (rReqId) {
            const found = budgetRequests.find(r => r.id === rReqId);
            if (found) return found;
        }

        const reportMonth = report.date.substring(0, 7);
        const approvedReqs = budgetRequests.filter(r => {
            const isSameUnit = (r.unitId && (r.unitId === report.unitId || r.unitId === report.fieldId)) ||
                               (r.fieldId && (r.fieldId === report.unitId || r.fieldId === report.fieldId));
            return isSameUnit && r.status === 'APPROVED' && (!globalAcademicYearId || r.academicYearId === globalAcademicYearId);
        }).sort((a, b) => (b.month || '').localeCompare(a.month || ''));

        const prevMonthReq = approvedReqs.find(r => r.month < reportMonth);
        if (prevMonthReq) return prevMonthReq;
    }

    // 5. Fallback: return budgetRequestId if matched
    if (rReqId) {
        const found = budgetRequests.find(r => r.id === rReqId);
        if (found) return found;
    }

    // 6. Fallback: match by date month and unit
    if (report.date) {
        const reportMonth = report.date.substring(0, 7);
        const foundByDate = budgetRequests.find(r => {
            const isSameUnit = (r.unitId && (r.unitId === report.unitId || r.unitId === report.fieldId)) ||
                               (r.fieldId && (r.fieldId === report.unitId || r.fieldId === report.fieldId));
            return isSameUnit && r.status === 'APPROVED' && r.month === reportMonth;
        });
        if (foundByDate) return foundByDate;
    }

    return null;
}

// ────────────────────────────────────────────────────────────
// Helper: hitung saldo satu entitas (unit atau bidang)
// ────────────────────────────────────────────────────────────
function calcEntityBalance(requests, reports) {
    const approved = requests.filter(r => r.status === 'APPROVED').reduce((s, r) => s + (parseFloat(r.totalAmount) || 0), 0);
    const used = reports.filter(r => r.kategoriAset !== 'PENGEMBALIAN' && r.status === 'APPROVED').reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const returned = reports.filter(r => r.kategoriAset === 'PENGEMBALIAN' && r.status === 'APPROVED').reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const pending = requests.filter(r => r.status === 'PENDING').reduce((s, r) => s + (parseFloat(r.totalAmount) || 0), 0);
    return { approved, used, returned, balance: Math.max(0, approved - used - returned), pending };
}

// ────────────────────────────────────────────────────────────
// Baris entitas (unit / bidang) yang bisa di-expand
// ────────────────────────────────────────────────────────────
function EntityRow({ name, type, requests, reports, selectedMonth, budgetRequests, globalAcademicYearId }) {
    const [open, setOpen] = useState(false);

    const filteredRequests = useMemo(() => {
        if (selectedMonth === 'ALL') return requests;
        return requests.filter(r => r.month === selectedMonth);
    }, [requests, selectedMonth]);

    const filteredReports = useMemo(() => {
        if (selectedMonth === 'ALL') return reports;
        return reports.filter(r => {
            const req = resolveReportRequest(r, budgetRequests, globalAcademicYearId);
            if (req) return req.month === selectedMonth;
            return r.date ? r.date.startsWith(selectedMonth) : false;
        });
    }, [reports, selectedMonth, budgetRequests, globalAcademicYearId]);

    const { approved, used, returned, balance } = calcEntityBalance(filteredRequests, filteredReports);

    // Rincian per kategori (item)
    const positions = useMemo(() => {
        const pos = {};
        filteredRequests.filter(r => r.status === 'APPROVED').forEach(req => {
            (req.items || []).forEach(item => {
                const cat = item.name || 'General';
                if (!pos[cat]) pos[cat] = { category: cat, totalApproved: 0, totalUsed: 0, totalReturned: 0 };
                pos[cat].totalApproved += (parseFloat(item.amount) || 0);
            });
        });
        filteredReports.forEach(rel => {
            if (rel.kategoriAset === 'PENGEMBALIAN' || rel.status !== 'APPROVED') return;
            const cat = rel.category || 'General';
            if (!pos[cat]) pos[cat] = { category: cat, totalApproved: 0, totalUsed: 0, totalReturned: 0 };
            pos[cat].totalUsed += (parseFloat(rel.amount) || 0);
        });
        
        const list = Object.values(pos).filter(p => p.totalApproved > 0 || p.totalUsed > 0);
        const totalApprovedReturned = filteredReports.filter(r => r.kategoriAset === 'PENGEMBALIAN' && r.status === 'APPROVED').reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
        let remainingReturned = totalApprovedReturned;
        list.forEach(p => {
            const initialSisa = p.totalApproved - p.totalUsed;
            if (initialSisa > 0) {
                const allocatedReturn = Math.min(remainingReturned, initialSisa);
                p.totalReturned = allocatedReturn;
                remainingReturned -= allocatedReturn;
            } else {
                p.totalReturned = 0;
            }
        });
        return list;
    }, [filteredRequests, filteredReports]);

    const balanceColor = balance < 0 ? 'text-rose-600' : balance > 0 ? 'text-emerald-600' : 'text-slate-400';

    return (
        <>
            <tr
                className={`border-b border-slate-100 cursor-pointer transition-colors ${open ? 'bg-indigo-50/60' : 'hover:bg-slate-50'}`}
                onClick={() => setOpen(o => !o)}
            >
                <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${type === 'unit' ? 'bg-indigo-50 text-indigo-600' : 'bg-violet-50 text-violet-600'}`}>
                            {type === 'unit' ? <Building2 size={16} /> : <Users size={16} />}
                        </div>
                        <div>
                            <div className="font-black text-slate-800 text-sm">{name}</div>
                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{type === 'unit' ? 'Unit' : 'Bidang'}</div>
                        </div>
                    </div>
                </td>
                <td className="px-6 py-5 font-bold text-emerald-700 text-sm">{formatRupiah(approved)}</td>
                <td className="px-6 py-5 font-bold text-rose-600 text-sm">{formatRupiah(used)}</td>
                <td className="px-6 py-5">
                    <span className={`font-black text-base ${balanceColor}`}>{formatRupiah(balance)}</span>
                </td>
                <td className="px-6 py-5 font-bold text-indigo-600 text-sm">{formatRupiah(returned)}</td>
                <td className="px-6 py-5 text-center">
                    {positions.length > 0 ? (
                        open
                            ? <ChevronDown size={16} className="text-indigo-500 mx-auto" />
                            : <ChevronRight size={16} className="text-slate-300 mx-auto" />
                    ) : <span className="text-[10px] text-slate-300 italic">—</span>}
                </td>
            </tr>

            {/* Sub-rows: rincian per item */}
            {open && positions.map((pos, idx) => {
                const avail = Math.max(0, pos.totalApproved - pos.totalUsed - (pos.totalReturned || 0));
                const pct = pos.totalApproved > 0 ? (pos.totalUsed / pos.totalApproved) * 100 : 0;
                return (
                    <tr key={idx} className="bg-slate-50/80 border-b border-slate-100/60">
                        <td className="pl-20 pr-6 py-4">
                            <div className="flex items-center gap-3">
                                <div className="w-1.5 h-8 rounded-full bg-indigo-300" />
                                <span className="text-xs font-bold text-slate-600 italic">{pos.category}</span>
                            </div>
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-500">{formatRupiah(pos.totalApproved)}</td>
                        <td className="px-6 py-4 text-xs font-bold text-rose-500">{formatRupiah(pos.totalUsed)}</td>
                        <td className="px-6 py-4">
                            <span className={`text-xs font-black ${avail < 0 ? 'text-rose-600' : 'text-indigo-600'}`}>{formatRupiah(avail)}</span>
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-700 text-center">
                            {pos.totalReturned > 0 ? formatRupiah(pos.totalReturned) : '—'}
                        </td>
                        <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                                <div className="flex-1 bg-slate-200 h-2 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${Math.min(100, pct)}%` }} />
                                </div>
                                <span className="text-[10px] font-black text-slate-400">{pct.toFixed(0)}%</span>
                            </div>
                        </td>
                    </tr>
                );
            })}
        </>
    );
}

// ────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────
export default function FundAvailability() {
    const { state, dispatch } = useApp();
    const { currentUser, budgetRequests, budgetReports, units, fields, globalAcademicYearId } = state;

    const [showReturnModal, setShowReturnModal] = useState(false);
    const [returnForm, setReturnForm] = useState({ amount: '', buktiTeks: '', description: '', budgetRequestId: '' });
    const [isReturnAmountLocked, setIsReturnAmountLocked] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [processingId, setProcessingId] = useState(null);
    const [reviewData, setReviewData] = useState(null);
    
    // STATES: Filter Bulan & Mode Tampilan
    const [selectedMonth, setSelectedMonth] = useState('ALL');
    const [viewMode, setViewMode] = useState('month_breakdown'); // 'month_breakdown' | 'category_breakdown'
    const [expandedRequestIds, setExpandedRequestIds] = useState([]);

    const isSuperAdmin = currentUser?.role === 'superadmin';
    const myUnitId = currentUser?.unitId;
    const myFieldId = currentUser?.fieldId;

    // ── Filter base requests (Exclude BOS)
    const baseRequests = useMemo(() =>
        (budgetRequests || []).filter(r => {
            if (r.academicYearId !== globalAcademicYearId) return false;
            const isBos = (r.items || []).some(item => item.planId?.endsWith('-BOS'));
            if (isBos) return false;
            if (!isSuperAdmin) {
                if (myUnitId && r.unitId !== myUnitId) return false;
                if (myFieldId && r.fieldId !== myFieldId) return false;
            }
            return true;
        }),
        [budgetRequests, globalAcademicYearId, isSuperAdmin, myUnitId, myFieldId]);

    // ── Filter base reports (Exclude BOS)
    const baseReports = useMemo(() =>
        (budgetReports || []).filter(r => {
            if (r.academicYearId !== globalAcademicYearId || r.isDeleted || r.status === 'REJECTED') return false;
            const req = resolveReportRequest(r, budgetRequests, globalAcademicYearId);
            const isBos = (req?.items || []).some(item => item.planId?.endsWith('-BOS'));
            if (isBos) return false;
            if (!isSuperAdmin) {
                if (myUnitId && r.unitId !== myUnitId) return false;
                if (myFieldId && r.fieldId !== myFieldId) return false;
            }
            return true;
        }),
        [budgetReports, budgetRequests, globalAcademicYearId, isSuperAdmin, myUnitId, myFieldId]);

    // ── Extract list of available months from requests
    const monthOptions = useMemo(() => {
        const set = new Set();
        baseRequests.filter(r => r.status === 'APPROVED' && r.month).forEach(r => {
            set.add(r.month);
        });
        return Array.from(set).sort().reverse();
    }, [baseRequests]);

    // ── Filter requests & reports based on selected month
    const activeRequestsFiltered = useMemo(() => {
        if (selectedMonth === 'ALL') return baseRequests;
        return baseRequests.filter(r => r.month === selectedMonth);
    }, [baseRequests, selectedMonth]);

    const activeReportsFiltered = useMemo(() => {
        if (selectedMonth === 'ALL') return baseReports;

        return baseReports.filter(r => {
            const req = resolveReportRequest(r, budgetRequests, globalAcademicYearId);
            if (req) return req.month === selectedMonth;
            return r.date ? r.date.startsWith(selectedMonth) : false;
        });
    }, [baseReports, selectedMonth, budgetRequests, globalAcademicYearId]);

    // ── Clear notifications for unit/bidang when viewing this page (local state update only, no background network push)
    useEffect(() => {
        if (!isSuperAdmin && budgetReports) {
            const unnotified = budgetReports.filter(r => {
                const isMine = (myUnitId && r.unitId === myUnitId) || (myFieldId && r.fieldId === myFieldId);
                const isBos = r.source === 'BOS' || r.planId?.endsWith('-BOS') || r.category?.toLowerCase().includes('bos') || r.description?.toLowerCase().includes('bos') || r.id?.startsWith('RET-BOS-');
                return isMine && r.kategoriAset === 'PENGEMBALIAN' && !isBos && (r.status === 'APPROVED' || r.status === 'REJECTED') && !r.notified;
            });
            if (unnotified.length > 0) {
                unnotified.forEach(r => {
                    const updated = { ...r, notified: true };
                    dispatch({ type: 'EDIT_BUDGET_REPORT', payload: updated });
                });
            }
        }
    }, [isSuperAdmin, budgetReports, myUnitId, myFieldId, dispatch]);

    // ── Aggregate totals (Synchronized 100% with MonthlyReport.jsx)
    const totalApproved = activeRequestsFiltered.filter(r => r.status === 'APPROVED').reduce((s, r) => s + (parseFloat(r.totalAmount) || 0), 0);
    const totalUsed = activeReportsFiltered.filter(r => r.kategoriAset !== 'PENGEMBALIAN' && r.status === 'APPROVED').reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const totalReturned = activeReportsFiltered.filter(r => r.kategoriAset === 'PENGEMBALIAN' && r.status === 'APPROVED').reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const totalBalance = Math.max(0, totalApproved - totalUsed - totalReturned);
    const totalPending = activeRequestsFiltered.filter(r => r.status === 'PENDING').reduce((s, r) => s + (parseFloat(r.totalAmount) || 0), 0) + 
                         activeReportsFiltered.filter(r => r.status === 'PENDING' && r.kategoriAset === 'PENGEMBALIAN').reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

    // Stat card values
    const statApproved = totalApproved;
    const statUsed = totalUsed;
    const statBalance = totalBalance;
    const statPending = totalPending;

    // ── Daftar unit & bidang yang punya data (untuk superadmin)
    const activeUnits = useMemo(() => (units || []).filter(u => !u.isDeleted), [units]);
    const activeFields = useMemo(() => (fields || []).filter(f => !f.isDeleted), [fields]);

    // ── Grouping breakdown per Surat Permintaan Dana (Per Bulan)
    const monthBreakdownCards = useMemo(() => {
        const approvedReqs = activeRequestsFiltered.filter(r => r.status === 'APPROVED');
        const targetReports = activeReportsFiltered.filter(r => r.status === 'APPROVED');

        const initialCards = approvedReqs.map(req => {
            const reqItems = req.items || [];
            const matchingReports = targetReports.filter(r => {
                if (r.kategoriAset === 'PENGEMBALIAN') return false;
                const resolved = resolveReportRequest(r, budgetRequests, globalAcademicYearId);
                if (resolved) return resolved.id === req.id;
                return r.date ? r.date.startsWith(req.month) : false;
            });

            const itemsDetail = reqItems.map(item => {
                const itemAmt = parseFloat(item.amount || 0);
                const itemReports = matchingReports.filter(r => {
                    if (item.componentId && r.componentId === item.componentId) return true;
                    const rName = (r.category || r.description || '').trim().toLowerCase();
                    const iName = (item.name || '').trim().toLowerCase();
                    return rName && iName && rName === iName;
                });

                const usedAmt = itemReports.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
                const sisaAmt = Math.max(0, itemAmt - usedAmt);
                const pctUsed = itemAmt > 0 ? Math.min(100, (usedAmt / itemAmt) * 100) : 0;

                return {
                    name: item.name || 'Komponen Belanja',
                    componentId: item.componentId,
                    itemAmt,
                    usedAmt,
                    sisaAmt,
                    pctUsed
                };
            });

            const reqApproved = itemsDetail.reduce((s, i) => s + i.itemAmt, 0) || (parseFloat(req.totalAmount) || 0);
            const reqUsed = matchingReports.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
            const initialSisa = Math.max(0, reqApproved - reqUsed);

            return {
                req,
                itemsDetail,
                reqApproved,
                reqUsed,
                initialSisa,
                reqReturned: 0
            };
        });

        // Collect all approved returns for this entity (from baseReports to ensure refunds made in subsequent months are captured)
        const relevantReturns = (baseReports || []).filter(r => r.kategoriAset === 'PENGEMBALIAN' && r.status === 'APPROVED');

        // Pass 1: Direct matches
        relevantReturns.forEach(ret => {
            const retAmt = parseFloat(ret.amount || 0);
            if (retAmt <= 0) return;

            const resolvedReq = resolveReportRequest(ret, budgetRequests, globalAcademicYearId);
            const targetCard = initialCards.find(c =>
                (ret.budgetRequestId && c.req.id === ret.budgetRequestId) ||
                (ret.requestId && c.req.id === ret.requestId) ||
                (resolvedReq && c.req.id === resolvedReq.id)
            );

            if (targetCard) {
                targetCard.reqReturned += retAmt;
            }
        });

        // Pass 2: Re-distribute any surplus or unassigned returns to requests of the same unit that still have remaining sisa
        let surplusReturned = 0;
        initialCards.forEach(c => {
            if (c.reqReturned > c.initialSisa) {
                surplusReturned += (c.reqReturned - c.initialSisa);
                c.reqReturned = c.initialSisa;
            }
        });

        relevantReturns.forEach(ret => {
            const retAmt = parseFloat(ret.amount || 0);
            const resolvedReq = resolveReportRequest(ret, budgetRequests, globalAcademicYearId);
            const isDirectMatched = initialCards.some(c =>
                (ret.budgetRequestId && c.req.id === ret.budgetRequestId) ||
                (ret.requestId && c.req.id === ret.requestId) ||
                (resolvedReq && c.req.id === resolvedReq.id)
            );
            if (!isDirectMatched) {
                const isMyUnit = (myUnitId && (ret.unitId === myUnitId || ret.fieldId === myUnitId)) ||
                                 (myFieldId && (ret.fieldId === myFieldId || ret.unitId === myFieldId)) ||
                                 isSuperAdmin;
                if (isMyUnit) {
                    surplusReturned += retAmt;
                }
            }
        });

        if (surplusReturned > 0) {
            initialCards.forEach(c => {
                const deficit = Math.max(0, c.initialSisa - c.reqReturned);
                if (deficit > 0 && surplusReturned > 0) {
                    const alloc = Math.min(surplusReturned, deficit);
                    c.reqReturned += alloc;
                    surplusReturned -= alloc;
                }
            });
        }

        return initialCards.map(c => {
            const { req, reqApproved, reqUsed, reqReturned, itemsDetail } = c;
            const reqSisa = Math.max(0, reqApproved - reqUsed - reqReturned);
            const reqPct = reqApproved > 0 ? (reqUsed / reqApproved) * 100 : 0;
            const uName = units?.find(u => u.id === req.unitId)?.name || fields?.find(f => f.id === req.fieldId)?.name || 'Yayasan';

            return {
                reqId: req.id,
                reqMonth: req.month,
                reqDate: req.date,
                reqDescription: req.description,
                unitName: uName,
                reqApproved,
                reqUsed,
                reqReturned,
                reqSisa,
                reqPct,
                itemsDetail
            };
        });
    }, [activeRequestsFiltered, activeReportsFiltered, baseReports, budgetRequests, globalAcademicYearId, myUnitId, myFieldId, isSuperAdmin, units, fields]);

    // ── Aggregation of categories for normal users (Filtered by month)
    const categoryList = useMemo(() => {
        const positions = {};
        activeRequestsFiltered.filter(r => r.status === 'APPROVED').forEach(req => {
            (req.items || []).forEach(item => {
                const cat = item.name || 'General';
                if (!positions[cat]) positions[cat] = { category: cat, totalApproved: 0, totalUsed: 0, totalReturned: 0 };
                positions[cat].totalApproved += (parseFloat(item.amount) || 0);
            });
        });
        activeReportsFiltered.forEach(rel => {
            if (rel.kategoriAset === 'PENGEMBALIAN' || rel.status !== 'APPROVED') return;
            const cat = rel.category || 'General';
            if (!positions[cat]) positions[cat] = { category: cat, totalApproved: 0, totalUsed: 0, totalReturned: 0 };
            positions[cat].totalUsed += (parseFloat(rel.amount) || 0);
        });
        const list = Object.values(positions).filter(p => p.totalApproved > 0 || p.totalUsed > 0);
        const totalApprovedReturned = activeReportsFiltered.filter(r => r.kategoriAset === 'PENGEMBALIAN' && r.status === 'APPROVED').reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
        let remainingReturned = totalApprovedReturned;
        list.forEach(p => {
            const initialSisa = p.totalApproved - p.totalUsed;
            if (initialSisa > 0) {
                const allocatedReturn = Math.min(remainingReturned, initialSisa);
                p.totalReturned = allocatedReturn;
                remainingReturned -= allocatedReturn;
            } else {
                p.totalReturned = 0;
            }
        });
        return list;
    }, [activeRequestsFiltered, activeReportsFiltered]);

    const categoryTotals = useMemo(() => {
        const totalApproved = categoryList.reduce((sum, item) => sum + item.totalApproved, 0);
        const totalUsed = categoryList.reduce((sum, item) => sum + item.totalUsed, 0);
        const totalReturned = categoryList.reduce((sum, item) => sum + (item.totalReturned || 0), 0);
        const totalAvailable = Math.max(0, totalApproved - totalUsed - totalReturned);
        const totalPct = totalApproved > 0 ? (totalUsed / totalApproved) * 100 : 0;
        return { totalApproved, totalUsed, totalReturned, totalAvailable, totalPct };
    }, [categoryList]);

    const toggleExpandRequest = (id) => {
        setExpandedRequestIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleSubmitReturn = async (e) => {
        e.preventDefault();
        const amt = parseFloat(returnForm.amount);
        const myPendingReturns = baseReports.filter(r => r.status === 'PENDING' && r.kategoriAset === 'PENGEMBALIAN').reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
        
        if (isNaN(amt) || amt <= 0) return alert('Nominal tidak valid!');
        if (!returnForm.budgetRequestId) return alert('Mohon pilih Bulan Permintaan Dana (Surat REQ) yang akan dikembalikan!');
        
        const chosenCard = monthBreakdownCards.find(c => c.reqId === returnForm.budgetRequestId);
        if (chosenCard && amt > chosenCard.reqSisa) {
            return alert(`Nominal pengembalian (${formatRupiah(amt)}) TIDAK BOLEH melebihi sisa pagu riil yang belum dilaporkan (${formatRupiah(chosenCard.reqSisa)})!\n\nJika ada nota belanja yang belum diinput, silakan laporkan nota tersebut terlebih dahulu agar perhitungan sisa klop.`);
        }
        if (amt > (statBalance - myPendingReturns)) return alert('Nominal melebihi sisa saldo Anda (termasuk yang sedang diproses)!');
        if (!returnForm.buktiTeks) return alert('Bukti transfer wajib dilampirkan!');

        setIsSubmitting(true);
        window.dispatchEvent(new CustomEvent('app-processing-start', { 
            detail: { 
                title: 'Mengirim Pengembalian Dana...', 
                message: 'Mohon tunggu sebentar, pengajuan pengembalian sisa dana sedang dikirim ke server...', 
                type: 'submitting' 
            } 
        }));

        try {
            const newReturn = {
                id: 'RET-' + Date.now().toString(36).toUpperCase(),
                unitId: myUnitId,
                fieldId: myFieldId,
                budgetRequestId: returnForm.budgetRequestId || null,
                requestId: returnForm.budgetRequestId || null,
                academicYearId: globalAcademicYearId,
                date: new Date().toISOString().split('T')[0],
                amount: amt,
                description: returnForm.description || 'Pengembalian Sisa Dana Kas',
                buktiTeks: returnForm.buktiTeks,
                kategoriAset: 'PENGEMBALIAN',
                status: 'PENDING',
                notified: false
            };

            dispatch({ type: 'ADD_BUDGET_REPORT', payload: newReturn });
            await api.pushAction({ type: 'ADD_BUDGET_REPORT', payload: newReturn }, state);
            
            setShowReturnModal(false);
            setReturnForm({ amount: '', buktiTeks: '', description: '', budgetRequestId: '' });
            alert('Pengajuan pengembalian dana berhasil dikirim dan menunggu ACC Yayasan.');
        } catch (err) {
            console.error(err);
            alert('Gagal mengajukan pengembalian dana: ' + err.message);
        } finally {
            setIsSubmitting(false);
            window.dispatchEvent(new CustomEvent('app-processing-end'));
        }
    };

    const handleApproveReturn = async (ret) => {
        if (!window.confirm('Setujui pengembalian dana ini? Draf Jurnal akan otomatis dibuat.')) return;
        
        setProcessingId(ret.id);
        window.dispatchEvent(new CustomEvent('app-processing-start', { 
            detail: { 
                title: 'Memproses ACC Pengembalian...', 
                message: 'Mohon tunggu sebentar, verifikasi pengembalian dana sedang dicatat...', 
                type: 'approving' 
            } 
        }));

        try {
            const updated = { ...ret, status: 'APPROVED', notified: false };
            dispatch({ type: 'EDIT_BUDGET_REPORT', payload: updated });
            await api.pushAction({ type: 'EDIT_BUDGET_REPORT', payload: updated }, state);
            alert('Pengembalian dana berhasil di-ACC!');
        } catch (error) {
            console.error(error);
            alert('Gagal menyetujui pengembalian dana: ' + error.message);
        } finally {
            setProcessingId(null);
            setReviewData(null);
            window.dispatchEvent(new CustomEvent('app-processing-end'));
        }
    };

    const handleRejectReturn = async (ret) => {
        const reason = window.prompt('Alasan penolakan pengembalian dana:');
        if (reason !== null) {
            setProcessingId(ret.id);
            window.dispatchEvent(new CustomEvent('app-processing-start', { 
                detail: { 
                    title: 'Memproses Penolakan Pengembalian...', 
                    message: 'Mohon tunggu sebentar, status penolakan pengembalian sedang dikirim...', 
                    type: 'rejecting' 
                } 
            }));

            try {
                const updated = { ...ret, status: 'REJECTED', description: `${ret.description} (Ditolak: ${reason})`, notified: false };
                dispatch({ type: 'EDIT_BUDGET_REPORT', payload: updated });
                await api.pushAction({ type: 'EDIT_BUDGET_REPORT', payload: updated }, state);
                alert('Pengembalian dana ditolak.');
            } catch (error) {
                console.error(error);
                alert('Gagal menolak pengembalian dana: ' + error.message);
            } finally {
                setProcessingId(null);
                setReviewData(null);
                window.dispatchEvent(new CustomEvent('app-processing-end'));
            }
        }
    };

    const pendingReturns = baseReports.filter(r => r.kategoriAset === 'PENGEMBALIAN' && r.status === 'PENDING');
    const unitName = units?.find(u => u.id === myUnitId)?.name || fields?.find(f => f.id === myFieldId)?.name || 'Yayasan';

    return (
        <div className="p-8 animate-in fade-in duration-500">

            {/* ── Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Ketersediaan Dana & Saldo</h1>
                    <p className="text-slate-500 font-medium italic">
                        {isSuperAdmin ? 'Monitoring saldo kas seluruh unit kerja & bidang.' : `Status saldo kas ${unitName}.`}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                    {!isSuperAdmin && statBalance > 0 && (
                        <button 
                            onClick={() => {
                                const availableCard = monthBreakdownCards.find(c => c.reqSisa > 0);
                                setReturnForm(prev => ({
                                    ...prev,
                                    budgetRequestId: availableCard ? availableCard.reqId : '',
                                    amount: availableCard ? availableCard.reqSisa : (statBalance > 0 ? statBalance : ''),
                                    description: availableCard ? `Pengembalian Sisa Dana Request ${formatMonthLabel(availableCard.reqMonth)}` : ''
                                }));
                                setIsReturnAmountLocked(true);
                                setShowReturnModal(true);
                            }}
                            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-lg shadow-indigo-200 transition-all active:scale-95 font-bold text-xs"
                        >
                            <HandCoins size={18} />
                            <span>KEMBALIKAN SISA DANA</span>
                        </button>
                    )}
                    <div className="flex items-center gap-3 px-6 py-3 bg-indigo-50 text-indigo-700 rounded-2xl border border-indigo-100 shadow-sm">
                        <ShieldCheck size={20} />
                        <span className="text-xs font-black uppercase tracking-widest">Saldo Real-Time</span>
                    </div>
                </div>
            </div>

            {/* ── Filter Bar & Tampilan Selector */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                        <Calendar size={22} />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                            Bulan Permintaan Dana
                        </label>
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer min-w-[220px]"
                        >
                            <option value="ALL">🗓️ Semua Bulan Permintaan</option>
                            {monthOptions.map(m => (
                                <option key={m} value={m}>
                                    📅 {formatMonthLabel(m)}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {!isSuperAdmin && (
                    <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                        <button
                            onClick={() => setViewMode('month_breakdown')}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
                                viewMode === 'month_breakdown'
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <Layers size={16} />
                            <span>Per Surat Permintaan (Bulan)</span>
                        </button>
                        <button
                            onClick={() => setViewMode('category_breakdown')}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
                                viewMode === 'category_breakdown'
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <Tag size={16} />
                            <span>Per Kategori Barang</span>
                        </button>
                    </div>
                )}
            </div>

            {/* ── Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
                <div className="card p-8 bg-white border-b-4 border-emerald-500 shadow-lg hover:translate-y-[-4px] transition-all">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4"><CheckCircle size={24} /></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                        Total Dana ACC {selectedMonth !== 'ALL' ? `(${formatMonthLabel(selectedMonth)})` : '(Masuk)'}
                    </p>
                    <h2 className="text-2xl font-black text-slate-900">{formatRupiah(statApproved)}</h2>
                </div>
                <div className="card p-8 bg-white border-b-4 border-rose-500 shadow-lg hover:translate-y-[-4px] transition-all">
                    <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center mb-4"><TrendingUp size={24} /></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                        Total Realisasi {selectedMonth !== 'ALL' ? `(${formatMonthLabel(selectedMonth)})` : '(Keluar)'}
                    </p>
                    <h2 className="text-2xl font-black text-slate-900">{formatRupiah(statUsed)}</h2>
                </div>
                <div className="card p-8 bg-white border-b-4 border-indigo-500 shadow-lg hover:translate-y-[-4px] transition-all">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4"><Wallet size={24} /></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                        Sisa Dana {selectedMonth !== 'ALL' ? `(${formatMonthLabel(selectedMonth)})` : '(Saldo)'}
                    </p>
                    <h2 className="text-2xl font-black text-emerald-600">{formatRupiah(statBalance)}</h2>
                </div>
                <div className="card p-8 bg-white border-b-4 border-amber-500 shadow-lg hover:translate-y-[-4px] transition-all">
                    <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-4"><Clock size={24} /></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Menunggu ACC (Proses)</p>
                    <h2 className="text-2xl font-black text-amber-600">{formatRupiah(statPending)}</h2>
                </div>
            </div>

            {/* ── SUPERADMIN: Tabel per Unit & Bidang */}
            {isSuperAdmin ? (
                <div className="card overflow-hidden shadow-2xl mb-10 rounded-[2rem] bg-white border-0">
                    <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
                        <h3 className="font-black uppercase text-xs tracking-widest flex items-center gap-2">
                            <Layers className="text-indigo-400" size={16} /> Saldo per Unit & Bidang {selectedMonth !== 'ALL' && `(${formatMonthLabel(selectedMonth)})`}
                        </h3>
                        <span className="text-[10px] text-slate-400 font-bold italic">Klik baris untuk lihat rincian kategori</span>
                    </div>
                    <div className="overflow-x-auto max-h-[500px] overflow-y-auto pr-1">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-20 bg-slate-50 shadow-sm">
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="sticky top-0 bg-slate-50 px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit / Bidang</th>
                                    <th className="sticky top-0 bg-slate-50 px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Dana ACC</th>
                                    <th className="sticky top-0 bg-slate-50 px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Realisasi</th>
                                    <th className="sticky top-0 bg-slate-50 px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sisa Saldo</th>
                                    <th className="sticky top-0 bg-slate-50 px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Dikembalikan</th>
                                    <th className="sticky top-0 bg-slate-50 px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Detail</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* Units */}
                                {activeUnits.map(unit => (
                                    <EntityRow
                                        key={unit.id}
                                        name={unit.name}
                                        type="unit"
                                        requests={baseRequests.filter(r => r.unitId === unit.id)}
                                        reports={baseReports.filter(r => r.unitId === unit.id)}
                                        selectedMonth={selectedMonth}
                                        budgetRequests={budgetRequests}
                                        globalAcademicYearId={globalAcademicYearId}
                                    />
                                ))}
                                {/* Fields (bidang) */}
                                {activeFields.map(field => (
                                    <EntityRow
                                        key={field.id}
                                        name={field.name}
                                        type="field"
                                        requests={baseRequests.filter(r => r.fieldId === field.id)}
                                        reports={baseReports.filter(r => r.fieldId === field.id)}
                                        selectedMonth={selectedMonth}
                                        budgetRequests={budgetRequests}
                                        globalAcademicYearId={globalAcademicYearId}
                                    />
                                ))}
                                {activeUnits.length === 0 && activeFields.length === 0 && (
                                    <tr>
                                        <td colSpan="6" className="px-8 py-20 text-center text-slate-400 font-medium italic">
                                            Belum ada unit atau bidang yang terdaftar.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot className="sticky bottom-0 z-20 bg-slate-50 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
                                <tr className="bg-slate-50 border-t-2 border-slate-200 font-black text-slate-800">
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-slate-800 text-white font-black">
                                                Σ
                                            </div>
                                            <div>
                                                <div className="font-black text-slate-800 text-sm">TOTAL KESELURUHAN</div>
                                                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Semua Unit & Bidang</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 font-black text-emerald-700 text-sm">{formatRupiah(totalApproved)}</td>
                                    <td className="px-6 py-5 font-black text-rose-600 text-sm">{formatRupiah(totalUsed)}</td>
                                    <td className="px-6 py-5 font-black text-emerald-600 text-base">{formatRupiah(totalBalance)}</td>
                                    <td className="px-6 py-5 font-black text-indigo-600 text-sm">{formatRupiah(totalReturned)}</td>
                                    <td className="px-6 py-5 text-center">
                                        <span className="text-[10px] text-slate-300 italic">—</span>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            ) : (
                /* ── USER BIASA: Pilihan Mode Tampilan */
                viewMode === 'month_breakdown' ? (
                    /* ── MODE 1: RINCIAN PER SURAT PERMINTAAN DANA (BULAN) */
                    <div className="space-y-6 mb-10">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="font-black text-lg text-slate-800 tracking-tight flex items-center gap-2">
                                <Layers className="text-indigo-600" size={20} />
                                <span>Rincian Saldo per Surat Permintaan Dana</span>
                            </h3>
                            <span className="text-xs font-bold text-slate-400 italic">
                                {monthBreakdownCards.length} Surat Permintaan Ditemukan
                            </span>
                        </div>

                        {monthBreakdownCards.length === 0 ? (
                            <div className="bg-white p-12 rounded-[2rem] border border-slate-100 text-center shadow-xl">
                                <Info size={40} className="text-slate-300 mx-auto mb-4" />
                                <p className="text-slate-500 font-bold">Tidak ada surat permintaan dana yang di-ACC untuk periode bulan ini.</p>
                            </div>
                        ) : (
                            monthBreakdownCards.map((card) => {
                                const isExpanded = expandedRequestIds.includes(card.reqId);
                                return (
                                    <div key={card.reqId} className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden transition-all duration-300 hover:border-indigo-200">
                                        {/* Card Header */}
                                        <div 
                                            onClick={() => toggleExpandRequest(card.reqId)}
                                            className="p-6 md:p-8 bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-6 cursor-pointer hover:bg-slate-800 transition-colors"
                                        >
                                            <div className="flex items-start gap-4">
                                                <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center flex-shrink-0 mt-1">
                                                    <Calendar size={22} />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-3 mb-1">
                                                        <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-lg text-xs font-black uppercase tracking-wider border border-indigo-500/30">
                                                            {formatMonthLabel(card.reqMonth)}
                                                        </span>
                                                        <span className="text-xs font-bold text-slate-400">ID: {card.reqId}</span>
                                                    </div>
                                                    <h4 className="text-lg font-black text-white">{card.reqDescription || 'Surat Permintaan Dana'}</h4>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-6 self-end md:self-center">
                                                <div className="text-right">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sisa Saldo Bulan Ini</p>
                                                    <p className="text-2xl font-black text-emerald-400">{formatRupiah(card.reqSisa)}</p>
                                                </div>
                                                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300">
                                                    {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Card Quick Stats Summary */}
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-slate-50 border-b border-slate-100">
                                            <div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Dana Cair (ACC)</p>
                                                <p className="text-base font-black text-slate-700">{formatRupiah(card.reqApproved)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Realisasi (Keluar)</p>
                                                <p className="text-base font-black text-rose-600">{formatRupiah(card.reqUsed)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Sisa Saldo</p>
                                                <p className="text-base font-black text-emerald-600">{formatRupiah(card.reqSisa)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Penyerapan</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <div className="flex-1 bg-slate-200 h-2 rounded-full overflow-hidden">
                                                        <div className="h-full bg-indigo-600" style={{ width: `${Math.min(100, card.reqPct)}%` }} />
                                                    </div>
                                                    <span className="text-xs font-black text-slate-600">{card.reqPct.toFixed(0)}%</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Item Breakdown Table (Expandable or Default Visible) */}
                                        <div className="p-6 overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                        <th className="py-3 px-4">Rincian Item Belanja</th>
                                                        <th className="py-3 px-4">Dana Cair (ACC)</th>
                                                        <th className="py-3 px-4">Realisasi Terpakai</th>
                                                        <th className="py-3 px-4">Sisa Saldo Item</th>
                                                        <th className="py-3 px-4 text-center">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 text-sm">
                                                    {card.itemsDetail.map((item, idx) => {
                                                        const isReturned = card.reqReturned > 0 && item.sisaAmt > 0;
                                                        return (
                                                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                                <td className="py-4 px-4 font-bold text-slate-800">
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <span>{item.name}</span>
                                                                        {isReturned && (
                                                                            <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-100 italic">
                                                                                (Sisa {formatRupiah(item.sisaAmt)} sudah dikembalikan)
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="py-4 px-4 font-semibold text-slate-600">
                                                                    {formatRupiah(item.itemAmt)}
                                                                </td>
                                                                <td className="py-4 px-4 font-semibold text-rose-600">
                                                                    {formatRupiah(item.usedAmt)}
                                                                </td>
                                                                <td className="py-4 px-4">
                                                                    <span className={`font-black text-base ${isReturned ? 'text-indigo-600' : item.sisaAmt > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                                        {formatRupiah(item.sisaAmt)}
                                                                    </span>
                                                                </td>
                                                                <td className="py-4 px-4 text-center">
                                                                    {item.sisaAmt <= 0 ? (
                                                                        <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-black">
                                                                            ✅ Tuntas 100%
                                                                        </span>
                                                                    ) : isReturned ? (
                                                                        <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-black border border-indigo-200 shadow-sm">
                                                                            ↩️ Sisa Dikembalikan
                                                                        </span>
                                                                    ) : (
                                                                        <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-black">
                                                                            ⏳ Tersisa {formatRupiah(item.sisaAmt)}
                                                                        </span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                    {card.reqReturned > 0 && (
                                                        <tr className="bg-indigo-50/60 font-bold border-t-2 border-indigo-200">
                                                            <td className="py-4 px-4 font-black text-indigo-900 flex items-center gap-2">
                                                                <span className="text-base">💸</span>
                                                                <span>Pengembalian Sisa Dana (Dikembalikan ke Kas Yayasan)</span>
                                                            </td>
                                                            <td className="py-4 px-4 text-slate-400 font-medium">
                                                                —
                                                            </td>
                                                            <td className="py-4 px-4 font-black text-indigo-600">
                                                                {formatRupiah(card.reqReturned)}
                                                            </td>
                                                            <td className="py-4 px-4 font-black text-emerald-600">
                                                                Rp 0
                                                            </td>
                                                            <td className="py-4 px-4 text-center">
                                                                <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-black border border-indigo-200 shadow-sm">
                                                                    ✨ Setor Kas Yayasan
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>

                                    </div>
                                );
                            })
                        )}
                    </div>
                ) : (
                    /* ── MODE 2: TABEL PER KATEGORI (BERDASARKAN FILTER BULAN) */
                    <div className="card overflow-hidden shadow-2xl mb-10 rounded-[2rem] bg-white border-0">
                        <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
                            <h3 className="font-black uppercase text-xs tracking-widest flex items-center gap-2">
                                <Layers className="text-indigo-400" size={16} /> Rincian Saldo per Kategori {selectedMonth !== 'ALL' && `(${formatMonthLabel(selectedMonth)})`}
                            </h3>
                        </div>
                        <div className="overflow-x-auto max-h-[500px] overflow-y-auto pr-1">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 z-20 bg-slate-50 shadow-sm">
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="sticky top-0 bg-slate-50 px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Kategori Pengeluaran</th>
                                        <th className="sticky top-0 bg-slate-50 px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Dana Cair (ACC)</th>
                                        <th className="sticky top-0 bg-slate-50 px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Realisasi</th>
                                        <th className="sticky top-0 bg-slate-50 px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sisa Saldo</th>
                                        <th className="sticky top-0 bg-slate-50 px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Dikembalikan</th>
                                        <th className="sticky top-0 bg-slate-50 px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Penyerapan</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {categoryList.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="px-8 py-20 text-center text-slate-400 font-medium italic">
                                                Belum ada data saldo kas untuk periode bulan ini.
                                            </td>
                                        </tr>
                                    ) : (
                                        categoryList.map((item, idx) => {
                                            const available = Math.max(0, item.totalApproved - item.totalUsed - (item.totalReturned || 0));
                                            const pct = item.totalApproved > 0 ? (item.totalUsed / item.totalApproved) * 100 : 0;
                                            return (
                                                <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                                                    <td className="px-8 py-6">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-2 h-10 rounded-full bg-indigo-600 group-hover:scale-y-125 transition-transform" />
                                                            <span className="font-black text-slate-700">{item.category}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-6 font-bold text-slate-500">{formatRupiah(item.totalApproved)}</td>
                                                    <td className="px-8 py-6 font-black text-rose-600">{formatRupiah(item.totalUsed)}</td>
                                                    <td className="px-8 py-6">
                                                        <span className={`text-lg font-black ${available < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatRupiah(available)}</span>
                                                    </td>
                                                    <td className="px-8 py-6 text-center text-slate-700 font-bold">
                                                        {item.totalReturned > 0 ? formatRupiah(item.totalReturned) : '—'}
                                                    </td>
                                                    <td className="px-8 py-6 text-right w-64">
                                                        <div className="flex flex-col gap-2">
                                                            <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                                <span>Terpakai</span><span>{pct.toFixed(1)}%</span>
                                                            </div>
                                                            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-200">
                                                                <div className="h-full bg-indigo-600 shadow-sm" style={{ width: `${Math.min(100, pct)}%` }} />
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                                {categoryList.length > 0 && (
                                    <tfoot className="sticky bottom-0 z-20 bg-slate-50 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
                                        <tr className="bg-slate-50 border-t-2 border-slate-200 font-black text-slate-800">
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-2 h-10 rounded-full bg-slate-800" />
                                                    <span className="font-black text-slate-800">TOTAL</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 font-black text-slate-800">{formatRupiah(categoryTotals.totalApproved)}</td>
                                            <td className="px-8 py-6 font-black text-rose-600">{formatRupiah(categoryTotals.totalUsed)}</td>
                                            <td className="px-8 py-6">
                                                <span className={`text-lg font-black ${categoryTotals.totalAvailable < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                    {formatRupiah(categoryTotals.totalAvailable)}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6 text-center text-slate-800 font-black">
                                                {categoryTotals.totalReturned > 0 ? formatRupiah(categoryTotals.totalReturned) : '—'}
                                            </td>
                                            <td className="px-8 py-6 text-right w-64">
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex justify-between items-center text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                                        <span>Total Terpakai</span><span>{categoryTotals.totalPct.toFixed(1)}%</span>
                                                    </div>
                                                    <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden border border-slate-300">
                                                        <div className="h-full bg-indigo-700 shadow-sm" style={{ width: `${Math.min(100, categoryTotals.totalPct)}%` }} />
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                )
            )}

            {/* ── SUPERADMIN: Verifikasi Pengembalian Dana */}
            {isSuperAdmin && pendingReturns.length > 0 && (
                <div className="card overflow-hidden shadow-2xl mb-10 rounded-[2rem] border-2 border-indigo-100">
                    <div className="p-6 bg-indigo-600 text-white flex items-center justify-between">
                        <h3 className="font-black uppercase text-xs tracking-widest flex items-center gap-2">
                            <HandCoins size={18} /> Verifikasi Pengembalian Sisa Dana ({pendingReturns.length})
                        </h3>
                    </div>
                    <div className="p-6 divide-y divide-slate-100">
                        {pendingReturns.map(ret => {
                            const uName = units?.find(u => u.id === ret.unitId)?.name || fields?.find(f => f.id === ret.fieldId)?.name || 'Unit/Bidang';
                            return (
                                <div key={ret.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-black text-slate-800 text-sm">{uName}</span>
                                            <span className="text-[10px] font-bold text-slate-400">({ret.date})</span>
                                        </div>
                                        <div className="text-xs text-slate-500">{ret.description}</div>
                                        {ret.buktiTeks && (
                                            <div className="text-[11px] font-mono bg-slate-50 p-2 rounded border border-slate-100 mt-2 text-slate-600">
                                                Bukti Transfer: {ret.buktiTeks}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <div className="text-[10px] font-black text-slate-400 uppercase">Nominal</div>
                                            <div className="text-lg font-black text-indigo-600">{formatRupiah(ret.amount)}</div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleApproveReturn(ret)}
                                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all"
                                            >
                                                ACC
                                            </button>
                                            <button
                                                onClick={() => handleRejectReturn(ret)}
                                                className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition-all"
                                            >
                                                Tolak
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── MODAL PENGEMBALIAN DANA */}
            {showReturnModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-black text-slate-900 text-lg">Pengembalian Sisa Dana Kas</h3>
                            <button onClick={() => setShowReturnModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmitReturn} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Bulan Permintaan Dana (Surat REQ)</label>
                                <select
                                    value={returnForm.budgetRequestId || ''}
                                    onChange={e => {
                                        const reqId = e.target.value;
                                        const chosenCard = monthBreakdownCards.find(c => c.reqId === reqId);
                                        if (chosenCard) {
                                            setReturnForm({
                                                ...returnForm,
                                                budgetRequestId: reqId,
                                                amount: chosenCard.reqSisa > 0 ? chosenCard.reqSisa : '',
                                                description: `Pengembalian Sisa Dana Request ${formatMonthLabel(chosenCard.reqMonth)}`
                                            });
                                        } else {
                                            setReturnForm({
                                                ...returnForm,
                                                budgetRequestId: reqId,
                                                amount: '',
                                                description: ''
                                            });
                                        }
                                    }}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    required
                                >
                                    <option value="">-- Pilih Bulan Permintaan --</option>
                                    {monthBreakdownCards.map(c => (
                                        <option key={c.reqId} value={c.reqId}>
                                            {formatMonthLabel(c.reqMonth)} - REQ [{c.reqId.slice(-8)}] (Sisa: {formatRupiah(c.reqSisa)})
                                        </option>
                                    ))}
                                </select>
                                {returnForm.budgetRequestId && (() => {
                                    const chosen = monthBreakdownCards.find(c => c.reqId === returnForm.budgetRequestId);
                                    if (chosen) {
                                        return (
                                            <span className="text-[11px] font-black text-emerald-600 mt-1.5 block bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
                                                💡 Sisa Pagu Belum Dilaporkan ({formatMonthLabel(chosen.reqMonth)}): {formatRupiah(chosen.reqSisa)}
                                            </span>
                                        );
                                    }
                                    return null;
                                })()}
                            </div>
                            <div>
                                {(() => {
                                    const chosen = monthBreakdownCards.find(c => c.reqId === returnForm.budgetRequestId);
                                    const currentAmt = parseFloat(returnForm.amount || 0);
                                    const isOver = chosen && currentAmt > chosen.reqSisa;

                                    return (
                                        <>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="block text-xs font-bold text-slate-500 uppercase">
                                                    Nominal Pengembalian (Rp) <span className="text-rose-500">*</span>
                                                </label>
                                                {chosen && chosen.reqSisa > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (!isReturnAmountLocked) {
                                                                setReturnForm(prev => ({ ...prev, amount: chosen.reqSisa }));
                                                            }
                                                            setIsReturnAmountLocked(!isReturnAmountLocked);
                                                        }}
                                                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
                                                    >
                                                        {isReturnAmountLocked ? (
                                                            <>
                                                                <Lock size={12} className="text-emerald-600" />
                                                                <span className="text-emerald-600">Terkunci Sesuai Sisa (Klik Ubah)</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Unlock size={12} className="text-amber-600" />
                                                                <span className="text-amber-600">Buka Kunci (Kembalikan ke Pas)</span>
                                                            </>
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    value={returnForm.amount}
                                                    readOnly={isReturnAmountLocked}
                                                    max={chosen ? chosen.reqSisa : undefined}
                                                    onChange={e => setReturnForm({ ...returnForm, amount: e.target.value })}
                                                    placeholder={chosen ? `Maksimal: ${formatRupiah(chosen.reqSisa)}` : 'Pilih Bulan Permintaan terlebih dahulu'}
                                                    className={`w-full px-4 py-3 border rounded-xl font-black text-sm focus:outline-none transition-all ${
                                                        isReturnAmountLocked 
                                                            ? 'bg-slate-100 border-slate-200 text-slate-700 cursor-not-allowed' 
                                                            : isOver
                                                                ? 'bg-rose-50 border-rose-300 text-rose-700 focus:ring-2 focus:ring-rose-500'
                                                                : 'bg-white border-indigo-300 text-slate-900 focus:ring-2 focus:ring-indigo-500'
                                                    }`}
                                                    required
                                                />
                                                {isReturnAmountLocked && (
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600 flex items-center gap-1 text-[11px] font-bold">
                                                        <Lock size={14} />
                                                        <span>Auto-Locked</span>
                                                    </div>
                                                )}
                                            </div>

                                            {chosen && (
                                                <div className="mt-2 space-y-1">
                                                    {isOver && (
                                                        <span className="text-[11px] font-black text-rose-600 block bg-rose-50 border border-rose-200 rounded-lg px-3 py-1.5">
                                                            ⛔ Nominal pengembalian ({formatRupiah(currentAmt)}) MELEBIHI sisa pagu riil ({formatRupiah(chosen.reqSisa)})! Kelebihan {formatRupiah(currentAmt - chosen.reqSisa)}. Harap laporkan nota belanja terlebih dahulu jika ada nota yang belum diinput.
                                                        </span>
                                                    )}
                                                    {!isOver && currentAmt > 0 && currentAmt === chosen.reqSisa && (
                                                        <span className="text-[11px] font-black text-emerald-700 block bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
                                                            ✅ Nominal pas 100% sesuai sisa pagu riil yang belum dilaporkan ({formatRupiah(chosen.reqSisa)}).
                                                        </span>
                                                    )}
                                                    {!isOver && currentAmt > 0 && currentAmt < chosen.reqSisa && (
                                                        <span className="text-[11px] font-bold text-amber-700 block bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                                                            ⚠️ Pengembalian sebagian ({formatRupiah(currentAmt)}). Sisa {formatRupiah(chosen.reqSisa - currentAmt)} akan tetap tercatat sebagai sisa pagu yang harus dilaporkan/disetor.
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Bukti Transfer (Nomor/Teks Bukti)</label>
                                <input
                                    type="text"
                                    value={returnForm.buktiTeks}
                                    onChange={e => setReturnForm({ ...returnForm, buktiTeks: e.target.value })}
                                    placeholder="Contoh: No. Ref TRX123456"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Keterangan / Catatan</label>
                                <textarea
                                    value={returnForm.description}
                                    onChange={e => setReturnForm({ ...returnForm, description: e.target.value })}
                                    placeholder="Catatan tambahan (opsional)"
                                    rows="2"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowReturnModal(false)}
                                    className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-200"
                                >
                                    Batal
                                </button>
                                {(() => {
                                    const chosen = monthBreakdownCards.find(c => c.reqId === returnForm.budgetRequestId);
                                    const isOver = chosen && parseFloat(returnForm.amount || 0) > chosen.reqSisa;
                                    return (
                                        <button
                                            type="submit"
                                            disabled={isSubmitting || !returnForm.budgetRequestId || isOver}
                                            className={`flex-1 py-3 text-white rounded-xl font-bold text-xs shadow-lg transition-all ${
                                                isOver || !returnForm.budgetRequestId
                                                    ? 'bg-slate-300 cursor-not-allowed shadow-none'
                                                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                                            }`}
                                        >
                                            Kirim Pengajuan
                                        </button>
                                    );
                                })()}
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}
