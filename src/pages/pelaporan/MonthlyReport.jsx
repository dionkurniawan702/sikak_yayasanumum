import React, { useState, useMemo } from 'react';
import { FileCheck, Receipt, Save, AlertCircle, CheckCircle2, ArrowUpRight, History, Search, ChevronDown, ChevronRight, Download, Package, Layers, Filter, Calendar, Tag, Building2, Loader2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { formatRupiah } from '../../utils/format';

// ─── Badge Kategori Aset ─────────────────────────────────────────────────────
function AsetBadge({ kategori, umurEkonomis }) {
    if (kategori === 'ASET') {
        return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Package size={10} /> Aset {umurEkonomis ? `• ${umurEkonomis} Thn` : ''}
            </span>
        );
    }
    if (kategori === 'PENGEMBALIAN') {
        return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-700 border border-indigo-200">
                <FileCheck size={10} /> Pengembalian
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 border border-slate-200">
            <Layers size={10} /> Non Aset
        </span>
    );
}

// ─── Expandable Row ──────────────────────────────────────────────────────────
function ReportRow({ report, units, isSuperAdmin, idx }) {
    const [open, setOpen] = useState(false);
    const unitName = units.find(u => u.id === report.unitId)?.name;
    const dateStr = report.date ? new Date(report.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

    return (
        <>
            <tr
                className={`border-b border-slate-100 cursor-pointer transition-colors ${open ? 'bg-indigo-50/40' : 'hover:bg-slate-50/80'}`}
                onClick={() => setOpen(o => !o)}
            >
                <td className="px-5 py-4 text-center">
                    <span className="text-[10px] font-black text-slate-400">{idx + 1}</span>
                </td>
                <td className="px-5 py-4">
                    <span className="text-xs font-bold text-slate-500">{dateStr}</span>
                </td>
                <td className="px-5 py-4">
                    <span className="text-xs font-black text-indigo-600 font-mono">{report.nomorNota || '—'}</span>
                </td>
                <td className="px-5 py-4">
                    <span className="text-xs font-bold text-slate-700 line-clamp-1">{report.category || report.description || 'Pengeluaran'}</span>
                    {isSuperAdmin && unitName && (
                        <div className="flex items-center gap-1 mt-0.5">
                            <Building2 size={9} className="text-slate-300" />
                            <span className="text-[9px] text-slate-400 font-bold">{unitName}</span>
                        </div>
                    )}
                </td>
                <td className="px-5 py-4 text-center">
                    {(report.volume && report.satuan) ? (
                        <span className="text-xs font-bold text-slate-600">
                            {parseFloat(report.volume).toLocaleString('id-ID')} {report.satuan}
                        </span>
                    ) : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-5 py-4 text-right">
                    <span className="text-sm font-black text-slate-800">{formatRupiah(parseFloat(report.amount || 0))}</span>
                </td>
                <td className="px-5 py-4 text-center">
                    <AsetBadge kategori={report.kategoriAset} umurEkonomis={report.umurEkonomis} />
                </td>
                <td className="px-5 py-4 text-center">
                    {report.status === 'PENDING' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-black uppercase bg-amber-50 text-amber-600 border border-amber-200">
                            Menunggu
                        </span>
                    ) : report.status === 'DRAFT' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-black uppercase bg-slate-100 text-slate-600 border border-slate-300">
                            Draft
                        </span>
                    ) : report.status === 'REJECTED' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-black uppercase bg-rose-50 text-rose-600 border border-rose-200">
                            Ditolak
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-black uppercase bg-emerald-50 text-emerald-600 border border-emerald-200">
                            ✓ Terverifikasi
                        </span>
                    )}
                </td>
                <td className="px-5 py-4 text-center">
                    {open
                        ? <ChevronDown size={14} className="text-indigo-400 mx-auto" />
                        : <ChevronRight size={14} className="text-slate-300 mx-auto" />}
                </td>
            </tr>

            {/* Accordion Detail */}
            {open && (
                <tr className="bg-slate-50/80 border-b border-slate-100">
                    <td colSpan="9" className="px-8 py-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Rincian Pembelian */}
                            <div className="space-y-3">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">Rincian Pembelian</p>
                                <div className="space-y-2 text-xs">
                                    {report.volume && <div className="flex justify-between"><span className="text-slate-400 font-bold">Volume</span><span className="font-black">{parseFloat(report.volume).toLocaleString('id-ID')} {report.satuan}</span></div>}
                                    {report.harga && <div className="flex justify-between"><span className="text-slate-400 font-bold">Harga Satuan</span><span className="font-black">{formatRupiah(parseFloat(report.harga))}</span></div>}
                                    <div className="flex justify-between border-t border-slate-200 pt-2"><span className="text-slate-400 font-bold">Total</span><span className="font-black text-indigo-600">{formatRupiah(parseFloat(report.amount || 0))}</span></div>
                                </div>
                            </div>
                            {/* Keterangan & Bukti */}
                            <div className="space-y-3">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">Keterangan & Bukti</p>
                                <p className="text-xs text-slate-600 font-medium leading-relaxed">{report.description || '—'}</p>
                                {report.buktiTeks && (
                                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                                        <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1">Bukti Transaksi</p>
                                        <p className="text-xs text-slate-700 font-medium">{report.buktiTeks}</p>
                                    </div>
                                )}
                            </div>
                            {/* Info Aset */}
                            <div className="space-y-3">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">Info Kategori</p>
                                <AsetBadge kategori={report.kategoriAset} umurEkonomis={report.umurEkonomis} />
                                {report.kategoriAset === 'ASET' && report.umurEkonomis && (
                                    <p className="text-xs text-emerald-700 font-bold">✓ Dicatat sebagai Aset Tetap<br /><span className="text-slate-500 font-medium">Umur Ekonomis: {report.umurEkonomis} Tahun</span></p>
                                )}
                                <div className="text-[9px] text-slate-400 font-bold font-mono mt-2">ID: {report.id?.slice(0, 16)}...</div>
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}

export default function MonthlyReport() {
    const { state, dispatch } = useApp();
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [showReportForm, setShowReportForm] = useState(false);
    const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'history'
    const [processingId, setProcessingId] = useState(null);
    const [sourceMode, setSourceMode] = useState('YAYASAN'); // 'YAYASAN' or 'BOS'

    // Filter state for history
    const [search, setSearch] = useState('');
    const [filterKategori, setFilterKategori] = useState('ALL');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');

    const { budgetRequests = [], budgetReports = [], expenseItems = [], units = [], fields = [], globalAcademicYearId, currentUser } = state;

    const isSuperAdmin = currentUser?.role === 'superadmin';
    const myUnitId = currentUser?.unitId;
    const myFieldId = currentUser?.fieldId;

    // Clear notifications for unit admin when they visit
    React.useEffect(() => {
        if (!isSuperAdmin && budgetReports?.length > 0) {
            const unnotified = budgetReports.filter(r => {
                const isMine = (myUnitId && r.unitId === myUnitId) || (myFieldId && r.fieldId === myFieldId);
                return isMine && (r.status === 'APPROVED' || r.status === 'REJECTED') && !r.notified;
            });
            if (unnotified.length > 0) {
                unnotified.forEach(r => {
                    const updated = { ...r, notified: true };
                    dispatch({ type: 'EDIT_BUDGET_REPORT', payload: updated });
                    api.pushAction({ type: 'EDIT_BUDGET_REPORT', payload: updated }, state);
                });
            }
        }
    }, [budgetReports, isSuperAdmin, myUnitId, myFieldId, dispatch, state]);

    const reportedAmounts = useMemo(() => {
        const map = {};
        const reqMap = {};
        (budgetReports || []).forEach(r => {
            if (r.status !== 'REJECTED') {
                if (r.componentId) {
                    if (!map[r.componentId]) map[r.componentId] = 0;
                    map[r.componentId] += parseFloat(r.amount || 0);
                } else {
                    if (!reqMap[r.budgetRequestId]) reqMap[r.budgetRequestId] = 0;
                    reqMap[r.budgetRequestId] += parseFloat(r.amount || 0);
                }
            }
        });
        return { byComponent: map, byRequest: reqMap };
    }, [budgetReports]);

    const requestsForYear = useMemo(() => {
        return (budgetRequests || []).filter(req => {
            const isYear = req.academicYearId === globalAcademicYearId;
            if (!isYear) return false;
            
            // Filter by source
            const isBosRequest = req.source === 'BOS' || (req.items || []).some(item => item.planId?.endsWith('-BOS'));
            if (sourceMode === 'BOS' && !isBosRequest) return false;
            if (sourceMode === 'YAYASAN' && isBosRequest) return false;

            if (isSuperAdmin) return true;
            if (myUnitId) return req.unitId === myUnitId;
            if (myFieldId) return req.fieldId === myFieldId;
            return false;
        });
    }, [budgetRequests, isSuperAdmin, myUnitId, myFieldId, globalAcademicYearId, sourceMode]);

    const pendingItems = useMemo(() => {
        const items = [];
        requestsForYear.filter(req => req.status === 'APPROVED').forEach(req => {
            // If the old system fully reported the request without component tracking, hide all items
            const reportedReq = reportedAmounts.byRequest[req.id] || 0;
            if (reportedReq >= parseFloat(req.totalAmount || 0) && Object.keys(reportedAmounts.byComponent).length === 0) {
                return;
            }

            if (req.items && req.items.length > 0) {
                req.items.forEach(item => {
                    const reportedComp = reportedAmounts.byComponent[item.componentId] || 0;
                    if (reportedComp < parseFloat(item.amount || 0)) {
                        items.push({
                            ...item,
                            reqId: req.id,
                            reqDate: req.date,
                            reqDescription: req.description,
                            reqUnitId: req.unitId,
                            expenseItemId: req.expenseItemId,
                            sisa: parseFloat(item.amount || 0) - reportedComp
                        });
                    }
                });
            } else {
                if (reportedReq < parseFloat(req.totalAmount || 0)) {
                    items.push({
                        reqId: req.id,
                        reqDate: req.date,
                        reqDescription: req.description,
                        reqUnitId: req.unitId,
                        expenseItemId: req.expenseItemId,
                        name: 'General (Legacy)',
                        amount: req.totalAmount,
                        sisa: parseFloat(req.totalAmount || 0) - reportedReq
                    });
                }
            }
        });
        return items;
    }, [requestsForYear, reportedAmounts]);

    const verificationReports = useMemo(() => {
        return (budgetReports || []).filter(rel => rel.status === 'PENDING' && rel.academicYearId === globalAcademicYearId);
    }, [budgetReports, globalAcademicYearId]);

    const draftReports = useMemo(() => {
        return (budgetReports || []).filter(rel => {
            // Safety Catch: If status is missing but ID starts with REL-, treat as DRAFT
            // This handles cases where the DB hasn't been updated with the status column yet
            const effectiveStatus = rel.status || (rel.id?.startsWith('REL-') ? 'DRAFT' : 'APPROVED');
            
            if (effectiveStatus !== 'DRAFT') return false;
            if (rel.academicYearId !== globalAcademicYearId) return false;
            if (isSuperAdmin) return false; 
            if (myUnitId && rel.unitId !== myUnitId) return false;
            if (myFieldId && rel.fieldId !== myFieldId) return false;
            return true;
        });
    }, [budgetReports, isSuperAdmin, myUnitId, myFieldId, globalAcademicYearId]);

    const baseReports = useMemo(() => {
        return (budgetReports || []).filter(rel => {
            const isYear = rel.academicYearId === globalAcademicYearId;
            if (!isYear) return false;

            // Filter by source
            const isBosReport = rel.source === 'BOS' || rel.planId?.endsWith('-BOS');
            if (sourceMode === 'BOS' && !isBosReport) return false;
            if (sourceMode === 'YAYASAN' && isBosReport) return false;

            if (isSuperAdmin) return true;
            if (myUnitId) return rel.unitId === myUnitId;
            if (myFieldId) return rel.fieldId === myFieldId;
            return false;
        });
    }, [budgetReports, budgetRequests, isSuperAdmin, myUnitId, myFieldId, globalAcademicYearId, sourceMode]);

    // Apply filters to history
    const filteredReports = useMemo(() => {
        return baseReports.filter(r => {
            const q = search.toLowerCase();
            const matchSearch = !q || (r.nomorNota || '').toLowerCase().includes(q) ||
                (r.description || '').toLowerCase().includes(q) ||
                (r.category || '').toLowerCase().includes(q) ||
                (r.buktiTeks || '').toLowerCase().includes(q);
            const matchKategori = filterKategori === 'ALL' || r.kategoriAset === filterKategori;
            const rDate = r.date ? new Date(r.date) : null;
            const matchFrom = !filterDateFrom || (rDate && rDate >= new Date(filterDateFrom));
            const matchTo = !filterDateTo || (rDate && rDate <= new Date(filterDateTo));
            return matchSearch && matchKategori && matchFrom && matchTo;
        });
    }, [baseReports, search, filterKategori, filterDateFrom, filterDateTo]);

    // Summary stats for history
    const totalNilai = filteredReports.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
    const totalAset = filteredReports.filter(r => r.kategoriAset === 'ASET').length;
    const totalNonAset = filteredReports.filter(r => r.kategoriAset !== 'ASET').length;

    const totalCair = requestsForYear.filter(r => r.status === 'APPROVED').reduce((s, r) => s + parseFloat(r.totalAmount || 0), 0);
    const totalLapor = baseReports.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
    const totalSisa = totalCair - totalLapor;

    const [editingDraftId, setEditingDraftId] = useState(null);
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        amount: 0,
        description: '',
        buktiTeks: '',
        nomorNota: '',
        volume: '',
        satuan: '',
        harga: '',
        kategoriAset: 'NON_ASET',
        umurEkonomis: ''
    });

    const handleOpenReportForm = (item) => {
        setEditingDraftId(null);
        setSelectedRequest(item); // Note: item contains both component info and reqId
        setFormData({
            date: new Date().toISOString().split('T')[0],
            amount: item.sisa > 0 ? item.sisa : 0,
            description: '',
            buktiTeks: '',
            nomorNota: '',
            volume: '',
            satuan: '',
            harga: '',
            kategoriAset: 'NON_ASET',
            umurEkonomis: ''
        });
        setShowReportForm(true);
    };

    const handleEditDraft = (draft) => {
        const req = budgetRequests.find(r => r.id === draft.budgetRequestId);
        if (!req) return alert("Data induk tidak ditemukan!");
        
        let item = { reqId: req.id, sisa: draft.amount, reqDescription: req.description, name: draft.category, reqUnitId: req.unitId, fieldId: req.fieldId };
        if (draft.componentId) {
            const reqItem = req.items?.find(i => i.componentId === draft.componentId);
            if (reqItem) {
                const reportedComp = (reportedAmounts.byComponent[draft.componentId] || 0) - parseFloat(draft.amount || 0);
                item = { ...reqItem, ...item, sisa: parseFloat(reqItem.amount || 0) - reportedComp };
            }
        }
        
        setSelectedRequest(item);
        setEditingDraftId(draft.id);
        setFormData({
            date: draft.date ? draft.date.split('T')[0] : new Date().toISOString().split('T')[0],
            amount: parseFloat(draft.amount || 0),
            description: draft.description || '',
            buktiTeks: draft.buktiTeks || '',
            nomorNota: draft.nomorNota || '',
            volume: draft.volume || '',
            satuan: draft.satuan || '',
            harga: draft.harga || '',
            kategoriAset: draft.kategoriAset || 'NON_ASET',
            umurEkonomis: draft.umurEkonomis || ''
        });
        setShowReportForm(true);
    };

    const handleReportSubmit = (e) => {
        e.preventDefault();
        if (formData.kategoriAset === 'ASET' && !formData.umurEkonomis) {
            return alert('Pilih umur ekonomis untuk kategori Aset.');
        }

        const currentDraftAmount = editingDraftId ? parseFloat(budgetReports.find(r => r.id === editingDraftId)?.amount || 0) : 0;
        const sisaDana = selectedRequest.sisa + currentDraftAmount;
        
        if (parseFloat(formData.amount) > sisaDana) {
            return alert(`Jumlah realisasi tidak boleh melebihi sisa dana (${formatRupiah(sisaDana)}).`);
        }

        const reportData = {
            id: editingDraftId || `REL-${Date.now()}`,
            requestId: selectedRequest.reqId,
            budgetRequestId: selectedRequest.reqId,
            componentId: selectedRequest.componentId,
            unitId: selectedRequest.reqUnitId,
            fieldId: selectedRequest.fieldId,
            academicYearId: globalAcademicYearId,
            planId: selectedRequest.planId,
            source: sourceMode, // Tag as YAYASAN or BOS
            amount: parseFloat(formData.amount),
            date: formData.date,
            description: formData.description,
            category: selectedRequest.name || 'General',
            // Field baru
            buktiTeks: formData.buktiTeks,
            nomorNota: formData.nomorNota,
            volume: formData.volume,
            satuan: formData.satuan,
            harga: formData.harga,
            kategoriAset: formData.kategoriAset,
            umurEkonomis: formData.kategoriAset === 'ASET' ? formData.umurEkonomis : null,
            status: 'DRAFT'
        };

        if (editingDraftId) {
            dispatch({ type: 'EDIT_BUDGET_REPORT', payload: reportData });
            api.pushAction({ type: 'EDIT_BUDGET_REPORT', payload: reportData }, state);
        } else {
            dispatch({ type: 'ADD_BUDGET_REPORT', payload: reportData });
            api.pushAction({ type: 'ADD_BUDGET_REPORT', payload: reportData }, state);
        }

        setShowReportForm(false);
        setEditingDraftId(null);
    };

    const handleSubmitDrafts = () => {
        if (window.confirm(`Anda akan mengajukan ${draftReports.length} laporan ke Superadmin. Lanjutkan?`)) {
            draftReports.forEach(draft => {
                const updated = { ...draft, status: 'PENDING' };
                dispatch({ type: 'EDIT_BUDGET_REPORT', payload: updated });
                api.pushAction({ type: 'EDIT_BUDGET_REPORT', payload: updated }, state);
            });
        }
    };

    const handleDeleteDraft = (id) => {
        if (window.confirm('Hapus nota (draft) ini? Saldo sisa dana akan kembali seperti semula.')) {
            dispatch({ type: 'DELETE_BUDGET_REPORT', payload: id });
            api.pushAction({ type: 'DELETE_BUDGET_REPORT', payload: id }, state);
        }
    };

    const handleApproveReport = async (report) => {
        if (window.confirm('Setujui laporan ini? Jurnal akan dicatat jika diperlukan.')) {
            setProcessingId(report.id);
            const updated = { ...report, status: 'APPROVED', notified: false };
            dispatch({ type: 'EDIT_BUDGET_REPORT', payload: updated });
            await api.pushAction({ type: 'EDIT_BUDGET_REPORT', payload: updated }, state);
            setProcessingId(null);
            alert('Laporan berhasil disetujui');
        }
    };

    const handleRejectReport = async (report) => {
        if (window.confirm('Tolak laporan ini? Saldo unit akan dikembalikan.')) {
            setProcessingId(report.id);
            const updated = { ...report, status: 'REJECTED', notified: false };
            dispatch({ type: 'EDIT_BUDGET_REPORT', payload: updated });
            await api.pushAction({ type: 'EDIT_BUDGET_REPORT', payload: updated }, state);
            setProcessingId(null);
            alert('Laporan berhasil ditolak');
        }
    };

    return (
        <div className="p-8 animate-in text-slate-900 bg-slate-50 min-h-screen">
            <div className="print:hidden space-y-8">
                {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-1 font-display">Laporan Pengeluaran</h1>
                    <p className="text-slate-500 font-medium italic mb-6">Laporkan realisasi penggunaan dana yang telah dicairkan.</p>
                    
                    <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 mb-8 inline-flex">
                        <button 
                            onClick={() => setSourceMode('YAYASAN')}
                            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sourceMode === 'YAYASAN' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-indigo-600'}`}
                        >
                            <Building2 size={12} className="inline mr-2" />
                            Dana Yayasan
                        </button>
                        {(!myFieldId || isSuperAdmin) && (
                            <button 
                                onClick={() => setSourceMode('BOS')}
                                className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sourceMode === 'BOS' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-emerald-600'}`}
                            >
                                <Tag size={12} className="inline mr-2" />
                                Dana BOS
                            </button>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl">
                    <button
                        onClick={() => setActiveTab('pending')}
                        className={`px-6 py-2 rounded-xl font-black text-xs transition-all ${activeTab === 'pending' ? 'bg-white text-blue-600 shadow-sm shadow-blue-500/5' : 'text-slate-500'}`}
                    >
                        Perlu Dilaporkan
                        {pendingItems.length > 0 && (
                            <span className="ml-2 bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{pendingItems.length}</span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`px-6 py-2 rounded-xl font-black text-xs transition-all ${activeTab === 'history' ? 'bg-white text-blue-600 shadow-sm shadow-blue-500/5' : 'text-slate-500'}`}
                    >
                        Riwayat Laporan
                    </button>
                    {isSuperAdmin && (
                        <button
                            onClick={() => setActiveTab('verification')}
                            className={`px-6 py-2 rounded-xl font-black text-xs transition-all ${activeTab === 'verification' ? 'bg-white text-indigo-600 shadow-sm shadow-indigo-500/5' : 'text-slate-500'}`}
                        >
                            Verifikasi Laporan
                            {verificationReports.length > 0 && (
                                <span className="ml-2 bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{verificationReports.length}</span>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {activeTab === 'pending' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* List of pending/draft reports */}
                    <div className="lg:col-span-2 space-y-6">
                        
                        {/* DRAFTS SECTION */}
                        {draftReports.length > 0 && (
                            <div className="card p-6 bg-amber-50 border-amber-200 shadow-sm mb-8">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="font-black text-amber-900 text-lg flex items-center gap-2">
                                            <Package size={18} /> Nota Belum Diajukan (Draft)
                                        </h3>
                                        <p className="text-xs text-amber-700 font-medium">Laporan di bawah ini sudah memotong saldo, tetapi belum dikirim ke Superadmin.</p>
                                    </div>
                                    <button onClick={handleSubmitDrafts} className="px-4 py-2 bg-amber-500 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-md hover:bg-amber-600 transition-colors">
                                        Ajukan {draftReports.length} Laporan
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {draftReports.map(draft => (
                                        <div key={draft.id} className="flex items-center justify-between bg-white p-4 rounded-2xl border border-amber-100 shadow-sm">
                                            <div>
                                                <p className="text-sm font-black text-slate-800">{draft.description}</p>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Nota: {draft.nomorNota || '-'} | Vol: {draft.volume} {draft.satuan}</p>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="font-black text-amber-600 text-sm">{formatRupiah(parseFloat(draft.amount || 0))}</span>
                                                <button onClick={() => handleEditDraft(draft)} className="text-indigo-500 hover:text-indigo-700 p-2 bg-indigo-50 rounded-lg font-bold text-xs" title="Edit Draft">
                                                    Edit
                                                </button>
                                                <button onClick={() => handleDeleteDraft(draft.id)} className="text-rose-500 hover:text-rose-700 p-2 bg-rose-50 rounded-lg font-bold text-xs" title="Hapus Draft">
                                                    Hapus
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-2 mb-2 px-2">
                            <AlertCircle size={16} className="text-blue-500" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rincian yang Menunggu Laporan</span>
                        </div>

                        {pendingItems.length > 0 ? pendingItems.map(item => (
                            <div key={`${item.reqId}-${item.componentId || 'legacy'}`} className="card p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-blue-200 transition-all border-l-8 border-l-blue-600">
                                <div>
                                    <h4 className="font-black text-slate-900 text-xl mb-1">{item.name}</h4>
                                    <div className="flex items-center gap-4 text-slate-400 text-xs font-bold">
                                        <span className="flex items-center gap-1"><History size={14} /> {item.reqDate}</span>
                                        <span className="flex items-center gap-1 font-black text-blue-600 italic">REQ: {item.reqId.slice(0, 8)}</span>
                                    </div>
                                    <p className="mt-4 text-sm text-slate-500 font-medium">{item.reqDescription}</p>
                                </div>

                                <div className="text-right">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Sisa Dana Rincian</p>
                                    <h4 className="text-2xl font-black text-blue-700 mb-2">{formatRupiah(item.sisa)}</h4>
                                    <p className="text-[10px] font-bold text-slate-400 mb-4">Plafon Rincian: {formatRupiah(parseFloat(item.amount || 0))}</p>
                                    <button
                                        onClick={() => handleOpenReportForm(item)}
                                        className="btn btn-primary !rounded-xl !py-2 !text-xs !w-full"
                                    >
                                        <FileCheck size={16} />
                                        <span>Buat Laporan</span>
                                    </button>
                                </div>
                            </div>
                        )) : (
                            <div className="card p-20 text-center text-slate-400 italic font-medium">
                                Tidak ada rincian dana yang menunggu laporan.
                            </div>
                        )}
                    </div>

                    {/* Pending Sidebar summary */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="card p-8 bg-emerald-50 border-emerald-100 text-center">
                            <div className="w-16 h-16 bg-white text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                                <CheckCircle2 size={32} />
                            </div>
                            <h3 className="text-xl font-black text-slate-900 mb-2">Tertib Administrasi</h3>
                            <p className="text-sm text-slate-600 font-medium leading-relaxed">Pastikan semua pengeluaran dilaporkan tepat waktu untuk menjaga transparansi keuangan Yayasan.</p>
                        </div>

                        <div className="card p-8">
                            <h4 className="font-black text-slate-900 uppercase text-[10px] tracking-widest mb-6 border-b border-slate-100 pb-4 flex items-center justify-between">
                                <span>Statistik Laporan</span>
                                <ArrowUpRight size={14} />
                            </h4>
                            <div className="space-y-6">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-400">Total Cair</span>
                                    <span className="text-sm font-black text-slate-700">{formatRupiah(totalCair)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-400">Total Lapor</span>
                                    <span className="text-sm font-black text-emerald-600">{formatRupiah(totalLapor)}</span>
                                </div>
                                <div className="flex justify-between items-center border-t border-slate-100 pt-4">
                                    <span className="text-xs font-bold text-slate-400">Total Sisa</span>
                                    <span className="text-sm font-black text-amber-500">{formatRupiah(totalSisa)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : activeTab === 'history' ? (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: 'Total Laporan', value: filteredReports.length, unit: 'transaksi', color: 'indigo' },
                            { label: 'Total Nilai', value: formatRupiah(totalNilai), unit: '', color: 'slate' },
                            { label: 'Kategori Aset', value: totalAset, unit: 'transaksi', color: 'emerald' },
                            { label: 'Non Aset', value: totalNonAset, unit: 'transaksi', color: 'amber' },
                        ].map((s, i) => (
                            <div key={i} className={`card p-5 border-l-4 ${i === 0 ? 'border-l-indigo-500' : i === 1 ? 'border-l-slate-400' : i === 2 ? 'border-l-emerald-500' : 'border-l-amber-500'}`}>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{s.label}</p>
                                <p className="text-xl font-black text-slate-800">{s.value}</p>
                                {s.unit && <p className="text-[9px] text-slate-400 font-bold">{s.unit}</p>}
                            </div>
                        ))}
                    </div>

                    {/* Filter Bar */}
                    <div className="card p-5 flex flex-wrap gap-4 items-center">
                        <div className="flex items-center gap-2 flex-1 min-w-[180px] bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
                            <Search size={14} className="text-slate-400" />
                            <input
                                className="bg-transparent text-xs font-bold text-slate-700 placeholder:text-slate-400 outline-none flex-1"
                                placeholder="Cari nota, keterangan, kategori..."
                                value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
                            <Tag size={14} className="text-slate-400" />
                            <select className="bg-transparent text-xs font-bold text-slate-700 outline-none"
                                value={filterKategori} onChange={e => setFilterKategori(e.target.value)}>
                                <option value="ALL">Semua Kategori</option>
                                <option value="ASET">Aset</option>
                                <option value="NON_ASET">Non Aset</option>
                            </select>
                        </div>
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
                            <Calendar size={14} className="text-slate-400" />
                            <input type="date" className="bg-transparent text-xs font-bold text-slate-600 outline-none"
                                value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
                            <span className="text-slate-300 text-xs">—</span>
                            <input type="date" className="bg-transparent text-xs font-bold text-slate-600 outline-none"
                                value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
                        </div>
                        {(search || filterKategori !== 'ALL' || filterDateFrom || filterDateTo) && (
                            <button onClick={() => { setSearch(''); setFilterKategori('ALL'); setFilterDateFrom(''); setFilterDateTo(''); }}
                                className="text-[10px] font-black text-rose-500 hover:text-rose-700 uppercase tracking-widest">
                                Reset Filter
                            </button>
                        )}
                        <div className="flex gap-2 ml-auto">
                            <button
                                onClick={() => alert('Fitur export Excel akan segera tersedia.')}
                                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-700 transition-colors shadow-sm">
                                <Download size={14} /> Export Excel
                            </button>
                            <button
                                onClick={() => window.print()}
                                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 transition-colors shadow-sm">
                                <FileCheck size={14} /> Cetak
                            </button>
                        </div>
                    </div>

                    {/* Dense Table */}
                    <div className="card overflow-hidden rounded-2xl border-0 shadow-xl">
                        <div className="bg-slate-900 px-6 py-4 flex items-center gap-3">
                            <History size={14} className="text-indigo-400" />
                            <span className="text-[10px] font-black text-white uppercase tracking-widest">Riwayat Laporan Realisasi</span>
                            <span className="ml-auto text-[9px] text-slate-400 font-bold">{filteredReports.length} data ditampilkan</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100">
                                        <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center w-10">No</th>
                                        <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Tanggal</th>
                                        <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">No. Nota</th>
                                        <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Keterangan</th>
                                        <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Volume</th>
                                        <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Jumlah</th>
                                        <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Kategori</th>
                                        <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                        <th className="px-5 py-3 w-8"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredReports.length > 0
                                        ? filteredReports.map((report, idx) => (
                                            <ReportRow key={report.id} report={report} units={units} isSuperAdmin={isSuperAdmin} idx={idx} />
                                        ))
                                        : (
                                            <tr>
                                                <td colSpan="9" className="px-8 py-20 text-center text-slate-400 italic font-medium border-t border-slate-50">
                                                    {baseReports.length === 0 ? 'Belum ada laporan yang dibuat.' : 'Tidak ada data yang cocok dengan filter.'}
                                                </td>
                                            </tr>
                                        )}
                                </tbody>
                                {filteredReports.length > 0 && (
                                    <tfoot>
                                        <tr className="bg-slate-900 text-white">
                                            <td colSpan="5" className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Total</td>
                                            <td className="px-5 py-4 text-right font-black text-emerald-400 text-base">{formatRupiah(totalNilai)}</td>
                                            <td colSpan="3"></td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                </div>
            ) : activeTab === 'verification' && isSuperAdmin ? (
                /* VERIFICATION TAB */
                <div className="space-y-6">
                    <div className="card p-6 bg-indigo-50 border-indigo-100 flex items-center gap-4">
                        <AlertCircle size={24} className="text-indigo-600" />
                        <div>
                            <h3 className="font-black text-indigo-900 text-lg">Persetujuan Laporan Realisasi</h3>
                            <p className="text-xs text-indigo-600 font-medium">Laporan yang diajukan unit dan bidang akan mengunci saldo Sisa Dana Cair sementara. Anda perlu menyetujui laporan berikut agar statusnya menjadi final (VERIFIED).</p>
                        </div>
                    </div>

                    <div className="card overflow-hidden rounded-2xl border-0 shadow-xl">
                        <div className="bg-slate-900 px-6 py-4 flex items-center gap-3">
                            <CheckCircle2 size={14} className="text-emerald-400" />
                            <span className="text-[10px] font-black text-white uppercase tracking-widest">Daftar Menunggu Persetujuan</span>
                            <span className="ml-auto text-[9px] text-slate-400 font-bold">{verificationReports.length} laporan</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100">
                                        <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Unit / Tgl</th>
                                        <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">No. Nota</th>
                                        <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Keterangan</th>
                                        <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Volume</th>
                                        <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Jumlah</th>
                                        <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Kategori</th>
                                        <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {verificationReports.length > 0
                                        ? verificationReports.map((report) => (
                                            <tr key={report.id} className="border-b border-slate-100 hover:bg-slate-50">
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-1 mb-1">
                                                        <Building2 size={10} className="text-slate-400" />
                                                        <span className="text-[10px] font-black text-slate-600">{units.find(u => u.id === report.unitId)?.name || 'Umum'}</span>
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-400">{report.date}</span>
                                                </td>
                                                <td className="px-5 py-4 text-xs font-black text-indigo-600 font-mono">{report.nomorNota || '—'}</td>
                                                <td className="px-5 py-4 text-xs font-medium text-slate-600 max-w-[200px] truncate" title={report.description}>{report.description}</td>
                                                <td className="px-5 py-4 text-center text-xs font-bold text-slate-600">{(report.volume && report.satuan) ? `${parseFloat(report.volume)} ${report.satuan}` : '—'}</td>
                                                <td className="px-5 py-4 text-right text-sm font-black text-slate-800">{formatRupiah(parseFloat(report.amount || 0))}</td>
                                                <td className="px-5 py-4 text-center"><AsetBadge kategori={report.kategoriAset} umurEkonomis={report.umurEkonomis} /></td>
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button 
                                                            onClick={() => handleApproveReport(report)} 
                                                            disabled={processingId === report.id}
                                                            className="px-3 py-1.5 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-emerald-600 transition-colors shadow-sm shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                                        >
                                                            {processingId === report.id ? <Loader2 size={12} className="animate-spin" /> : null}
                                                            Setujui
                                                        </button>
                                                        <button 
                                                            onClick={() => handleRejectReport(report)} 
                                                            disabled={processingId === report.id}
                                                            className="px-3 py-1.5 bg-rose-50 text-rose-600 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-rose-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                                        >
                                                            {processingId === report.id ? <Loader2 size={12} className="animate-spin" /> : null}
                                                            Tolak
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                        : (
                                            <tr>
                                                <td colSpan="7" className="px-8 py-20 text-center text-slate-400 italic font-medium">Tidak ada laporan yang menunggu persetujuan.</td>
                                            </tr>
                                        )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : null}

            {/* Report Form Modal */}
            {showReportForm && (
                <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowReportForm(false)} />
                    <div className="bg-white rounded-[40px] w-full max-w-3xl relative z-10 shadow-2xl overflow-hidden animate-in max-h-[92vh] flex flex-col">
                        {/* Modal Header */}
                        <div className="p-8 border-b border-slate-100 flex justify-between items-start flex-shrink-0">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900">Laporan Penggunaan Dana</h2>
                                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">Ref: {selectedRequest?.description}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Maksimal Lapor (Sisa)</p>
                                <span className="text-lg font-black text-blue-700">
                                    {formatRupiah(parseFloat(selectedRequest?.totalAmount || selectedRequest?.amount || 0) - (reportedAmounts[selectedRequest?.id] || 0) + (editingDraftId ? parseFloat(budgetReports.find(r => r.id === editingDraftId)?.amount || 0) : 0))}
                                </span>
                            </div>
                        </div>

                        {/* Scrollable body */}
                        <div className="overflow-y-auto flex-1 custom-scrollbar">
                            <form id="report-form" onSubmit={handleReportSubmit} className="p-8 space-y-6">

                                {/* Row 1: Tanggal + Nomor Nota */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="form-label">Tanggal Pelaporan <span className="text-rose-500">*</span></label>
                                        <input type="date" className="form-input" value={formData.date}
                                            onChange={e => setFormData({ ...formData, date: e.target.value })} required />
                                    </div>
                                    <div>
                                        <label className="form-label">Nomor Urut Nota <span className="text-rose-500">*</span></label>
                                        <input type="text" className="form-input" placeholder="Contoh: 001"
                                            value={formData.nomorNota}
                                            onChange={e => setFormData({ ...formData, nomorNota: e.target.value })} required />
                                    </div>
                                </div>

                                {/* Row 2: Volume + Satuan + Harga → auto Jumlah */}
                                <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rincian Pembelian</p>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="form-label">Volume</label>
                                            <input type="number" min="0" step="any" className="form-input" placeholder="Qty"
                                                value={formData.volume}
                                                onChange={e => {
                                                    const vol = e.target.value;
                                                    const currentHarga = formData.harga || 0;
                                                    const total = parseFloat(vol || 0) * parseFloat(currentHarga);
                                                    setFormData({ ...formData, volume: vol, amount: total || formData.amount });
                                                }} />
                                        </div>
                                        <div>
                                            <label className="form-label">Satuan</label>
                                            <input type="text" className="form-input" placeholder="Buah / Rim / Kg"
                                                value={formData.satuan}
                                                onChange={e => setFormData({ ...formData, satuan: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="form-label">Harga Satuan (Rp)</label>
                                            <input type="number" min="0" className="form-input" placeholder="0"
                                                value={formData.harga}
                                                onChange={e => {
                                                    const hrg = e.target.value;
                                                    const currentVol = formData.volume || 0;
                                                    const total = parseFloat(currentVol) * parseFloat(hrg || 0);
                                                    setFormData({ ...formData, harga: hrg, amount: total || formData.amount });
                                                }} />
                                        </div>
                                    </div>
                                    {/* Auto total display */}
                                    <div className="flex items-center justify-between px-4 py-3 bg-indigo-50 rounded-2xl border border-indigo-100">
                                        <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Total Otomatis</span>
                                        <span className="font-black text-indigo-700 text-base">
                                            {formatRupiah(parseFloat(formData.volume || 0) * parseFloat(formData.harga || 0))}
                                        </span>
                                    </div>
                                </div>

                                {/* Row 3: Jumlah Realisasi (editable override) */}
                                <div>
                                    <label className="form-label">Jumlah Realisasi (Rp) <span className="text-rose-500">*</span></label>
                                    <input type="number" className="form-input font-black text-blue-600" placeholder="0"
                                        value={formData.amount}
                                        onChange={e => setFormData({ ...formData, amount: e.target.value })} required />
                                    <p className="text-[10px] text-slate-400 mt-1 italic">*Otomatis terisi dari volume × harga. Bisa diubah manual.</p>
                                </div>

                                {/* Row 4: Keterangan Detail */}
                                <div>
                                    <label className="form-label">Keterangan Detail <span className="text-rose-500">*</span></label>
                                    <textarea className="form-input h-[90px] !py-3" placeholder="Jelaskan penggunaan dana secara spesifik..."
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })} required />
                                </div>

                                {/* Row 5: Bukti Transaksi – teks */}
                                <div>
                                    <label className="form-label">Bukti Transaksi (Teks)</label>
                                    <textarea className="form-input h-[80px] !py-3"
                                        placeholder="Nomor kwitansi, nama toko, atau keterangan bukti transaksi lainnya..."
                                        value={formData.buktiTeks}
                                        onChange={e => setFormData({ ...formData, buktiTeks: e.target.value })} />
                                </div>

                                {/* Row 6: Kategori Aset */}
                                <div className="p-5 rounded-3xl border-2 border-slate-100 space-y-4">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kategori Penggunaan</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        {[{ val: 'NON_ASET', label: 'Non Aset', sub: 'Habis pakai / Jasa' },
                                        { val: 'ASET', label: 'Aset', sub: 'Barang inventaris / Tetap' }].map(opt => (
                                            <div
                                                key={opt.val}
                                                onClick={() => setFormData({ ...formData, kategoriAset: opt.val, umurEkonomis: '' })}
                                                className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${formData.kategoriAset === opt.val
                                                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                                    : 'border-slate-100 hover:border-slate-200 text-slate-600'
                                                    }`}
                                            >
                                                <p className="font-black text-sm">{opt.label}</p>
                                                <p className="text-[10px] font-bold opacity-60 mt-0.5">{opt.sub}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Umur Ekonomis – muncul hanya jika ASET */}
                                    {formData.kategoriAset === 'ASET' && (
                                        <div>
                                            <label className="form-label">Umur Ekonomis (Tahun) <span className="text-rose-500">*</span></label>
                                            <div className="grid grid-cols-4 gap-3">
                                                {['4', '8', '10', '20'].map(yr => (
                                                    <button
                                                        type="button"
                                                        key={yr}
                                                        onClick={() => setFormData({ ...formData, umurEkonomis: yr })}
                                                        className={`py-3 rounded-2xl font-black text-sm border-2 transition-all ${formData.umurEkonomis === yr
                                                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                                            : 'border-slate-100 hover:border-slate-200 text-slate-500'
                                                            }`}
                                                    >
                                                        {yr} Thn
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Sinkronisasi Jurnal Info */}
                                <div className="p-5 bg-blue-50/60 rounded-3xl border border-blue-100">
                                    <h5 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <Receipt size={14} /> Sinkronisasi Jurnal
                                    </h5>
                                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                                        Sistem akan otomatis membuat entri di <b>Jurnal Umum</b> dan memperbarui <b>Buku Besar</b> setelah laporan ini dikonfirmasi.
                                        {formData.kategoriAset === 'ASET' && formData.umurEkonomis && (
                                            <span className="block mt-1 text-emerald-600 font-bold">✓ Aset baru akan tercatat dengan umur ekonomis {formData.umurEkonomis} tahun.</span>
                                        )}
                                    </p>
                                </div>
                            </form>
                        </div>

                        {/* Fixed Footer */}
                        <div className="p-8 border-t border-slate-100 flex gap-4 flex-shrink-0 bg-white">
                            <button type="button" onClick={() => setShowReportForm(false)} className="btn btn-secondary flex-1">Batal</button>
                            <button type="submit" form="report-form" className="btn btn-primary flex-1 shadow-blue-500/20">
                                <Save size={18} />
                                <span>Simpan Nota (Draft)</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
            </div>

            {/* Printable Area (Hidden on screen, visible on print) */}
            <div className="hidden print:block text-black bg-white w-full">
                <div className="text-center mb-6">
                    <h2 className="text-xl font-black uppercase">LAPORAN PENGELUARAN YAYASAN</h2>
                    <p className="text-sm font-bold mt-1">
                        {myUnitId ? (units.find(u => u.id === myUnitId)?.name || '') : 'Semua Unit'} 
                        {filterDateFrom && filterDateTo ? ` (${filterDateFrom} s.d ${filterDateTo})` : ''}
                    </p>
                </div>
                
                <table className="w-full text-left border-collapse border border-slate-800 text-[10px]">
                    <thead>
                        <tr className="bg-slate-100">
                            <th className="p-2 border border-slate-800 text-center font-bold">No</th>
                            <th className="p-2 border border-slate-800 font-bold">Tanggal</th>
                            <th className="p-2 border border-slate-800 font-bold">No. Nota</th>
                            <th className="p-2 border border-slate-800 font-bold">Keterangan</th>
                            <th className="p-2 border border-slate-800 font-bold">Bukti Transaksi</th>
                            <th className="p-2 border border-slate-800 text-center font-bold">Volume</th>
                            <th className="p-2 border border-slate-800 text-right font-bold">Harga</th>
                            <th className="p-2 border border-slate-800 text-right font-bold">Jumlah</th>
                            <th className="p-2 border border-slate-800 text-center font-bold">Kategori</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredReports.map((report, idx) => (
                            <tr key={report.id}>
                                <td className="p-2 border border-slate-800 text-center">{idx + 1}</td>
                                <td className="p-2 border border-slate-800 whitespace-nowrap">{report.date ? new Date(report.date).toLocaleDateString('id-ID') : '—'}</td>
                                <td className="p-2 border border-slate-800 font-mono whitespace-nowrap">{report.nomorNota || '—'}</td>
                                <td className="p-2 border border-slate-800">{report.category || report.description || 'Pengeluaran'}</td>
                                <td className="p-2 border border-slate-800">{report.buktiTeks || '—'}</td>
                                <td className="p-2 border border-slate-800 text-center whitespace-nowrap">{(report.volume && report.satuan) ? `${parseFloat(report.volume)} ${report.satuan}` : '—'}</td>
                                <td className="p-2 border border-slate-800 text-right whitespace-nowrap">{report.harga ? formatRupiah(parseFloat(report.harga)) : '—'}</td>
                                <td className="p-2 border border-slate-800 text-right font-bold whitespace-nowrap">{formatRupiah(parseFloat(report.amount || 0))}</td>
                                <td className="p-2 border border-slate-800 text-center">{report.kategoriAset === 'ASET' ? 'ASET' : 'NON ASET'}</td>
                            </tr>
                        ))}
                        {filteredReports.length === 0 && (
                            <tr>
                                <td colSpan="9" className="p-4 border border-slate-800 text-center italic">Tidak ada data untuk dicetak</td>
                            </tr>
                        )}
                    </tbody>
                    {filteredReports.length > 0 && (
                        <tfoot>
                            <tr className="bg-slate-100">
                                <td colSpan="7" className="p-2 border border-slate-800 text-right font-black uppercase">Total Pengeluaran</td>
                                <td className="p-2 border border-slate-800 text-right font-black">{formatRupiah(totalNilai)}</td>
                                <td className="border border-slate-800"></td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </div>
    );
}
