import React, { useMemo, useState, useEffect } from 'react';
import { 
    Landmark, TrendingDown, Wallet, Building2, ChevronDown, ChevronRight, 
    Calendar, Search, AlertCircle, CheckCircle2, Clock, FileCheck, RotateCcw, 
    X, Save, ArrowUpRight, Check, Loader2, Sparkles, Receipt
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { formatRupiah, generateId } from '../../utils/format';

function formatMonthLabel(m) {
    if (!m) return '';
    const [year, month] = m.split('-');
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${months[parseInt(month, 10) - 1] || month} ${year}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Row per unit – bisa di-expand untuk melihat rincian per Tahap & POS
// ─────────────────────────────────────────────────────────────────────────────
function BOSUnitRow({ 
    unit, 
    allocations, 
    reports, 
    budgetRequests, 
    bosStages, 
    bosPosList, 
    selectedYearId, 
    rabPlans, 
    expenseItems,
    onOpenReturnModal,
    onApproveReturn,
    isSuperAdmin
}) {
    const [open, setOpen] = useState(false);

    const unitAllocations = useMemo(() => {
        return allocations.filter(a =>
            a.unitId === unit.id &&
            !a.isDeleted &&
            (selectedYearId ? a.academicYearId === selectedYearId : true)
        );
    }, [allocations, unit.id, selectedYearId]);

    const totalAllocated = useMemo(() => {
        return unitAllocations.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
    }, [unitAllocations]);

    // Realisasi belanja = budget reports BOS unit ini (APPROVED dan bukan pengembalian)
    const unitReports = useMemo(() => {
        return reports.filter(r => {
            if (r.unitId !== unit.id || r.isDeleted || r.status !== 'APPROVED' || r.kategoriAset === 'PENGEMBALIAN') return false;
            if (selectedYearId && r.academicYearId !== selectedYearId) return false;
            
            // FILTER: ONLY BOS
            const req = budgetRequests.find(br => br.id === r.budgetRequestId);
            return r.source === 'BOS' || r.planId?.endsWith('-BOS') || (req?.items || []).some(item => item.planId?.endsWith('-BOS'));
        });
    }, [reports, unit.id, selectedYearId, budgetRequests]);

    const totalRealized = useMemo(() => {
        return unitReports.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    }, [unitReports]);

    const saldo = totalAllocated - totalRealized;
    const pctUsed = totalAllocated > 0 ? Math.min(100, Math.round((totalRealized / totalAllocated) * 100)) : 0;

    const hasData = totalAllocated > 0;
    const saldoColor = saldo < 0 ? 'text-rose-600' : saldo > 0 ? 'text-emerald-600' : 'text-slate-400';
    const barColor = pctUsed >= 90 ? 'bg-rose-500' : pctUsed >= 70 ? 'bg-amber-500' : 'bg-emerald-500';

    // ─────────────────────────────────────────────────────────────────────────
    // Matching engine: Petakan setiap laporan realisasi ke Alokasi / POS yang sesuai
    // ─────────────────────────────────────────────────────────────────────────
    const { byStage, allocRealizedMap } = useMemo(() => {
        const realizedMap = {};
        unitAllocations.forEach(a => {
            realizedMap[a.id] = 0;
        });

        // Loop over each approved report and find the matching allocation
        unitReports.forEach(r => {
            const rAmt = parseFloat(r.amount) || 0;
            if (rAmt <= 0) return;

            // 1. Resolve metadata from request / component
            const req = budgetRequests.find(br => br.id === r.budgetRequestId);
            let reqItem = null;
            if (req?.items) {
                reqItem = req.items.find(i => i.componentId === r.componentId || i.id === r.componentId);
                if (!reqItem && req.items.length === 1) reqItem = req.items[0];
            }

            let planComp = null;
            let planItemId = null;
            if (rabPlans && r.componentId) {
                for (const p of rabPlans) {
                    if (p.unitId === unit.id && p.expense) {
                        for (const [itemId, rawPlans] of Object.entries(p.expense)) {
                            const iPlans = Array.isArray(rawPlans) ? rawPlans : [rawPlans];
                            for (const ip of iPlans) {
                                const c = (ip.components || []).find(comp => comp.id === r.componentId);
                                if (c) {
                                    planComp = c;
                                    planItemId = itemId;
                                    break;
                                }
                            }
                            if (planComp) break;
                        }
                    }
                    if (planComp) break;
                }
            }

            const rExpenseItemId = r.expenseItemId || reqItem?.expenseItemId || planItemId;
            const rPosId = reqItem?.bosPosId || planComp?.bosPosId;
            const rStageId = reqItem?.bosStageId || planComp?.bosStageId;

            // 2. Score candidate allocations
            let bestAlloc = null;
            let bestScore = -1;

            unitAllocations.forEach(a => {
                let score = 0;
                const pos = bosPosList.find(p => p.id === a.posId);
                const exItem = expenseItems.find(e => e.id === a.expenseItemId);

                if (rExpenseItemId && a.expenseItemId === rExpenseItemId) score += 10;
                if (rPosId && a.posId === rPosId) score += 8;
                if (rStageId && a.stageId === rStageId) score += 6;

                if (pos?.name) {
                    const posLower = pos.name.toLowerCase();
                    if (r.category?.toLowerCase() === posLower) score += 7;
                    else if (r.category?.toLowerCase().includes(posLower)) score += 4;
                    else if (r.description?.toLowerCase().includes(posLower)) score += 2;
                }

                if (exItem?.name) {
                    const exLower = exItem.name.toLowerCase();
                    if (r.category?.toLowerCase() === exLower) score += 9;
                    else if (r.category?.toLowerCase().includes(exLower)) score += 5;
                    else if (r.description?.toLowerCase().includes(exLower)) score += 3;
                }

                if (score > bestScore) {
                    bestScore = score;
                    bestAlloc = a;
                }
            });

            if (bestAlloc && bestScore > 0) {
                realizedMap[bestAlloc.id] = (realizedMap[bestAlloc.id] || 0) + rAmt;
            } else {
                // Fallback: match allocation in same stage with remaining balance or first allocation
                const fallback = unitAllocations.find(a => (!rStageId || a.stageId === rStageId) && (parseFloat(a.amount) || 0) > (realizedMap[a.id] || 0)) || unitAllocations[0];
                if (fallback) {
                    realizedMap[fallback.id] = (realizedMap[fallback.id] || 0) + rAmt;
                }
            }
        });

        // Group allocations by stage and compute metrics
        const stageMap = {};
        unitAllocations.forEach(a => {
            const stage = bosStages.find(s => s.id === a.stageId);
            const pos = bosPosList.find(p => p.id === a.posId);
            const exItem = expenseItems.find(e => e.id === a.expenseItemId);
            const stageName = stage?.name || 'Tahap Tidak Dikenal';

            if (!stageMap[stageName]) {
                stageMap[stageName] = { 
                    stage: stageName, 
                    stageId: a.stageId,
                    items: [],
                    totalAlloc: 0,
                    totalRealized: 0
                };
            }

            const amt = parseFloat(a.amount) || 0;
            const itemRealized = realizedMap[a.id] || 0;
            const itemSaldo = amt - itemRealized;
            const itemPct = amt > 0 ? Math.min(100, Math.round((itemRealized / amt) * 100)) : 0;

            stageMap[stageName].totalAlloc += amt;
            stageMap[stageName].totalRealized += itemRealized;

            stageMap[stageName].items.push({
                id: a.id,
                pos: pos?.name || 'POS Tidak Dikenal',
                posId: a.posId,
                expenseItemId: a.expenseItemId,
                expenseItemName: exItem?.name || '',
                amount: amt,
                realized: itemRealized,
                saldo: itemSaldo,
                pct: itemPct
            });
        });

        return {
            byStage: Object.values(stageMap),
            allocRealizedMap: realizedMap
        };
    }, [unitAllocations, unitReports, bosStages, bosPosList, expenseItems, budgetRequests, rabPlans, unit.id]);

    // ─────────────────────────────────────────────────────────────────────────
    // Kalkulasi Sisa Kas Permintaan BOS (Dana Cair - Realisasi - Pengembalian)
    // ─────────────────────────────────────────────────────────────────────────
    const { 
        totalCairBos, 
        totalSpentBos, 
        totalReturnedBos, 
        totalPendingReturnBos, 
        unreturnedCashBos, 
        pendingReturnsList,
        approvedReturnsList
    } = useMemo(() => {
        const approvedReqs = (budgetRequests || []).filter(r => {
            if (r.status !== 'APPROVED' || r.isDeleted) return false;
            if (r.unitId !== unit.id) return false;
            if (selectedYearId && r.academicYearId && r.academicYearId !== selectedYearId) return false;
            return r.source === 'BOS' || (r.items || []).some(item => item.planId?.endsWith('-BOS'));
        });

        const totalCair = approvedReqs.reduce((sum, r) => sum + (parseFloat(r.totalAmount) || 0), 0);
        const reqIds = approvedReqs.map(r => r.id);

        const spentReports = (reports || []).filter(r => {
            if (r.unitId !== unit.id || r.isDeleted || r.status !== 'APPROVED') return false;
            if (r.kategoriAset === 'PENGEMBALIAN') return false;
            if (selectedYearId && r.academicYearId && r.academicYearId !== selectedYearId) return false;
            return r.source === 'BOS' || r.planId?.endsWith('-BOS') || (r.budgetRequestId && reqIds.includes(r.budgetRequestId));
        });
        const totalSpent = spentReports.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

        const approvedRet = (reports || []).filter(r => {
            if (r.unitId !== unit.id || r.isDeleted || r.status !== 'APPROVED') return false;
            if (r.kategoriAset !== 'PENGEMBALIAN') return false;
            if (selectedYearId && r.academicYearId && r.academicYearId !== selectedYearId) return false;
            return r.source === 'BOS' || r.planId?.endsWith('-BOS') || (r.budgetRequestId && reqIds.includes(r.budgetRequestId));
        });
        const totalRet = approvedRet.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

        const pendingRet = (reports || []).filter(r => {
            if (r.unitId !== unit.id || r.isDeleted || r.status !== 'PENDING') return false;
            if (r.kategoriAset !== 'PENGEMBALIAN') return false;
            if (selectedYearId && r.academicYearId && r.academicYearId !== selectedYearId) return false;
            return r.source === 'BOS' || r.planId?.endsWith('-BOS') || (r.budgetRequestId && reqIds.includes(r.budgetRequestId));
        });
        const totalPendingRet = pendingRet.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

        const unreturned = Math.max(0, totalCair - totalSpent - totalRet);

        return {
            totalCairBos: totalCair,
            totalSpentBos: totalSpent,
            totalReturnedBos: totalRet,
            totalPendingReturnBos: totalPendingRet,
            unreturnedCashBos: unreturned,
            pendingReturnsList: pendingRet,
            approvedReturnsList: approvedRet
        };
    }, [budgetRequests, reports, unit.id, selectedYearId]);

    return (
        <>
            <tr
                className={`border-b border-slate-100 cursor-pointer transition-all duration-200 ${open ? 'bg-emerald-50/70' : 'hover:bg-slate-50'} ${!hasData ? 'opacity-60' : ''}`}
                onClick={() => hasData && setOpen(o => !o)}
            >
                <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 shadow-sm border border-emerald-100">
                            <Building2 size={16} />
                        </div>
                        <div>
                            <div className="font-black text-slate-800 text-sm flex items-center gap-2">
                                {unit.name}
                                {unreturnedCashBos > 0 && (
                                    <span className="text-[10px] bg-amber-100 text-amber-800 font-black px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                                        <AlertCircle size={10} /> Sisa Kas Belum Kembali: {formatRupiah(unreturnedCashBos)}
                                    </span>
                                )}
                                {totalPendingReturnBos > 0 && (
                                    <span className="text-[10px] bg-blue-100 text-blue-800 font-black px-2 py-0.5 rounded-full border border-blue-200 flex items-center gap-1">
                                        <Clock size={10} /> Verifikasi Pengembalian: {formatRupiah(totalPendingReturnBos)}
                                    </span>
                                )}
                            </div>
                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Unit Penerima BOS</div>
                        </div>
                        {hasData && (
                            <span className="ml-1 text-slate-400">
                                {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </span>
                        )}
                    </div>
                </td>
                <td className="px-6 py-5 text-right">
                    <span className="font-bold text-slate-700 text-sm">{formatRupiah(totalAllocated)}</span>
                </td>
                <td className="px-6 py-5 text-right">
                    <span className="font-bold text-rose-600 text-sm">{formatRupiah(totalRealized)}</span>
                </td>
                <td className="px-6 py-5 text-right">
                    <span className={`font-black text-sm ${saldoColor}`}>{formatRupiah(saldo)}</span>
                </td>
                <td className="px-6 py-5">
                    {hasData ? (
                        <div className="flex items-center gap-3">
                            <div className="flex-1 bg-slate-200 rounded-full h-2">
                                <div
                                    className={`h-2 rounded-full transition-all duration-700 ${barColor}`}
                                    style={{ width: `${pctUsed}%` }}
                                />
                            </div>
                            <span className="text-[10px] font-black text-slate-500 w-8 text-right">{pctUsed}%</span>
                        </div>
                    ) : (
                        <span className="text-[10px] text-slate-400 font-medium">Belum ada alokasi</span>
                    )}
                </td>
            </tr>

            {open && (
                <>
                    {/* Banner Sisa Kas Belum Kembali (Jika Ada) */}
                    {unreturnedCashBos > 0 && (
                        <tr className="bg-amber-50/70 border-b border-amber-100">
                            <td colSpan={5} className="px-6 py-3.5">
                                <div className="flex items-center justify-between flex-wrap gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                                            <AlertCircle size={16} />
                                        </div>
                                        <div>
                                            <div className="text-xs font-black text-amber-900">
                                                Ada Sisa Kas Permintaan BOS yang Belum Dikembalikan: <span className="text-rose-600 font-extrabold">{formatRupiah(unreturnedCashBos)}</span>
                                            </div>
                                            <div className="text-[11px] text-amber-800">
                                                Dana yang telah dicairkan belum sepenuhnya terpakai atau dikembalikan. Kembalikan sisa dana ini agar permohonan dana bulan berikutnya tidak terblokir.
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onOpenReturnModal(unit, unreturnedCashBos);
                                        }}
                                        className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 shrink-0"
                                    >
                                        <RotateCcw size={14} />
                                        <span>Kembalikan Sisa Kas BOS</span>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    )}

                    {/* Banner Pengembalian Menunggu Verifikasi */}
                    {totalPendingReturnBos > 0 && (
                        <tr className="bg-blue-50/70 border-b border-blue-100">
                            <td colSpan={5} className="px-6 py-3">
                                <div className="flex items-center justify-between flex-wrap gap-3">
                                    <div className="flex items-center gap-2.5">
                                        <Clock size={16} className="text-blue-600 shrink-0" />
                                        <span className="text-xs font-bold text-blue-900">
                                            Pengajuan Pengembalian BOS Menunggu Verifikasi Superadmin: <span className="font-black text-blue-700">{formatRupiah(totalPendingReturnBos)}</span>
                                        </span>
                                    </div>
                                    {isSuperAdmin && (
                                        <div className="flex items-center gap-2">
                                            {pendingReturnsList.map(ret => (
                                                <button
                                                    key={ret.id}
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onApproveReturn(ret);
                                                    }}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm active:scale-95"
                                                >
                                                    <Check size={13} />
                                                    <span>ACC Pengembalian ({formatRupiah(ret.amount)})</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </td>
                        </tr>
                    )}

                    {/* Rincian Alokasi & Realisasi per Tahap dan POS */}
                    {byStage.map((stageGroup, si) => {
                        const stageSaldo = stageGroup.totalAlloc - stageGroup.totalRealized;
                        const stagePct = stageGroup.totalAlloc > 0 ? Math.min(100, Math.round((stageGroup.totalRealized / stageGroup.totalAlloc) * 100)) : 0;

                        return (
                            <React.Fragment key={si}>
                                <tr className="bg-emerald-50/40 border-t border-emerald-100">
                                    <td className="pl-12 pr-6 py-2.5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black text-emerald-800 uppercase tracking-wider">
                                                📌 {stageGroup.stage}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-2.5 text-right text-xs font-black text-slate-800">
                                        {formatRupiah(stageGroup.totalAlloc)}
                                    </td>
                                    <td className="px-6 py-2.5 text-right text-xs font-black text-rose-600">
                                        {formatRupiah(stageGroup.totalRealized)}
                                    </td>
                                    <td className="px-6 py-2.5 text-right text-xs font-black text-emerald-700">
                                        {formatRupiah(stageSaldo)}
                                    </td>
                                    <td className="px-6 py-2.5">
                                        <div className="flex items-center gap-2">
                                            <div className="w-16 bg-slate-200 rounded-full h-1.5">
                                                <div 
                                                    className="h-1.5 rounded-full bg-emerald-600" 
                                                    style={{ width: `${stagePct}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] font-black text-slate-500">{stagePct}%</span>
                                        </div>
                                    </td>
                                </tr>

                                {stageGroup.items.map((item, ii) => (
                                    <tr key={ii} className="border-b border-slate-100 bg-white/70 hover:bg-emerald-50/20 transition-colors">
                                        <td className="pl-16 pr-6 py-2.5">
                                            <div className="text-xs font-bold text-slate-700">{item.pos}</div>
                                            {item.expenseItemName && (
                                                <div className="text-[10px] font-semibold text-slate-400">
                                                    • {item.expenseItemName}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-2.5 text-right text-xs font-bold text-slate-700">
                                            {formatRupiah(item.amount)}
                                        </td>
                                        <td className="px-6 py-2.5 text-right text-xs font-bold">
                                            {item.realized > 0 ? (
                                                <span className="text-rose-600">{formatRupiah(item.realized)}</span>
                                            ) : (
                                                <span className="text-slate-400 font-normal">Rp 0</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-2.5 text-right text-xs font-bold">
                                            <span className={item.saldo < 0 ? 'text-rose-600 font-black' : 'text-emerald-600'}>
                                                {formatRupiah(item.saldo)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-2.5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                                    <div 
                                                        className={`h-1.5 rounded-full ${item.pct >= 90 ? 'bg-rose-500' : item.pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                                                        style={{ width: `${item.pct}%` }}
                                                    />
                                                </div>
                                                <span className="text-[9px] font-bold text-slate-400">{item.pct}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </React.Fragment>
                        );
                    })}

                    {/* Riwayat Pengembalian Dana Kas BOS jika ada */}
                    {(approvedReturnsList.length > 0 || pendingReturnsList.length > 0) && (
                        <tr className="bg-slate-50/90 border-b border-slate-200">
                            <td colSpan={5} className="pl-12 pr-6 py-4">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-black text-slate-700 flex items-center gap-2">
                                            <RotateCcw size={14} className="text-emerald-600" />
                                            Riwayat Pengembalian Sisa Dana Kas BOS ({unit.name})
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onOpenReturnModal(unit, unreturnedCashBos);
                                            }}
                                            className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 underline uppercase"
                                        >
                                            + Ajukan Pengembalian Baru
                                        </button>
                                    </div>
                                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-500 font-bold text-[10px] uppercase">
                                                    <th className="px-4 py-2 text-left">Tanggal</th>
                                                    <th className="px-4 py-2 text-left">Keterangan / Bukti</th>
                                                    <th className="px-4 py-2 text-right">Nominal</th>
                                                    <th className="px-4 py-2 text-center">Status</th>
                                                    {isSuperAdmin && <th className="px-4 py-2 text-center">Aksi</th>}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {[...pendingReturnsList, ...approvedReturnsList].map((ret, rIdx) => (
                                                    <tr key={ret.id || rIdx} className="border-b border-slate-100 last:border-none hover:bg-slate-50">
                                                        <td className="px-4 py-2.5 font-medium text-slate-600">
                                                            {ret.date ? new Date(ret.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                                        </td>
                                                        <td className="px-4 py-2.5">
                                                            <div className="font-bold text-slate-800">{ret.description || 'Pengembalian Sisa Kas BOS'}</div>
                                                            {ret.buktiTeks && (
                                                                <div className="text-[10px] text-slate-400 font-mono">Bukti: {ret.buktiTeks}</div>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right font-black text-emerald-700">
                                                            {formatRupiah(ret.amount)}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-center">
                                                            {ret.status === 'APPROVED' ? (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                                    <CheckCircle2 size={11} /> Disetujui
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                                                    <Clock size={11} /> Menunggu Verifikasi
                                                                </span>
                                                            )}
                                                        </td>
                                                        {isSuperAdmin && (
                                                            <td className="px-4 py-2.5 text-center">
                                                                {ret.status === 'PENDING' && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            onApproveReturn(ret);
                                                                        }}
                                                                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                                                                    >
                                                                        ACC
                                                                    </button>
                                                                )}
                                                            </td>
                                                        )}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    )}
                </>
            )}
        </>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Halaman Utama: Saldo BOS
// ─────────────────────────────────────────────────────────────────────────────
export default function BOSSaldo() {
    const { state, dispatch } = useApp();
    const {
        bosAllocations = [],
        bosStages = [],
        bosPosList = [],
        units = [],
        academicYears = [],
        budgetReports = [],
        budgetRequests = [],
        rabPlans = [],
        expenseItems = [],
        currentUser
    } = state;

    const isSuperAdmin = currentUser?.role === 'superadmin';
    const isAdminUnit = currentUser?.role === 'admin_unit';

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedYearId, setSelectedYearId] = useState(() => {
        const active = academicYears.find(y => y.isCurrent && !y.isDeleted);
        return active?.id || academicYears.filter(y => !y.isDeleted).sort((a, b) => b.name.localeCompare(a.name))[0]?.id || '';
    });

    // State Modal Pengembalian Sisa Kas BOS
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
    const [returnForm, setReturnForm] = useState({
        unitId: '',
        budgetRequestId: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: 'Pengembalian Sisa Dana Kas BOS',
        buktiTeks: ''
    });

    const activeYears = useMemo(() => academicYears.filter(y => !y.isDeleted).sort((a, b) => b.name.localeCompare(a.name)), [academicYears]);

    // Hanya tampilkan unit yang menerima BOS
    const bosUnits = useMemo(() => {
        let list = units.filter(u => u.receivesBos && !u.isDeleted);
        if (isAdminUnit && currentUser?.unitId) {
            list = list.filter(u => u.id === currentUser.unitId);
        }
        if (searchTerm) {
            list = list.filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase()));
        }
        return list;
    }, [units, isAdminUnit, currentUser, searchTerm]);

    // Ringkasan global
    const { totalAllocated, totalRealized, totalSaldo } = useMemo(() => {
        const yearAllocations = bosAllocations.filter(a => !a.isDeleted && (selectedYearId ? a.academicYearId === selectedYearId : true));
        const allocated = yearAllocations.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);

        const yearReports = budgetReports.filter(r => {
            if (r.isDeleted || r.status === 'REJECTED' || r.kategoriAset === 'PENGEMBALIAN') return false;
            if (selectedYearId && r.academicYearId !== selectedYearId) return false;
            
            // FILTER: ONLY BOS
            const req = budgetRequests.find(br => br.id === r.budgetRequestId);
            return r.source === 'BOS' || r.planId?.endsWith('-BOS') || (req?.items || []).some(item => item.planId?.endsWith('-BOS'));
        });
        const realized = yearReports.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
        return { totalAllocated: allocated, totalRealized: realized, totalSaldo: allocated - realized };
    }, [bosAllocations, budgetReports, budgetRequests, selectedYearId]);

    // Clear notifications for unit when viewing this page (local state update only)
    useEffect(() => {
        if (!isSuperAdmin && budgetReports && currentUser?.unitId) {
            const unnotified = budgetReports.filter(r => {
                const isMine = r.unitId === currentUser.unitId;
                const isBos = r.source === 'BOS' || r.planId?.endsWith('-BOS') || r.category?.toLowerCase().includes('bos') || r.description?.toLowerCase().includes('bos') || r.id?.startsWith('RET-BOS-');
                return isMine && r.kategoriAset === 'PENGEMBALIAN' && isBos && (r.status === 'APPROVED' || r.status === 'REJECTED') && !r.notified;
            });
            if (unnotified.length > 0) {
                unnotified.forEach(r => {
                    const updated = { ...r, notified: true };
                    dispatch({ type: 'EDIT_BUDGET_REPORT', payload: updated });
                });
            }
        }
    }, [isSuperAdmin, budgetReports, currentUser?.unitId, dispatch]);

    const globalPct = totalAllocated > 0 ? Math.min(100, Math.round((totalRealized / totalAllocated) * 100)) : 0;

    // Hitung total sisa kas permintaan BOS yang belum dikembalikan di seluruh unit
    const globalUnreturnedCash = useMemo(() => {
        let total = 0;
        bosUnits.forEach(u => {
            const approvedReqs = (budgetRequests || []).filter(r => {
                if (r.status !== 'APPROVED' || r.isDeleted || r.unitId !== u.id) return false;
                if (selectedYearId && r.academicYearId && r.academicYearId !== selectedYearId) return false;
                return r.source === 'BOS' || (r.items || []).some(item => item.planId?.endsWith('-BOS'));
            });
            const totalCair = approvedReqs.reduce((sum, r) => sum + (parseFloat(r.totalAmount) || 0), 0);
            const reqIds = approvedReqs.map(r => r.id);

            const spentReports = (budgetReports || []).filter(r => {
                if (r.unitId !== u.id || r.isDeleted || r.status !== 'APPROVED' || r.kategoriAset === 'PENGEMBALIAN') return false;
                if (selectedYearId && r.academicYearId && r.academicYearId !== selectedYearId) return false;
                return r.source === 'BOS' || r.planId?.endsWith('-BOS') || (r.budgetRequestId && reqIds.includes(r.budgetRequestId));
            });
            const totalSpent = spentReports.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

            const returnedReports = (budgetReports || []).filter(r => {
                if (r.unitId !== u.id || r.isDeleted || r.status !== 'APPROVED' || r.kategoriAset !== 'PENGEMBALIAN') return false;
                if (selectedYearId && r.academicYearId && r.academicYearId !== selectedYearId) return false;
                return r.source === 'BOS' || r.planId?.endsWith('-BOS') || (r.budgetRequestId && reqIds.includes(r.budgetRequestId));
            });
            const totalReturned = returnedReports.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

            total += Math.max(0, totalCair - totalSpent - totalReturned);
        });
        return total;
    }, [bosUnits, budgetRequests, budgetReports, selectedYearId]);

    // Daftar Permintaan BOS untuk unit yang sedang dipilih di Modal Pengembalian
    const returnModalRequests = useMemo(() => {
        if (!returnForm.unitId) return [];
        return (budgetRequests || []).filter(r => {
            if (r.status !== 'APPROVED' || r.isDeleted) return false;
            if (r.unitId !== returnForm.unitId) return false;
            if (selectedYearId && r.academicYearId && r.academicYearId !== selectedYearId) return false;
            return r.source === 'BOS' || (r.items || []).some(item => item.planId?.endsWith('-BOS'));
        });
    }, [budgetRequests, returnForm.unitId, selectedYearId]);

    // Buka Modal Pengembalian
    const handleOpenReturnModal = (targetUnit = null, defaultAmount = 0) => {
        const uId = targetUnit ? targetUnit.id : (currentUser?.unitId || (bosUnits[0]?.id || ''));
        const uName = targetUnit ? targetUnit.name : (units.find(u => u.id === uId)?.name || '');
        
        // Cari permintaan yang paling relevan yang memiliki sisa
        const unitReqs = (budgetRequests || []).filter(r => {
            if (r.status !== 'APPROVED' || r.isDeleted || r.unitId !== uId) return false;
            return r.source === 'BOS' || (r.items || []).some(item => item.planId?.endsWith('-BOS'));
        });

        let chosenReqId = '';
        let initialAmt = defaultAmount > 0 ? defaultAmount : '';

        if (unitReqs.length > 0) {
            chosenReqId = unitReqs[0].id;
            if (!initialAmt) {
                // Hitung sisa permintaan ini
                const spent = (budgetReports || []).filter(r => r.budgetRequestId === chosenReqId && r.status === 'APPROVED' && r.kategoriAset !== 'PENGEMBALIAN')
                    .reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
                const ret = (budgetReports || []).filter(r => r.budgetRequestId === chosenReqId && r.status === 'APPROVED' && r.kategoriAset === 'PENGEMBALIAN')
                    .reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
                const reqTotal = parseFloat(unitReqs[0].totalAmount) || 0;
                const sisa = Math.max(0, reqTotal - spent - ret);
                if (sisa > 0) initialAmt = sisa;
            }
        }

        setReturnForm({
            unitId: uId,
            budgetRequestId: chosenReqId,
            amount: initialAmt ? String(initialAmt) : '',
            date: new Date().toISOString().split('T')[0],
            description: `Pengembalian Sisa Dana Kas BOS ${uName}`,
            buktiTeks: ''
        });
        setShowReturnModal(true);
    };

    // Simpan Pengembalian Sisa Dana BOS
    const handleSubmitReturn = async (e) => {
        e.preventDefault();
        const amt = parseFloat(returnForm.amount);
        if (!amt || amt <= 0) {
            alert('Mohon masukkan nominal pengembalian yang valid!');
            return;
        }

        if (!returnForm.unitId) {
            alert('Mohon pilih unit penerima BOS!');
            return;
        }

        setIsSubmittingReturn(true);
        window.dispatchEvent(new CustomEvent('app-processing-start', { 
            detail: { 
                message: 'Mencatat pengembalian sisa dana kas BOS...', 
                type: 'submitting' 
            } 
        }));

        try {
            const newReturn = {
                id: 'RET-BOS-' + Date.now().toString(36).toUpperCase(),
                unitId: returnForm.unitId,
                fieldId: null,
                budgetRequestId: returnForm.budgetRequestId || null,
                requestId: returnForm.budgetRequestId || null,
                academicYearId: selectedYearId || state.globalAcademicYearId || null,
                date: returnForm.date || new Date().toISOString().split('T')[0],
                amount: amt,
                description: returnForm.description || 'Pengembalian Sisa Dana Kas BOS',
                buktiTeks: returnForm.buktiTeks || null,
                kategoriAset: 'PENGEMBALIAN',
                source: 'BOS',
                category: 'Pengembalian Sisa Dana BOS',
                status: isSuperAdmin ? 'APPROVED' : 'PENDING',
                notified: false
            };

            dispatch({ type: 'ADD_BUDGET_REPORT', payload: newReturn });
            await api.pushAction({ type: 'ADD_BUDGET_REPORT', payload: newReturn }, state);

            setShowReturnModal(false);
            setReturnForm({
                unitId: '',
                budgetRequestId: '',
                amount: '',
                date: new Date().toISOString().split('T')[0],
                description: '',
                buktiTeks: ''
            });

            alert(isSuperAdmin 
                ? 'Pengembalian sisa dana BOS berhasil dicatat dan langsung disetujui (Jurnal otomatis dibuat)!' 
                : 'Pengembalian sisa dana BOS berhasil diajukan dan sedang menunggu verifikasi (ACC) Superadmin.');
        } catch (err) {
            console.error('Error submitting BOS return:', err);
            alert('Gagal mencatat pengembalian sisa dana BOS: ' + err.message);
        } finally {
            setIsSubmittingReturn(false);
            window.dispatchEvent(new CustomEvent('app-processing-end'));
        }
    };

    // ACC Pengembalian oleh Super Admin
    const handleApproveReturn = async (returnReport) => {
        if (!window.confirm(`Setujui pengembalian dana BOS sebesar ${formatRupiah(returnReport.amount)} untuk ${units.find(u => u.id === returnReport.unitId)?.name}?`)) {
            return;
        }

        window.dispatchEvent(new CustomEvent('app-processing-start', {
            detail: { message: 'Menyetujui pengembalian dana BOS...', type: 'submitting' }
        }));

        try {
            const updated = { ...returnReport, status: 'APPROVED' };
            dispatch({ type: 'EDIT_BUDGET_REPORT', payload: updated });
            await api.pushAction({ type: 'EDIT_BUDGET_REPORT', payload: updated }, state);
            alert('Pengembalian dana BOS berhasil di-ACC! Jurnal otomatis telah disinkronkan.');
        } catch (err) {
            console.error('Error approving return:', err);
            alert('Gagal menyetujui pengembalian: ' + err.message);
        } finally {
            window.dispatchEvent(new CustomEvent('app-processing-end'));
        }
    };

    return (
        <div className="p-6 space-y-6 min-h-screen" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #f8fafc 100%)' }}>
            {/* Header */}
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/30">
                            <Landmark size={20} className="text-white" />
                        </div>
                        Saldo BOS
                    </h1>
                    <p className="text-slate-500 text-sm mt-1 ml-[52px]">Monitoring ketersediaan, penyerapan per POS, dan pengembalian sisa kas BOS per unit</p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {/* Tombol Pengembalian Sisa BOS */}
                    <button
                        type="button"
                        onClick={() => handleOpenReturnModal()}
                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                    >
                        <RotateCcw size={16} />
                        <span>Pengembalian Sisa Dana BOS</span>
                    </button>

                    {/* Year Selector */}
                    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-2 shadow-sm">
                        <Calendar size={15} className="text-slate-400" />
                        <select
                            value={selectedYearId}
                            onChange={e => setSelectedYearId(e.target.value)}
                            className="text-sm font-bold text-slate-700 bg-transparent border-none outline-none cursor-pointer"
                        >
                            <option value="">Semua Tahun Ajaran</option>
                            {activeYears.map(y => (
                                <option key={y.id} value={y.id}>{y.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                {[
                    {
                        label: 'Total Alokasi BOS',
                        value: formatRupiah(totalAllocated),
                        icon: <Wallet size={22} className="text-green-600" />,
                        bg: 'bg-green-50',
                        border: 'border-green-100',
                        valueColor: 'text-green-700'
                    },
                    {
                        label: 'Total Realisasi BOS',
                        value: formatRupiah(totalRealized),
                        icon: <TrendingDown size={22} className="text-rose-500" />,
                        bg: 'bg-rose-50',
                        border: 'border-rose-100',
                        valueColor: 'text-rose-600'
                    },
                    {
                        label: 'Sisa Saldo Pagu BOS',
                        value: formatRupiah(totalSaldo),
                        icon: <CheckCircle2 size={22} className="text-emerald-600" />,
                        bg: 'bg-emerald-50',
                        border: 'border-emerald-100',
                        valueColor: totalSaldo < 0 ? 'text-rose-600' : 'text-emerald-700'
                    },
                    {
                        label: 'Sisa Kas Belum Dikembalikan',
                        value: formatRupiah(globalUnreturnedCash),
                        icon: <RotateCcw size={22} className="text-amber-600" />,
                        bg: 'bg-amber-50',
                        border: 'border-amber-100',
                        valueColor: globalUnreturnedCash > 0 ? 'text-amber-700 font-extrabold' : 'text-slate-500'
                    }
                ].map((card, i) => (
                    <div key={i} className={`${card.bg} border ${card.border} rounded-3xl p-6 shadow-sm`}>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-white/70 flex items-center justify-center shadow-sm">
                                {card.icon}
                            </div>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{card.label}</span>
                        </div>
                        <div className={`text-2xl font-black ${card.valueColor}`}>{card.value}</div>
                    </div>
                ))}
            </div>

            {/* Usage Bar Global */}
            {totalAllocated > 0 && (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-black text-slate-700">Tingkat Penyerapan Dana BOS</span>
                        <span className="text-sm font-black text-slate-500">{globalPct}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3">
                        <div
                            className={`h-3 rounded-full transition-all duration-1000 ${globalPct >= 90 ? 'bg-gradient-to-r from-rose-500 to-red-600' : globalPct >= 70 ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-gradient-to-r from-green-400 to-emerald-500'}`}
                            style={{ width: `${globalPct}%` }}
                        />
                    </div>
                    <div className="flex justify-between mt-2 text-[10px] font-bold text-slate-400">
                        <span>0%</span>
                        <span className={globalPct >= 90 ? 'text-rose-500' : globalPct >= 70 ? 'text-amber-500' : 'text-emerald-500'}>
                            {globalPct < 70 ? '✅ Dalam batas aman' : globalPct < 90 ? '⚠️ Perlu perhatian' : '🔴 Melebihi batas aman'}
                        </span>
                        <span>100%</span>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Table Toolbar */}
                <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-100 flex-wrap">
                    <div className="flex items-center gap-2 bg-green-900 text-white px-4 py-2 rounded-xl">
                        <Landmark size={14} />
                        <span className="text-xs font-black uppercase tracking-widest">Saldo BOS per Unit</span>
                    </div>
                    <div className="flex-1 max-w-md flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                        <Search size={14} className="text-slate-400" />
                        <input
                            type="text"
                            placeholder="Cari unit penerima BOS..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none"
                        />
                    </div>
                </div>

                {bosUnits.length === 0 ? (
                    <div className="py-20 flex flex-col items-center gap-4 text-center">
                        <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center">
                            <AlertCircle size={28} className="text-slate-400" />
                        </div>
                        <div>
                            <p className="font-bold text-slate-600">Tidak ada unit penerima BOS ditemukan</p>
                            <p className="text-sm text-slate-400 mt-1">Pastikan unit sudah diaktifkan sebagai penerima BOS di pengaturan unit</p>
                        </div>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Unit Penerima BOS / POS Anggaran</th>
                                    <th className="px-6 py-4 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">Alokasi Pagu</th>
                                    <th className="px-6 py-4 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">Realisasi Terserap</th>
                                    <th className="px-6 py-4 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">Sisa Saldo</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Penyerapan</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bosUnits.map(unit => (
                                    <BOSUnitRow
                                        key={unit.id}
                                        unit={unit}
                                        allocations={bosAllocations}
                                        reports={budgetReports}
                                        budgetRequests={budgetRequests}
                                        bosStages={bosStages}
                                        bosPosList={bosPosList}
                                        selectedYearId={selectedYearId}
                                        rabPlans={rabPlans}
                                        expenseItems={expenseItems}
                                        onOpenReturnModal={handleOpenReturnModal}
                                        onApproveReturn={handleApproveReturn}
                                        isSuperAdmin={isSuperAdmin}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Info Footer */}
            <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-sm text-emerald-900">
                <AlertCircle size={16} className="mt-0.5 text-emerald-600 flex-shrink-0" />
                <div className="space-y-1">
                    <p>
                        <strong>Catatan Penyerapan & Pengembalian Dana:</strong>
                    </p>
                    <ul className="text-xs text-emerald-800 list-disc list-inside space-y-0.5 font-medium">
                        <li>Alokasi Pagu bersumber dari rincian POS di menu <strong>Database BOS</strong>.</li>
                        <li>Realisasi dihitung dari belanja nota yang telah diverifikasi (ACC) oleh Yayasan dan dipetakan langsung ke masing-masing POS anggaran.</li>
                        <li>Sisa kas dari permohonan pencairan yang tidak terpakai wajib disetorkan kembali via tombol <strong>Pengembalian Sisa Dana BOS</strong> agar pembukaan pengajuan bulan berikutnya tidak terhambat.</li>
                    </ul>
                </div>
            </div>

            {/* ─────────────────────────────────────────────────────────────────
                Modal Pengembalian Sisa Dana Kas BOS
            ───────────────────────────────────────────────────────────────── */}
            {showReturnModal && (
                <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in" onClick={() => !isSubmittingReturn && setShowReturnModal(false)} />
                    <div className="bg-white rounded-[2.5rem] max-w-lg w-full p-8 shadow-2xl space-y-6 relative z-10 animate-in zoom-in-95 border border-slate-100">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner">
                                    <RotateCcw size={22} />
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-900 text-lg">Pengembalian Sisa Kas BOS</h3>
                                    <p className="text-[11px] font-bold text-slate-400">Setor kembali sisa kas dari pencairan dana BOS ke rekening BOS</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowReturnModal(false)} 
                                disabled={isSubmittingReturn}
                                className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-50 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmitReturn} className="space-y-4">
                            {/* Pilihan Unit (Hanya Superadmin bisa ganti, Admin Unit fix ke unitnya) */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                    Unit Penerima BOS <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    value={returnForm.unitId}
                                    disabled={isAdminUnit}
                                    onChange={e => {
                                        const newUnitId = e.target.value;
                                        const uName = units.find(u => u.id === newUnitId)?.name || '';
                                        setReturnForm(prev => ({
                                            ...prev,
                                            unitId: newUnitId,
                                            budgetRequestId: '',
                                            description: `Pengembalian Sisa Dana Kas BOS ${uName}`
                                        }));
                                    }}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-70"
                                    required
                                >
                                    <option value="">-- Pilih Unit Sekolah --</option>
                                    {bosUnits.map(u => (
                                        <option key={u.id} value={u.id}>{u.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Pilihan Permintaan Dana BOS Terkait */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                    Permintaan Dana BOS yang Memiliki Sisa (Opsional)
                                </label>
                                <select
                                    value={returnForm.budgetRequestId || ''}
                                    onChange={e => {
                                        const reqId = e.target.value;
                                        const chosenReq = returnModalRequests.find(r => r.id === reqId);
                                        if (chosenReq) {
                                            // Hitung sisa permintaan ini
                                            const spent = (budgetReports || []).filter(r => r.budgetRequestId === reqId && r.status === 'APPROVED' && r.kategoriAset !== 'PENGEMBALIAN')
                                                .reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
                                            const ret = (budgetReports || []).filter(r => r.budgetRequestId === reqId && r.status === 'APPROVED' && r.kategoriAset === 'PENGEMBALIAN')
                                                .reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
                                            const reqTotal = parseFloat(chosenReq.totalAmount) || 0;
                                            const sisa = Math.max(0, reqTotal - spent - ret);

                                            setReturnForm(prev => ({
                                                ...prev,
                                                budgetRequestId: reqId,
                                                amount: sisa > 0 ? String(sisa) : prev.amount,
                                                description: `Pengembalian Sisa Dana Kas BOS Bulan ${formatMonthLabel(chosenReq.month)}`
                                            }));
                                        } else {
                                            setReturnForm(prev => ({ ...prev, budgetRequestId: reqId }));
                                        }
                                    }}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                >
                                    <option value="">-- Tanpa Referensi Khusus / Saldo Kas Global --</option>
                                    {returnModalRequests.map(req => {
                                        const spent = (budgetReports || []).filter(r => r.budgetRequestId === req.id && r.status === 'APPROVED' && r.kategoriAset !== 'PENGEMBALIAN')
                                            .reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
                                        const ret = (budgetReports || []).filter(r => r.budgetRequestId === req.id && r.status === 'APPROVED' && r.kategoriAset === 'PENGEMBALIAN')
                                            .reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
                                        const reqTotal = parseFloat(req.totalAmount) || 0;
                                        const sisa = Math.max(0, reqTotal - spent - ret);

                                        return (
                                            <option key={req.id} value={req.id}>
                                                Bulan {formatMonthLabel(req.month)} - Cair: {formatRupiah(reqTotal)} (Sisa: {formatRupiah(sisa)})
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>

                            {/* Nominal Pengembalian */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                    Nominal Pengembalian (Rp) <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    value={returnForm.amount}
                                    onChange={e => setReturnForm(prev => ({ ...prev, amount: e.target.value }))}
                                    placeholder="Contoh: 500000"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    required
                                />
                            </div>

                            {/* Tanggal Penyetoran */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                    Tanggal Penyetoran Kembali <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    value={returnForm.date}
                                    onChange={e => setReturnForm(prev => ({ ...prev, date: e.target.value }))}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    required
                                />
                            </div>

                            {/* Bukti Transaksi */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                    Bukti Penyetoran / Mutasi Bank BOS <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={returnForm.buktiTeks}
                                    onChange={e => setReturnForm(prev => ({ ...prev, buktiTeks: e.target.value }))}
                                    placeholder="Contoh: Slip Setor Bank / No. Ref Mutasi Bank BOS TRX-12345"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    required
                                />
                            </div>

                            {/* Keterangan */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                    Keterangan Detail
                                </label>
                                <textarea
                                    value={returnForm.description}
                                    onChange={e => setReturnForm(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Catatan tambahan mengenai pengembalian sisa kas BOS..."
                                    rows="2"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>

                            {/* Info Box */}
                            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-start gap-2.5">
                                <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                                <p className="text-[11px] text-emerald-800 font-medium leading-relaxed">
                                    Pengembalian dana BOS akan {isSuperAdmin ? 'langsung diverifikasi dan memotong sisa saldo kas unit serta membukukan jurnal umum secara otomatis' : 'dikirim ke Superadmin untuk diverifikasi (ACC)'}. Setelah disetujui, pembatasan ACC permintaan dana bulan berikutnya akan otomatis terhapus.
                                </p>
                            </div>

                            {/* Tombol Aksi */}
                            <div className="pt-3 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowReturnModal(false)}
                                    disabled={isSubmittingReturn}
                                    className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmittingReturn}
                                    className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2"
                                >
                                    {isSubmittingReturn ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            <span>Menyimpan...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Save size={16} />
                                            <span>Catat Pengembalian</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
