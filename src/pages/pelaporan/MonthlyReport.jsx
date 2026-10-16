import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileCheck, Receipt, Save, AlertCircle, CheckCircle2, ArrowUpRight, History, Search, ChevronDown, ChevronRight, Download, Package, Layers, Filter, Calendar, Tag, Building2, Loader2, Edit2, Trash2, X, RotateCcw, Upload, FileSpreadsheet, ExternalLink } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { formatRupiah, parseExcelDate } from '../../utils/format';
import { getComponentKeterangan } from '../../utils/budgetEngine';
import { getAssetDefaultDetails } from '../../utils/depreciation';
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

    // 5. Fallback: match by date month and unit
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

function resolveReportToRequestItem(report, reqItems, byRequestComponent, rReqId, rabPlans, expenseItems) {
    if (!report || !reqItems || reqItems.length === 0) return null;

    // 1. Direct componentId match if report has componentId
    if (report.componentId) {
        const direct = reqItems.find(it => (it.componentId || it.id) === report.componentId);
        if (direct) return direct;
    }

    const rCat = (report.category || '').trim().toLowerCase();
    const rDesc = (report.description || '').trim().toLowerCase();
    const rBukti = (report.buktiTeks || '').trim().toLowerCase();

    // Helper to pick the best item among candidates with same category/name
    const pickBestItem = (candidates) => {
        if (!candidates || candidates.length === 0) return null;
        if (candidates.length === 1) return candidates[0];

        // A. Keyword match against keterangan rincian, asset name, room, or description
        const descText = `${rDesc} ${rBukti}`.trim();
        if (descText) {
            const scored = candidates.map(cand => {
                const candKet = (getComponentKeterangan(cand, rabPlans, expenseItems) || '').toLowerCase();
                const candRoom = (cand.assetRoom || '').toLowerCase();
                const candAsset = (cand.assetName || '').toLowerCase();
                const candDesc = (cand.description || cand.keterangan || '').toLowerCase();

                let score = 0;
                if (candKet && (descText.includes(candKet) || candKet.includes(descText))) score += 10;
                if (candRoom && descText.includes(candRoom)) score += 8;
                if (candAsset && descText.includes(candAsset)) score += 6;
                if (candDesc && (descText.includes(candDesc) || candDesc.includes(descText))) score += 5;

                // Word overlap
                const words = `${candKet} ${candRoom} ${candAsset} ${candDesc}`.split(/[\s,./•-]+/).filter(w => w && w.length > 3);
                words.forEach(w => {
                    if (descText.includes(w)) score += 2;
                });

                return { cand, score };
            });

            scored.sort((a, b) => b.score - a.score);
            if (scored[0].score > 0) {
                return scored[0].cand;
            }
        }

        // B. Budget Awareness: Pick the candidate that still has remaining budget (prevents piling up onto over-budget item)
        if (byRequestComponent && rReqId) {
            const candidateWithBudget = candidates.find(item => {
                const cId = item.componentId || item.id;
                const reqCompKey = `${rReqId}_${cId}`;
                const currentUsed = byRequestComponent[reqCompKey] || 0;
                return currentUsed < parseFloat(item.amount || 0);
            });
            if (candidateWithBudget) return candidateWithBudget;
        }

        // C. Fallback to first candidate
        return candidates[0];
    };

    // 2. Strict EXACT match on category against item name
    if (rCat) {
        const exactCatMatches = reqItems.filter(it => (it.name || '').trim().toLowerCase() === rCat);
        if (exactCatMatches.length > 0) {
            return pickBestItem(exactCatMatches);
        }
    }

    // 3. Strict EXACT match on description against item name
    if (rDesc) {
        const exactDescMatches = reqItems.filter(it => (it.name || '').trim().toLowerCase() === rDesc);
        if (exactDescMatches.length > 0) {
            return pickBestItem(exactDescMatches);
        }
    }

    // 4. Substring matching with specificity priority:
    const searchText = rCat || rDesc;
    if (searchText) {
        const candidateItems = reqItems.filter(it => {
            const iName = (it.name || '').trim().toLowerCase();
            return iName && (searchText.includes(iName) || iName.includes(searchText));
        });

        if (candidateItems.length > 0) {
            // Sort by name length descending: most specific/longest match first
            candidateItems.sort((a, b) => ((b.name || '').trim().length - (a.name || '').trim().length));
            const topLen = (candidateItems[0].name || '').trim().length;
            const topCandidates = candidateItems.filter(it => (it.name || '').trim().length === topLen);
            return pickBestItem(topCandidates);
        }
    }

    return null;
}

