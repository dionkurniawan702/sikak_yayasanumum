import React, { useMemo, useState } from 'react';
import { Landmark, TrendingDown, Wallet, Building2, ChevronDown, ChevronRight, Calendar, Search, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatRupiah } from '../../utils/format';

// ─────────────────────────────────────────────────────────────────────────────
// Row per unit – bisa di-expand untuk melihat rincian per Tahap & POS
// ─────────────────────────────────────────────────────────────────────────────
function BOSUnitRow({ unit, allocations, reports, budgetRequests, bosStages, bosPosList, selectedYearId }) {
    const [open, setOpen] = useState(false);

    const unitAllocations = allocations.filter(a =>
        a.unitId === unit.id &&
        !a.isDeleted &&
        (selectedYearId ? a.academicYearId === selectedYearId : true)
    );

    const totalAllocated = unitAllocations.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);

    // Realisasi = budget reports yang berasal dari RAB BOS unit ini
    const unitReports = reports.filter(r => {
        if (r.unitId !== unit.id || r.isDeleted || r.status !== 'APPROVED' || r.kategoriAset === 'PENGEMBALIAN') return false;
        if (selectedYearId && r.academicYearId !== selectedYearId) return false;
        
        // FILTER: ONLY BOS
        const req = budgetRequests.find(br => br.id === r.budgetRequestId);
        return (req?.items || []).some(item => item.planId?.endsWith('-BOS'));
    });
    const totalRealized = unitReports.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const saldo = totalAllocated - totalRealized;
    const pctUsed = totalAllocated > 0 ? Math.min(100, Math.round((totalRealized / totalAllocated) * 100)) : 0;

    const hasData = totalAllocated > 0;
    const saldoColor = saldo < 0 ? 'text-rose-600' : saldo > 0 ? 'text-emerald-600' : 'text-slate-400';
    const barColor = pctUsed >= 90 ? 'bg-rose-500' : pctUsed >= 70 ? 'bg-amber-500' : 'bg-emerald-500';

    // Group allocations by stage
    const byStage = useMemo(() => {
        const map = {};
        unitAllocations.forEach(a => {
            const stage = bosStages.find(s => s.id === a.stageId);
            const pos = bosPosList.find(p => p.id === a.posId);
            const stageName = stage?.name || 'Tahap Tidak Dikenal';
            if (!map[stageName]) map[stageName] = { stage: stageName, items: [] };
            map[stageName].items.push({
                pos: pos?.name || 'POS Tidak Dikenal',
                amount: parseFloat(a.amount) || 0
            });
        });
        return Object.values(map);
    }, [unitAllocations, bosStages, bosPosList]);

    return (
        <>
            <tr
                className={`border-b border-slate-100 cursor-pointer transition-all duration-200 ${open ? 'bg-green-50/60' : 'hover:bg-slate-50'} ${!hasData ? 'opacity-60' : ''}`}
                onClick={() => hasData && setOpen(o => !o)}
            >
                <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                        <div className="w-9 h-9 rounded-xl bg-green-50 text-green-600 flex items-center justify-center flex-shrink-0">
                            <Building2 size={16} />
                        </div>
                        <div>
                            <div className="font-black text-slate-800 text-sm">{unit.name}</div>
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

            {open && byStage.map((stageGroup, si) => (
                <React.Fragment key={si}>
                    <tr className="bg-green-50/30">
                        <td className="pl-16 pr-6 py-2" colSpan={5}>
                            <span className="text-[10px] font-black text-green-700 uppercase tracking-widest">
                                📌 {stageGroup.stage}
                            </span>
                        </td>
                    </tr>
                    {stageGroup.items.map((item, ii) => (
                        <tr key={ii} className="border-b border-slate-50 bg-green-50/20">
                            <td className="pl-20 pr-6 py-2 text-xs text-slate-600 font-medium">{item.pos}</td>
                            <td className="px-6 py-2 text-right text-xs font-bold text-slate-700">{formatRupiah(item.amount)}</td>
                            <td className="px-6 py-2 text-right text-xs text-slate-400">—</td>
                            <td className="px-6 py-2 text-right text-xs text-slate-400">—</td>
                            <td className="px-6 py-2" />
                        </tr>
                    ))}
                </React.Fragment>
            ))}
        </>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Halaman Utama: Saldo BOS
// ─────────────────────────────────────────────────────────────────────────────
export default function BOSSaldo() {
    const { state } = useApp();
    const {
        bosAllocations = [],
        bosStages = [],
        bosPosList = [],
        units = [],
        academicYears = [],
        budgetReports = [],
        budgetRequests = [],
        currentUser
    } = state;

    const isSuperAdmin = currentUser?.role === 'superadmin';
    const isAdminUnit = currentUser?.role === 'admin_unit';

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedYearId, setSelectedYearId] = useState(() => {
        const active = academicYears.find(y => y.isCurrent && !y.isDeleted);
        return active?.id || academicYears.filter(y => !y.isDeleted).sort((a, b) => b.name.localeCompare(a.name))[0]?.id || '';
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
            return (req?.items || []).some(item => item.planId?.endsWith('-BOS'));
        });
        const realized = yearReports.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
        return { totalAllocated: allocated, totalRealized: realized, totalSaldo: allocated - realized };
    }, [bosAllocations, budgetReports, selectedYearId]);

    const globalPct = totalAllocated > 0 ? Math.min(100, Math.round((totalRealized / totalAllocated) * 100)) : 0;

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
                    <p className="text-slate-500 text-sm mt-1 ml-[52px]">Monitoring ketersediaan dan realisasi dana Bantuan Operasional Sekolah per unit</p>
                </div>

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

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                        label: 'Total Realisasi',
                        value: formatRupiah(totalRealized),
                        icon: <TrendingDown size={22} className="text-rose-500" />,
                        bg: 'bg-rose-50',
                        border: 'border-rose-100',
                        valueColor: 'text-rose-600'
                    },
                    {
                        label: 'Sisa Saldo BOS',
                        value: formatRupiah(totalSaldo),
                        icon: <CheckCircle2 size={22} className="text-emerald-600" />,
                        bg: 'bg-emerald-50',
                        border: 'border-emerald-100',
                        valueColor: totalSaldo < 0 ? 'text-rose-600' : 'text-emerald-700'
                    }
                ].map((card, i) => (
                    <div key={i} className={`${card.bg} border ${card.border} rounded-3xl p-6 shadow-sm`}>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-white/70 flex items-center justify-center shadow-sm">
                                {card.icon}
                            </div>
                            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">{card.label}</span>
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
                <div className="flex items-center gap-4 px-6 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-2 bg-green-900 text-white px-4 py-2 rounded-xl">
                        <Landmark size={14} />
                        <span className="text-xs font-black uppercase tracking-widest">Saldo BOS per Unit</span>
                    </div>
                    <div className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                        <Search size={14} className="text-slate-400" />
                        <input
                            type="text"
                            placeholder="Cari unit..."
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
                                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Unit Penerima BOS</th>
                                    <th className="px-6 py-4 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">Alokasi</th>
                                    <th className="px-6 py-4 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">Realisasi</th>
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
                                        budgetRequests={state.budgetRequests}
                                        bosStages={bosStages}
                                        bosPosList={bosPosList}
                                        selectedYearId={selectedYearId}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Info Footer */}
            <div className="flex items-start gap-3 bg-green-50 border border-green-100 rounded-2xl p-4 text-sm text-green-800">
                <AlertCircle size={16} className="mt-0.5 text-green-600 flex-shrink-0" />
                <p>
                    <strong>Catatan:</strong> Alokasi BOS bersumber dari data yang diinput di menu <strong>Database BOS</strong>.
                    Realisasi dihitung dari laporan yang sudah diverifikasi oleh Yayasan.
                </p>
            </div>
        </div>
    );
}
