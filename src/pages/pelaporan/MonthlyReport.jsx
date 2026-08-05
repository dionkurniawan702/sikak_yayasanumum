import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileCheck, Receipt, Save, AlertCircle, CheckCircle2, ArrowUpRight, History, Search, ChevronDown, ChevronRight, Download, Package, Layers, Filter, Calendar, Tag, Building2, Loader2, Edit2, Trash2, X, RotateCcw, Upload, FileSpreadsheet } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { formatRupiah } from '../../utils/format';
import * as XLSX from 'xlsx';

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

function formatMonthLabel(monthStr) {
    if (!monthStr) return '—';
    const monthNames = {
        '01': 'Januari', '02': 'Februari', '03': 'Maret', '04': 'April',
        '05': 'Mei', '06': 'Juni', '07': 'Juli', '08': 'Agustus',
        '09': 'September', '10': 'Oktober', '11': 'November', '12': 'Desember'
    };
    const parts = monthStr.split('-');
    if (parts.length === 2 && monthNames[parts[1]]) {
        return `${monthNames[parts[1]]} ${parts[0]}`;
    }
    return monthStr;
}

// ─── Expandable Row ──────────────────────────────────────────────────────────
function ReportRow({ report, units, expenseItems, rabPlans, budgetRequests, isSuperAdmin, idx, selectable, isSelected, onToggleSelect, onEdit, onDelete, onCancelApproval, isProcessing }) {
    const [open, setOpen] = useState(false);
    const unitName = units.find(u => u.id === report.unitId)?.name;
    const dateStr = report.date ? new Date(report.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
    
    const req = budgetRequests?.find(r => r.id === (report.budgetRequestId || report.requestId));
    const reqMonthLabel = req?.month ? formatMonthLabel(req.month) : '—';

    let exId = report.expenseItemId;
    if (!exId && report.planId && report.componentId) {
        const plan = rabPlans?.find(p => p.id === report.planId);
        if (plan && plan.expense) {
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
    }
    if (!exId && report.budgetRequestId) {
        const reqFound = budgetRequests?.find(r => r.id === report.budgetRequestId);
        if (reqFound) {
            if (report.componentId && reqFound.items) {
                const reqItem = reqFound.items.find(i => i.componentId === report.componentId);
                if (reqItem && reqItem.expenseItemId) exId = reqItem.expenseItemId;
            }
            if (!exId && reqFound.expenseItemId) exId = reqFound.expenseItemId;
        }
    }
    
    const expenseItemName = expenseItems?.find(e => e.id === exId)?.name || '—';

    return (
        <>
            <tr
                className={`border-b border-slate-100 cursor-pointer transition-colors ${open ? 'bg-indigo-50/40' : 'hover:bg-slate-50/80'}`}
                onClick={() => setOpen(o => !o)}
            >
                {!isSuperAdmin && (
                    <td className="px-5 py-4 text-center" onClick={e => e.stopPropagation()}>
                        {selectable && (
                            <input 
                                type="checkbox" 
                                checked={isSelected} 
                                onChange={() => onToggleSelect(report.id)}
                                className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer shadow-sm"
                            />
                        )}
                    </td>
                )}
                <td className="px-5 py-4 text-center">
                    <span className="text-[10px] font-black text-slate-400">{idx + 1}</span>
                </td>
                <td className="px-5 py-4">
                    <span className="text-xs font-bold text-slate-500">{dateStr}</span>
                </td>
                <td className="px-5 py-4">
                    <span className="inline-flex items-center px-2 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded text-[10px] font-black uppercase tracking-wider">
                        {reqMonthLabel}
                    </span>
                </td>
                <td className="px-5 py-4">
                    <span className="text-xs font-black text-indigo-600 font-mono">{report.nomorNota || '—'}</span>
                </td>
                <td className="px-5 py-4">
                    <span className="text-xs font-bold text-slate-700 line-clamp-1">{report.category || '—'}</span>
                    {isSuperAdmin && unitName && (
                        <div className="flex items-center gap-1 mt-0.5">
                            <Building2 size={9} className="text-slate-300" />
                            <span className="text-[9px] text-slate-400 font-bold">{unitName}</span>
                        </div>
                    )}
                </td>
                <td className="px-5 py-4">
                    <span className="text-xs font-bold text-slate-600 line-clamp-1" title={report.description}>{report.description || '—'}</span>
                </td>
                <td className="px-5 py-4 text-center">
                    {(report.volume && report.satuan) ? (
                        <span className="text-xs font-bold text-slate-600">
                            {parseFloat(report.volume).toLocaleString('id-ID')} {report.satuan}
                        </span>
                    ) : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-5 py-4 text-right font-mono">
                    {parseFloat(report.diskon || 0) > 0 ? (
                        <span className="text-xs font-bold text-rose-500">
                            -{formatRupiah(parseFloat(report.diskon))}
                        </span>
                    ) : <span className="text-slate-300 text-xs">—</span>}
                </td>
                <td className="px-5 py-4 text-right">
                    <span className="text-sm font-black text-slate-800">{formatRupiah(parseFloat(report.amount || 0))}</span>
                </td>
                <td className="px-5 py-4 text-center">
                    <span className="inline-flex items-center px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-black uppercase tracking-widest">{expenseItemName}</span>
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
                    <div className="flex items-center justify-center gap-1.5">
                        {!isSuperAdmin && (report.status === 'DRAFT' || report.status === 'REJECTED') && onEdit && onDelete && (
                            <>
                                {report.kategoriAset !== 'PENGEMBALIAN' && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onEdit(); }}
                                        className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors"
                                        title={report.status === 'REJECTED' ? 'Perbaiki Laporan' : 'Edit Draft'}
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                )}
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                                    className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors"
                                    title={report.status === 'REJECTED' ? 'Hapus Laporan' : 'Hapus Draft'}
                                >
                                    <Trash2 size={14} />
                                </button>
                            </>
                        )}
                        {open
                            ? <ChevronDown size={14} className="text-indigo-400" />
                            : <ChevronRight size={14} className="text-slate-300" />}
                    </div>
                </td>
            </tr>

            {/* Accordion Detail */}
            {open && (
                <tr className="bg-slate-50/80 border-b border-slate-100">
                    <td colSpan={isSuperAdmin ? 11 : 12} className="px-8 py-6">
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
                            {/* Actions for Draft (Unit Only) */}
                            {!isSuperAdmin && (report.status === 'DRAFT' || report.status === 'REJECTED') && onEdit && onDelete && (
                                <div className="space-y-3 md:col-span-3 border-t border-slate-200/60 pt-4 mt-2">
                                    <div className="flex gap-3 justify-end">
                                        {report.kategoriAset !== 'PENGEMBALIAN' && (
                                            <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="btn btn-secondary !py-2 !px-4 !text-xs !rounded-xl !text-indigo-600 hover:!bg-indigo-50 hover:!border-indigo-200 shadow-sm">
                                                <Edit2 size={14} className="mr-1 inline-block" /> {report.status === 'REJECTED' ? 'Perbaiki Laporan' : 'Edit Draft'}
                                            </button>
                                        )}
                                        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="btn btn-secondary !py-2 !px-4 !text-xs !rounded-xl !text-rose-600 hover:!bg-rose-50 hover:!border-rose-200 shadow-sm">
                                            <Trash2 size={14} className="mr-1 inline-block" /> {report.status === 'REJECTED' ? 'Hapus Laporan' : 'Hapus Draft'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Actions for Approved (Superadmin Only) */}
                            {isSuperAdmin && report.status === 'APPROVED' && onCancelApproval && (
                                <div className="space-y-3 md:col-span-3 border-t border-slate-200/60 pt-4 mt-2">
                                    <div className="flex gap-3 justify-end">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onCancelApproval(); }} 
                                            disabled={isProcessing}
                                            className="btn btn-secondary !py-2 !px-4 !text-xs !rounded-xl !text-rose-600 hover:!bg-rose-50 hover:!border-rose-200 shadow-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <RotateCcw size={12} className="inline-block" /> Batalkan Persetujuan (ACC)
                                        </button>
                                    </div>
                                </div>
                            )}
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
    const [searchParams] = useSearchParams();
    const sourceParam = searchParams.get('source') || 'YAYASAN';
    const [sourceMode, setSourceMode] = useState(sourceParam.toUpperCase() === 'BOS' ? 'BOS' : 'YAYASAN');

    React.useEffect(() => {
        setSourceMode(sourceParam.toUpperCase() === 'BOS' ? 'BOS' : 'YAYASAN');
    }, [sourceParam]);

    const [selectedUnitFilter, setSelectedUnitFilter] = useState('ALL'); // superadmin unit filter
    const [selectedHistoryIds, setSelectedHistoryIds] = useState([]); // local history bulk submission
    const [showReportsList, setShowReportsList] = useState(false);
    const [selectedItemForReports, setSelectedItemForReports] = useState(null);

    const monthParam = searchParams.get('month');
    const reqIdParam = searchParams.get('reqId');

    // Filter state for history
    const [search, setSearch] = useState('');
    const [filterKategori, setFilterKategori] = useState('ALL');
    const [filterRequestMonth, setFilterRequestMonth] = useState('ALL');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');
    const [pendingSearch, setPendingSearch] = useState(reqIdParam || '');
    const [pendingMonthFilter, setPendingMonthFilter] = useState(monthParam || 'ALL');
    const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL', 'FILLED', 'NOT_FILLED'

    React.useEffect(() => {
        if (monthParam) setPendingMonthFilter(monthParam);
        if (reqIdParam) setPendingSearch(reqIdParam);
    }, [monthParam, reqIdParam]);

    const { budgetRequests = [], budgetReports = [], expenseItems = [], rabPlans = [], units = [], fields = [], globalAcademicYearId, currentUser } = state;

    const monthOptions = useMemo(() => {
        const set = new Set();
        (budgetRequests || []).forEach(r => {
            if (r.month) set.add(r.month);
        });
        const list = Array.from(set).sort();
        return list.map(mStr => ({
            id: mStr,
            label: formatMonthLabel(mStr)
        }));
    }, [budgetRequests]);

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
        const approvedMap = {};
        const reqMap = {};
        const reqApprovedMap = {};
        const reqSettledMap = {};
        const byRequestComponent = {};

        (budgetReports || []).forEach(r => {
            if (r.status !== 'REJECTED' && !r.isDeleted) {
                // Backward-compatible componentId lookup if missing in old reports
                let effectiveComponentId = r.componentId;
                if (!effectiveComponentId && (r.budgetRequestId || r.requestId)) {
                    const reqIdVal = r.budgetRequestId || r.requestId;
                    const req = (budgetRequests || []).find(br => br.id === reqIdVal);
                    if (req && req.items) {
                        const match = req.items.find(item => 
                            item.name === r.category || 
                            item.name?.toLowerCase() === r.category?.toLowerCase() ||
                            item.name?.toLowerCase() === r.description?.toLowerCase()
                        );
                        if (match) {
                            effectiveComponentId = match.componentId;
                        }
                    }
                }

                const amt = parseFloat(r.amount || 0);

                if (effectiveComponentId) {
                    if (!map[effectiveComponentId]) map[effectiveComponentId] = 0;
                    map[effectiveComponentId] += amt;

                    if (r.status === 'APPROVED') {
                        if (!approvedMap[effectiveComponentId]) approvedMap[effectiveComponentId] = 0;
                        approvedMap[effectiveComponentId] += amt;
                    }
                }
                
                const rReqId = r.budgetRequestId || r.requestId;
                if (rReqId) {
                    if (!reqMap[rReqId]) reqMap[rReqId] = 0;
                    reqMap[rReqId] += amt;

                    if (r.status === 'APPROVED') {
                        if (!reqApprovedMap[rReqId]) reqApprovedMap[rReqId] = 0;
                        reqApprovedMap[rReqId] += amt;
                    }

                    if (!reqSettledMap[rReqId]) reqSettledMap[rReqId] = 0;
                    reqSettledMap[rReqId] += amt;

                    if (effectiveComponentId) {
                        const reqCompKey = `${rReqId}_${effectiveComponentId}`;
                        if (!byRequestComponent[reqCompKey]) byRequestComponent[reqCompKey] = 0;
                        byRequestComponent[reqCompKey] += amt;
                    }
                }
            }
        });

        // Include Pengembalian Dana (refund) reports towards request settlement
        (budgetReports || []).forEach(r => {
            if (r.status !== 'REJECTED' && !r.isDeleted && r.kategoriAset === 'PENGEMBALIAN') {
                const amt = parseFloat(r.amount || 0);
                const rReqId = r.budgetRequestId || r.requestId;
                if (rReqId) {
                    if (!reqSettledMap[rReqId]) reqSettledMap[rReqId] = 0;
                    reqSettledMap[rReqId] += amt;
                } else {
                    const rDesc = (r.description || '').toLowerCase();
                    const matchingReqs = (budgetRequests || []).filter(req => {
                        const isSameUnit = (req.unitId && req.unitId === r.unitId) || (req.fieldId && req.fieldId === r.fieldId);
                        return isSameUnit && req.academicYearId === r.academicYearId && req.status === 'APPROVED';
                    });

                    let matchedReq = matchingReqs.find(req => {
                        if (!req.month) return false;
                        const mName = req.month.slice(5);
                        const monthNames = {
                            '01': 'januari', '02': 'februari', '03': 'maret', '04': 'april',
                            '05': 'mei', '06': 'juni', '07': 'juli', '08': 'agustus',
                            '09': 'september', '10': 'oktober', '11': 'november', '12': 'desember'
                        };
                        const nameStr = monthNames[mName] || '';
                        return nameStr && rDesc.includes(nameStr);
                    });

                    if (!matchedReq) {
                        matchedReq = matchingReqs.find(req => {
                            const reqTot = parseFloat(req.totalAmount || 0);
                            const currSettled = (reqMap[req.id] || 0) + (reqSettledMap[req.id] || 0);
                            return currSettled < reqTot;
                        });
                    }

                    if (matchedReq) {
                        if (!reqSettledMap[matchedReq.id]) reqSettledMap[matchedReq.id] = 0;
                        reqSettledMap[matchedReq.id] += amt;
                    }
                }
            }
        });

        return { byComponent: map, approvedByComponent: approvedMap, byRequest: reqMap, approvedByRequest: reqApprovedMap, reqSettledMap, byRequestComponent };
    }, [budgetReports, budgetRequests]);

    const getReportsCountForItem = (item) => {
        return (budgetReports || []).filter(r => {
            if (r.isDeleted || r.status === 'REJECTED') return false;
            let effectiveComponentId = r.componentId;
            const rReqId = r.budgetRequestId || r.requestId;

            if (!effectiveComponentId && rReqId) {
                const req = (budgetRequests || []).find(br => br.id === rReqId);
                if (req && req.items) {
                    const match = req.items.find(ri => 
                        ri.name === r.category || 
                        ri.name?.toLowerCase() === r.category?.toLowerCase() ||
                        ri.name?.toLowerCase() === r.description?.toLowerCase()
                    );
                    if (match) {
                        effectiveComponentId = match.componentId;
                    }
                }
            }
            if (rReqId && item.reqId) {
                return rReqId === item.reqId && (effectiveComponentId ? effectiveComponentId === item.componentId : true);
            }
            return effectiveComponentId === item.componentId || (!effectiveComponentId && r.budgetRequestId === item.reqId);
        }).length;
    };

    const itemReports = useMemo(() => {
        if (!selectedItemForReports) return [];
        return (budgetReports || []).filter(r => {
            if (r.isDeleted) return false;
            let effectiveComponentId = r.componentId;
            const rReqId = r.budgetRequestId || r.requestId;

            if (!effectiveComponentId && rReqId) {
                const req = (budgetRequests || []).find(br => br.id === rReqId);
                if (req && req.items) {
                    const match = req.items.find(ri => 
                        ri.name === r.category || 
                        ri.name?.toLowerCase() === r.category?.toLowerCase() ||
                        ri.name?.toLowerCase() === r.description?.toLowerCase()
                    );
                    if (match) {
                        effectiveComponentId = match.componentId;
                    }
                }
            }
            if (rReqId && selectedItemForReports.reqId) {
                return rReqId === selectedItemForReports.reqId && (effectiveComponentId ? effectiveComponentId === selectedItemForReports.componentId : true);
            }
            return effectiveComponentId === selectedItemForReports.componentId || (!effectiveComponentId && r.budgetRequestId === selectedItemForReports.reqId);
        });
    }, [selectedItemForReports, budgetReports, budgetRequests]);

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

    const draftReports = useMemo(() => {
        return (budgetReports || []).filter(rel => {
            const effectiveStatus = rel.status || (rel.id?.startsWith('REL-') ? 'DRAFT' : 'APPROVED');
            if (effectiveStatus !== 'DRAFT') return false;
            if (rel.academicYearId !== globalAcademicYearId) return false;
            if (isSuperAdmin) return false; 
            if (myUnitId && rel.unitId !== myUnitId) return false;
            if (myFieldId && rel.fieldId !== myFieldId) return false;
            
            // Filter by source
            const isBosReport = rel.source === 'BOS' || rel.planId?.endsWith('-BOS');
            if (sourceMode === 'BOS' && !isBosReport) return false;
            if (sourceMode === 'YAYASAN' && isBosReport) return false;

            return true;
        });
    }, [budgetReports, isSuperAdmin, myUnitId, myFieldId, globalAcademicYearId, sourceMode]);

    const pendingItems = useMemo(() => {
        const items = [];
        requestsForYear.filter(req => req.status === 'APPROVED').forEach(req => {
            if (req.isClosed) return;

            if (req.items && req.items.length > 0) {
                req.items.forEach(item => {
                    if (item.isClosed) return; // Skip closed items!
                    
                    const reqCompKey = item.componentId ? `${req.id}_${item.componentId}` : null;
                    let reportedComp = 0;

                    if (reqCompKey && reportedAmounts?.byRequestComponent) {
                        reportedComp = reportedAmounts.byRequestComponent[reqCompKey] || 0;
                    } else if (item.componentId) {
                        const reportsNoReqId = (budgetReports || []).filter(r => 
                            !r.isDeleted && r.status !== 'REJECTED' && 
                            !r.budgetRequestId && !r.requestId && 
                            r.componentId === item.componentId
                        );
                        reportedComp = reportsNoReqId.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
                    }

                    const itemAmount = parseFloat(item.amount || 0);
                    const sisa = itemAmount - reportedComp;

                    items.push({
                        ...item,
                        reqId: req.id,
                        reqMonth: req.month,
                        reqDate: req.date,
                        reqDescription: req.description,
                        reqUnitId: req.unitId,
                        expenseItemId: item.expenseItemId || req.expenseItemId,
                        sisa
                    });
                });
            } else {
                const reqTotal = parseFloat(req.totalAmount || 0);
                const reportedReq = reportedAmounts.byRequest[req.id] || 0;
                const sisa = reqTotal - reportedReq;

                items.push({
                    reqId: req.id,
                    reqMonth: req.month,
                    reqDate: req.date,
                    reqDescription: req.description,
                    reqUnitId: req.unitId,
                    expenseItemId: req.expenseItemId,
                    name: 'General (Legacy)',
                    amount: req.totalAmount,
                    sisa
                });
            }
        });
        
        // Urutkan rincian:
        // Priority 0: Aktif/Baru (sisa > 0, belum ada draf, belum ada pending)
        // Priority 1: Memiliki draf
        // Priority 2: Memiliki pengajuan pending verifikasi
        // Priority 3: Selesai/Nihil (sisa <= 0)
        items.sort((a, b) => {
            const getPriority = (x) => {
                const hasDraft = draftReports.some(d => {
                    const dReqId = d.budgetRequestId || d.requestId;
                    if (dReqId) {
                        return dReqId === x.reqId && (x.componentId ? d.componentId === x.componentId : true);
                    }
                    return x.componentId ? d.componentId === x.componentId : d.budgetRequestId === x.reqId;
                });
                const hasPending = (budgetReports || []).some(r => {
                    if (r.status !== 'PENDING' || r.isDeleted) return false;
                    const rReqId = r.budgetRequestId || r.requestId;
                    if (rReqId) {
                        return rReqId === x.reqId && (x.componentId ? r.componentId === x.componentId : true);
                    }
                    return x.componentId ? r.componentId === x.componentId : r.budgetRequestId === x.reqId;
                });
                const isCompleted = x.sisa <= 0;

                if (isCompleted) return 3;
                if (hasPending) return 2;
                if (hasDraft) return 1;
                return 0;
            };

            return getPriority(a) - getPriority(b);
        });

        return items;
    }, [requestsForYear, reportedAmounts, budgetRequests, budgetReports, globalAcademicYearId, sourceMode, draftReports]);

    // Map of unit/field id → count of pending items (for superadmin badges)
    const pendingCountByUnit = useMemo(() => {
        const map = {};
        const allItems = [];
        (budgetRequests || []).filter(req => {
            const isYear = req.academicYearId === globalAcademicYearId;
            if (!isYear || req.status !== 'APPROVED') return false;
            const isBosRequest = req.source === 'BOS' || (req.items || []).some(item => item.planId?.endsWith('-BOS'));
            if (sourceMode === 'BOS' && !isBosRequest) return false;
            if (sourceMode === 'YAYASAN' && isBosRequest) return false;
            return true;
        }).forEach(req => {
            const reqUnitId = req.unitId;
            const reqFieldId = req.fieldId;

            // Check active balance
            const unitRequests = (budgetRequests || []).filter(r => 
                r.academicYearId === globalAcademicYearId && 
                r.status === 'APPROVED' &&
                (reqUnitId ? r.unitId === reqUnitId : r.fieldId === reqFieldId) &&
                (sourceMode === 'BOS' 
                    ? (r.source === 'BOS' || (r.items || []).some(item => item.planId?.endsWith('-BOS'))) 
                    : (r.source !== 'BOS' && !(r.items || []).some(item => item.planId?.endsWith('-BOS'))))
            );
            const unitCair = unitRequests.reduce((sum, r) => sum + (parseFloat(r.totalAmount) || 0), 0);

            const unitReports = (budgetReports || []).filter(r => 
                r.academicYearId === globalAcademicYearId && 
                r.status === 'APPROVED' &&
                !r.isDeleted &&
                (reqUnitId ? r.unitId === reqUnitId : r.fieldId === reqFieldId) &&
                (sourceMode === 'BOS' ? r.planId?.endsWith('-BOS') : !r.planId?.endsWith('-BOS'))
            );
            const unitUsed = unitReports.filter(r => r.kategoriAset !== 'PENGEMBALIAN').reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
            const unitReturned = unitReports.filter(r => r.kategoriAset === 'PENGEMBALIAN').reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

            const activeBalance = unitCair - unitUsed - unitReturned;

            if (activeBalance <= 0) return;

            const unitKey = reqUnitId || reqFieldId || 'UNKNOWN';
            if (req.items && req.items.length > 0) {
                req.items.forEach(item => {
                    if (item.isClosed) return; // Skip closed
                    const reportedComp = reportedAmounts.byComponent[item.componentId] || 0;
                    if (reportedComp < parseFloat(item.amount || 0)) {
                        map[unitKey] = (map[unitKey] || 0) + 1;
                    }
                });
            } else {
                const reportedReq = reportedAmounts.byRequest[req.id] || 0;
                if (reportedReq < parseFloat(req.totalAmount || 0)) {
                    map[unitKey] = (map[unitKey] || 0) + 1;
                }
            }
        });
        return map;
    }, [budgetRequests, budgetReports, reportedAmounts, globalAcademicYearId, sourceMode]);

    // Filtered pending items for superadmin based on selected unit + search term + statusFilter
    const filteredPendingItems = useMemo(() => {
        let items = pendingItems;
        if (pendingMonthFilter !== 'ALL') {
            items = items.filter(item => item.reqMonth === pendingMonthFilter);
        }
        if (isSuperAdmin && selectedUnitFilter !== 'ALL') {
            items = items.filter(item => item.reqUnitId === selectedUnitFilter || item.fieldId === selectedUnitFilter);
        }
        if (pendingSearch.trim()) {
            const q = pendingSearch.toLowerCase();
            items = items.filter(item => {
                const unitName = (units.find(u => u.id === item.reqUnitId)?.name || fields.find(f => f.id === item.reqUnitId)?.name || '').toLowerCase();
                const name = (item.name || '').toLowerCase();
                const desc = (item.reqDescription || '').toLowerCase();
                const reqId = (item.reqId || '').toLowerCase();
                return name.includes(q) || desc.includes(q) || reqId.includes(q) || unitName.includes(q);
            });
        }
        if (statusFilter === 'FILLED') {
            items = items.filter(item => {
                const hasDraft = draftReports.some(d => {
                    const dReqId = d.budgetRequestId || d.requestId;
                    if (dReqId) return dReqId === item.reqId && (item.componentId ? d.componentId === item.componentId : true);
                    return item.componentId ? d.componentId === item.componentId : d.budgetRequestId === item.reqId;
                });
                const hasPending = (budgetReports || []).some(r => {
                    if (r.status !== 'PENDING' || r.isDeleted) return false;
                    const rReqId = r.budgetRequestId || r.requestId;
                    if (rReqId) return rReqId === item.reqId && (item.componentId ? r.componentId === item.componentId : true);
                    return item.componentId ? r.componentId === item.componentId : r.budgetRequestId === item.reqId;
                });
                const isPartiallyOrFullyReported = item.sisa < item.amount;
                return isPartiallyOrFullyReported || hasDraft || hasPending;
            });
        } else if (statusFilter === 'NOT_FILLED') {
            items = items.filter(item => {
                const hasDraft = draftReports.some(d => {
                    const dReqId = d.budgetRequestId || d.requestId;
                    if (dReqId) return dReqId === item.reqId && (item.componentId ? d.componentId === item.componentId : true);
                    return item.componentId ? d.componentId === item.componentId : d.budgetRequestId === item.reqId;
                });
                const hasPending = (budgetReports || []).some(r => {
                    if (r.status !== 'PENDING' || r.isDeleted) return false;
                    const rReqId = r.budgetRequestId || r.requestId;
                    if (rReqId) return rReqId === item.reqId && (item.componentId ? r.componentId === item.componentId : true);
                    return item.componentId ? r.componentId === item.componentId : r.budgetRequestId === item.reqId;
                });
                const isPartiallyOrFullyReported = item.sisa < item.amount;
                return !isPartiallyOrFullyReported && !hasDraft && !hasPending;
            });
        }
        return items;
    }, [pendingItems, isSuperAdmin, selectedUnitFilter, pendingSearch, pendingMonthFilter, statusFilter, units, fields, draftReports, budgetReports]);

    // Handle Download Template Import Excel for a single item card
    const handleDownloadItemTemplate = (item) => {
        try {
            const wsData = [
                ["TEMPLATE IMPORT REALISASI NOTA BELANJA (EXCEL)"],
                ["Nama Item Rincian:", item.name || "-"],
                ["Kode Pengajuan (REQ ID):", item.reqId || "-"],
                ["Bulan Permintaan:", item.reqMonth || "-"],
                ["Pagu RAB (Rp):", parseFloat(item.amount || 0)],
                ["Sisa Dana Saat Ini (Rp):", item.sisa || 0],
                [],
                ["PETUNJUK: Isi baris transaksi nota di bawah ini, lalu simpan & Import file ini kembali ke sistem."],
                ["No", "Tanggal Realisasi (YYYY-MM-DD)", "Deskripsi / Keterangan Nota", "Nama Toko / Vendor", "Volume", "Satuan", "Nominal Belanja (Rp)", "Nomor Nota"],
                [
                    1,
                    new Date().toISOString().split('T')[0],
                    `Pembelian ${item.name}`,
                    "Toko A",
                    1,
                    "Pcs",
                    parseFloat(item.sisa > 0 ? item.sisa : item.amount || 0),
                    "NOTA-001"
                ]
            ];

            const ws = XLSX.utils.aoa_to_sheet(wsData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Template Realisasi");

            const cleanName = (item.name || 'Rincian').replace(/[/\\?%*:|"<>]/g, '_');
            XLSX.writeFile(wb, `Template_Import_${cleanName}_${item.reqId.slice(0, 8)}.xlsx`);
        } catch (err) {
            console.error('Template Download Error:', err);
            alert('Gagal mengunduh template Excel: ' + err.message);
        }
    };

    // Handle Export Excel for a single item card
    const handleExportSingleItemExcel = (item) => {
        try {
            const itemReports = (budgetReports || []).filter(r => 
                !r.isDeleted && 
                (item.componentId ? r.componentId === item.componentId : r.budgetRequestId === item.reqId)
            );

            const wsData = [
                ["RINCIAN PELAPORAN REALISASI ANGGARAN (EXCEL)"],
                ["Nama Item Rincian:", item.name || "-"],
                ["Kode Pengajuan (REQ ID):", item.reqId || "-"],
                ["Bulan Permintaan:", item.reqMonth || "-"],
                ["Pagu RAB (Rp):", parseFloat(item.amount || 0)],
                ["Sisa Dana Saat Ini (Rp):", item.sisa || 0],
                [],
                ["PETUNJUK: Tambahkan atau ubah baris transaksi di bawah ini untuk di-Import ke sistem."],
                ["No", "Tanggal Realisasi (YYYY-MM-DD)", "Deskripsi / Keterangan Nota", "Nama Toko / Vendor", "Volume", "Satuan", "Nominal Belanja (Rp)", "Nomor Nota"]
            ];

            if (itemReports.length > 0) {
                itemReports.forEach((r, idx) => {
                    wsData.push([
                        idx + 1,
                        r.date || new Date().toISOString().split('T')[0],
                        r.description || item.name || '',
                        r.vendor || '-',
                        r.volume || 1,
                        r.satuan || 'Pcs',
                        parseFloat(r.amount || 0),
                        r.nomorNota || '-'
                    ]);
                });
            } else {
                wsData.push([
                    1,
                    new Date().toISOString().split('T')[0],
                    `Pembelian ${item.name}`,
                    "Toko A",
                    1,
                    "Pcs",
                    parseFloat(item.sisa > 0 ? item.sisa : item.amount || 0),
                    "NOTA-001"
                ]);
            }

            const ws = XLSX.utils.aoa_to_sheet(wsData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Realisasi Item");

            const cleanName = (item.name || 'Rincian').replace(/[/\\?%*:|"<>]/g, '_');
            XLSX.writeFile(wb, `Laporan_${cleanName}_${item.reqId.slice(0, 8)}.xlsx`);
        } catch (err) {
            console.error('Export Error:', err);
            alert('Gagal mengekspor file Excel: ' + err.message);
        }
    };

    // Handle Import Excel for a single item card
    const handleImportSingleItemExcel = (e, item) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const sheetName = wb.SheetNames[0];
                const ws = wb.Sheets[sheetName];
                
                const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
                if (!rows || rows.length < 9) {
                    alert('Format file Excel tidak sesuai. Gunakan file Excel yang di-Export dari rincian ini.');
                    e.target.value = '';
                    return;
                }

                const transactionRows = rows.slice(8);
                let importedCount = 0;

                transactionRows.forEach((row) => {
                    if (!row || row.length < 4) return;

                    const dateVal = row[1] ? String(row[1]).trim() : new Date().toISOString().split('T')[0];
                    const descVal = row[2] ? String(row[2]).trim() : '';
                    const vendorVal = row[3] ? String(row[3]).trim() : '';
                    const volVal = row[4] ? parseFloat(row[4]) : 1;
                    const satuanVal = row[5] ? String(row[5]).trim() : 'Pcs';
                    const amountVal = row[6] ? parseFloat(row[6]) : 0;
                    const notaVal = row[7] ? String(row[7]).trim() : '';

                    if (!descVal || amountVal <= 0) return;

                    const newReport = {
                        id: `REL-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                        budgetRequestId: item.reqId,
                        componentId: item.componentId || null,
                        expenseItemId: item.expenseItemId || null,
                        category: item.name,
                        date: dateVal,
                        description: descVal,
                        vendor: vendorVal,
                        volume: volVal,
                        satuan: satuanVal,
                        amount: amountVal,
                        nomorNota: notaVal,
                        status: 'DRAFT',
                        createdAt: new Date().toISOString(),
                        unitId: item.reqUnitId
                    };

                    dispatch({ type: 'ADD_BUDGET_REPORT', payload: newReport });
                    api.pushAction({ type: 'ADD_BUDGET_REPORT', payload: newReport }, state);
                    importedCount++;
                });

                if (importedCount > 0) {
                    alert(`Berhasil mengimpor ${importedCount} nota realisasi untuk "${item.name}"! Data telah tersimpan sebagai Draft Nota.`);
                } else {
                    alert('Tidak ada data nota valid yang ditemukan pada file Excel.');
                }
            } catch (err) {
                console.error('Import Error:', err);
                alert('Gagal mengunggah file Excel: ' + err.message);
            } finally {
                e.target.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    const verificationReports = useMemo(() => {
        return (budgetReports || []).filter(rel => {
            if (rel.status !== 'PENDING') return false;
            if (rel.academicYearId !== globalAcademicYearId) return false;
            const isBosReport = rel.source === 'BOS' || rel.planId?.endsWith('-BOS');
            if (sourceMode === 'BOS' && !isBosReport) return false;
            if (sourceMode === 'YAYASAN' && isBosReport) return false;
            if (isSuperAdmin && selectedUnitFilter !== 'ALL') {
                if (rel.unitId !== selectedUnitFilter && rel.fieldId !== selectedUnitFilter) return false;
            }
            return true;
        });
    }, [budgetReports, globalAcademicYearId, sourceMode, isSuperAdmin, selectedUnitFilter]);

    const pendingVerificationUnits = useMemo(() => {
        const set = new Set();
        (budgetReports || []).forEach(rel => {
            if (rel.status !== 'PENDING') return;
            if (rel.academicYearId !== globalAcademicYearId) return;
            const isBosReport = rel.source === 'BOS' || rel.planId?.endsWith('-BOS');
            if (sourceMode === 'BOS' && !isBosReport) return;
            if (sourceMode === 'YAYASAN' && isBosReport) return;
            if (rel.unitId) set.add(rel.unitId);
            if (rel.fieldId) set.add(rel.fieldId);
        });
        return set;
    }, [budgetReports, globalAcademicYearId, sourceMode]);

    const [selectedReportIds, setSelectedReportIds] = useState([]);
    const [selectedHistoryCancelIds, setSelectedHistoryCancelIds] = useState([]);

    React.useEffect(() => {
        setSelectedReportIds([]);
        setSelectedHistoryIds([]);
        setSelectedHistoryCancelIds([]);
    }, [sourceMode, activeTab]);

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedReportIds(verificationReports.map(r => r.id));
        } else {
            setSelectedReportIds([]);
        }
    };

    const handleSelectRow = (id) => {
        setSelectedReportIds(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleBulkApprove = async () => {
        if (selectedReportIds.length === 0) {
            return alert('Pilih/centang minimal satu laporan yang ingin disetujui terlebih dahulu!');
        }
        if (window.confirm(`Setujui ${selectedReportIds.length} laporan terpilih sekaligus?`)) {
            setProcessingId('BULK');
            try {
                const updatedReportsMap = new Map();
                for (const id of selectedReportIds) {
                    const r = budgetReports.find(x => x.id === id);
                    if (r) {
                        const updated = { ...r, status: 'APPROVED', notified: false };
                        updatedReportsMap.set(id, updated);
                        dispatch({ type: 'EDIT_BUDGET_REPORT', payload: updated });
                        await api.pushAction({ type: 'EDIT_BUDGET_REPORT', payload: updated }, state);
                    }
                }

                const newBudgetReports = (budgetReports || []).map(r => updatedReportsMap.get(r.id) || r);
                await api.syncWholeState({ ...state, budgetReports: newBudgetReports });

                alert(`${selectedReportIds.length} laporan berhasil disetujui!`);
                setSelectedReportIds([]);
            } catch (err) {
                alert('Gagal memproses persetujuan masal: ' + err.message);
            } finally {
                setProcessingId(null);
            }
        }
    };

    const handleBulkReject = async () => {
        if (selectedReportIds.length === 0) {
            return alert('Pilih/centang minimal satu laporan yang ingin ditolak terlebih dahulu!');
        }
        if (window.confirm(`Tolak ${selectedReportIds.length} laporan terpilih sekaligus?`)) {
            setProcessingId('BULK');
            try {
                const updatedReportsMap = new Map();
                for (const id of selectedReportIds) {
                    const r = budgetReports.find(x => x.id === id);
                    if (r) {
                        const updated = { ...r, status: 'REJECTED', notified: false };
                        updatedReportsMap.set(id, updated);
                        dispatch({ type: 'EDIT_BUDGET_REPORT', payload: updated });
                        await api.pushAction({ type: 'EDIT_BUDGET_REPORT', payload: updated }, state);
                    }
                }

                const newBudgetReports = (budgetReports || []).map(r => updatedReportsMap.get(r.id) || r);
                await api.syncWholeState({ ...state, budgetReports: newBudgetReports });

                alert(`${selectedReportIds.length} laporan berhasil ditolak!`);
                setSelectedReportIds([]);
            } catch (err) {
                alert('Gagal memproses penolakan masal: ' + err.message);
            } finally {
                setProcessingId(null);
            }
        }
    };

    const handleSelectAllHistory = (e) => {
        if (e.target.checked) {
            setSelectedHistoryIds(filteredReports.filter(r => r.status === 'DRAFT').map(r => r.id));
        } else {
            setSelectedHistoryIds([]);
        }
    };

    const handleToggleSelectHistory = (id) => {
        setSelectedHistoryIds(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleBulkSubmitHistory = async () => {
        if (selectedHistoryIds.length === 0) {
            return alert('Pilih/centang minimal satu laporan yang ingin diajukan terlebih dahulu!');
        }
        if (window.confirm(`Anda akan mengajukan ${selectedHistoryIds.length} laporan terpilih ke Superadmin. Lanjutkan?`)) {
            setProcessingId('BULK_HISTORY');
            try {
                const updatedReportsMap = new Map();
                for (const id of selectedHistoryIds) {
                    const r = budgetReports.find(x => x.id === id);
                    if (r) {
                        const updated = { ...r, status: 'PENDING' };
                        updatedReportsMap.set(id, updated);
                        dispatch({ type: 'EDIT_BUDGET_REPORT', payload: updated });
                        await api.pushAction({ type: 'EDIT_BUDGET_REPORT', payload: updated }, state);
                    }
                }

                const newBudgetReports = (budgetReports || []).map(r => updatedReportsMap.get(r.id) || r);
                await api.syncWholeState({ ...state, budgetReports: newBudgetReports });

                alert(`${selectedHistoryIds.length} laporan berhasil diajukan!`);
                setSelectedHistoryIds([]);
            } catch (err) {
                alert('Gagal mengajukan laporan: ' + err.message);
            } finally {
                setProcessingId(null);
            }
        }
    };

    // --- Bulk Cancel Approval (Superadmin only) ---
    const handleBulkCancelApproval = async () => {
        if (selectedHistoryCancelIds.length === 0) {
            return alert('Pilih/centang minimal satu laporan yang terverifikasi untuk dibatalkan!');
        }
        const confirmMsg = `Batalkan verifikasi ${selectedHistoryCancelIds.length} laporan terpilih?\n\nJurnal akuntansi terkait akan DIHAPUS dan status laporan kembali ke PENDING.`;
        if (!window.confirm(confirmMsg)) return;

        setProcessingId('BULK_CANCEL');
        try {
            const result = await api.bulkCancelApproval(selectedHistoryCancelIds);

            // Update local state for all successfully cancelled reports
            const successIds = new Set(result.success || []);
            successIds.forEach(id => {
                const r = budgetReports.find(x => x.id === id);
                if (r) {
                    const updated = { ...r, status: 'PENDING', journalId: null, notified: false };
                    dispatch({ type: 'EDIT_BUDGET_REPORT', payload: updated });
                }
            });

            const failCount = (result.failed || []).length;
            alert(
                `${successIds.size} laporan berhasil dibatalkan verifikasinya.` +
                (failCount > 0 ? `\n${failCount} laporan gagal diproses (mungkin bukan status APPROVED).` : '')
            );
            setSelectedHistoryCancelIds([]);
        } catch (err) {
            alert('Gagal membatalkan verifikasi massal: ' + err.message);
        } finally {
            setProcessingId(null);
        }
    };


    const baseReports = useMemo(() => {
        return (budgetReports || []).filter(rel => {
            const isYear = rel.academicYearId === globalAcademicYearId;
            if (!isYear) return false;

            // Filter by source
            const isBosReport = rel.source === 'BOS' || rel.planId?.endsWith('-BOS');
            if (sourceMode === 'BOS' && !isBosReport) return false;
            if (sourceMode === 'YAYASAN' && isBosReport) return false;

            if (isSuperAdmin) {
                if (selectedUnitFilter !== 'ALL') {
                    return rel.unitId === selectedUnitFilter || rel.fieldId === selectedUnitFilter;
                }
                return true;
            }
            if (myUnitId) return rel.unitId === myUnitId;
            if (myFieldId) return rel.fieldId === myFieldId;
            return false;
        });
    }, [budgetReports, budgetRequests, isSuperAdmin, myUnitId, myFieldId, globalAcademicYearId, sourceMode, selectedUnitFilter]);

    // Apply filters to history
    const filteredReports = useMemo(() => {
        return baseReports.filter(r => {
            const q = search.toLowerCase();
            const matchSearch = !q || (r.nomorNota || '').toLowerCase().includes(q) ||
                (r.description || '').toLowerCase().includes(q) ||
                (r.category || '').toLowerCase().includes(q) ||
                (r.buktiTeks || '').toLowerCase().includes(q);
            const matchKategori = filterKategori === 'ALL' || r.kategoriAset === filterKategori;
            const matchRequestMonth = filterRequestMonth === 'ALL' || (() => {
                const req = budgetRequests.find(q => q.id === (r.budgetRequestId || r.requestId));
                return req?.month === filterRequestMonth;
            })();
            const rDate = r.date ? new Date(r.date) : null;
            const matchFrom = !filterDateFrom || (rDate && rDate >= new Date(filterDateFrom));
            const matchTo = !filterDateTo || (rDate && rDate <= new Date(filterDateTo));
            return matchSearch && matchKategori && matchRequestMonth && matchFrom && matchTo;
        });
    }, [baseReports, search, filterKategori, filterRequestMonth, filterDateFrom, filterDateTo, budgetRequests]);

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
        diskon: '',
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
            diskon: '',
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
                const isRejected = draft.status === 'REJECTED';
                const reqCompKey = `${req.id}_${draft.componentId}`;
                const reportedCompVal = reportedAmounts.byRequestComponent?.[reqCompKey] || 0;
                const reportedComp = reportedCompVal - (isRejected ? 0 : parseFloat(draft.amount || 0));
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
            diskon: draft.diskon || '',
            kategoriAset: draft.kategoriAset || 'NON_ASET',
            umurEkonomis: draft.umurEkonomis || ''
        });
        setShowReportForm(true);
    };

    const handleCloseItem = async (item) => {
        const confirmMsg = `Apakah Anda yakin ingin menutup/menihilkan sisa item "${item.name}"? Sisa dana sebesar ${formatRupiah(item.sisa)} akan dianggap tidak terpakai dan harus dikembalikan ke Yayasan.`;
        if (window.confirm(confirmMsg)) {
            try {
                const req = budgetRequests.find(r => r.id === item.reqId);
                if (!req) return alert("Data induk pengajuan tidak ditemukan!");

                const updatedItems = req.items.map(reqItem => {
                    if (reqItem.componentId === item.componentId) {
                        return { ...reqItem, isClosed: true };
                    }
                    return reqItem;
                });

                const updatedRequest = {
                    ...req,
                    items: updatedItems
                };

                dispatch({ type: 'EDIT_BUDGET_REQUEST', payload: updatedRequest });
                await api.pushAction({ type: 'EDIT_BUDGET_REQUEST', payload: updatedRequest }, state);
                
                alert("Item berhasil ditutup. Sisa dana telah dibekukan dan wajib dikembalikan ke Yayasan.");
            } catch (err) {
                alert("Gagal menutup item: " + err.message);
            }
        }
    };

    const handleReportSubmit = (e) => {
        e.preventDefault();
        if (formData.kategoriAset === 'ASET' && !formData.umurEkonomis) {
            return alert('Pilih umur ekonomis untuk kategori Aset.');
        }

        const editingReport = editingDraftId ? budgetReports.find(r => r.id === editingDraftId) : null;
        const currentDraftAmount = (editingReport && editingReport.status !== 'REJECTED') 
            ? parseFloat(editingReport.amount || 0) 
            : 0;
        
        // Cek sisa dana keseluruhan dari Pengajuan Dana (Budget Request) induknya
        const parentReq = budgetRequests.find(r => r.id === selectedRequest.reqId);
        if (!parentReq) {
            return alert('Data induk pengajuan tidak ditemukan.');
        }

        const totalApproved = parseFloat(parentReq.totalAmount || parentReq.amount || 0);
        const totalReportedForReq = (budgetReports || [])
            .filter(r => r.budgetRequestId === selectedRequest.reqId && r.status !== 'REJECTED' && !r.isDeleted)
            .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

        const sisaDanaPengajuan = totalApproved - totalReportedForReq + currentDraftAmount;
        
        if (parseFloat(formData.amount) > sisaDanaPengajuan) {
            return alert(`Jumlah realisasi tidak boleh melebihi sisa total pengajuan dana (${formatRupiah(sisaDanaPengajuan)}).`);
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
            diskon: formData.diskon,
            kategoriAset: formData.kategoriAset,
            umurEkonomis: formData.kategoriAset === 'ASET' ? formData.umurEkonomis : null,
            status: 'DRAFT',
            expenseItemId: selectedRequest.expenseItemId
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
        if (window.confirm('Setujui laporan ini? Draf Jurnal (Menunggu COA) akan otomatis dibuat.')) {
            setProcessingId(report.id);
            try {
                const updated = { ...report, status: 'APPROVED', notified: false };
                dispatch({ type: 'EDIT_BUDGET_REPORT', payload: updated });
                const newBudgetReports = (budgetReports || []).map(r => r.id === report.id ? updated : r);
                await api.syncWholeState({ ...state, budgetReports: newBudgetReports });
                alert('Laporan berhasil disetujui!');
            } catch (error) {
                console.error(error);
                alert('Gagal menyetujui laporan: ' + error.message);
            } finally {
                setProcessingId(null);
            }
        }
    };

    const handleRejectReport = async (report) => {
        if (window.confirm('Tolak laporan ini? Saldo unit akan dikembalikan.')) {
            setProcessingId(report.id);
            try {
                const updated = { ...report, status: 'REJECTED', notified: false };
                dispatch({ type: 'EDIT_BUDGET_REPORT', payload: updated });
                const newBudgetReports = (budgetReports || []).map(r => r.id === report.id ? updated : r);
                await api.syncWholeState({ ...state, budgetReports: newBudgetReports });
                alert('Laporan berhasil ditolak');
            } catch (error) {
                console.error(error);
                alert('Gagal menolak laporan: ' + error.message);
            } finally {
                setProcessingId(null);
            }
        }
    };

    const handleCancelReportApproval = async (report) => {
        if (window.confirm('Batalkan persetujuan laporan ini? Jurnal akuntansi terkait akan otomatis dihapus dan status laporan kembali ke PENDING.')) {
            setProcessingId(report.id);
            try {
                const updated = { ...report, status: 'PENDING', journalId: null };
                dispatch({ type: 'EDIT_BUDGET_REPORT', payload: updated });
                await api.pushAction({ type: 'EDIT_BUDGET_REPORT', payload: updated }, state);
                alert('Persetujuan laporan berhasil dibatalkan. Status kembali ke PENDING.');
            } catch (error) {
                console.error(error);
                alert('Gagal membatalkan persetujuan laporan: ' + error.message);
            } finally {
                setProcessingId(null);
            }
        }
    };

    const handleExportExcel = () => {
        if (filteredReports.length === 0) return alert("Tidak ada data untuk diekspor");

        const wsData = [
            [
                "No",
                "Tanggal Pelaporan",
                "Bulan Permintaan",
                "Nomor Urut Nota",
                "Rincian",
                "Unit/Bidang",
                "Volume",
                "Satuan",
                "Harga Satuan (Rp)",
                "Potongan / Diskon (Rp)",
                "Jumlah Realisasi (Rp)",
                "Keterangan Detail",
                "Bukti Transaksi (Teks)",
                "Mata Anggaran",
                "Kategori Penggunaan",
                "Umur Ekonomis (Tahun)",
                "Status"
            ]
        ];

        filteredReports.forEach((report, i) => {
            const unitName = report.unitId 
                ? (units.find(u => u.id === report.unitId)?.name || '-') 
                : (fields.find(f => f.id === report.fieldId)?.name || '-');
            
            const dateStr = report.date 
                ? new Date(report.date).toLocaleDateString('id-ID') 
                : '-';

            const req = budgetRequests?.find(r => r.id === (report.budgetRequestId || report.requestId));
            const reqMonthLabel = req?.month ? formatMonthLabel(req.month) : '-';

            let exId = report.expenseItemId;
            if (!exId && report.planId && report.componentId) {
                const plan = rabPlans?.find(p => p.id === report.planId);
                if (plan && plan.expense) {
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
            }
            if (!exId && report.budgetRequestId) {
                const reqFound = budgetRequests?.find(r => r.id === report.budgetRequestId);
                if (reqFound) {
                    if (report.componentId && reqFound.items) {
                        const reqItem = reqFound.items.find(i => i.componentId === report.componentId);
                        if (reqItem && reqItem.expenseItemId) exId = reqItem.expenseItemId;
                    }
                    if (!exId && reqFound.expenseItemId) exId = reqFound.expenseItemId;
                }
            }
            const expenseItemName = expenseItems?.find(e => e.id === exId)?.name || '-';

            wsData.push([
                i + 1,
                dateStr,
                reqMonthLabel,
                report.nomorNota || '-',
                report.category || '-',
                unitName,
                report.volume ? parseFloat(report.volume) : '-',
                report.satuan || '-',
                report.harga ? parseFloat(report.harga) : 0,
                parseFloat(report.diskon || 0),
                parseFloat(report.amount || 0),
                report.description || '-',
                report.buktiTeks || '-',
                expenseItemName,
                report.kategoriAset || 'NON_ASET',
                report.umurEkonomis ? `${report.umurEkonomis} Tahun` : '-',
                report.status || '-'
            ]);
        });

        // Add a row for total
        const totalDiskon = filteredReports.reduce((s, r) => s + parseFloat(r.diskon || 0), 0);
        const totalAmount = filteredReports.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
        const totalRow = Array(17).fill("");
        totalRow[0] = "TOTAL";
        totalRow[9] = totalDiskon;   // index 9 is Potongan / Diskon (Rp)
        totalRow[10] = totalAmount;  // index 10 is Jumlah Realisasi (Rp)
        wsData.push(totalRow);

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        
        ws['!cols'] = [
            { wch: 5 },  // No
            { wch: 18 }, // Tanggal Pelaporan
            { wch: 18 }, // Bulan Permintaan
            { wch: 18 }, // Nomor Urut Nota
            { wch: 25 }, // Rincian
            { wch: 20 }, // Unit/Bidang
            { wch: 10 }, // Volume
            { wch: 10 }, // Satuan
            { wch: 18 }, // Harga Satuan (Rp)
            { wch: 22 }, // Potongan / Diskon (Rp)
            { wch: 22 }, // Jumlah Realisasi (Rp)
            { wch: 30 }, // Keterangan Detail
            { wch: 30 }, // Bukti Transaksi (Teks)
            { wch: 25 }, // Mata Anggaran
            { wch: 20 }, // Kategori Penggunaan
            { wch: 22 }, // Umur Ekonomis (Tahun)
            { wch: 15 }  // Status
        ];

        const wb = XLSX.utils.book_new();
        const sheetName = sourceMode === 'BOS' ? "Laporan BOS" : "Laporan Yayasan";
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        
        const timestamp = new Date().toISOString().slice(0, 10);
        const filename = sourceMode === 'BOS' 
            ? `Laporan_Pengeluaran_BOS_${timestamp}.xlsx`
            : `Laporan_Pengeluaran_Yayasan_${timestamp}.xlsx`;
            
        XLSX.writeFile(wb, filename);
    };

    return (
        <div className="p-8 animate-in text-slate-900 bg-slate-50 min-h-screen">
            <div className="print:hidden space-y-8">
                {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3 tracking-tight mb-1 font-display">
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                            <Building2 size={20} className="text-white" />
                        </div>
                        Laporan Pengeluaran {sourceMode === 'BOS' ? 'BOS' : 'Yayasan'}
                    </h1>
                    <p className="text-slate-500 font-medium italic mb-6 ml-[52px]">Laporkan realisasi penggunaan dana yang telah dicairkan.</p>
                    
                    {sourceMode === 'BOS' && (
                        <div className="mb-6">
                            <button 
                                onClick={() => window.location.href = '/pelaporan/realisasi-bos'}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-all shadow-sm"
                            >
                                ← Kembali ke Pengeluaran BOS
                            </button>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl">
                    <button
                        onClick={() => setActiveTab('pending')}
                        className={`px-6 py-2 rounded-xl font-black text-xs transition-all ${activeTab === 'pending' ? 'bg-white text-blue-600 shadow-sm shadow-blue-500/5' : 'text-slate-500'}`}
                    >
                        Perlu Dilaporkan
                        {filteredPendingItems.length > 0 && (
                            <span className="ml-2 bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{filteredPendingItems.length}</span>
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
                <div className="space-y-6">
                    {/* Search & Filter Pending Items */}
                    <div className="flex flex-col sm:flex-row gap-4 items-center">
                        <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-sm transition-all focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Search size={14} className="text-slate-400" />
                            </div>
                            <input
                                type="text"
                                value={pendingSearch}
                                onChange={(e) => setPendingSearch(e.target.value)}
                                placeholder="Cari rincian pengeluaran (nama, deskripsi, REQ)..."
                                className="w-full pl-10 pr-10 py-2.5 bg-transparent border-none outline-none text-xs font-bold text-slate-700 placeholder:text-slate-400"
                            />
                            {pendingSearch && (
                                <button
                                    onClick={() => setPendingSearch('')}
                                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        {/* Dropdown status pelaporan */}
                        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-2.5 shadow-sm">
                            <Filter size={14} className="text-slate-400" />
                            <select 
                                className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <option value="ALL">Semua Pelaporan</option>
                                <option value="NOT_FILLED">Belum Isi</option>
                                <option value="FILLED">Sudah Isi</option>
                            </select>
                        </div>

                        {/* Dropdown Bulan Permintaan */}
                        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-2.5 shadow-sm">
                            <Calendar size={14} className="text-slate-400" />
                            <select 
                                className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                                value={pendingMonthFilter}
                                onChange={(e) => setPendingMonthFilter(e.target.value)}
                            >
                                <option value="ALL">Semua Bulan Permintaan</option>
                                {monthOptions.map(m => (
                                    <option key={m.id} value={m.id}>{m.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Dropdown unit & bidang (Super Admin Only) */}
                        {isSuperAdmin && (
                            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-2.5 shadow-sm">
                                <Building2 size={14} className="text-slate-400" />
                                <select 
                                    className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer max-w-[200px]"
                                    value={selectedUnitFilter}
                                    onChange={(e) => setSelectedUnitFilter(e.target.value)}
                                >
                                    <option value="ALL">Semua Unit & Bidang</option>
                                    <optgroup label="Bidang">
                                        {fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                    </optgroup>
                                    <optgroup label="Unit Pendidikan">
                                        {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                    </optgroup>
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* List of pending/draft reports */}
                    <div className="lg:col-span-2 space-y-6">



                        <div className="flex items-center gap-2 mb-2 px-2">
                            <AlertCircle size={16} className="text-blue-500" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rincian yang Menunggu Laporan</span>
                        </div>

                        {filteredPendingItems.length > 0 ? filteredPendingItems.map(item => {
                            const unitName = units.find(u => u.id === item.reqUnitId)?.name || fields.find(f => f.id === item.reqUnitId)?.name;
                            const sisaPct = item.amount > 0 ? Math.round((item.sisa / item.amount) * 100) : 0;
                            const terpakaiPct = item.amount > 0 ? Math.round(((item.amount - item.sisa) / item.amount) * 100) : 0;
                            return (
                            <div key={`${item.reqId}-${item.componentId || 'legacy'}`} className="card p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-blue-200 transition-all border-l-8 border-l-blue-600">
                                <div className="flex-1">
                                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                                        <h4 className="font-black text-slate-900 text-xl">{item.name}</h4>
                                        {item.sisa <= 0 && (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full text-[10px] font-black uppercase tracking-wider">
                                                <CheckCircle2 size={12} /> Selesai / Lunas
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3 text-slate-400 text-xs font-bold">
                                        <span className="flex items-center gap-1"><History size={14} /> {item.reqDate}</span>
                                        <span className="flex items-center gap-1 font-black text-blue-600 italic">REQ: {item.reqId.slice(0, 8)}</span>
                                        {isSuperAdmin && unitName && (
                                            <span className="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black">
                                                <Building2 size={10} /> {unitName}
                                            </span>
                                        )}
                                    </div>
                                    {/* Progress bar terpakai */}
                                    <div className="mt-4">
                                        <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                            <span>Terpakai {terpakaiPct}%</span>
                                            <span className={item.sisa < 0 ? 'text-rose-500 font-bold' : ''}>
                                                Sisa {sisaPct}%
                                            </span>
                                        </div>
                                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div className={`h-full ${terpakaiPct > 100 ? 'bg-rose-500' : 'bg-blue-500'} rounded-full transition-all`} style={{ width: `${Math.min(Math.max(terpakaiPct, 0), 100)}%` }} />
                                        </div>
                                    </div>
                                    
                                    {/* LOCAL DRAFTS SECTION */}
                                    {(() => {
                                        const localDrafts = draftReports.filter(d => item.componentId ? d.componentId === item.componentId : d.budgetRequestId === item.reqId);
                                        if (localDrafts.length === 0) return null;
                                        return (
                                            <div className="mt-6 p-4 bg-amber-50 rounded-2xl border border-amber-200">
                                                <div className="flex items-center justify-between mb-3 border-b border-amber-200/50 pb-2">
                                                    <h5 className="font-black text-amber-900 text-xs flex items-center gap-1.5 uppercase tracking-widest">
                                                        <Package size={14} /> Draft Nota
                                                    </h5>
                                                    <button onClick={() => {
                                                        if (window.confirm(`Ajukan ${localDrafts.length} draft laporan ini ke Superadmin?`)) {
                                                            localDrafts.forEach(draft => {
                                                                const updated = { ...draft, status: 'PENDING' };
                                                                dispatch({ type: 'EDIT_BUDGET_REPORT', payload: updated });
                                                                api.pushAction({ type: 'EDIT_BUDGET_REPORT', payload: updated }, state);
                                                            });
                                                        }
                                                    }} className="px-3 py-1 bg-amber-500 text-white font-black text-[9px] uppercase tracking-widest rounded-lg hover:bg-amber-600 transition-colors shadow-sm shadow-amber-500/20">
                                                        Ajukan Draft
                                                    </button>
                                                </div>
                                                <div className="space-y-2">
                                                    {localDrafts.map(draft => (
                                                        <div key={draft.id} className="flex items-center justify-between bg-white p-3 rounded-xl border border-amber-100 shadow-sm">
                                                            <div>
                                                                <p className="text-xs font-bold text-slate-800">{draft.description}</p>
                                                                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Nota: {draft.nomorNota || '-'} | Vol: {draft.volume} {draft.satuan}</p>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <span className="font-black text-amber-600 text-xs">{formatRupiah(parseFloat(draft.amount || 0))}</span>
                                                                <div className="flex items-center gap-1">
                                                                    <button onClick={() => handleEditDraft(draft)} className="text-indigo-500 hover:text-indigo-700 p-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors" title="Edit">
                                                                        <Edit2 size={12} strokeWidth={3} />
                                                                    </button>
                                                                    <button onClick={() => handleDeleteDraft(draft.id)} className="text-rose-500 hover:text-rose-700 p-1.5 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors" title="Hapus">
                                                                        <Trash2 size={12} strokeWidth={3} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>

                                <div className="text-right shrink-0">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Sisa Dana Rincian</p>
                                    <h4 className={`text-2xl font-black mb-1 ${item.sisa < 0 ? 'text-rose-600' : 'text-blue-700'}`}>{formatRupiah(item.sisa)}</h4>
                                    <p className="text-[10px] font-bold text-slate-400 mb-4">RAB: {formatRupiah(parseFloat(item.amount || 0))}</p>
                                    <div className="flex flex-col gap-2 mt-2 w-full">
                                        {!isSuperAdmin && (
                                            <button
                                                onClick={() => handleOpenReportForm(item)}
                                                className="btn btn-primary !rounded-xl !py-2 !text-xs !w-full"
                                            >
                                                <FileCheck size={16} />
                                                <span>Buat Laporan</span>
                                            </button>
                                        )}
                                        <button
                                            onClick={() => { setSelectedItemForReports(item); setShowReportsList(true); }}
                                            className="px-4 py-2 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center gap-2"
                                        >
                                            <History size={14} />
                                            <span>Lihat Laporan ({getReportsCountForItem(item)})</span>
                                        </button>
                                        
                                        {/* Excel Template, Export & Import per item card */}
                                        <div className="grid grid-cols-3 gap-1 mt-1">
                                            <button
                                                onClick={() => handleDownloadItemTemplate(item)}
                                                className="px-2 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl font-black text-[9px] uppercase tracking-wider hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-1 shadow-sm"
                                                title="Unduh template Excel kosong khusus rincian ini"
                                            >
                                                <FileSpreadsheet size={11} />
                                                <span>Template</span>
                                            </button>
                                            <button
                                                onClick={() => handleExportSingleItemExcel(item)}
                                                className="px-2 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl font-black text-[9px] uppercase tracking-wider hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center gap-1 shadow-sm"
                                                title="Unduh data realisasi eksisting rincian ini"
                                            >
                                                <Download size={11} />
                                                <span>Export</span>
                                            </button>
                                            <label
                                                className="px-2 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl font-black text-[9px] uppercase tracking-wider hover:bg-amber-600 hover:text-white transition-all flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                                                title="Upload Excel nota realisasi untuk rincian ini"
                                            >
                                                <Upload size={11} />
                                                <span>Import</span>
                                                <input
                                                    type="file"
                                                    accept=".xlsx, .xls"
                                                    className="hidden"
                                                    onChange={(e) => handleImportSingleItemExcel(e, item)}
                                                />
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}) : (
                            <div className="card p-20 text-center text-slate-400 italic font-medium">
                                {pendingSearch 
                                    ? 'Tidak ada rincian yang cocok dengan kata kunci pencarian.' 
                                    : (statusFilter !== 'ALL' 
                                        ? `Tidak ada rincian dengan status "${statusFilter === 'FILLED' ? 'Sudah Isi' : 'Belum Isi'}".`
                                        : (selectedUnitFilter !== 'ALL' ? 'Tidak ada rincian untuk unit ini.' : 'Tidak ada rincian dana yang menunggu laporan.'))}
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
                                    <span className="text-xs font-bold text-slate-400">Total Sudah Dilaporkan</span>
                                    <span className="text-sm font-black text-emerald-600">{formatRupiah(totalLapor)}</span>
                                </div>
                                <div className="flex justify-between items-center border-t border-slate-100 pt-4">
                                    <span className="text-xs font-bold text-slate-400">Total Belum Dilaporkan</span>
                                    <span className="text-sm font-black text-amber-500">{formatRupiah(totalSisa)}</span>
                                </div>
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
                        {isSuperAdmin && (
                            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
                                <Building2 size={14} className="text-slate-400" />
                                <select className="bg-transparent text-xs font-bold text-slate-700 outline-none max-w-[180px] cursor-pointer"
                                    value={selectedUnitFilter} onChange={e => setSelectedUnitFilter(e.target.value)}>
                                    <option value="ALL">Semua Unit & Bidang</option>
                                    <optgroup label="Bidang">
                                        {fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                    </optgroup>
                                    <optgroup label="Unit Pendidikan">
                                        {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                    </optgroup>
                                </select>
                            </div>
                        )}
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
                            <select className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                                value={filterRequestMonth} onChange={e => setFilterRequestMonth(e.target.value)}>
                                <option value="ALL">Semua Bulan Permintaan</option>
                                {monthOptions.map(m => (
                                    <option key={m.id} value={m.id}>{m.label}</option>
                                ))}
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
                        {(search || filterKategori !== 'ALL' || filterRequestMonth !== 'ALL' || filterDateFrom || filterDateTo || (isSuperAdmin && selectedUnitFilter !== 'ALL')) && (
                            <button onClick={() => { setSearch(''); setFilterKategori('ALL'); setFilterRequestMonth('ALL'); setFilterDateFrom(''); setFilterDateTo(''); setSelectedUnitFilter('ALL'); }}
                                className="text-[10px] font-black text-rose-500 hover:text-rose-700 uppercase tracking-widest">
                                Reset Filter
                            </button>
                        )}
                        <div className="flex gap-2 ml-auto">
                            <button
                                onClick={handleExportExcel}
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
                        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <History size={14} className="text-indigo-400" />
                                <span className="text-[10px] font-black text-white uppercase tracking-widest">Riwayat Laporan Realisasi</span>
                            </div>
                            <div className="flex items-center gap-4">
                                {!isSuperAdmin && selectedHistoryIds.length > 0 && (
                                    <button 
                                        onClick={handleBulkSubmitHistory} 
                                        disabled={processingId === 'BULK_HISTORY'}
                                        className="px-3 py-1.5 bg-indigo-500 text-white font-black text-[9px] uppercase tracking-widest rounded-lg hover:bg-indigo-600 transition-colors shadow-sm shadow-indigo-500/30">
                                        {processingId === 'BULK_HISTORY' ? 'Memproses...' : `Ajukan ${selectedHistoryIds.length} Terpilih`}
                                    </button>
                                )}
                                <span className="text-[9px] text-slate-400 font-bold">{filteredReports.length} data ditampilkan</span>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100">
                                        {!isSuperAdmin && (
                                            <th className="px-5 py-3 w-12 text-center">
                                                <input 
                                                    type="checkbox" 
                                                    className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer shadow-sm"
                                                    onChange={handleSelectAllHistory}
                                                    checked={filteredReports.filter(r => r.status === 'DRAFT').length > 0 && selectedHistoryIds.length === filteredReports.filter(r => r.status === 'DRAFT').length}
                                                />
                                            </th>
                                        )}
                                        <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center w-10">No</th>
                                        <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Tanggal Nota</th>
                                        <th className="px-5 py-3 text-[9px] font-black text-indigo-500 uppercase tracking-widest">Bulan Permintaan</th>
                                        <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">No. Nota</th>
                                        <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest min-w-[180px]">Rincian</th>
                                        <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest min-w-[200px]">Keterangan</th>
                                        <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Volume</th>
                                        <th className="px-5 py-3 text-[9px] font-black text-rose-500 uppercase tracking-widest text-right">Diskon</th>
                                        <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Jumlah</th>
                                        <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Mata Anggaran</th>
                                        <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Kategori</th>
                                        <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                        <th className="px-5 py-3 w-8"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredReports.length > 0
                                        ? filteredReports.map((report, idx) => (
                                            <ReportRow 
                                                key={report.id} 
                                                report={report} 
                                                units={units} 
                                                expenseItems={expenseItems} 
                                                rabPlans={rabPlans} 
                                                budgetRequests={budgetRequests} 
                                                isSuperAdmin={isSuperAdmin} 
                                                idx={idx} 
                                                selectable={!isSuperAdmin && report.status === 'DRAFT'}
                                                isSelected={selectedHistoryIds.includes(report.id)}
                                                onToggleSelect={handleToggleSelectHistory}
                                                onEdit={() => handleEditDraft(report)}
                                                onDelete={() => handleDeleteDraft(report.id)}
                                                onCancelApproval={() => handleCancelReportApproval(report)}
                                                isProcessing={processingId === report.id}
                                            />
                                        ))
                                        : (
                                            <tr>
                                                <td colSpan="12" className="px-8 py-20 text-center text-slate-400 italic font-medium border-t border-slate-50">
                                                    {baseReports.length === 0 ? 'Belum ada laporan yang dibuat.' : 'Tidak ada data yang cocok dengan filter.'}
                                                </td>
                                            </tr>
                                        )}
                                </tbody>
                                {filteredReports.length > 0 && (
                                    <tfoot>
                                        <tr className="bg-slate-900 text-white">
                                            <td colSpan={isSuperAdmin ? 8 : 9} className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Total</td>
                                            <td className="px-5 py-4 text-right font-black text-emerald-400 text-base">{formatRupiah(totalNilai)}</td>
                                            <td colSpan="4"></td>
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
                    <div className="card p-6 bg-indigo-50 border-indigo-100 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <AlertCircle size={24} className="text-indigo-600" />
                            <div>
                                <h3 className="font-black text-indigo-900 text-lg">Persetujuan Laporan Realisasi</h3>
                                <p className="text-xs text-indigo-600 font-medium">Laporan yang diajukan unit dan bidang akan mengunci saldo Sisa Dana Cair sementara. Anda perlu menyetujui laporan berikut agar statusnya menjadi final (VERIFIED).</p>
                            </div>
                        </div>
                        <select 
                            value={selectedUnitFilter} 
                            onChange={(e) => setSelectedUnitFilter(e.target.value)}
                            className="bg-white border-0 rounded-xl px-4 py-3 text-[10px] font-black text-slate-600 uppercase tracking-widest focus:ring-2 focus:ring-indigo-100 outline-none cursor-pointer shadow-sm shrink-0 w-full md:w-auto"
                        >
                            <option value="ALL">Semua Unit & Bidang</option>
                            <optgroup label="Bidang">
                                {fields.map(f => <option key={f.id} value={f.id} className={pendingVerificationUnits.has(f.id) ? 'text-rose-600' : ''}>{f.name} {pendingVerificationUnits.has(f.id) ? '🔴' : ''}</option>)}
                            </optgroup>
                            <optgroup label="Unit Pendidikan">
                                {units.map(u => <option key={u.id} value={u.id} className={pendingVerificationUnits.has(u.id) ? 'text-rose-600' : ''}>{u.name} {pendingVerificationUnits.has(u.id) ? '🔴' : ''}</option>)}
                            </optgroup>
                        </select>
                    </div>

                    <div className="card overflow-hidden rounded-2xl border-0 shadow-xl animate-in fade-in duration-300">
                        <div className="bg-slate-900 px-6 py-4 flex items-center gap-3 flex-wrap">
                            <CheckCircle2 size={14} className="text-emerald-400" />
                            <span className="text-[10px] font-black text-white uppercase tracking-widest">Daftar Menunggu Persetujuan</span>
                            <span className="text-[9px] text-slate-400 font-bold bg-slate-800 px-2 py-0.5 rounded-full">{verificationReports.length} laporan</span>
                            
                            {selectedReportIds.length > 0 && (
                                <div className="ml-auto flex items-center gap-2 animate-in slide-in-from-right-5 duration-300">
                                    <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest mr-2">{selectedReportIds.length} Terpilih</span>
                                    <button
                                        onClick={handleBulkApprove}
                                        disabled={processingId !== null}
                                        className="px-4 py-2 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-1.5 active:scale-95"
                                    >
                                        {processingId === 'BULK' ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                                        Setujui Masal
                                    </button>
                                    <button
                                        onClick={handleBulkReject}
                                        disabled={processingId !== null}
                                        className="px-4 py-2 bg-rose-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20 disabled:opacity-50 flex items-center gap-1.5 active:scale-95"
                                    >
                                        {processingId === 'BULK' ? <Loader2 size={12} className="animate-spin" /> : <AlertCircle size={12} />}
                                        Tolak Masal
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100">
                                        <th className="px-5 py-3 w-12 text-center">
                                            <input 
                                                type="checkbox"
                                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                checked={verificationReports.length > 0 && selectedReportIds.length === verificationReports.length}
                                                onChange={handleSelectAll}
                                            />
                                        </th>
                                        <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Unit / Tgl</th>
                                        <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">No. Nota</th>
                                        <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest min-w-[180px]">Rincian</th>
                                        <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest min-w-[200px]">Keterangan</th>
                                        <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Volume</th>
                                        <th className="px-5 py-3 text-[9px] font-black text-rose-500 uppercase tracking-widest text-right">Diskon</th>
                                        <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Jumlah</th>
                                        <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Kategori</th>
                                        <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {verificationReports.length > 0
                                        ? verificationReports.map((report) => (
                                            <tr key={report.id} className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${selectedReportIds.includes(report.id) ? 'bg-indigo-50/30' : ''}`}>
                                                <td className="px-5 py-4 text-center">
                                                    <input 
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                        checked={selectedReportIds.includes(report.id)}
                                                        onChange={() => handleSelectRow(report.id)}
                                                    />
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-1 mb-1">
                                                        <Building2 size={10} className="text-slate-400" />
                                                        <span className="text-[10px] font-black text-slate-600">{units.find(u => u.id === report.unitId)?.name || 'Umum'}</span>
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-400">{report.date}</span>
                                                </td>
                                                <td className="px-5 py-4 text-xs font-black text-indigo-600 font-mono">{report.nomorNota || '—'}</td>
                                                <td className="px-5 py-4 text-xs font-bold text-slate-700">{report.category || '—'}</td>
                                                <td className="px-5 py-4 text-xs font-medium text-slate-600 max-w-[200px] truncate" title={report.description}>{report.description}</td>
                                                <td className="px-5 py-4 text-center text-xs font-bold text-slate-600">{(report.volume && report.satuan) ? `${parseFloat(report.volume)} ${report.satuan}` : '—'}</td>
                                                <td className="px-5 py-4 text-right text-xs font-bold text-rose-500 font-mono">{parseFloat(report.diskon || 0) > 0 ? `-${formatRupiah(parseFloat(report.diskon))}` : '—'}</td>
                                                <td className="px-5 py-4 text-right text-sm font-black text-slate-800">{formatRupiah(parseFloat(report.amount || 0))}</td>
                                                <td className="px-5 py-4 text-center"><AsetBadge kategori={report.kategoriAset} umurEkonomis={report.umurEkonomis} /></td>
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button 
                                                            onClick={() => handleApproveReport(report)} 
                                                            disabled={processingId !== null}
                                                            className="px-3 py-1.5 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-emerald-600 transition-colors shadow-sm shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                                        >
                                                            {processingId === report.id ? <Loader2 size={12} className="animate-spin" /> : null}
                                                            Setujui
                                                        </button>
                                                        <button 
                                                            onClick={() => handleRejectReport(report)} 
                                                            disabled={processingId !== null}
                                                            className="px-3 py-1.5 bg-rose-550 bg-rose-50 text-rose-600 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-rose-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
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
                                                <td colSpan="10" className="px-8 py-4 bg-indigo-50/20 text-center text-slate-400 italic font-medium">Tidak ada laporan yang menunggu persetujuan.</td>
                                            </tr>
                                        )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : null}

            {/* Reports List Modal */}
            {showReportsList && selectedItemForReports && (
                <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => { setShowReportsList(false); setSelectedItemForReports(null); }} />
                    <div className="bg-white rounded-[40px] w-full max-w-4xl relative z-10 shadow-2xl overflow-hidden animate-in max-h-[92vh] flex flex-col">
                        {/* Modal Header */}
                        <div className="p-8 border-b border-slate-100 flex justify-between items-start flex-shrink-0">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900">Riwayat Pengeluaran Belanja</h2>
                                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">Komponen: {selectedItemForReports.name}</p>
                            </div>
                            <button
                                onClick={() => { setShowReportsList(false); setSelectedItemForReports(null); }}
                                className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="overflow-y-auto flex-1 p-8 custom-scrollbar">
                            {itemReports.length === 0 ? (
                                <div className="p-12 text-center text-slate-400 italic font-medium">
                                    Belum ada pengeluaran yang dilaporkan untuk komponen ini.
                                </div>
                            ) : (
                                <div className="overflow-x-auto rounded-2xl border border-slate-100">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-100">
                                                <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center w-12">No</th>
                                                <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Tanggal</th>
                                                <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">No. Nota</th>
                                                <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Keterangan</th>
                                                <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Volume</th>
                                                <th className="px-5 py-3 text-[9px] font-black text-rose-500 uppercase tracking-widest text-right">Diskon</th>
                                                <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Jumlah</th>
                                                <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                                {!isSuperAdmin && <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Aksi</th>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {itemReports.map((report, idx) => {
                                                const reportDate = report.date ? new Date(report.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
                                                return (
                                                    <tr key={report.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                                        <td className="px-5 py-4 text-center text-xs font-bold text-slate-400">{idx + 1}</td>
                                                        <td className="px-5 py-4 text-xs font-bold text-slate-600">{reportDate}</td>
                                                        <td className="px-5 py-4 text-xs font-bold font-mono text-indigo-600">{report.nomorNota || '—'}</td>
                                                        <td className="px-5 py-4 text-xs font-bold text-slate-700">{report.description || '—'}</td>
                                                        <td className="px-5 py-4 text-xs font-bold text-slate-500 text-center">
                                                            {report.volume ? `${parseFloat(report.volume)} ${report.satuan || ''}` : '—'}
                                                        </td>
                                                        <td className="px-5 py-4 text-xs font-bold text-rose-500 font-mono text-right">
                                                            {parseFloat(report.diskon || 0) > 0 ? `-${formatRupiah(parseFloat(report.diskon))}` : '—'}
                                                        </td>
                                                        <td className="px-5 py-4 text-xs font-black text-slate-800 text-right">{formatRupiah(parseFloat(report.amount || 0))}</td>
                                                        <td className="px-5 py-4 text-center">
                                                            {report.status === 'APPROVED' ? (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                    ACC
                                                                </span>
                                                            ) : report.status === 'REJECTED' ? (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-rose-50 text-rose-700 border border-rose-200">
                                                                    Ditolak
                                                                </span>
                                                            ) : report.status === 'PENDING' ? (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-amber-50 text-amber-700 border border-amber-200">
                                                                    Pending
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 border border-slate-200">
                                                                    Draft
                                                                </span>
                                                            )}
                                                        </td>
                                                        {!isSuperAdmin && (
                                                            <td className="px-5 py-4 text-center">
                                                                {(report.status === 'DRAFT' || report.status === 'REJECTED') ? (
                                                                    <div className="flex items-center justify-center gap-1.5">
                                                                        {report.kategoriAset !== 'PENGEMBALIAN' && (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setShowReportsList(false);
                                                                                    handleEditDraft(report);
                                                                                }}
                                                                                className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors"
                                                                                title={report.status === 'REJECTED' ? 'Perbaiki Laporan' : 'Edit Draft'}
                                                                            >
                                                                                <Edit2 size={14} />
                                                                            </button>
                                                                        )}
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleDeleteDraft(report.id);
                                                                            }}
                                                                            className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors"
                                                                            title={report.status === 'REJECTED' ? 'Hapus Laporan' : 'Hapus Draft'}
                                                                        >
                                                                            <Trash2 size={14} />
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-slate-300 text-xs">—</span>
                                                                )}
                                                            </td>
                                                        )}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-8 border-t border-slate-100 bg-slate-50 flex items-center justify-between flex-shrink-0">
                            <div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Total Realisasi Rincian</span>
                                <span className="text-lg font-black text-blue-700">
                                    {formatRupiah(itemReports.reduce((s, r) => s + parseFloat(r.amount || 0), 0))}
                                </span>
                            </div>
                            <button
                                onClick={() => { setShowReportsList(false); setSelectedItemForReports(null); }}
                                className="px-8 py-4 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-2xl font-black text-xs uppercase transition-colors"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Maksimal Lapor (Sisa Pengajuan)</p>
                                <span className="text-lg font-black text-blue-700">
                                    {(() => {
                                        const parentReq = budgetRequests.find(r => r.id === selectedRequest?.reqId);
                                        if (!parentReq) return 'Rp 0';
                                        const totalApproved = parseFloat(parentReq.totalAmount || parentReq.amount || 0);
                                        const totalReportedForReq = (budgetReports || [])
                                            .filter(r => r.budgetRequestId === selectedRequest?.reqId && r.status !== 'REJECTED' && !r.isDeleted)
                                            .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
                                        const currentDraftAmount = editingDraftId ? parseFloat(budgetReports.find(r => r.id === editingDraftId)?.amount || 0) : 0;
                                        const sisaDanaPengajuan = totalApproved - totalReportedForReq + currentDraftAmount;
                                        return formatRupiah(sisaDanaPengajuan);
                                    })()}
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
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
                                        <div className="flex flex-col justify-end h-full">
                                            <label className="form-label min-h-[24px] flex items-end mb-1">Volume</label>
                                            <input type="number" min="0" step="any" className="form-input" placeholder="Qty"
                                                value={formData.volume}
                                                onChange={e => {
                                                    const vol = e.target.value;
                                                    const currentHarga = formData.harga || 0;
                                                    const currentDiskon = formData.diskon || 0;
                                                    const gross = parseFloat(vol || 0) * parseFloat(currentHarga);
                                                    const total = Math.max(0, gross - parseFloat(currentDiskon));
                                                    setFormData({ ...formData, volume: vol, amount: total });
                                                }} />
                                        </div>
                                        <div className="flex flex-col justify-end h-full">
                                            <label className="form-label min-h-[24px] flex items-end mb-1">Satuan</label>
                                            <input type="text" className="form-input" placeholder="Buah / Rim / Kg"
                                                value={formData.satuan}
                                                onChange={e => setFormData({ ...formData, satuan: e.target.value })} />
                                        </div>
                                        <div className="flex flex-col justify-end h-full">
                                            <label className="form-label min-h-[24px] flex items-end mb-1">Harga Satuan (Rp)</label>
                                            <input type="number" min="0" className="form-input" placeholder="0"
                                                value={formData.harga}
                                                onChange={e => {
                                                    const hrg = e.target.value;
                                                    const currentVol = formData.volume || 0;
                                                    const currentDiskon = formData.diskon || 0;
                                                    const gross = parseFloat(currentVol) * parseFloat(hrg || 0);
                                                    const total = Math.max(0, gross - parseFloat(currentDiskon));
                                                    setFormData({ ...formData, harga: hrg, amount: total });
                                                }} />
                                        </div>
                                        <div className="flex flex-col justify-end h-full">
                                            <label className="form-label min-h-[24px] flex items-end mb-1">Diskon / Potongan (Rp)</label>
                                            <input type="number" min="0" className="form-input text-rose-600 font-bold" placeholder="0"
                                                value={formData.diskon}
                                                onChange={e => {
                                                    const disk = e.target.value;
                                                    const currentVol = formData.volume || 0;
                                                    const currentHarga = formData.harga || 0;
                                                    const gross = parseFloat(currentVol) * parseFloat(currentHarga);
                                                    const total = Math.max(0, gross - parseFloat(disk || 0));
                                                    setFormData({ ...formData, diskon: disk, amount: total });
                                                }} />
                                        </div>
                                    </div>
                                    {/* Auto total display */}
                                    <div className="flex items-center justify-between px-4 py-3 bg-indigo-50 rounded-2xl border border-indigo-100">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Total Otomatis</span>
                                            {parseFloat(formData.diskon || 0) > 0 && (
                                                <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">
                                                    Diskon -{formatRupiah(parseFloat(formData.diskon || 0))}
                                                </span>
                                            )}
                                        </div>
                                        <span className="font-black text-indigo-700 text-base">
                                            {formatRupiah(Math.max(0, (parseFloat(formData.volume || 0) * parseFloat(formData.harga || 0)) - parseFloat(formData.diskon || 0)))}
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
                <div className="text-center mb-3">
                    <h2 className="text-base font-black uppercase">LAPORAN PENGELUARAN YAYASAN</h2>
                    <p className="text-xs font-bold mt-0.5">
                        {myUnitId ? (units.find(u => u.id === myUnitId)?.name || '') : 'Semua Unit'} 
                        {filterRequestMonth !== 'ALL' ? ` • Bulan Permintaan: ${formatMonthLabel(filterRequestMonth)}` : ''}
                        {filterDateFrom && filterDateTo ? ` (${filterDateFrom} s.d ${filterDateTo})` : ''}
                    </p>
                </div>
                
                <table className="w-full text-left border-collapse border border-slate-800 text-[9px]">
                    <thead>
                        <tr className="bg-slate-100">
                            <th className="px-1 py-0.5 border border-slate-800 text-center font-bold">No</th>
                            <th className="px-1 py-0.5 border border-slate-800 font-bold">Tanggal Nota</th>
                            <th className="px-1 py-0.5 border border-slate-800 font-bold">Bulan Permintaan</th>
                            <th className="px-1 py-0.5 border border-slate-800 font-bold">No. Nota</th>
                            <th className="px-1 py-0.5 border border-slate-800 font-bold">Keterangan</th>
                            <th className="px-1 py-0.5 border border-slate-800 font-bold">Jenis Belanja</th>
                            <th className="px-1 py-0.5 border border-slate-800 font-bold">Bukti Transaksi</th>
                            <th className="px-1 py-0.5 border border-slate-800 text-center font-bold">Volume</th>
                            <th className="px-1 py-0.5 border border-slate-800 text-right font-bold">Harga</th>
                            <th className="px-1 py-0.5 border border-slate-800 text-right font-bold">Jumlah</th>
                            <th className="px-1 py-0.5 border border-slate-800 text-center font-bold">Kategori</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredReports.map((report, idx) => {
                            const req = budgetRequests?.find(r => r.id === (report.budgetRequestId || report.requestId));
                            const reqMonthLabel = req?.month ? formatMonthLabel(req.month) : '—';
                            return (
                            <tr key={report.id}>
                                <td className="px-1 py-0.5 border border-slate-800 text-center">{idx + 1}</td>
                                <td className="px-1 py-0.5 border border-slate-800 whitespace-nowrap">{report.date ? new Date(report.date).toLocaleDateString('id-ID') : '—'}</td>
                                <td className="px-1 py-0.5 border border-slate-800 whitespace-nowrap font-bold">{reqMonthLabel}</td>
                                <td className="px-1 py-0.5 border border-slate-800 font-mono whitespace-nowrap">{report.nomorNota || '—'}</td>
                                <td className="px-1 py-0.5 border border-slate-800">{report.description || '—'}</td>
                                <td className="px-1 py-0.5 border border-slate-800 whitespace-nowrap">{report.category || '—'}</td>
                                <td className="px-1 py-0.5 border border-slate-800">{report.buktiTeks || '—'}</td>
                                <td className="px-1 py-0.5 border border-slate-800 text-center whitespace-nowrap">{(report.volume && report.satuan) ? `${parseFloat(report.volume)} ${report.satuan}` : '—'}</td>
                                <td className="px-1 py-0.5 border border-slate-800 text-right whitespace-nowrap">{report.harga ? formatRupiah(parseFloat(report.harga)) : '—'}</td>
                                <td className="px-1 py-0.5 border border-slate-800 text-right font-bold whitespace-nowrap">{formatRupiah(parseFloat(report.amount || 0))}</td>
                                <td className="px-1 py-0.5 border border-slate-800 text-center">{report.kategoriAset === 'ASET' ? 'ASET' : 'NON ASET'}</td>
                            </tr>
                        )})}
                        {filteredReports.length === 0 && (
                            <tr>
                                <td colSpan="11" className="p-2 border border-slate-800 text-center italic">Tidak ada data untuk dicetak</td>
                            </tr>
                        )}
                    </tbody>
                    {filteredReports.length > 0 && (
                        <tfoot>
                            <tr className="bg-slate-100">
                                <td colSpan="9" className="px-1 py-0.5 border border-slate-800 text-right font-black uppercase">Total Pengeluaran</td>
                                <td className="px-1 py-0.5 border border-slate-800 text-right font-black">{formatRupiah(totalNilai)}</td>
                                <td className="border border-slate-800"></td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </div>
    );
}