// ─── Expandable Row ──────────────────────────────────────────────────────────
function ReportRow({ report, units, expenseItems, rabPlans, budgetRequests, isSuperAdmin, idx, selectable, isSelected, onToggleSelect, onEdit, onDelete, onCancelApproval, onWithdraw, isProcessing, globalAcademicYearId }) {
    const [open, setOpen] = useState(false);
    const unitName = units.find(u => u.id === report.unitId)?.name;
    const dateStr = report.date ? new Date(report.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
    
    const req = resolveReportRequest(report, budgetRequests, globalAcademicYearId);
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
                    ) : report.status === 'DELETED' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-black uppercase bg-slate-100 text-slate-500 border border-slate-300">
                            Dihapus
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-black uppercase bg-emerald-50 text-emerald-600 border border-emerald-200">
                            ✓ Terverifikasi
                        </span>
                    )}
                </td>
                <td className="px-5 py-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                        {!isSuperAdmin && report.status === 'PENDING' && onWithdraw && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onWithdraw(); }}
                                className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-all flex items-center gap-1 shadow-sm active:scale-95"
                                title="Batalkan Ajukan (Kembalikan ke Draf)"
                            >
                                <RotateCcw size={11} />
                                <span>Tarik Ajuan</span>
                            </button>
                        )}
                        {/* Edit button: for unit (DRAFT/REJECTED) and for Superadmin (all reports except PENGEMBALIAN) */}
                        {report.kategoriAset !== 'PENGEMBALIAN' && onEdit && (
                            (!isSuperAdmin && (report.status === 'DRAFT' || report.status === 'REJECTED')) ||
                            isSuperAdmin
                        ) && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                                className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors"
                                title={isSuperAdmin ? (report.status === 'APPROVED' ? 'Edit / Sesuaikan Nota (Otomatis Update Jurnal)' : 'Edit Nota') : (report.status === 'REJECTED' ? 'Perbaiki Laporan' : 'Edit Draft')}
                            >
                                <Edit2 size={14} />
                            </button>
                        )}
                        {!isSuperAdmin && (report.status === 'DRAFT' || report.status === 'REJECTED') && onDelete && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                                className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors"
                                title={report.status === 'REJECTED' ? 'Hapus Laporan' : 'Hapus Draft'}
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                        {isSuperAdmin && onDelete && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                                className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Hapus Laporan Permanen"
                            >
                                <Trash2 size={14} />
                            </button>
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
                                        {report.buktiTeks.trim().startsWith('http://') || report.buktiTeks.trim().startsWith('https://') ? (
                                            <a
                                                href={report.buktiTeks.trim()}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 text-xs text-indigo-700 hover:text-indigo-900 font-bold underline break-all mt-1 bg-white px-2.5 py-1.5 rounded-lg border border-indigo-200 shadow-xs hover:shadow transition-all"
                                            >
                                                <ExternalLink size={12} className="shrink-0" />
                                                <span>Buka Tautan Bukti ({report.buktiTeks.includes('drive.google.com') ? 'Google Drive' : 'Link Web'}) ↗</span>
                                            </a>
                                        ) : (
                                            <p className="text-xs text-slate-700 font-medium">{report.buktiTeks}</p>
                                        )}
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

                            {/* Actions for Superadmin */}
                            {isSuperAdmin && (
                                <div className="space-y-3 md:col-span-3 border-t border-slate-200/60 pt-4 mt-2">
                                    <div className="flex gap-3 justify-end">
                                        {report.kategoriAset !== 'PENGEMBALIAN' && onEdit && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onEdit(); }} 
                                                className="btn btn-secondary !py-2 !px-4 !text-xs !rounded-xl !text-indigo-600 hover:!bg-indigo-50 hover:!border-indigo-200 shadow-sm flex items-center gap-1.5"
                                            >
                                                <Edit2 size={12} className="inline-block" /> Edit Nota {report.status === 'APPROVED' ? '(Auto-Sync Jurnal)' : ''}
                                            </button>
                                        )}
                                        {report.status === 'APPROVED' && onCancelApproval && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onCancelApproval(); }} 
                                                disabled={isProcessing}
                                                className="btn btn-secondary !py-2 !px-4 !text-xs !rounded-xl !text-amber-600 hover:!bg-amber-50 hover:!border-amber-200 shadow-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <RotateCcw size={12} className="inline-block" /> Batalkan Persetujuan (ACC)
                                            </button>
                                        )}
                                        {onDelete && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onDelete(); }} 
                                                disabled={isProcessing}
                                                className="btn btn-secondary !py-2 !px-4 !text-xs !rounded-xl !text-rose-600 hover:!bg-rose-50 hover:!border-rose-200 shadow-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                                title="Hapus Laporan Permanen"
                                            >
                                                <Trash2 size={12} className="inline-block" /> Hapus Laporan Permanen
                                            </button>
                                        )}
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
    const [selectedHistoryIds, setSelectedHistoryIds] = useState([]); // local history bulk submission (drafts)
    const [selectedHistoryPendingIds, setSelectedHistoryPendingIds] = useState([]); // local history bulk withdrawal (pending)
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

    const { budgetRequests = [], budgetReports = [], expenseItems = [], rabPlans = [], units = [], fields = [], globalAcademicYearId, currentUser, accounts = [], assetCategories = [] } = state;

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

    // Clear notifications for unit admin when they visit (local state update only, no background network push)
    React.useEffect(() => {
        if (!isSuperAdmin && budgetReports?.length > 0) {
            const unnotified = budgetReports.filter(r => {
                const resolvedReq = resolveReportRequest(r, budgetRequests, globalAcademicYearId) || (budgetRequests || []).find(br => br.id === (r.budgetRequestId || r.requestId));
                const rUnitId = r.unitId || resolvedReq?.unitId;
                const rFieldId = r.fieldId || resolvedReq?.fieldId;
                const isMine = (myUnitId && rUnitId === myUnitId) || (myFieldId && rFieldId === myFieldId);
                return isMine && (r.status === 'APPROVED' || r.status === 'REJECTED') && !r.notified;
            });
            if (unnotified.length > 0) {
                unnotified.forEach(r => {
                    const updated = { ...r, notified: true };
                    dispatch({ type: 'EDIT_BUDGET_REPORT', payload: updated });
                });
            }
        }
    }, [budgetReports, budgetRequests, isSuperAdmin, myUnitId, myFieldId, globalAcademicYearId, dispatch]);

    const reportedAmounts = useMemo(() => {
        const map = {};
        const approvedMap = {};
        const reqMap = {};
        const reqApprovedMap = {};
        const reqSettledMap = {};
        const byRequestComponent = {};
        const approvedByRequestComponent = {};
        const reportCompMap = {};

        const reqLookup = new Map();
        (budgetRequests || []).forEach(br => reqLookup.set(br.id, br));

        (budgetReports || []).forEach(r => {
            if (r.status !== 'REJECTED' && !r.isDeleted) {
                const resolvedReq = resolveReportRequest(r, budgetRequests, globalAcademicYearId);
                const rReqId = resolvedReq ? resolvedReq.id : (r.budgetRequestId || r.requestId);

                // Backward-compatible componentId lookup if missing in old reports
                let effectiveComponentId = r.componentId;
                if (!effectiveComponentId && rReqId) {
                    const req = reqLookup.get(rReqId);
                    if (req && req.items && req.items.length > 0) {
                        const matchedItem = resolveReportToRequestItem(r, req.items, byRequestComponent, rReqId, rabPlans, expenseItems);
                        if (matchedItem) {
                            effectiveComponentId = matchedItem.componentId || matchedItem.id;
                        }
                    }
                }

                const amt = parseFloat(r.amount || 0);

                if (effectiveComponentId) {
                    reportCompMap[r.id] = effectiveComponentId;

                    if (!map[effectiveComponentId]) map[effectiveComponentId] = 0;
                    map[effectiveComponentId] += amt;

                    if (r.status === 'APPROVED') {
                        if (!approvedMap[effectiveComponentId]) approvedMap[effectiveComponentId] = 0;
                        approvedMap[effectiveComponentId] += amt;
                    }
                }
                
                if (rReqId) {
                    if (!reqMap[rReqId]) reqMap[rReqId] = 0;
                    reqMap[rReqId] += amt;

                    if (r.status === 'APPROVED') {
                        if (!reqApprovedMap[rReqId]) reqApprovedMap[rReqId] = 0;
                        reqApprovedMap[rReqId] += amt;
                    }

                    if (r.kategoriAset !== 'PENGEMBALIAN') {
                        if (!reqSettledMap[rReqId]) reqSettledMap[rReqId] = 0;
                        reqSettledMap[rReqId] += amt;
                    }

                    if (effectiveComponentId) {
                        const reqCompKey = `${rReqId}_${effectiveComponentId}`;
                        if (!byRequestComponent[reqCompKey]) byRequestComponent[reqCompKey] = 0;
                        byRequestComponent[reqCompKey] += amt;

                        if (r.status === 'APPROVED') {
                            if (!approvedByRequestComponent[reqCompKey]) approvedByRequestComponent[reqCompKey] = 0;
                            approvedByRequestComponent[reqCompKey] += amt;
                        }
                    }
                }
            }
        });

        // Include Pengembalian Dana (refund) reports towards request settlement
        (budgetReports || []).forEach(r => {
            if (r.status !== 'REJECTED' && !r.isDeleted && r.kategoriAset === 'PENGEMBALIAN') {
                const amt = parseFloat(r.amount || 0);
                const resolvedReq = resolveReportRequest(r, budgetRequests, globalAcademicYearId);
                const rReqId = resolvedReq ? resolvedReq.id : (r.budgetRequestId || r.requestId);
                if (rReqId) {
                    if (!reqSettledMap[rReqId]) reqSettledMap[rReqId] = 0;
                    reqSettledMap[rReqId] += amt;
                }
            }
        });

        return { byComponent: map, approvedByComponent: approvedMap, byRequest: reqMap, approvedByRequest: reqApprovedMap, reqSettledMap, byRequestComponent, approvedByRequestComponent, reportCompMap };
    }, [budgetReports, budgetRequests, globalAcademicYearId, rabPlans, expenseItems]);

    const reportsCountMap = useMemo(() => {
        const counts = {};
        const reqLookup = new Map();
        (budgetRequests || []).forEach(br => reqLookup.set(br.id, br));

        (budgetReports || []).forEach(r => {
            if (r.isDeleted || r.status === 'REJECTED') return;
            const resolvedReq = resolveReportRequest(r, budgetRequests, globalAcademicYearId);
            const rReqId = resolvedReq ? resolvedReq.id : (r.budgetRequestId || r.requestId);
            let effectiveCompId = r.componentId || reportedAmounts?.reportCompMap?.[r.id];
            if (!effectiveCompId && rReqId) {
                const req = reqLookup.get(rReqId);
                if (req && req.items) {
                    const match = resolveReportToRequestItem(r, req.items, reportedAmounts?.byRequestComponent, rReqId, rabPlans, expenseItems);
                    if (match) effectiveCompId = match.componentId || match.id;
                }
            }
            if (rReqId && effectiveCompId) {
                const key = `${rReqId}_${effectiveCompId}`;
                counts[key] = (counts[key] || 0) + 1;
            } else if (rReqId) {
                counts[rReqId] = (counts[rReqId] || 0) + 1;
            } else if (effectiveCompId) {
                counts[effectiveCompId] = (counts[effectiveCompId] || 0) + 1;
            }
        });
        return counts;
    }, [budgetReports, budgetRequests, globalAcademicYearId, reportedAmounts, rabPlans, expenseItems]);

    const getReportsCountForItem = (item) => {
        if (!item) return 0;
        const itemCompId = item.componentId || item.id;
        return (budgetReports || []).filter(r => {
            if (!r || r.isDeleted || r.status === 'REJECTED') return false;

            const resolvedReq = resolveReportRequest(r, budgetRequests, globalAcademicYearId);
            const rReqId = resolvedReq ? resolvedReq.id : (r.budgetRequestId || r.requestId);

            if (rReqId && item.reqId && rReqId !== item.reqId) {
                return false;
            }

            const effCompId = r.componentId || reportedAmounts?.reportCompMap?.[r.id];
            if (effCompId) {
                return effCompId === itemCompId;
            }

            if (itemCompId) {
                const req = (budgetRequests || []).find(b => b.id === (item.reqId || rReqId));
                if (req && req.items && req.items.length > 0) {
                    const matchedItem = resolveReportToRequestItem(r, req.items, reportedAmounts?.byRequestComponent, rReqId, rabPlans, expenseItems);
                    if (matchedItem) {
                        return (matchedItem.componentId || matchedItem.id) === itemCompId;
                    }
                }
                return false;
            }

            const rCat = (r.category || '').trim().toLowerCase();
            const rDesc = (r.description || '').trim().toLowerCase();
            const iName = (item.name || '').trim().toLowerCase();

            if (iName && (rCat === iName || rDesc === iName)) {
                return true;
            }

            if (rReqId && item.reqId && rReqId === item.reqId && !r.componentId && !r.category) {
                return true;
            }

            return false;
        }).length;
    };

    const itemReports = useMemo(() => {
        if (!selectedItemForReports) return [];
        const item = selectedItemForReports;
        const itemCompId = item.componentId || item.id;
        return (budgetReports || []).filter(r => {
            if (!r || r.isDeleted) return false;

            const resolvedReq = resolveReportRequest(r, budgetRequests, globalAcademicYearId);
            const rReqId = resolvedReq ? resolvedReq.id : (r.budgetRequestId || r.requestId);

            if (rReqId && item.reqId && rReqId !== item.reqId) {
                return false;
            }

            const effCompId = r.componentId || reportedAmounts?.reportCompMap?.[r.id];
            if (effCompId) {
                return effCompId === itemCompId;
            }

            if (itemCompId) {
                const req = (budgetRequests || []).find(b => b.id === (item.reqId || rReqId));
                if (req && req.items && req.items.length > 0) {
                    const matchedItem = resolveReportToRequestItem(r, req.items, reportedAmounts?.byRequestComponent, rReqId, rabPlans, expenseItems);
                    if (matchedItem) {
                        return (matchedItem.componentId || matchedItem.id) === itemCompId;
                    }
                }
                return false;
            }

            const rCat = (r.category || '').trim().toLowerCase();
            const rDesc = (r.description || '').trim().toLowerCase();
            const iName = (item.name || '').trim().toLowerCase();

            if (iName && (rCat === iName || rDesc === iName)) {
                return true;
            }

            if (rReqId && item.reqId && rReqId === item.reqId && !r.componentId && !r.category) {
                return true;
            }

            return false;
        });
    }, [selectedItemForReports, budgetReports, budgetRequests, globalAcademicYearId, reportedAmounts, rabPlans, expenseItems]);

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
            
            const resolvedReq = resolveReportRequest(rel, budgetRequests, globalAcademicYearId) || (budgetRequests || []).find(r => r.id === (rel.budgetRequestId || rel.requestId));
            const reportUnitId = rel.unitId || resolvedReq?.unitId;
            const reportFieldId = rel.fieldId || resolvedReq?.fieldId;

            if (myUnitId && reportUnitId !== myUnitId) return false;
            if (myFieldId && reportFieldId !== myFieldId) return false;
            
            // Filter by source
            const isBosReport = rel.source === 'BOS' || rel.planId?.endsWith('-BOS');
            if (sourceMode === 'BOS' && !isBosReport) return false;
            if (sourceMode === 'YAYASAN' && isBosReport) return false;

            return true;
        });
    }, [budgetReports, budgetRequests, isSuperAdmin, myUnitId, myFieldId, globalAcademicYearId, sourceMode]);

    const pendingItems = useMemo(() => {
        const items = [];

        // Find the latest request month for each unit
        const latestMonthByUnit = {};
        requestsForYear.filter(req => req.status === 'APPROVED').forEach(req => {
            const uKey = req.unitId || req.fieldId || 'UNKNOWN';
            if (req.month && (!latestMonthByUnit[uKey] || req.month > latestMonthByUnit[uKey])) {
                latestMonthByUnit[uKey] = req.month;
            }
        });

        requestsForYear.filter(req => req.status === 'APPROVED').forEach(req => {
            if (req.isClosed) return; // Exclude closed requests

            // Skip requests that are fully reported & settled (Total reports + refunds >= totalAmount)
            const totalSettled = reportedAmounts?.reqSettledMap?.[req.id] || 0;
            const reqTotal = parseFloat(req.totalAmount || 0);
            if (reqTotal > 0 && totalSettled >= reqTotal - 1) return;


            const uKey = req.unitId || req.fieldId || 'UNKNOWN';
            const maxMonth = latestMonthByUnit[uKey] || '';


            if (req.items && req.items.length > 0) {
                req.items.forEach(item => {
                    if (item.isClosed) return; // Skip closed items!

                    const reqCompKey = item.componentId ? `${req.id}_${item.componentId}` : null;
                    let reportedComp = 0;

                    if (reqCompKey && reportedAmounts?.byRequestComponent) {
                        reportedComp = reportedAmounts.byRequestComponent[reqCompKey] || 0;
                    } else {
                        const matchingReports = (budgetReports || []).filter(r => {
                            if (r.status === 'REJECTED' || r.isDeleted) return false;
                            const isSameUnit = (r.unitId && (r.unitId === req.unitId || r.unitId === req.fieldId)) || 
                                               (r.fieldId && (r.fieldId === req.unitId || r.fieldId === req.fieldId));
                            if (!isSameUnit) return false;

                            if (item.componentId && r.componentId === item.componentId) return true;

                            const reportName = (r.category || r.description || '').trim().toLowerCase();
                            const itemName = (item.name || '').trim().toLowerCase();
                            if (reportName && itemName && reportName === itemName) {
                                if (item.expenseItemId && r.expenseItemId && item.expenseItemId !== r.expenseItemId) {
                                    return false;
                                }
                                const resolved = resolveReportRequest(r, budgetRequests, globalAcademicYearId);
                                if (resolved && resolved.id === req.id) return true;
                                const rReqId = r.budgetRequestId || r.requestId;
                                if (!rReqId || rReqId === req.id) return true;
                            }
                            return false;
                        });
                        reportedComp = matchingReports.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
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
                        fieldId: req.fieldId,
                        expenseItemId: item.expenseItemId || req.expenseItemId,
                        sisa
                    });
                });
            } else {
                // Skip legacy requests that have been verified (APPROVED) by Superadmin
                const hasApprovedReport = (budgetReports || []).some(r => {
                    if (r.status !== 'APPROVED' || r.isDeleted) return false;
                    const rReqId = r.budgetRequestId || r.requestId;
                    return rReqId === req.id;
                });
                if (hasApprovedReport) return;

                const reqTotal = parseFloat(req.totalAmount || 0);
                const reportedReq = reportedAmounts?.byRequest?.[req.id] || 0;
                const sisa = reqTotal - reportedReq;

                items.push({
                    reqId: req.id,
                    reqMonth: req.month,
                    reqDate: req.date,
                    reqDescription: req.description,
                    reqUnitId: req.unitId,
                    fieldId: req.fieldId,
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

        // 1. Pre-calculate unit/field cair totals once
        const unitCairMap = {};
        (budgetRequests || []).forEach(r => {
            if (r.academicYearId !== globalAcademicYearId || r.status !== 'APPROVED') return;
            const isBosRequest = r.source === 'BOS' || (r.items || []).some(item => item.planId?.endsWith('-BOS'));
            if (sourceMode === 'BOS' && !isBosRequest) return;
            if (sourceMode === 'YAYASAN' && isBosRequest) return;

            const key = r.unitId || r.fieldId;
            if (key) {
                unitCairMap[key] = (unitCairMap[key] || 0) + (parseFloat(r.totalAmount) || 0);
            }
        });

        // 2. Pre-calculate unit/field report totals once
        const unitUsedMap = {};
        const unitReturnedMap = {};
        (budgetReports || []).forEach(r => {
            if (r.academicYearId !== globalAcademicYearId || r.status !== 'APPROVED' || r.isDeleted) return;
            const isBosReport = r.planId?.endsWith('-BOS');
            if (sourceMode === 'BOS' && !isBosReport) return;
            if (sourceMode === 'YAYASAN' && isBosReport) return;

            const key = r.unitId || r.fieldId;
            if (key) {
                const amt = parseFloat(r.amount) || 0;
                if (r.kategoriAset === 'PENGEMBALIAN') {
                    unitReturnedMap[key] = (unitReturnedMap[key] || 0) + amt;
                } else {
                    unitUsedMap[key] = (unitUsedMap[key] || 0) + amt;
                }
            }
        });

        // 3. Count pending items per unit
        const latestMonthByUnit = {};
        requestsForYear.filter(req => req.status === 'APPROVED').forEach(req => {
            const uKey = req.unitId || req.fieldId || 'UNKNOWN';
            if (req.month && (!latestMonthByUnit[uKey] || req.month > latestMonthByUnit[uKey])) {
                latestMonthByUnit[uKey] = req.month;
            }
        });

        (budgetRequests || []).forEach(req => {
            if (req.academicYearId !== globalAcademicYearId || req.status !== 'APPROVED') return;
            const isBosRequest = req.source === 'BOS' || (req.items || []).some(item => item.planId?.endsWith('-BOS'));
            if (sourceMode === 'BOS' && !isBosRequest) return;
            if (sourceMode === 'YAYASAN' && isBosRequest) return;

            const unitKey = req.unitId || req.fieldId || 'UNKNOWN';
            const unitCair = unitCairMap[unitKey] || 0;
            const unitUsed = unitUsedMap[unitKey] || 0;
            const unitReturned = unitReturnedMap[unitKey] || 0;
            const activeBalance = unitCair - unitUsed - unitReturned;

            if (activeBalance <= 0) return;

            // Skip requests that are fully reported & settled
            const totalSettled = reportedAmounts?.reqSettledMap?.[req.id] || 0;
            const reqTotal = parseFloat(req.totalAmount || 0);
            if (reqTotal > 0 && totalSettled >= reqTotal - 1) return;


            if (req.items && req.items.length > 0) {
                req.items.forEach(item => {
                    if (item.isClosed) return;
                    map[unitKey] = (map[unitKey] || 0) + 1;
                });
            } else {
                const hasApprovedReport = (budgetReports || []).some(r => {
                    if (r.status !== 'APPROVED' || r.isDeleted) return false;
                    const rReqId = r.budgetRequestId || r.requestId;
                    return rReqId === req.id;
                });
                if (hasApprovedReport) return;

                const reportedReq = reportedAmounts?.byRequest?.[req.id] || 0;
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
                const ket = (getComponentKeterangan(item, rabPlans, expenseItems) || '').toLowerCase();
                return name.includes(q) || desc.includes(q) || reqId.includes(q) || unitName.includes(q) || ket.includes(q);
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
    }, [pendingItems, isSuperAdmin, selectedUnitFilter, pendingSearch, pendingMonthFilter, statusFilter, units, fields, draftReports, budgetReports, rabPlans, expenseItems]);

    // Handle Download Template Import Excel for a single item card
    const handleDownloadItemTemplate = (item) => {
        try {
            const ket = getComponentKeterangan(item, rabPlans, expenseItems);
            const unitPrice = parseFloat(item.sisa > 0 ? item.sisa : item.amount || 0);
            const wsData = [
                ["TEMPLATE IMPORT REALISASI NOTA BELANJA (EXCEL)"],
                ["Nama Item Rincian:", item.name || "-"],
                ["Keterangan Rincian (RAB):", ket || "-"],
                ["Kode Komponen (Component ID):", item.componentId || item.id || "-"],
                ["Kode Pengajuan (REQ ID):", item.reqId || "-"],
                ["Bulan Permintaan:", item.reqMonth || "-"],
                ["Pagu RAB (Rp):", parseFloat(item.amount || 0)],
                ["Sisa Dana Saat Ini (Rp):", item.sisa || 0],
                [],
                ["PETUNJUK: Isi baris transaksi nota di bawah ini (Tanggal bisa format YYYY-MM-DD atau DD-MM-YYYY). Simpan & Import file ini kembali ke sistem."],
                ["No", "Tanggal Realisasi (YYYY-MM-DD)", "Deskripsi / Keterangan Nota", "Nama Toko / Vendor", "Volume", "Satuan", "Harga Satuan (Rp)", "Nominal Belanja (Rp)", "Nomor Nota"],
                [
                    1,
                    new Date().toISOString().split('T')[0],
                    ket ? `${item.name} (${ket})` : `Pembelian ${item.name}`,
                    "Toko A",
                    1,
                    "Pcs",
                    unitPrice,
                    unitPrice,
                    "NOTA-001"
                ]
            ];

            const ws = XLSX.utils.aoa_to_sheet(wsData);
            ws['!cols'] = [
                { wch: 6 },
                { wch: 18 },
                { wch: 35 },
                { wch: 20 },
                { wch: 10 },
                { wch: 10 },
                { wch: 18 },
                { wch: 20 },
                { wch: 15 }
            ];
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
            const ket = getComponentKeterangan(item, rabPlans, expenseItems);
            const itemCompId = item.componentId || item.id;
            const itemReports = (budgetReports || []).filter(r => {
                if (!r || r.isDeleted) return false;
                const resolvedReq = resolveReportRequest(r, budgetRequests, globalAcademicYearId);
                const rReqId = resolvedReq ? resolvedReq.id : (r.budgetRequestId || r.requestId);
                if (rReqId && item.reqId && rReqId !== item.reqId) return false;
                const effCompId = r.componentId || reportedAmounts?.reportCompMap?.[r.id];
                if (effCompId) return effCompId === itemCompId;
                if (itemCompId) {
                    const req = (budgetRequests || []).find(b => b.id === (item.reqId || rReqId));
                    if (req && req.items && req.items.length > 0) {
                        const matchedItem = resolveReportToRequestItem(r, req.items, reportedAmounts?.byRequestComponent, rReqId, rabPlans, expenseItems);
                        if (matchedItem) return (matchedItem.componentId || matchedItem.id) === itemCompId;
                    }
                    return false;
                }
                return rReqId === item.reqId;
            });

            const wsData = [
                ["RINCIAN PELAPORAN REALISASI ANGGARAN (EXCEL)"],
                ["Nama Item Rincian:", item.name || "-"],
                ["Keterangan Rincian (RAB):", ket || "-"],
                ["Kode Komponen (Component ID):", item.componentId || item.id || "-"],
                ["Kode Pengajuan (REQ ID):", item.reqId || "-"],
                ["Bulan Permintaan:", item.reqMonth || "-"],
                ["Pagu RAB (Rp):", parseFloat(item.amount || 0)],
                ["Sisa Dana Saat Ini (Rp):", item.sisa || 0],
                [],
                ["PETUNJUK: Tambahkan atau ubah baris transaksi di bawah ini untuk di-Import ke sistem."],
                ["No", "Tanggal Realisasi (YYYY-MM-DD)", "Deskripsi / Keterangan Nota", "Nama Toko / Vendor", "Volume", "Satuan", "Harga Satuan (Rp)", "Nominal Belanja (Rp)", "Nomor Nota"]
            ];

            if (itemReports.length > 0) {
                itemReports.forEach((r, idx) => {
                    const vol = r.volume ? parseFloat(r.volume) : 1;
                    const amt = parseFloat(r.amount || 0);
                    const hrg = (r.harga !== undefined && r.harga !== null && r.harga !== '')
                        ? parseFloat(r.harga)
                        : (vol > 0 ? Math.round(amt / vol) : 0);
                    wsData.push([
                        idx + 1,
                        r.date ? parseExcelDate(r.date) : new Date().toISOString().split('T')[0],
                        r.description || item.name || '',
                        r.vendor || '-',
                        vol,
                        r.satuan || 'Pcs',
                        hrg,
                        amt,
                        r.nomorNota || '-'
                    ]);
                });
            } else {
                const unitPrice = parseFloat(item.sisa > 0 ? item.sisa : item.amount || 0);
                wsData.push([
                    1,
                    new Date().toISOString().split('T')[0],
                    `Pembelian ${item.name}`,
                    "Toko A",
                    1,
                    "Pcs",
                    unitPrice,
                    unitPrice,
                    "NOTA-001"
                ]);
            }

            const ws = XLSX.utils.aoa_to_sheet(wsData);
            ws['!cols'] = [
                { wch: 6 },
                { wch: 18 },
                { wch: 35 },
                { wch: 20 },
                { wch: 10 },
                { wch: 10 },
                { wch: 18 },
                { wch: 20 },
                { wch: 15 }
            ];
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
        reader.onload = async (evt) => {
            try {
                window.dispatchEvent(new CustomEvent('app-processing-start', { 
                    detail: { 
                        title: 'Mengimpor Nota Excel...', 
                        message: `Sedang memproses dan menyimpan data nota realisasi untuk "${item.name}"...`, 
                        type: 'importing' 
                    } 
                }));

                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary', cellDates: false });
                const sheetName = wb.SheetNames[0];
                const ws = wb.Sheets[sheetName];
                
                const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
                const headerIdx = rows ? rows.findIndex(r => Array.isArray(r) && r.some(cell => {
                    const c = String(cell || '').toLowerCase();
                    return c.includes('tanggal realisasi') || c.includes('nominal belanja') || c.includes('deskripsi');
                })) : -1;
                const minRows = headerIdx !== -1 ? headerIdx + 1 : 9;
                if (!rows || rows.length <= minRows) {
                    alert('Format file Excel tidak sesuai atau belum ada baris transaksi nota.');
                    e.target.value = '';
                    window.dispatchEvent(new CustomEvent('app-processing-end'));
                    return;
                }

                // Dynamic column detection
                let colMap = {
                    date: 1,
                    desc: 2,
                    vendor: 3,
                    volume: 4,
                    satuan: 5,
                    harga: -1,
                    amount: 6,
                    nota: 7
                };

                if (headerIdx !== -1 && rows[headerIdx]) {
                    const hRow = rows[headerIdx];
                    hRow.forEach((cell, idx) => {
                        const title = String(cell || '').trim().toLowerCase();
                        if (title.includes('tanggal')) colMap.date = idx;
                        else if (title.includes('deskripsi') || title.includes('keterangan')) colMap.desc = idx;
                        else if (title.includes('toko') || title.includes('vendor')) colMap.vendor = idx;
                        else if (title.includes('volume') || title.includes('qty') || title.includes('kuantitas')) colMap.volume = idx;
                        else if (title.includes('satuan') && !title.includes('harga')) colMap.satuan = idx;
                        else if (title.includes('harga') || title.includes('tarif')) colMap.harga = idx;
                        else if (title.includes('nominal') || title.includes('total') || title.includes('belanja')) colMap.amount = idx;
                        else if (title.includes('nota') || title.includes('kwitansi') || title.includes('bukti')) colMap.nota = idx;
                    });
                }

                // Fallback column positions if header mapping didn't find specific columns
                if (colMap.harga === -1 && rows[headerIdx + 1] && rows[headerIdx + 1].length >= 9) {
                    colMap.harga = 6;
                    colMap.amount = 7;
                    colMap.nota = 8;
                }

                const transactionRows = headerIdx !== -1 ? rows.slice(headerIdx + 1) : rows.slice(8);
                let importedCount = 0;
                let skippedCount = 0;

                const parentReq = (budgetRequests || []).find(r => r.id === item.reqId);
                const resolvedAcademicYearId = item.academicYearId || parentReq?.academicYearId || globalAcademicYearId;
                const resolvedPlanId = item.planId || parentReq?.planId || (resolvedAcademicYearId && (item.reqUnitId || item.unitId) ? `${resolvedAcademicYearId}-${item.reqUnitId || item.unitId}-${sourceMode}` : null);

                // Anti-duplikasi: track existing in database + track newly added in current batch
                const existingKeys = new Set(
                    (budgetReports || [])
                        .filter(r => !r.isDeleted && r.budgetRequestId === item.reqId)
                        .map(r => `${(r.nomorNota || '').trim().toLowerCase()}_${(r.description || '').trim().toLowerCase()}_${parseFloat(r.amount || 0)}`)
                );

                const newReports = [];

                transactionRows.forEach((row) => {
                    if (!row || row.length < 3) return;

                    const dateVal = parseExcelDate(row[colMap.date]);
                    const descVal = colMap.desc !== -1 && row[colMap.desc] ? String(row[colMap.desc]).trim() : '';
                    const vendorVal = colMap.vendor !== -1 && row[colMap.vendor] ? String(row[colMap.vendor]).trim() : '';
                    const volVal = colMap.volume !== -1 && row[colMap.volume] ? parseFloat(String(row[colMap.volume]).replace(/[^0-9.-]+/g, '')) || 1 : 1;
                    const satuanVal = colMap.satuan !== -1 && row[colMap.satuan] ? String(row[colMap.satuan]).trim() : 'Pcs';

                    let rawHarga = colMap.harga !== -1 && row[colMap.harga] !== undefined ? parseFloat(String(row[colMap.harga]).replace(/[^0-9.-]+/g, '')) : null;
                    let rawAmount = colMap.amount !== -1 && row[colMap.amount] !== undefined ? parseFloat(String(row[colMap.amount]).replace(/[^0-9.-]+/g, '')) : null;

                    if (isNaN(rawHarga)) rawHarga = null;
                    if (isNaN(rawAmount)) rawAmount = null;

                    let hargaVal = 0;
                    let amountVal = 0;

                    if (rawAmount !== null && rawAmount > 0) {
                        amountVal = rawAmount;
                        if (rawHarga !== null && rawHarga > 0) {
                            hargaVal = rawHarga;
                        } else {
                            hargaVal = volVal > 0 ? Math.round(amountVal / volVal) : amountVal;
                        }
                    } else if (rawHarga !== null && rawHarga > 0) {
                        hargaVal = rawHarga;
                        amountVal = Math.round(volVal * hargaVal);
                    }

                    const notaVal = colMap.nota !== -1 && row[colMap.nota] ? String(row[colMap.nota]).trim() : '';

                    if (!descVal || amountVal <= 0) return;

                    const rowKey = `${notaVal.toLowerCase()}_${descVal.toLowerCase()}_${amountVal}`;
                    if (existingKeys.has(rowKey)) {
                        skippedCount++;
                        return;
                    }
                    existingKeys.add(rowKey);

                    const newReport = {
                        id: `REL-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                        budgetRequestId: item.reqId,
                        componentId: item.componentId || item.id || null,
                        expenseItemId: item.expenseItemId || null,
                        category: item.name,
                        date: dateVal,
                        description: descVal,
                        vendor: vendorVal,
                        volume: volVal,
                        satuan: satuanVal,
                        harga: hargaVal,
                        amount: amountVal,
                        nomorNota: notaVal,
                        status: 'DRAFT',
                        createdAt: new Date().toISOString(),
                        unitId: item.reqUnitId || item.unitId || parentReq?.unitId || null,
                        fieldId: item.fieldId || parentReq?.fieldId || null,
                        academicYearId: resolvedAcademicYearId,
                        planId: resolvedPlanId,
                        source: sourceMode
                    };

                    newReports.push(newReport);
                    importedCount++;
                });

                if (newReports.length > 0) {
                    for (const nr of newReports) {
                        dispatch({ type: 'ADD_BUDGET_REPORT', payload: nr });
                        await api.pushAction({ type: 'ADD_BUDGET_REPORT', payload: nr }, state);
                    }
                    const updatedAllReports = [...(budgetReports || []), ...newReports];
                    await api.syncWholeState({ ...state, budgetReports: updatedAllReports });
                }

                if (importedCount > 0) {
                    const skipMsg = skippedCount > 0 ? ` (${skippedCount} nota dilewati karena sudah ada/duplikat).` : '.';
                    alert(`Berhasil mengimpor ${importedCount} nota realisasi untuk "${item.name}"! Data telah tersimpan sebagai Draft Nota${skipMsg}`);
                } else if (skippedCount > 0) {
                    alert(`Semua ${skippedCount} nota pada file Excel dilewati karena sudah ada sebelumnya.`);
                } else {
                    alert('Tidak ada data nota valid yang ditemukan pada file Excel.');
                }
            } catch (err) {
                console.error('Import Error:', err);
                alert('Gagal mengunggah file Excel: ' + err.message);
            } finally {
                e.target.value = '';
                window.dispatchEvent(new CustomEvent('app-processing-end'));
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
        if (window.confirm(`Setujui ${selectedReportIds.length} laporan terpilih sekaligus?\n\nJurnal pengeluaran otomatis dicatat ke pembukuan akuntansi sesuai COA yang telah disahkan.`)) {
            setProcessingId('BULK');
            window.dispatchEvent(new CustomEvent('app-processing-start', { 
                detail: { 
                    title: 'Memproses ACC Superadmin...', 
                    message: `Mohon tunggu sebentar, ${selectedReportIds.length} laporan sedang diverifikasi dan dicatat ke server...`, 
                    type: 'approving' 
                } 
            }));
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
                window.dispatchEvent(new CustomEvent('app-processing-end'));
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
        if (isSuperAdmin) {
            if (e.target.checked) {
                setSelectedHistoryCancelIds(filteredReports.filter(r => r.status === 'APPROVED' || r.status === 'PENDING').map(r => r.id));
            } else {
                setSelectedHistoryCancelIds([]);
            }
        } else {
            if (e.target.checked) {
                const drafts = filteredReports.filter(r => r.status === 'DRAFT').map(r => r.id);
                const pendings = filteredReports.filter(r => r.status === 'PENDING').map(r => r.id);
                setSelectedHistoryIds(drafts);
                setSelectedHistoryPendingIds(pendings);
            } else {
                setSelectedHistoryIds([]);
                setSelectedHistoryPendingIds([]);
            }
        }
    };

    const handleToggleSelectHistory = (id) => {
        const r = budgetReports.find(x => x.id === id);
        if (r && r.status === 'PENDING') {
            setSelectedHistoryPendingIds(prev => 
                prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
            );
        } else {
            setSelectedHistoryIds(prev => 
                prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
            );
        }
    };

    const handleToggleSelectHistoryCancel = (id) => {
        setSelectedHistoryCancelIds(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleWithdrawReportSubmission = async (report) => {
        if (!window.confirm(`Batalkan pengajuan laporan nota "${report.nomorNota || report.category}"?\n\nStatus laporan akan dikembalikan ke DRAFT agar bisa Anda ubah.`)) return;
        setProcessingId(report.id);
        try {
            const updated = { ...report, status: 'DRAFT', notified: false };
            dispatch({ type: 'EDIT_BUDGET_REPORT', payload: updated });
            await api.pushAction({ type: 'EDIT_BUDGET_REPORT', payload: updated }, state);

            const newBudgetReports = (budgetReports || []).map(r => r.id === report.id ? updated : r);
            await api.syncWholeState({ ...state, budgetReports: newBudgetReports });

            alert('Pengajuan laporan berhasil dibatalkan dan dikembalikan ke DRAFT.');
        } catch (err) {
            alert('Gagal membatalkan pengajuan: ' + err.message);
        } finally {
            setProcessingId(null);
        }
    };

    const handleBulkSubmitHistory = async () => {
        if (selectedHistoryIds.length === 0) {
            return alert('Pilih/centang minimal satu laporan draft yang ingin diajukan terlebih dahulu!');
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

    const handleBulkWithdrawHistory = async () => {
        if (selectedHistoryPendingIds.length === 0) {
            return alert('Pilih/centang minimal satu laporan berstatus MENUNGGU untuk dibatalkan pengajuannya!');
        }
        if (window.confirm(`Batalkan pengajuan ${selectedHistoryPendingIds.length} laporan terpilih?\n\nStatus laporan akan dikembalikan ke DRAFT.`)) {
            setProcessingId('BULK_WITHDRAW');
            try {
                const updatedReportsMap = new Map();
                for (const id of selectedHistoryPendingIds) {
                    const r = budgetReports.find(x => x.id === id);
                    if (r && r.status === 'PENDING') {
                        const updated = { ...r, status: 'DRAFT', notified: false };
                        updatedReportsMap.set(id, updated);
                        dispatch({ type: 'EDIT_BUDGET_REPORT', payload: updated });
                        await api.pushAction({ type: 'EDIT_BUDGET_REPORT', payload: updated }, state);
                    }
                }

                const newBudgetReports = (budgetReports || []).map(r => updatedReportsMap.get(r.id) || r);
                await api.syncWholeState({ ...state, budgetReports: newBudgetReports });

                alert(`${selectedHistoryPendingIds.length} pengajuan laporan berhasil dibatalkan dan dikembalikan ke DRAFT!`);
                setSelectedHistoryPendingIds([]);
            } catch (err) {
                alert('Gagal membatalkan pengajuan laporan: ' + err.message);
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
            const updatedReportsMap = new Map();
            const successIds = new Set(result.success || []);
            successIds.forEach(id => {
                const r = budgetReports.find(x => x.id === id);
                if (r) {
                    const updated = { ...r, status: 'PENDING', journalId: null, notified: false };
                    updatedReportsMap.set(id, updated);
                    dispatch({ type: 'EDIT_BUDGET_REPORT', payload: updated });
                }
            });

            const newBudgetReports = (budgetReports || []).map(r => updatedReportsMap.get(r.id) || r);
            await api.syncWholeState({ ...state, budgetReports: newBudgetReports });

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
            if (rel.isDeleted || rel.status === 'DELETED') return false;

            // Filter by source
            const isBosReport = rel.source === 'BOS' || rel.planId?.endsWith('-BOS');
            if (sourceMode === 'BOS' && !isBosReport) return false;
            if (sourceMode === 'YAYASAN' && isBosReport) return false;

            const resolvedReq = resolveReportRequest(rel, budgetRequests, globalAcademicYearId) || (budgetRequests || []).find(r => r.id === (rel.budgetRequestId || rel.requestId));
            const reportUnitId = rel.unitId || resolvedReq?.unitId;
            const reportFieldId = rel.fieldId || resolvedReq?.fieldId;

            if (isSuperAdmin) {
                if (selectedUnitFilter !== 'ALL') {
                    return reportUnitId === selectedUnitFilter || reportFieldId === selectedUnitFilter;
                }
                return true;
            }
            if (myUnitId) return reportUnitId === myUnitId;
            if (myFieldId) return reportFieldId === myFieldId;
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
                const req = resolveReportRequest(r, budgetRequests, globalAcademicYearId);
                return req?.month === filterRequestMonth;
            })();
            const rDate = r.date ? new Date(r.date) : null;
            const matchFrom = !filterDateFrom || (rDate && rDate >= new Date(filterDateFrom));
            const matchTo = !filterDateTo || (rDate && rDate <= new Date(filterDateTo));
            return matchSearch && matchKategori && matchRequestMonth && matchFrom && matchTo;
        });
    }, [baseReports, search, filterKategori, filterRequestMonth, filterDateFrom, filterDateTo, budgetRequests, globalAcademicYearId]);

    // Summary stats for history
    const totalNilai = filteredReports.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
    const totalAset = filteredReports.filter(r => r.kategoriAset === 'ASET').length;
    const totalNonAset = filteredReports.filter(r => r.kategoriAset !== 'ASET').length;

    const approvedReqsInFilter = useMemo(() => {
        return requestsForYear
            .filter(r => r.status === 'APPROVED')
            .filter(r => pendingMonthFilter === 'ALL' || r.month === pendingMonthFilter)
            .filter(r => !isSuperAdmin || selectedUnitFilter === 'ALL' || r.unitId === selectedUnitFilter || r.fieldId === selectedUnitFilter);
    }, [requestsForYear, pendingMonthFilter, isSuperAdmin, selectedUnitFilter]);

    const totalCair = useMemo(() => {
        return approvedReqsInFilter.reduce((s, r) => s + parseFloat(r.totalAmount || 0), 0);
    }, [approvedReqsInFilter]);

    const totalPengeluaran = useMemo(() => {
        return baseReports.filter(r => {
            if (r.kategoriAset === 'PENGEMBALIAN' || r.status === 'REJECTED' || r.isDeleted) return false;
            if (pendingMonthFilter !== 'ALL') {
                const req = resolveReportRequest(r, budgetRequests, globalAcademicYearId);
                if (req) {
                    return req.month === pendingMonthFilter;
                }
                return r.date ? r.date.startsWith(pendingMonthFilter) : false;
            }
            return true;
        }).reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
    }, [baseReports, pendingMonthFilter, budgetRequests, globalAcademicYearId]);

    const totalPengembalian = useMemo(() => {
        return baseReports.filter(r => {
            if (r.kategoriAset !== 'PENGEMBALIAN' || r.status === 'REJECTED' || r.isDeleted) return false;
            if (pendingMonthFilter !== 'ALL') {
                const req = resolveReportRequest(r, budgetRequests, globalAcademicYearId);
                if (req) {
                    return req.month === pendingMonthFilter;
                }
                return r.date ? r.date.startsWith(pendingMonthFilter) : false;
            }
            return true;
        }).reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
    }, [baseReports, pendingMonthFilter, budgetRequests, globalAcademicYearId]);

    const totalSisa = useMemo(() => {
        return Math.max(0, totalCair - totalPengeluaran - totalPengembalian);
    }, [totalCair, totalPengeluaran, totalPengembalian]);

    const totalSisaActiveItems = useMemo(() => {
        return filteredPendingItems.reduce((sum, item) => sum + Math.max(0, parseFloat(item.sisa || 0)), 0);
    }, [filteredPendingItems]);

    const rawDiffSisa = useMemo(() => {
        return totalCair - totalPengeluaran - totalPengembalian;
    }, [totalCair, totalPengeluaran, totalPengembalian]);

    const totalOverSpentActiveItems = useMemo(() => {
        return filteredPendingItems.reduce((sum, item) => {
            const sisa = parseFloat(item.sisa || 0);
            return sisa < 0 ? sum + Math.abs(sisa) : sum;
        }, 0);
    }, [filteredPendingItems]);

    const actualPriorOverReturn = useMemo(() => {
        if (totalSisaActiveItems > totalSisa) {
            const diff = totalSisaActiveItems - totalSisa;
            return Math.max(0, diff - totalOverSpentActiveItems);
        }
        return 0;
    }, [totalSisaActiveItems, totalSisa, totalOverSpentActiveItems]);

    const totalSisaForHistory = useMemo(() => {
        const approvedReqsInHistoryFilter = requestsForYear
            .filter(r => r.status === 'APPROVED')
            .filter(r => filterRequestMonth === 'ALL' || r.month === filterRequestMonth)
            .filter(r => !isSuperAdmin || selectedUnitFilter === 'ALL' || r.unitId === selectedUnitFilter || r.fieldId === selectedUnitFilter);

        const totalCairHistory = approvedReqsInHistoryFilter.reduce((s, r) => s + parseFloat(r.totalAmount || 0), 0);

        const totalPengeluaranHistory = baseReports.filter(r => {
            if (r.kategoriAset === 'PENGEMBALIAN' || r.status === 'REJECTED' || r.isDeleted) return false;
            if (filterRequestMonth !== 'ALL') {
                const req = resolveReportRequest(r, budgetRequests, globalAcademicYearId);
                if (req) {
                    return req.month === filterRequestMonth;
                }
                return r.date ? r.date.startsWith(filterRequestMonth) : false;
            }
            return true;
        }).reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

        const totalPengembalianHistory = baseReports.filter(r => {
            if (r.kategoriAset !== 'PENGEMBALIAN' || r.status === 'REJECTED' || r.isDeleted) return false;
            if (filterRequestMonth !== 'ALL') {
                const req = resolveReportRequest(r, budgetRequests, globalAcademicYearId);
                if (req) {
                    return req.month === filterRequestMonth;
                }
                return r.date ? r.date.startsWith(filterRequestMonth) : false;
            }
            return true;
        }).reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

        return Math.max(0, totalCairHistory - totalPengeluaranHistory - totalPengembalianHistory);
    }, [requestsForYear, filterRequestMonth, isSuperAdmin, selectedUnitFilter, baseReports, budgetRequests, globalAcademicYearId]);

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

        const expItem = expenseItems.find(e => e.id === item.expenseItemId || e.id === item.mataAnggaranId);
        const debitAcc = accounts.find(a => a.id === item.coaId || a.id === item.accountId || a.id === expItem?.coaId || a.id === expItem?.accountId || a.code === expItem?.code);
        const defaultAsset = getAssetDefaultDetails({
            item,
            expenseItem: expItem,
            account: debitAcc,
            assetCategories
        });

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
            kategoriAset: defaultAsset.isAsset ? 'ASET' : 'NON_ASET',
            umurEkonomis: defaultAsset.isAsset ? (defaultAsset.umurEkonomis || '4') : ''
        });
        setShowReportForm(true);
    };

    const handleEditDraft = (draft) => {
        const req = resolveReportRequest(draft, budgetRequests, globalAcademicYearId) || budgetRequests.find(r => r.id === draft.budgetRequestId);
        if (!req) return alert("Data induk tidak ditemukan!");
        
        let item = { 
            reqId: req.id, 
            sisa: parseFloat(draft.amount || 0), 
            reqDescription: req.description, 
            name: draft.category, 
            reqUnitId: draft.unitId || req.unitId, 
            fieldId: draft.fieldId || req.fieldId, 
            expenseItemId: draft.expenseItemId || req.expenseItemId, 
            planId: draft.planId || req.planId, 
            componentId: draft.componentId 
        };
        const matchedReqItem = (draft.componentId && req.items?.find(i => (i.componentId || i.id) === draft.componentId))
            || resolveReportToRequestItem(draft, req.items);
        if (matchedReqItem) {
            const isRejected = draft.status === 'REJECTED';
            const compId = matchedReqItem.componentId || matchedReqItem.id;
            const reqCompKey = `${req.id}_${compId}`;
            const reportedCompVal = reportedAmounts.byRequestComponent?.[reqCompKey] || 0;
            const reportedComp = reportedCompVal - (isRejected ? 0 : parseFloat(draft.amount || 0));
            item = { 
                ...matchedReqItem, 
                ...item, 
                componentId: compId,
                name: matchedReqItem.name || draft.category,
                expenseItemId: matchedReqItem.expenseItemId || item.expenseItemId,
                sisa: parseFloat(matchedReqItem.amount || 0) - reportedComp 
            };
        }
        
        setSelectedRequest(item);
        setEditingDraftId(draft.id);

        const expItem = expenseItems.find(e => e.id === item.expenseItemId || e.id === item.mataAnggaranId);
        const debitAcc = accounts.find(a => a.id === item.coaId || a.id === item.accountId || a.id === expItem?.coaId || a.id === expItem?.accountId || a.code === expItem?.code);
        const defaultAsset = getAssetDefaultDetails({
            item,
            expenseItem: expItem,
            account: debitAcc,
            assetCategories
        });
        const initialKategori = draft.kategoriAset || (defaultAsset.isAsset ? 'ASET' : 'NON_ASET');
        const initialUmur = draft.umurEkonomis || (initialKategori === 'ASET' ? (defaultAsset.umurEkonomis || '4') : '');

        const currentVol = parseFloat(draft.volume || 1);
        const currentAmt = parseFloat(draft.amount || 0);
        const computedHarga = (draft.harga !== undefined && draft.harga !== null && draft.harga !== '' && parseFloat(draft.harga) > 0)
            ? draft.harga
            : (currentVol > 0 && currentAmt > 0 ? Math.round(currentAmt / currentVol) : '');

        setFormData({
            date: draft.date ? parseExcelDate(draft.date) : new Date().toISOString().split('T')[0],
            amount: currentAmt,
            description: draft.description || '',
            buktiTeks: draft.buktiTeks || '',
            nomorNota: draft.nomorNota || '',
            volume: draft.volume || 1,
            satuan: draft.satuan || 'Pcs',
            harga: computedHarga,
            diskon: draft.diskon || '',
            kategoriAset: initialKategori,
            umurEkonomis: initialUmur
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

    const handleReportSubmit = async (e) => {
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
            .filter(r => {
                if (r.status === 'REJECTED' || r.isDeleted) return false;
                const resolved = resolveReportRequest(r, budgetRequests, globalAcademicYearId);
                if (resolved) return resolved.id === selectedRequest.reqId;
                return r.budgetRequestId === selectedRequest.reqId;
            })
            .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

        const sisaDanaPengajuan = totalApproved - totalReportedForReq + currentDraftAmount;
        
        if (parseFloat(formData.amount) > sisaDanaPengajuan) {
            if (!isSuperAdmin) {
                return alert(`Gagal menyimpan: Jumlah realisasi (${formatRupiah(parseFloat(formData.amount))}) melebihi sisa total pengajuan dana yang tersedia (${formatRupiah(sisaDanaPengajuan)}).\n\nPeriksa kembali apakah ada rincian belanja lain yang melebihi pagu.`);
            } else {
                if (!window.confirm(`PERINGATAN SUPERADMIN: Jumlah realisasi (${formatRupiah(parseFloat(formData.amount))}) melebihi sisa plafon pengajuan (${formatRupiah(sisaDanaPengajuan)}).\n\nApakah Anda yakin ingin tetap menyimpan penyesuaian nota ini?`)) {
                    return;
                }
            }
        }

        const effectiveStatus = editingReport 
            ? editingReport.status 
            : (isSuperAdmin ? 'APPROVED' : 'DRAFT');

        const reportData = {
            id: editingDraftId || `REL-${Date.now()}`,
            requestId: selectedRequest.reqId,
            budgetRequestId: selectedRequest.reqId,
            componentId: selectedRequest.componentId,
            unitId: selectedRequest.reqUnitId || selectedRequest.unitId || parentReq?.unitId || null,
            fieldId: selectedRequest.fieldId || parentReq?.fieldId || null,
            academicYearId: globalAcademicYearId,
            planId: selectedRequest.planId || parentReq?.planId,
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
            status: effectiveStatus,
            journalId: editingReport?.journalId || null,
            expenseItemId: selectedRequest.expenseItemId
        };

        try {
            if (editingDraftId) {
                dispatch({ type: 'EDIT_BUDGET_REPORT', payload: reportData });
                await api.pushAction({ type: 'EDIT_BUDGET_REPORT', payload: reportData }, state);
            } else {
                dispatch({ type: 'ADD_BUDGET_REPORT', payload: reportData });
                await api.pushAction({ type: 'ADD_BUDGET_REPORT', payload: reportData }, state);
            }

            alert(`Nota No. ${reportData.nomorNota || '-'} sebesar ${formatRupiah(reportData.amount)} berhasil disimpan sebagai ${isSuperAdmin ? 'Laporan Terverifikasi' : 'Draft'}.`);
            setShowReportForm(false);
            setEditingDraftId(null);
        } catch (err) {
            console.error('Save report failed:', err);
            alert('Gagal menyimpan nota: ' + (err.message || 'Terjadi kesalahan server atau koneksi jaringan.'));
        }
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

    const handleDeleteDraft = async (id) => {
        if (window.confirm('Hapus nota (draft) ini? Saldo sisa dana akan kembali seperti semula.')) {
            try {
                setProcessingId(id);
                await api.pushAction({ type: 'DELETE_BUDGET_REPORT', payload: id }, state);
                dispatch({ type: 'DELETE_BUDGET_REPORT', payload: id });
            } catch (err) {
                console.error('Delete draft failed:', err);
                alert('Gagal menghapus nota: ' + (err.message || 'Terjadi kesalahan pada server.'));
            } finally {
                setProcessingId(null);
            }
        }
    };

    const handleBulkDeleteDrafts = async () => {
        if (selectedHistoryIds.length === 0) return alert('Pilih draft yang ingin dihapus.');
        if (window.confirm(`Hapus ${selectedHistoryIds.length} draft laporan terpilih? Saldo sisa dana akan kembali seperti semula.`)) {
            try {
                setProcessingId('BULK_DELETE_DRAFTS');
                for (const id of selectedHistoryIds) {
                    await api.pushAction({ type: 'DELETE_BUDGET_REPORT', payload: id }, state);
                    dispatch({ type: 'DELETE_BUDGET_REPORT', payload: id });
                }
                alert(`${selectedHistoryIds.length} draft laporan berhasil dihapus.`);
                setSelectedHistoryIds([]);
            } catch (err) {
                console.error('Bulk delete drafts failed:', err);
                alert('Gagal menghapus draft: ' + (err.message || 'Terjadi kesalahan pada server.'));
            } finally {
                setProcessingId(null);
            }
        }
    };

    const handleDeleteReportSuperadmin = async (report) => {
        if (window.confirm(`PERINGATAN SUPERADMIN: Apakah Anda yakin ingin MENGHAPUS PERMANEN laporan nota "${report.nomorNota || '-'} - ${report.description || report.category}" ini?\n\nJurnal akuntansi terkait (jika ada) juga akan otomatis dibatalkan/dihapus.`)) {
            try {
                setProcessingId(report.id);
                await api.pushAction({ type: 'DELETE_BUDGET_REPORT', payload: report.id }, state);
                dispatch({ type: 'DELETE_BUDGET_REPORT', payload: report.id });
                alert('Laporan berhasil dihapus.');
            } catch (err) {
                console.error('Superadmin delete failed:', err);
                alert('Gagal menghapus laporan: ' + (err.message || 'Terjadi kesalahan pada server.'));
            } finally {
                setProcessingId(null);
            }
        }
    };

    const handleBulkDeleteSuperadmin = async () => {
        if (selectedHistoryCancelIds.length === 0) return alert('Pilih laporan yang ingin dihapus.');
        if (window.confirm(`PERINGATAN SUPERADMIN: Apakah Anda yakin ingin MENGHAPUS ${selectedHistoryCancelIds.length} laporan terpilih?\n\nSemua jurnal terkait akan otomatis dihapus.`)) {
            try {
                setProcessingId('BULK_DELETE');
                for (const id of selectedHistoryCancelIds) {
                    await api.pushAction({ type: 'DELETE_BUDGET_REPORT', payload: id }, state);
                    dispatch({ type: 'DELETE_BUDGET_REPORT', payload: id });
                }
                alert(`${selectedHistoryCancelIds.length} laporan berhasil dihapus.`);
                setSelectedHistoryCancelIds([]);
            } catch (err) {
                console.error('Bulk delete failed:', err);
                alert('Gagal menghapus laporan: ' + (err.message || 'Terjadi kesalahan.'));
            } finally {
                setProcessingId(null);
            }
        }
    };

    const handleApproveReport = async (report) => {
        if (window.confirm(`Setujui laporan nota "${report.nomorNota || report.description || '-'}" ini?\n\nJurnal pengeluaran otomatis dicatat ke pembukuan akuntansi sesuai COA yang telah disahkan.`)) {
            setProcessingId(report.id);
            window.dispatchEvent(new CustomEvent('app-processing-start', { 
                detail: { 
                    title: 'Memproses ACC Superadmin...', 
                    message: 'Mohon tunggu sebentar, Laporan Pengeluaran sedang diverifikasi & disetujui...', 
                    type: 'approving' 
                } 
            }));
            try {
                const updated = { ...report, status: 'APPROVED', notified: false };
                dispatch({ type: 'EDIT_BUDGET_REPORT', payload: updated });
                await api.pushAction({ type: 'EDIT_BUDGET_REPORT', payload: updated }, state);
                const newBudgetReports = (budgetReports || []).map(r => r.id === report.id ? updated : r);
                await api.syncWholeState({ ...state, budgetReports: newBudgetReports });
                alert('Laporan berhasil disetujui!');
            } catch (error) {
                console.error(error);
                alert('Gagal menyetujui laporan: ' + error.message);
            } finally {
                setProcessingId(null);
                window.dispatchEvent(new CustomEvent('app-processing-end'));
            }
        }
    };

    const handleRejectReport = async (report) => {
        if (window.confirm('Tolak laporan ini? Saldo unit akan dikembalikan.')) {
            setProcessingId(report.id);
            window.dispatchEvent(new CustomEvent('app-processing-start', { 
                detail: { 
                    title: 'Memproses Penolakan Laporan...', 
                    message: 'Mohon tunggu sebentar, status penolakan laporan sedang dikirim...', 
                    type: 'rejecting' 
                } 
            }));
            try {
                const updated = { ...report, status: 'REJECTED', notified: false };
                dispatch({ type: 'EDIT_BUDGET_REPORT', payload: updated });
                await api.pushAction({ type: 'EDIT_BUDGET_REPORT', payload: updated }, state);
                const newBudgetReports = (budgetReports || []).map(r => r.id === report.id ? updated : r);
                await api.syncWholeState({ ...state, budgetReports: newBudgetReports });
                alert('Laporan berhasil ditolak');
            } catch (error) {
                console.error(error);
                alert('Gagal menolak laporan: ' + error.message);
            } finally {
                setProcessingId(null);
                window.dispatchEvent(new CustomEvent('app-processing-end'));
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

            const req = resolveReportRequest(report, budgetRequests, globalAcademicYearId);
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
                        className={`px-6 py-2 rounded-xl font-black text-xs transition-all cursor-pointer ${activeTab === 'pending' ? 'bg-white text-blue-600 shadow-sm shadow-blue-500/5' : 'text-slate-500'}`}
                    >
                        Perlu Dilaporkan
                        {filteredPendingItems.length > 0 && (
                            <span className="ml-2 bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{filteredPendingItems.length}</span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`px-6 py-2 rounded-xl font-black text-xs transition-all cursor-pointer ${activeTab === 'history' ? 'bg-white text-blue-600 shadow-sm shadow-blue-500/5' : 'text-slate-500'}`}
                    >
                        Riwayat Laporan
                    </button>
                    {isSuperAdmin && (
                        <button
                            onClick={() => setActiveTab('verification')}
                            className={`px-6 py-2 rounded-xl font-black text-xs transition-all cursor-pointer ${activeTab === 'verification' ? 'bg-white text-indigo-600 shadow-sm shadow-indigo-500/5' : 'text-slate-500'}`}
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
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h4 className="font-black text-slate-900 text-xl">{item.name}</h4>
                                            {item.volume && item.satuan && item.harga && (
                                                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">
                                                    {item.volume} {item.satuan} @ {formatRupiah(item.harga)}
                                                </span>
                                            )}
                                        </div>
                                        {item.sisa <= 0 && (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full text-[10px] font-black uppercase tracking-wider">
                                                <CheckCircle2 size={12} /> Selesai / Lunas
                                            </span>
                                        )}
                                    </div>
                                    {(() => {
                                        const ket = getComponentKeterangan(item, rabPlans, expenseItems);
                                        if (!ket) return null;
                                        return (
                                            <div className="flex items-center gap-1.5 my-2 text-xs font-bold text-indigo-700 bg-indigo-50/80 border border-indigo-100 px-3 py-1.5 rounded-xl w-fit shadow-xs">
                                                <Tag size={13} className="shrink-0 text-indigo-500" />
                                                <span><strong className="text-indigo-950 font-black">Keterangan:</strong> {ket}</span>
                                            </div>
                                        );
                                    })()}
                                    <div className="flex flex-wrap items-center gap-3 text-slate-400 text-xs font-bold">
                                        <span className="flex items-center gap-1" title="Tanggal pembuatan surat pengajuan"><History size={14} /> Tgl Buat: {item.reqDate ? item.reqDate.split('T')[0] : '—'}</span>
                                        {item.reqMonth && (
                                            <span className="flex items-center gap-1 px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-black border border-blue-100">
                                                <Calendar size={12} /> Permintaan: {item.reqMonth}
                                            </span>
                                        )}
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
                                </div>

                                <div className="text-right shrink-0">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Sisa Dana Rincian</p>
                                    <h4 className={`text-2xl font-black mb-1 ${item.sisa < 0 ? 'text-rose-600' : 'text-blue-700'}`}>{formatRupiah(item.sisa)}</h4>
                                    <p className="text-[10px] font-bold text-slate-400 mb-4">RAB: {formatRupiah(parseFloat(item.amount || 0))}</p>
                                    <div className="flex flex-col gap-2 mt-2 w-full">
                                        {item.sisa <= 0 ? (
                                            isSuperAdmin ? (
                                                <button
                                                    onClick={() => handleOpenReportForm(item)}
                                                    className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm w-full"
                                                    title="Plafon rincian sudah terpenuhi, klik untuk menambahkan nota susulan/penyesuaian"
                                                >
                                                    <FileCheck size={15} />
                                                    <span>+ Nota Susulan</span>
                                                </button>
                                            ) : (
                                                <div className="px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm">
                                                    <CheckCircle2 size={15} />
                                                    <span>100% Selesai Dilaporkan</span>
                                                </div>
                                            )
                                        ) : (
                                            <button
                                                onClick={() => handleOpenReportForm(item)}
                                                className="btn btn-primary !rounded-xl !py-2 !text-xs !w-full"
                                            >
                                                <FileCheck size={16} />
                                                <span>{isSuperAdmin ? '+ Input Nota' : 'Buat Laporan'}</span>
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
                                <span>Statistik Laporan {pendingMonthFilter !== 'ALL' ? `(${monthOptions.find(m => m.id === pendingMonthFilter)?.label || pendingMonthFilter})` : ''}</span>
                                <ArrowUpRight size={14} />
                            </h4>
                            <div className="space-y-5">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-400">Total Cair</span>
                                    <span className="text-sm font-black text-slate-700">{formatRupiah(totalCair)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-400">Total Pengeluaran</span>
                                    <span className="text-sm font-black text-emerald-600">{formatRupiah(totalPengeluaran)}</span>
                                </div>
                                <div className="flex justify-between items-center border-t border-slate-100 pt-4">
                                    <span className="text-xs font-bold text-slate-400">Total Sisa</span>
                                    <span className="text-sm font-black text-amber-500">{formatRupiah(totalSisa)}</span>
                                </div>
                                {(totalOverSpentActiveItems > 0 || actualPriorOverReturn > 0) && (
                                    <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3 text-[11px] space-y-1.5 animate-in fade-in">
                                        <div className="flex justify-between items-center font-bold text-slate-600">
                                            <span>Sisa Rincian Belum Selesai:</span>
                                            <span className="text-slate-800">{formatRupiah(totalSisaActiveItems)}</span>
                                        </div>
                                        {totalOverSpentActiveItems > 0 && (
                                            <div className="flex justify-between items-center font-bold text-rose-600">
                                                <span>Kelebihan Belanja Rincian (Over-Pagu):</span>
                                                <span>- {formatRupiah(totalOverSpentActiveItems)}</span>
                                            </div>
                                        )}
                                        {actualPriorOverReturn > 0 && (
                                            <div className="flex justify-between items-center font-bold text-rose-600">
                                                <span>Lebih Setor Periode Lalu:</span>
                                                <span>- {formatRupiah(actualPriorOverReturn)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between items-center font-black text-amber-800 border-t border-amber-200 pt-1">
                                            <span>Sisa Kas Wajib Disetor:</span>
                                            <span>{formatRupiah(totalSisa)}</span>
                                        </div>
                                    </div>
                                )}
                                {rawDiffSisa < 0 && (
                                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-[11px] flex justify-between items-center animate-in fade-in">
                                        <span className="font-bold text-rose-700">Lebih Setor Pengembalian:</span>
                                        <span className="font-black text-rose-700">+{formatRupiah(Math.abs(rawDiffSisa))}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center border-t border-slate-100 pt-4">
                                    <span className="text-xs font-bold text-slate-400">Total Pengembalian</span>
                                    <span className="text-sm font-black text-indigo-600">{formatRupiah(totalPengembalian)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            ) : activeTab === 'history' ? (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {[
                            { label: 'Total Laporan', value: filteredReports.length, unit: 'transaksi', color: 'border-l-indigo-500' },
                            { label: 'Total Nilai', value: formatRupiah(totalNilai), unit: '', color: 'border-l-slate-400' },
                            { label: 'Total Sisa', value: formatRupiah(totalSisaForHistory), unit: '', color: 'border-l-amber-500' },
                            { label: 'Kategori Aset', value: totalAset, unit: 'transaksi', color: 'border-l-emerald-500' },
                            { label: 'Non Aset', value: totalNonAset, unit: 'transaksi', color: 'border-l-blue-500' },
                        ].map((s, i) => (
                            <div key={i} className={`card p-5 border-l-4 ${s.color}`}>
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
                                    <>
                                        <button 
                                            onClick={handleBulkSubmitHistory} 
                                            disabled={processingId === 'BULK_HISTORY'}
                                            className="px-3 py-1.5 bg-indigo-500 text-white font-black text-[9px] uppercase tracking-widest rounded-lg hover:bg-indigo-600 transition-colors shadow-sm shadow-indigo-500/30">
                                            {processingId === 'BULK_HISTORY' ? 'Memproses...' : `Ajukan ${selectedHistoryIds.length} Draft Terpilih`}
                                        </button>
                                        <button 
                                            onClick={handleBulkDeleteDrafts} 
                                            disabled={processingId === 'BULK_DELETE_DRAFTS'}
                                            className="px-3 py-1.5 bg-rose-600 text-white font-black text-[9px] uppercase tracking-widest rounded-lg hover:bg-rose-700 transition-colors shadow-sm shadow-rose-600/30">
                                            {processingId === 'BULK_DELETE_DRAFTS' ? 'Memproses...' : `Hapus ${selectedHistoryIds.length} Draft`}
                                        </button>
                                    </>
                                )}
                                {!isSuperAdmin && selectedHistoryPendingIds.length > 0 && (
                                    <button 
                                        onClick={handleBulkWithdrawHistory} 
                                        disabled={processingId === 'BULK_WITHDRAW'}
                                        className="px-3 py-1.5 bg-amber-600 text-white font-black text-[9px] uppercase tracking-widest rounded-lg hover:bg-amber-700 transition-colors shadow-sm shadow-amber-600/30">
                                        {processingId === 'BULK_WITHDRAW' ? 'Memproses...' : `Batalkan Ajukan ${selectedHistoryPendingIds.length} Terpilih`}
                                    </button>
                                )}
                                {isSuperAdmin && selectedHistoryCancelIds.length > 0 && (
                                    <>
                                        <button 
                                            onClick={handleBulkCancelApproval} 
                                            disabled={processingId === 'BULK_CANCEL'}
                                            className="px-3 py-1.5 bg-amber-600 text-white font-black text-[9px] uppercase tracking-widest rounded-lg hover:bg-amber-700 transition-colors shadow-sm shadow-amber-600/30">
                                            {processingId === 'BULK_CANCEL' ? 'Memproses...' : `Batalkan Verifikasi ${selectedHistoryCancelIds.length} Terpilih`}
                                        </button>
                                        <button 
                                            onClick={handleBulkDeleteSuperadmin} 
                                            disabled={processingId === 'BULK_DELETE'}
                                            className="px-3 py-1.5 bg-rose-600 text-white font-black text-[9px] uppercase tracking-widest rounded-lg hover:bg-rose-700 transition-colors shadow-sm shadow-rose-600/30">
                                            {processingId === 'BULK_DELETE' ? 'Memproses...' : `Hapus ${selectedHistoryCancelIds.length} Terpilih`}
                                        </button>
                                    </>
                                )}
                                <span className="text-[9px] text-slate-400 font-bold">{filteredReports.length} data ditampilkan</span>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100">
                                        <th className="px-5 py-3 w-12 text-center">
                                            <input 
                                                type="checkbox" 
                                                className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer shadow-sm"
                                                onChange={handleSelectAllHistory}
                                                checked={isSuperAdmin 
                                                    ? (filteredReports.filter(r => r.status === 'APPROVED' || r.status === 'PENDING').length > 0 && selectedHistoryCancelIds.length === filteredReports.filter(r => r.status === 'APPROVED' || r.status === 'PENDING').length)
                                                    : (filteredReports.filter(r => r.status === 'DRAFT' || r.status === 'PENDING').length > 0 && (selectedHistoryIds.length + selectedHistoryPendingIds.length) === filteredReports.filter(r => r.status === 'DRAFT' || r.status === 'PENDING').length)
                                                }
                                            />
                                        </th>
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
                                                selectable={(!isSuperAdmin && (report.status === 'DRAFT' || report.status === 'PENDING')) || (isSuperAdmin && (report.status === 'APPROVED' || report.status === 'PENDING'))}
                                                isSelected={isSuperAdmin ? selectedHistoryCancelIds.includes(report.id) : (report.status === 'PENDING' ? selectedHistoryPendingIds.includes(report.id) : selectedHistoryIds.includes(report.id))}
                                                onToggleSelect={isSuperAdmin ? handleToggleSelectHistoryCancel : handleToggleSelectHistory}
                                                onEdit={() => handleEditDraft(report)}
                                                onDelete={isSuperAdmin ? () => handleDeleteReportSuperadmin(report) : () => handleDeleteDraft(report.id)}
                                                onCancelApproval={() => handleCancelReportApproval(report)}
                                                onWithdraw={() => handleWithdrawReportSubmission(report)}
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
                                                <td className="px-5 py-4 text-xs font-medium text-slate-600 max-w-[240px]" title={report.description}>
                                                    <div className="font-bold text-slate-800 truncate mb-1">{report.description}</div>
                                                    {(() => {
                                                        const parentReq = (budgetRequests || []).find(req => req.id === report.budgetRequestId);
                                                        let matchedItem = null;
                                                        if (parentReq && parentReq.items) {
                                                            const items = Array.isArray(parentReq.items) ? parentReq.items : [];
                                                            if (report.planId) matchedItem = items.find(i => i.componentId === report.planId || i.id === report.planId);
                                                            const repCat = (report.category || '').trim().toLowerCase();
                                                            const repDesc = (report.description || '').trim().toLowerCase();
                                                            if (!matchedItem && repCat) matchedItem = items.find(i => i.name && i.name.trim().toLowerCase() === repCat);
                                                            if (!matchedItem && repDesc) matchedItem = items.find(i => i.name && i.name.trim().toLowerCase() === repDesc);
                                                            if (!matchedItem && repCat) matchedItem = items.find(i => i.name && (repCat.includes(i.name.trim().toLowerCase()) || i.name.trim().toLowerCase().includes(repCat)));
                                                            if (!matchedItem && repDesc) matchedItem = items.find(i => i.name && (repDesc.includes(i.name.trim().toLowerCase()) || i.name.trim().toLowerCase().includes(repDesc)));
                                                            if (!matchedItem && report.expenseItemId) {
                                                                const sameExp = items.filter(i => i.expenseItemId === report.expenseItemId || i.componentId === report.expenseItemId);
                                                                if (sameExp.length > 0) matchedItem = sameExp[0];
                                                            }
                                                            if (!matchedItem && items.length === 1) matchedItem = items[0];
                                                        }
                                                        const dName = matchedItem?.debitAccountName || (matchedItem?.debitAccountId ? (accounts.find(a => a.id === matchedItem.debitAccountId)?.name) : null);
                                                        const cName = matchedItem?.creditAccountName || (matchedItem?.creditAccountId ? (accounts.find(a => a.id === matchedItem.creditAccountId)?.name) : null);

                                                        if (dName || cName) {
                                                            return (
                                                                <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-bold">
                                                                    {dName && (
                                                                        <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 truncate max-w-[130px]" title={`Debit: ${dName}`}>
                                                                            D: {dName}
                                                                        </span>
                                                                    )}
                                                                    {cName && (
                                                                        <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 truncate max-w-[130px]" title={`Kredit: ${cName}`}>
                                                                            K: {cName}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    })()}
                                                </td>
                                                <td className="px-5 py-4 text-center text-xs font-bold text-slate-600">{(report.volume && report.satuan) ? `${parseFloat(report.volume)} ${report.satuan}` : '—'}</td>
                                                <td className="px-5 py-4 text-right text-xs font-bold text-rose-500 font-mono whitespace-nowrap">{parseFloat(report.diskon || 0) > 0 ? `-${formatRupiah(parseFloat(report.diskon))}` : '—'}</td>
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
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        const itm = selectedItemForReports;
                                        setShowReportsList(false);
                                        setSelectedItemForReports(null);
                                        handleOpenReportForm(itm);
                                    }}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-[10px] uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
                                >
                                    <FileCheck size={14} />
                                    <span>+ Tambah Nota</span>
                                </button>
                                <button
                                    onClick={() => { setShowReportsList(false); setSelectedItemForReports(null); }}
                                    className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>
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
                                                <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Aksi</th>
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
                                                        <td className="px-5 py-4 text-center">
                                                            {!isSuperAdmin && (report.status === 'DRAFT' || report.status === 'REJECTED') ? (
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
                                                            ) : isSuperAdmin ? (
                                                                <div className="flex items-center justify-center gap-1.5">
                                                                    {report.kategoriAset !== 'PENGEMBALIAN' && (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setShowReportsList(false);
                                                                                handleEditDraft(report);
                                                                            }}
                                                                            className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors"
                                                                            title="Edit / Sesuaikan Nota (Otomatis Update Jurnal)"
                                                                        >
                                                                            <Edit2 size={14} />
                                                                        </button>
                                                                    )}
                                                                    {report.status === 'APPROVED' && (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleCancelReportApproval(report);
                                                                            }}
                                                                            className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors"
                                                                            title="Batalkan Persetujuan (Status kembali ke Pending & Hapus Jurnal)"
                                                                        >
                                                                            <RotateCcw size={14} />
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleDeleteReportSuperadmin(report);
                                                                        }}
                                                                        className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors"
                                                                        title="Hapus Laporan Permanen"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-300 text-xs">—</span>
                                                            )}
                                                        </td>
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
                                <h2 className="text-2xl font-black text-slate-900">
                                    {editingDraftId 
                                        ? (isSuperAdmin ? 'Edit / Sesuaikan Nota Pengeluaran' : 'Edit Laporan Pengeluaran') 
                                        : (isSuperAdmin ? 'Input Nota Pengeluaran (Superadmin)' : 'Laporan Penggunaan Dana')}
                                </h2>
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
                                             .filter(r => {
                                                 if (r.status === 'REJECTED' || r.isDeleted) return false;
                                                 const resolved = resolveReportRequest(r, budgetRequests, globalAcademicYearId);
                                                 if (resolved) return resolved.id === selectedRequest?.reqId;
                                                 return r.budgetRequestId === selectedRequest?.reqId;
                                             })
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

                                {/* Information Card: Surat Permintaan Dana (Terkunci Otomatis) */}
                                <div>
                                    <label className="form-label font-bold text-slate-700 mb-1 flex items-center justify-between">
                                        <span>Surat Permintaan Dana / Bulan Permintaan</span>
                                        <span className="text-[10px] text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                                            🔒 Otomatis Terkunci
                                        </span>
                                    </label>
                                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-xs flex-shrink-0">
                                                {selectedRequest?.reqMonth ? formatMonthLabel(selectedRequest.reqMonth).split(' ')[0].substring(0, 3).toUpperCase() : 'REQ'}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-xs font-black text-slate-800 flex items-center gap-2 flex-wrap">
                                                    <span>{formatMonthLabel(selectedRequest?.reqMonth)}</span>
                                                    <span className="text-[10px] font-mono font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                                                        {selectedRequest?.reqId}
                                                    </span>
                                                </div>
                                                <div className="text-[11px] text-slate-500 font-medium truncate max-w-md">
                                                    {selectedRequest?.reqDescription || selectedRequest?.name || 'Pengajuan Dana Induk'}
                                                </div>
                                            </div>
                                        </div>
                                        {(() => {
                                            const parentReq = budgetRequests.find(r => r.id === selectedRequest?.reqId);
                                            if (!parentReq) return null;
                                            return (
                                                <div className="text-right flex-shrink-0">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Total Cair</span>
                                                    <span className="text-xs font-black text-slate-700">{formatRupiah(parentReq.totalAmount || parentReq.amount)}</span>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>

                                {/* Target Rincian Belanja */}
                                <div>
                                    <label className="form-label font-bold text-slate-700 mb-1 flex items-center justify-between">
                                        <span>Target Rincian Belanja / Pagu Anggaran</span>
                                        {(() => {
                                            const parentReq = budgetRequests.find(r => r.id === selectedRequest?.reqId);
                                            if (parentReq?.items && parentReq.items.length > 1) {
                                                return (
                                                    <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                                                        Tersedia {parentReq.items.length} Rincian dalam Pengajuan Ini
                                                    </span>
                                                );
                                            }
                                            return null;
                                        })()}
                                    </label>
                                    {(() => {
                                        const parentReq = budgetRequests.find(r => r.id === selectedRequest?.reqId);
                                        if (parentReq?.items && parentReq.items.length > 1) {
                                            return (
                                                <div className="space-y-2">
                                                    <select
                                                        value={selectedRequest?.componentId || selectedRequest?.id || ''}
                                                        onChange={(e) => {
                                                            const chosenCompId = e.target.value;
                                                            const foundItem = parentReq.items.find(i => (i.componentId || i.id) === chosenCompId);
                                                            if (foundItem) {
                                                                const reqCompKey = `${parentReq.id}_${chosenCompId}`;
                                                                const reportedCompVal = reportedAmounts.byRequestComponent?.[reqCompKey] || 0;
                                                                setSelectedRequest({
                                                                    ...foundItem,
                                                                    reqId: parentReq.id,
                                                                    reqMonth: parentReq.month,
                                                                    reqDate: parentReq.date,
                                                                    reqDescription: parentReq.description,
                                                                    reqUnitId: parentReq.unitId,
                                                                    expenseItemId: foundItem.expenseItemId || parentReq.expenseItemId,
                                                                    sisa: parseFloat(foundItem.amount || 0) - reportedCompVal
                                                                });
                                                            }
                                                        }}
                                                        className="form-input bg-white border-2 border-indigo-200 text-xs font-bold text-slate-800 focus:border-indigo-500"
                                                    >
                                                        {parentReq.items.map(it => {
                                                            const cId = it.componentId || it.id;
                                                            const itKet = getComponentKeterangan(it, rabPlans, expenseItems);
                                                            const reqCompKey = `${parentReq.id}_${cId}`;
                                                            const used = reportedAmounts.byRequestComponent?.[reqCompKey] || 0;
                                                            const remaining = parseFloat(it.amount || 0) - used;
                                                            return (
                                                                <option key={cId} value={cId}>
                                                                    {it.name} {itKet ? `(${itKet})` : ''} — Pagu: {formatRupiah(it.amount)} (Sisa: {formatRupiah(remaining)})
                                                                </option>
                                                            );
                                                        })}
                                                    </select>
                                                    {(() => {
                                                        const activeKet = getComponentKeterangan(selectedRequest, rabPlans, expenseItems);
                                                        if (!activeKet) return null;
                                                        return (
                                                            <div className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-xs font-bold text-indigo-700">
                                                                <Tag size={13} className="shrink-0 text-indigo-500" />
                                                                <span><strong>Keterangan:</strong> {activeKet}</span>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            );
                                        } else {
                                            const activeKet = getComponentKeterangan(selectedRequest, rabPlans, expenseItems);
                                            return (
                                                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3">
                                                    <div>
                                                        <span className="font-black text-xs text-slate-800 block">{selectedRequest?.name || 'Rincian Pengeluaran'}</span>
                                                        {activeKet && (
                                                            <span className="text-[11px] font-bold text-indigo-600 block mt-0.5">🏷️ {activeKet}</span>
                                                        )}
                                                    </div>
                                                    <span className="text-xs font-black text-slate-700">{formatRupiah(selectedRequest?.amount || 0)}</span>
                                                </div>
                                            );
                                        }
                                    })()}
                                </div>

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
                                                onClick={() => {
                                                    const isNowAsset = opt.val === 'ASET';
                                                    let resolvedUmur = '';
                                                    if (isNowAsset) {
                                                        const expItem = expenseItems.find(e => e.id === selectedRequest?.expenseItemId || e.id === selectedRequest?.mataAnggaranId);
                                                        const debitAcc = accounts.find(a => a.id === selectedRequest?.coaId || a.id === selectedRequest?.accountId || a.id === expItem?.coaId || a.id === expItem?.accountId || a.code === expItem?.code);
                                                        const defaultAsset = getAssetDefaultDetails({
                                                            item: selectedRequest,
                                                            expenseItem: expItem,
                                                            account: debitAcc,
                                                            assetCategories
                                                        });
                                                        resolvedUmur = defaultAsset.umurEkonomis || formData.umurEkonomis || '4';
                                                    }
                                                    setFormData({ ...formData, kategoriAset: opt.val, umurEkonomis: resolvedUmur });
                                                }}
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
                                <span>
                                    {editingDraftId 
                                        ? (isSuperAdmin ? 'Simpan Perubahan Nota' : 'Simpan Perubahan (Draft)') 
                                        : (isSuperAdmin ? 'Simpan & Setujui Nota' : 'Simpan Nota (Draft)')}
                                </span>
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
                            const req = resolveReportRequest(report, budgetRequests, globalAcademicYearId);
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
