import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Landmark, TrendingUp, Info, ShieldCheck, HelpCircle, Layers, Wallet, Clock, CheckCircle, Building2, ChevronDown, ChevronRight, Users, HandCoins, X, UploadCloud, Save, Loader2, FileCheck, Eye, Calendar, Tag, Filter, Lock, Unlock, FileText, Image as ImageIcon, ExternalLink, Download, ZoomIn, Trash2, AlertCircle, Paperclip } from 'lucide-react';
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


    const rReqId = report.budgetRequestId || report.requestId;
    const reportItemName = (report.category || report.description || '').trim().toLowerCase();

    // 1. Check exact budgetRequestId FIRST if provided (keeps nota locked to its original request month)
    if (rReqId) {
        const found = budgetRequests.find(r => r.id === rReqId);
        if (found) {
            // If report has componentId, verify this request contains the component
            if (report.componentId && found.items && found.items.length > 0) {
                const hasComp = found.items.some(i => (i.componentId || i.id) === report.componentId);
                if (hasComp) return found;
            }
            if (report.kategoriAset === 'PENGEMBALIAN' || !reportItemName || !found.items || found.items.length === 0) {
                return found;
            }
            const hasItem = found.items.some(i => {
                const iName = (i.name || '').trim().toLowerCase();
                return iName === reportItemName || reportItemName.includes(iName) || iName.includes(reportItemName);
            });
            if (hasItem) return found;

            // Retain budgetRequestId link even if item name was customized
            return found;
        }
    }

    // 2. Orphan/fallback: matching by componentId in approved budgetRequests, preferring reportMonth
    if (report.componentId) {
        const reportMonth = report.date ? report.date.substring(0, 7) : null;
        const matchingReqs = budgetRequests.filter(r => 
            r.status === 'APPROVED' && 
            (report.unitId ? (r.unitId === report.unitId || r.fieldId === report.unitId) : true) &&
            (!globalAcademicYearId || r.academicYearId === globalAcademicYearId) &&
            r.items && 
            r.items.some(i => (i.componentId || i.id) === report.componentId)
        );
        if (matchingReqs.length > 0) {
            if (reportMonth) {
                const byMonth = matchingReqs.find(r => r.month === reportMonth);
                if (byMonth) return byMonth;
            }
            return matchingReqs[0];
        }
    }

    // 3. Orphan/fallback: matching by item name in approved budgetRequests, preferring reportMonth
    if (reportItemName) {
        const reportMonth = report.date ? report.date.substring(0, 7) : null;
        const matchingReqs = budgetRequests.filter(r => 
            r.status === 'APPROVED' &&
            (report.unitId ? (r.unitId === report.unitId || r.fieldId === report.unitId) : true) &&
            (!globalAcademicYearId || r.academicYearId === globalAcademicYearId) &&
            r.items &&
            r.items.some(i => (i.name || '').trim().toLowerCase() === reportItemName)
        );
        if (matchingReqs.length > 0) {
            if (reportMonth) {
                const byMonth = matchingReqs.find(r => r.month === reportMonth);
                if (byMonth) return byMonth;
            }
            return matchingReqs[0];
        }
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
    const [returnForm, setReturnForm] = useState({ 
        amount: '', 
        buktiTeks: '', 
        description: '', 
        budgetRequestId: '',
        buktiFoto: null,
        fileName: '',
        fileType: ''
    });
    const [isReturnAmountLocked, setIsReturnAmountLocked] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [processingId, setProcessingId] = useState(null);
    const [reviewReturn, setReviewReturn] = useState(null);
    const [lightboxImage, setLightboxImage] = useState(null);
    const fileInputRef = useRef(null);

    // Helper get proof data (photo / pdf) with localStorage fallback
    const getProofData = (ret) => {
        if (!ret) return null;
        return ret.buktiFoto || localStorage.getItem('sikak_proof_' + ret.id) || null;
    };

    // Handler upload file bukti (Image auto-compressed via canvas, PDF read as base64)
    const handleReturnFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
            if (file.size > 5 * 1024 * 1024) {
                alert('Ukuran dokumen PDF maksimal 5 MB!');
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                setReturnForm(prev => ({
                    ...prev,
                    buktiFoto: event.target.result,
                    fileName: file.name,
                    fileType: 'pdf'
                }));
            };
            reader.readAsDataURL(file);
        } else if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const maxDim = 1200;
                    if (width > maxDim || height > maxDim) {
                        if (width > height) {
                            height = Math.round((height * maxDim) / width);
                            width = maxDim;
                        } else {
                            width = Math.round((width * maxDim) / height);
                            height = maxDim;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
                    setReturnForm(prev => ({
                        ...prev,
                        buktiFoto: compressedDataUrl,
                        fileName: file.name,
                        fileType: 'image'
                    }));
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        } else {
            alert('Format file tidak didukung! Harap unggah foto struk (JPG/PNG/WEBP) atau dokumen PDF.');
        }
    };

    const handleRemoveReturnFile = () => {
        setReturnForm(prev => ({
            ...prev,
            buktiFoto: null,
            fileName: '',
            fileType: ''
        }));
        if (fileInputRef.current) fileInputRef.current.value = '';
    };
    
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
                const isBos = r.source === 'BOS' || (r.source !== 'YAYASAN' && !r.planId?.endsWith('-YAYASAN') && (r.planId?.endsWith('-BOS') || r.id?.startsWith('RET-BOS-')));
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
                    if (item.componentId && r.componentId && r.componentId === item.componentId) return true;
                    const rName = (r.category || r.description || '').trim().toLowerCase();
                    const iName = (item.name || '').trim().toLowerCase();
                    if (!rName || !iName || rName !== iName) return false;
                    // Prevent cross-account contamination if expenseItemId is specified on both
                    if (item.expenseItemId && r.expenseItemId && item.expenseItemId !== r.expenseItemId) {
                        return false;
                    }
                    return true;
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

            // Batas maksimal pengembalian: hitung SEMUA nota yang belum ditolak (DRAFT/PENDING/APPROVED)
            // agar nota yang belum diverifikasi tidak ikut "dikembalikan" (mencegah lebih setor).
            const isLinkedToReq = (r) => {
                const resolved = resolveReportRequest(r, budgetRequests, globalAcademicYearId);
                if (resolved) return resolved.id === req.id;
                return r.date ? r.date.startsWith(req.month) : false;
            };
            const allNonRejectedNotes = (baseReports || []).filter(r =>
                r.kategoriAset !== 'PENGEMBALIAN' && r.status !== 'REJECTED' && !r.isDeleted && isLinkedToReq(r)
            );
            const reqUsedAll = allNonRejectedNotes.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
            const unverifiedNotes = allNonRejectedNotes.filter(r => r.status !== 'APPROVED');
            const reqUnverifiedCount = unverifiedNotes.length;
            const reqUnverifiedAmt = unverifiedNotes.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
            const reqReturnedAll = (baseReports || []).filter(r =>
                r.kategoriAset === 'PENGEMBALIAN' && (r.status === 'APPROVED' || r.status === 'PENDING') && !r.isDeleted &&
                ((r.budgetRequestId || r.requestId) === req.id)
            ).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
            const reqRefundable = Math.max(0, reqApproved - reqUsedAll - reqReturnedAll);

            return {
                req,
                itemsDetail,
                reqApproved,
                reqUsed,
                initialSisa,
                reqReturned: 0,
                reqRefundable,
                reqUnverifiedCount,
                reqUnverifiedAmt
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
            if (retAmt <= 0) return;

            const resolvedReq = resolveReportRequest(ret, budgetRequests, globalAcademicYearId);
            const targetReqId = ret.budgetRequestId || ret.requestId || resolvedReq?.id;
            
            // If the return is explicitly linked or resolved to a known budget request,
            // it belongs specifically to that request (e.g. July/August request) and must
            // NEVER leak as surplus into other months when filtering.
            if (targetReqId) {
                return;
            }

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
            const { req, reqApproved, reqUsed, reqReturned, itemsDetail, reqRefundable, reqUnverifiedCount, reqUnverifiedAmt } = c;
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
                reqRefundable: Math.min(reqSisa, reqRefundable),
                reqUnverifiedCount,
                reqUnverifiedAmt,
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
        if (chosenCard && amt > chosenCard.reqRefundable) {
            return alert(`Nominal pengembalian (${formatRupiah(amt)}) TIDAK BOLEH melebihi sisa dana riil (${formatRupiah(chosenCard.reqRefundable)})!\n\nSisa riil = Dana cair − seluruh nota yang sudah diinput (termasuk yang belum diverifikasi) − pengembalian sebelumnya.${chosenCard.reqUnverifiedCount > 0 ? `\n\nCatatan: ada ${chosenCard.reqUnverifiedCount} nota (${formatRupiah(chosenCard.reqUnverifiedAmt)}) yang masih menunggu verifikasi dan sudah diperhitungkan.` : ''}`);
        }
        if (amt > (statBalance - myPendingReturns)) return alert('Nominal melebihi sisa saldo Anda (termasuk yang sedang diproses)!');
        if (!returnForm.buktiTeks && !returnForm.buktiFoto) return alert('Bukti transfer (foto struk / dokumen PDF atau nomor referensi) wajib dilampirkan!');

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
                buktiTeks: returnForm.buktiTeks || (returnForm.fileName ? `File: ${returnForm.fileName}` : 'Bukti Transfer Terlampir'),
                buktiFoto: returnForm.buktiFoto || null,
                kategoriAset: 'PENGEMBALIAN',
                status: 'PENDING',
                notified: false
            };

            // Local storage backup cache so proof is immediately safe
            if (returnForm.buktiFoto) {
                try {
                    localStorage.setItem('sikak_proof_' + newReturn.id, returnForm.buktiFoto);
                } catch (e) {
                    console.warn('LocalStorage limit for proof cache:', e);
                }
            }

            dispatch({ type: 'ADD_BUDGET_REPORT', payload: newReturn });
            try {
                await api.pushAction({ type: 'ADD_BUDGET_REPORT', payload: newReturn }, state);
            } catch (pushErr) {
                // Rollback optimistic insert jika server menolak (mis. nominal melebihi sisa riil)
                dispatch({ type: 'DELETE_BUDGET_REPORT', payload: newReturn.id });
                throw pushErr;
            }
            
            setShowReturnModal(false);
            setReturnForm({ amount: '', buktiTeks: '', description: '', budgetRequestId: '', buktiFoto: null, fileName: '', fileType: '' });
            if (fileInputRef.current) fileInputRef.current.value = '';
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
            try {
                await api.pushAction({ type: 'EDIT_BUDGET_REPORT', payload: updated }, state);
            } catch (pushErr) {
                // Rollback status jika server menolak ACC (mis. nominal melebihi sisa riil)
                dispatch({ type: 'EDIT_BUDGET_REPORT', payload: ret });
                throw pushErr;
            }
            alert('Pengembalian dana berhasil di-ACC!');
        } catch (error) {
            console.error(error);
            alert('Gagal menyetujui pengembalian dana: ' + error.message);
        } finally {
            setProcessingId(null);
            setReviewReturn(null);
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
                setReviewReturn(null);
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
                                const availableCard = monthBreakdownCards.find(c => c.reqRefundable > 0);
                                setReturnForm(prev => ({
                                    ...prev,
                                    budgetRequestId: availableCard ? availableCard.reqId : '',
                                    amount: availableCard ? availableCard.reqRefundable : '',
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
                            const proofData = getProofData(ret);
                            const isPdf = proofData && (proofData.startsWith('data:application/pdf') || proofData.endsWith('.pdf'));
                            const isImg = proofData && (proofData.startsWith('data:image/') || (!isPdf && (proofData.includes('.jpg') || proofData.includes('.png') || proofData.includes('.webp'))));

                            return (
                                <div key={ret.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/60 p-3 rounded-2xl transition-colors">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <span className="font-black text-slate-800 text-sm">{uName}</span>
                                            <span className="text-[10px] font-bold text-slate-400">({ret.date})</span>
                                            {isImg && (
                                                <button
                                                    type="button"
                                                    onClick={() => setLightboxImage(proofData)}
                                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-md text-[10px] font-bold transition-all shadow-xs"
                                                    title="Klik untuk melihat foto bukti transfer"
                                                >
                                                    <ImageIcon size={11} />
                                                    <span>Foto Bukti</span>
                                                    <Eye size={10} className="text-amber-500" />
                                                </button>
                                            )}
                                            {isPdf && (
                                                <button
                                                    type="button"
                                                    onClick={() => setReviewReturn(ret)}
                                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-md text-[10px] font-bold transition-all shadow-xs"
                                                    title="Dokumen PDF terlampir"
                                                >
                                                    <FileText size={11} />
                                                    <span>Dokumen PDF</span>
                                                    <ExternalLink size={10} />
                                                </button>
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-500">{ret.description}</div>
                                        {ret.buktiTeks && (
                                            <div className="text-[11px] font-mono bg-slate-50 p-2 rounded-lg border border-slate-100 mt-2 text-slate-600 flex items-center justify-between gap-2">
                                                <span>Bukti Transfer: <strong className="text-slate-800 font-bold">{ret.buktiTeks}</strong></span>
                                                {proofData && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setReviewReturn(ret)}
                                                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 shrink-0"
                                                    >
                                                        <Eye size={11} /> Buka Bukti
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-4 shrink-0">
                                        <div className="text-right">
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Nominal</div>
                                            <div className="text-lg font-black text-indigo-600">{formatRupiah(ret.amount)}</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setReviewReturn(ret)}
                                                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 hover:border-indigo-600 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                                                title="Lihat rincian lengkap sebelum ACC"
                                            >
                                                <Eye size={13} />
                                                <span>Lihat Rincian</span>
                                            </button>
                                            <button
                                                onClick={() => handleApproveReturn(ret)}
                                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-500/20 active:scale-95"
                                            >
                                                ACC
                                            </button>
                                            <button
                                                onClick={() => handleRejectReturn(ret)}
                                                className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition-all active:scale-95"
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
                                                amount: chosenCard.reqRefundable > 0 ? chosenCard.reqRefundable : '',
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
                                            {formatMonthLabel(c.reqMonth)} - REQ [{c.reqId.slice(-8)}] (Sisa: {formatRupiah(c.reqRefundable)})
                                        </option>
                                    ))}
                                </select>
                                {returnForm.budgetRequestId && (() => {
                                    const chosen = monthBreakdownCards.find(c => c.reqId === returnForm.budgetRequestId);
                                    if (chosen) {
                                        return (
                                            <>
                                                <span className="text-[11px] font-black text-emerald-600 mt-1.5 block bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
                                                    💡 Sisa Dana Riil yang Dapat Dikembalikan ({formatMonthLabel(chosen.reqMonth)}): {formatRupiah(chosen.reqRefundable)}
                                                </span>
                                                {chosen.reqUnverifiedCount > 0 && (
                                                    <span className="text-[11px] font-bold text-amber-700 mt-1.5 block bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                                                        ⏳ {chosen.reqUnverifiedCount} nota ({formatRupiah(chosen.reqUnverifiedAmt)}) masih menunggu verifikasi Yayasan dan sudah dikurangkan dari sisa di atas.
                                                    </span>
                                                )}
                                            </>
                                        );
                                    }
                                    return null;
                                })()}
                            </div>
                            <div>
                                {(() => {
                                    const chosen = monthBreakdownCards.find(c => c.reqId === returnForm.budgetRequestId);
                                    const currentAmt = parseFloat(returnForm.amount || 0);
                                    const isOver = chosen && currentAmt > chosen.reqRefundable;

                                    return (
                                        <>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="block text-xs font-bold text-slate-500 uppercase">
                                                    Nominal Pengembalian (Rp) <span className="text-rose-500">*</span>
                                                </label>
                                                {chosen && chosen.reqRefundable > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (!isReturnAmountLocked) {
                                                                setReturnForm(prev => ({ ...prev, amount: chosen.reqRefundable }));
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
                                                    max={chosen ? chosen.reqRefundable : undefined}
                                                    onChange={e => setReturnForm({ ...returnForm, amount: e.target.value })}
                                                    placeholder={chosen ? `Maksimal: ${formatRupiah(chosen.reqRefundable)}` : 'Pilih Bulan Permintaan terlebih dahulu'}
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
                                                            ⛔ Nominal pengembalian ({formatRupiah(currentAmt)}) MELEBIHI sisa pagu riil ({formatRupiah(chosen.reqRefundable)})! Kelebihan {formatRupiah(currentAmt - chosen.reqRefundable)}. Harap laporkan nota belanja terlebih dahulu jika ada nota yang belum diinput.
                                                        </span>
                                                    )}
                                                    {!isOver && currentAmt > 0 && currentAmt === chosen.reqRefundable && (
                                                        <span className="text-[11px] font-black text-emerald-700 block bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
                                                            ✅ Nominal pas 100% sesuai sisa pagu riil yang belum dilaporkan ({formatRupiah(chosen.reqRefundable)}).
                                                        </span>
                                                    )}
                                                    {!isOver && currentAmt > 0 && currentAmt < chosen.reqRefundable && (
                                                        <span className="text-[11px] font-bold text-amber-700 block bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                                                            ⚠️ Pengembalian sebagian ({formatRupiah(currentAmt)}). Sisa {formatRupiah(chosen.reqRefundable - currentAmt)} akan tetap tercatat sebagai sisa pagu yang harus dilaporkan/disetor.
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                            {/* Upload Foto / PDF Bukti Transfer */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 flex items-center justify-between">
                                    <span>Lampiran Foto / Dokumen PDF Bukti Transfer</span>
                                    <span className="text-[10px] text-indigo-600 font-bold lowercase">(foto struk / resi pdf)</span>
                                </label>

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/jpg,application/pdf"
                                    className="hidden"
                                    onChange={handleReturnFileChange}
                                />

                                {!returnForm.buktiFoto ? (
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/30 hover:bg-indigo-50/60 rounded-2xl p-5 text-center cursor-pointer transition-all group"
                                    >
                                        <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-2.5 group-hover:scale-105 transition-transform">
                                            <UploadCloud size={24} />
                                        </div>
                                        <div className="text-xs font-black text-slate-700 mb-0.5">
                                            Klik untuk Unggah Foto Struk / Dokumen PDF
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-medium">
                                            Mendukung foto/screenshot (JPG, PNG) & resi bank (PDF). Maks 5 MB.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="p-3.5 bg-indigo-50/50 rounded-2xl border border-indigo-200 relative group animate-in fade-in zoom-in-95">
                                        {returnForm.fileType === 'pdf' || returnForm.buktiFoto.startsWith('data:application/pdf') ? (
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 bg-rose-500 text-white rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                                                    <FileText size={24} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs font-black text-slate-800 truncate">
                                                        {returnForm.fileName || 'Dokumen_Bukti_Transfer.pdf'}
                                                    </div>
                                                    <div className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-0.5">
                                                        <CheckCircle size={11} /> Dokumen PDF Siap Dikirim
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => fileInputRef.current?.click()}
                                                        className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-[10px] font-bold border border-slate-200 transition-colors"
                                                    >
                                                        Ganti
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={handleRemoveReturnFile}
                                                        className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors"
                                                        title="Hapus berkas"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-2.5">
                                                <div className="relative rounded-xl overflow-hidden border border-indigo-200 bg-slate-900/5 max-h-48 flex items-center justify-center">
                                                    <img
                                                        src={returnForm.buktiFoto}
                                                        alt="Pratinjau Bukti"
                                                        className="max-h-48 w-full object-contain"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setLightboxImage(returnForm.buktiFoto)}
                                                        className="absolute bottom-2 right-2 px-2.5 py-1 bg-black/70 hover:bg-black/90 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 backdrop-blur-xs transition-colors"
                                                    >
                                                        <ZoomIn size={11} /> Perbesar
                                                    </button>
                                                </div>
                                                <div className="flex items-center justify-between gap-2 pt-1 border-t border-indigo-100">
                                                    <div className="text-[11px] font-bold text-slate-700 truncate flex items-center gap-1.5">
                                                        <ImageIcon size={13} className="text-indigo-600 shrink-0" />
                                                        <span className="truncate">{returnForm.fileName || 'Foto Bukti Transfer'}</span>
                                                        <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">Dikompres</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => fileInputRef.current?.click()}
                                                            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-[10px] font-bold border border-slate-200 transition-colors"
                                                        >
                                                            Ganti
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={handleRemoveReturnFile}
                                                            className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors"
                                                            title="Hapus foto"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Nomor / Catatan Referensi Transfer */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                    Nomor Referensi / Catatan Struk {returnForm.buktiFoto ? '(Opsional)' : <span className="text-rose-500">*</span>}
                                </label>
                                <input
                                    type="text"
                                    value={returnForm.buktiTeks}
                                    onChange={e => setReturnForm({ ...returnForm, buktiTeks: e.target.value })}
                                    placeholder="Contoh: No. Ref TRX123456 / No. Struk ATM"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    required={!returnForm.buktiFoto}
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
                                    const isOver = chosen && parseFloat(returnForm.amount || 0) > chosen.reqRefundable;
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

            {/* ── MODAL RINCIAN VERIFIKASI PENGEMBALIAN DANA (SUPERADMIN) */}
            {reviewReturn && (() => {
                const uName = units?.find(u => u.id === reviewReturn.unitId)?.name || fields?.find(f => f.id === reviewReturn.fieldId)?.name || 'Unit/Bidang';
                const reqOrigin = budgetRequests?.find(r => r.id === reviewReturn.budgetRequestId || r.id === reviewReturn.requestId);
                
                // Realization reports: hitung nota APPROVED dan nota PENDING/DRAFT
                const allNotes = (budgetReports || []).filter(r => 
                    (r.budgetRequestId === reqOrigin?.id || r.requestId === reqOrigin?.id) && 
                    r.status !== 'REJECTED' && !r.isDeleted &&
                    r.kategoriAset !== 'PENGEMBALIAN'
                );
                const relatedReports = allNotes.filter(r => r.status === 'APPROVED');
                const pendingNotes = allNotes.filter(r => r.status !== 'APPROVED');
                const totalBelanjaNota = relatedReports.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
                const totalBelanjaPending = pendingNotes.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
                const totalBelanjaAll = totalBelanjaNota + totalBelanjaPending;
                const totalPaguDicairkan = reqOrigin ? (parseFloat(reqOrigin.totalAmount) || parseFloat(reqOrigin.amount) || 0) : 0;
                const sisaPaguRiil = Math.max(0, totalPaguDicairkan - totalBelanjaAll);
                const returnAmount = parseFloat(reviewReturn.amount || 0);
                const isOverReturn = returnAmount > sisaPaguRiil + 1;

                const proofData = getProofData(reviewReturn);
                const isPdf = proofData && (proofData.startsWith('data:application/pdf') || proofData.endsWith('.pdf'));
                const isImg = proofData && (proofData.startsWith('data:image/') || (!isPdf && (proofData.includes('.jpg') || proofData.includes('.png') || proofData.includes('.webp'))));

                return (
                    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
                        <div className="bg-white rounded-[2.5rem] max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden my-8 animate-in zoom-in-95">
                            {/* Header */}
                            <div className="p-6 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-white border border-white/20">
                                        <HandCoins size={24} />
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-black tracking-widest uppercase bg-white/20 px-2 py-0.5 rounded-full text-indigo-100">
                                            Verifikasi Yayasan
                                        </span>
                                        <h3 className="font-black text-lg text-white mt-0.5">
                                            Rincian Pengembalian Sisa Dana
                                        </h3>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setReviewReturn(null)}
                                    className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-6 md:p-8 space-y-6 max-h-[75vh] overflow-y-auto">
                                {/* Unit Info & Tanggal */}
                                <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                                    <div>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Unit / Bidang</span>
                                        <span className="text-base font-black text-slate-800">{uName}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Tanggal Pengajuan</span>
                                        <span className="text-xs font-bold text-slate-700">
                                            {reviewReturn.date ? new Date(reviewReturn.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '-'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Bulan Permintaan (REQ)</span>
                                        <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg inline-block">
                                            {reqOrigin ? formatMonthLabel(reqOrigin.month) : (reviewReturn.budgetRequestId ? reviewReturn.budgetRequestId.slice(-8) : 'Umum')}
                                        </span>
                                    </div>
                                </div>

                                {/* Ringkasan 4 Kartu Metrik Anggaran */}
                                <div>
                                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                                        <Layers size={14} className="text-indigo-600" />
                                        <span>Komparasi Pagu Realisasi Belanja</span>
                                    </h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase block">1. Pagu Dicairkan</span>
                                            <span className="text-sm font-black text-indigo-700 block mt-1">{formatRupiah(totalPaguDicairkan)}</span>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-100">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase block">2. Belanja (Nota ACC)</span>
                                            <span className="text-sm font-black text-rose-600 block mt-1">{formatRupiah(totalBelanjaNota)}</span>
                                            {totalBelanjaPending > 0 && (
                                                <span className="text-[9px] font-bold text-amber-700 block mt-0.5">
                                                    + Pending: {formatRupiah(totalBelanjaPending)} ({pendingNotes.length} nota)
                                                </span>
                                            )}
                                        </div>
                                        <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-100">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase block">3. Sisa Pagu Riil</span>
                                            <span className="text-sm font-black text-amber-700 block mt-1">{formatRupiah(sisaPaguRiil)}</span>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 ring-2 ring-emerald-500/20">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase block">4. Pengembalian</span>
                                            <span className="text-base font-black text-emerald-700 block mt-1">{formatRupiah(returnAmount)}</span>
                                        </div>
                                    </div>

                                    {/* Status Validasi Klop */}
                                    <div className="mt-3">
                                        {returnAmount === sisaPaguRiil && returnAmount > 0 && (
                                            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center gap-2 text-emerald-800 text-xs font-bold">
                                                <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                                                <span>Nominal Pas 100% sesuai sisa pagu riil yang belum dilaporkan ({formatRupiah(sisaPaguRiil)}).</span>
                                            </div>
                                        )}
                                        {returnAmount < sisaPaguRiil && (
                                            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-center gap-2 text-amber-800 text-xs font-bold">
                                                <AlertCircle size={16} className="text-amber-600 shrink-0" />
                                                <span>Pengembalian sebagian ({formatRupiah(returnAmount)}). Sisa {formatRupiah(sisaPaguRiil - returnAmount)} tetap tercatat sebagai sisa pagu yang masih harus dilaporkan unit.</span>
                                            </div>
                                        )}
                                        {isOverReturn && (
                                            <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 flex items-center gap-2 text-rose-800 text-xs font-bold">
                                                <AlertCircle size={16} className="text-rose-600 shrink-0" />
                                                <span>⛔ Nominal pengembalian MELEBIHI sisa dana riil ({formatRupiah(sisaPaguRiil)})! Kelebihan {formatRupiah(returnAmount - sisaPaguRiil)}. Harap tolak pengembalian atau minta unit memperbarui nominal agar tidak terjadi lebih setor.</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Breakdown Pos Belanja dari Surat Permintaan */}
                                {reqOrigin?.items && reqOrigin.items.length > 0 && (
                                    <div>
                                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2.5">
                                            Rincian Pos Komponen Belanja (REQ: {reqOrigin.id})
                                        </h4>
                                        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-slate-100 text-slate-600 font-black uppercase text-[10px]">
                                                    <tr>
                                                        <th className="p-3">Pos Belanja</th>
                                                        <th className="p-3 text-right">Pagu</th>
                                                        <th className="p-3 text-right">Realisasi</th>
                                                        <th className="p-3 text-right">Sisa</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {reqOrigin.items.map((item, idx) => {
                                                        const iAmt = parseFloat(item.amount || 0);
                                                        const iUsed = relatedReports
                                                            .filter(r => (item.componentId && r.componentId === item.componentId) || ((r.category || r.description || '').trim().toLowerCase() === (item.name || '').trim().toLowerCase()))
                                                            .reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
                                                        const iSisa = Math.max(0, iAmt - iUsed);
                                                        return (
                                                            <tr key={idx} className="hover:bg-slate-50/50">
                                                                <td className="p-3 font-bold text-slate-800">{item.name || 'Pos Belanja'}</td>
                                                                <td className="p-3 text-right font-medium text-slate-600">{formatRupiah(iAmt)}</td>
                                                                <td className="p-3 text-right font-medium text-rose-600">{formatRupiah(iUsed)}</td>
                                                                <td className="p-3 text-right font-black text-emerald-700">{formatRupiah(iSisa)}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Bukti Transfer & Catatan */}
                                <div>
                                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                                        <ShieldCheck size={14} className="text-indigo-600" />
                                        <span>Bukti Transfer & Catatan Unit</span>
                                    </h4>

                                    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-4">
                                        {reviewReturn.buktiTeks && (
                                            <div>
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                                    Nomor Referensi / Catatan Struk:
                                                </span>
                                                <div className="text-xs font-mono font-bold text-slate-800 bg-white p-3 rounded-xl border border-slate-200">
                                                    {reviewReturn.buktiTeks}
                                                </div>
                                            </div>
                                        )}

                                        {reviewReturn.description && (
                                            <div>
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                                    Keterangan Tambahan Unit:
                                                </span>
                                                <div className="text-xs text-slate-700 bg-white p-3 rounded-xl border border-slate-200 font-medium">
                                                    {reviewReturn.description}
                                                </div>
                                            </div>
                                        )}

                                        {/* Tampilan Lampiran Bukti File (Foto atau PDF) */}
                                        <div>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                                                Lampiran Berkas Bukti:
                                            </span>

                                            {isImg && (
                                                <div className="space-y-3">
                                                    <div
                                                        onClick={() => setLightboxImage(proofData)}
                                                        className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900/5 group cursor-pointer max-h-80 flex items-center justify-center shadow-xs"
                                                    >
                                                        <img
                                                            src={proofData}
                                                            alt="Bukti Transfer"
                                                            className="w-full max-h-80 object-contain group-hover:scale-102 transition-transform duration-200"
                                                        />
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-xs text-white font-bold text-xs gap-1.5">
                                                            <ZoomIn size={18} /> Klik untuk Memperbesar Foto
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => setLightboxImage(proofData)}
                                                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-200 flex items-center gap-1.5 transition-colors"
                                                        >
                                                            <ZoomIn size={14} /> Perbesar Foto
                                                        </button>
                                                        <a
                                                            href={proofData}
                                                            download={`Bukti_Transfer_${uName}_${reviewReturn.id}.jpg`}
                                                            className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 flex items-center gap-1.5 transition-colors"
                                                        >
                                                            <Download size={14} /> Unduh Foto
                                                        </a>
                                                    </div>
                                                </div>
                                            )}

                                            {isPdf && (
                                                <div className="space-y-3">
                                                    <div className="p-4 bg-white rounded-2xl border border-rose-200 flex items-center justify-between gap-3 shadow-xs">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-12 h-12 bg-rose-500 text-white rounded-xl flex items-center justify-center shrink-0">
                                                                <FileText size={24} />
                                                            </div>
                                                            <div>
                                                                <div className="text-xs font-black text-slate-800">
                                                                    Dokumen Bukti Transfer (PDF)
                                                                </div>
                                                                <div className="text-[10px] text-slate-500 font-medium">
                                                                    Resi transfer resmi format PDF
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <a
                                                                href={proofData}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                                                            >
                                                                <ExternalLink size={13} /> Buka PDF
                                                            </a>
                                                            <a
                                                                href={proofData}
                                                                download={`Bukti_Transfer_${uName}_${reviewReturn.id}.pdf`}
                                                                className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 flex items-center gap-1.5 transition-colors"
                                                            >
                                                                <Download size={13} /> Unduh
                                                            </a>
                                                        </div>
                                                    </div>
                                                    <div className="rounded-2xl border border-slate-200 overflow-hidden">
                                                        <iframe
                                                            src={proofData}
                                                            title="Preview Dokumen PDF"
                                                            className="w-full h-80 bg-slate-100"
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {!proofData && (
                                                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-xs font-medium flex items-start gap-2">
                                                    <Info size={16} className="text-amber-600 mt-0.5 shrink-0" />
                                                    <span>Tidak ada file foto/PDF terlampir. Pengajuan ini hanya menyertakan teks catatan struk transfer.</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer Modal dengan Tombol ACC dan Tolak */}
                            <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                                <button
                                    type="button"
                                    onClick={() => setReviewReturn(null)}
                                    className="w-full sm:w-auto px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition-colors"
                                >
                                    Tutup Rincian
                                </button>
                                <div className="flex items-center gap-3 w-full sm:w-auto">
                                    <button
                                        type="button"
                                        onClick={() => handleRejectReturn(reviewReturn)}
                                        disabled={processingId === reviewReturn.id}
                                        className="flex-1 sm:flex-initial px-5 py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-bold text-xs transition-all border border-rose-200"
                                    >
                                        Tolak Pengembalian
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleApproveReturn(reviewReturn)}
                                        disabled={processingId === reviewReturn.id || isOverReturn}
                                        className={`flex-1 sm:flex-initial px-7 py-3 text-white rounded-xl font-black text-xs transition-all shadow-lg flex items-center justify-center gap-2 ${
                                            isOverReturn
                                                ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                                                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/30'
                                        }`}
                                    >
                                        <CheckCircle size={16} />
                                        <span>{isOverReturn ? 'Melebihi Sisa (Tolak/Perbaiki)' : 'Setujui (ACC Pengembalian)'}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ── LIGHTBOX MODAL (ZOOM FOTO BUKTI FULLSCREEN) */}
            {lightboxImage && (
                <div
                    className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
                    onClick={() => setLightboxImage(null)}
                >
                    <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center" onClick={e => e.stopPropagation()}>
                        <div className="absolute -top-12 right-0 flex items-center gap-2">
                            <a
                                href={lightboxImage}
                                download="Bukti_Transfer_Penuh.jpg"
                                className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 backdrop-blur-md transition-colors"
                            >
                                <Download size={14} /> Unduh
                            </a>
                            <button
                                onClick={() => setLightboxImage(null)}
                                className="w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <img
                            src={lightboxImage}
                            alt="Foto Bukti Ukuran Penuh"
                            className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl object-contain border border-white/10"
                        />
                    </div>
                </div>
            )}

        </div>
    );
}
