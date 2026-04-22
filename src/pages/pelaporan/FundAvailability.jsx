import React, { useMemo } from 'react';
import { Landmark, TrendingUp, PieChart, Info, ArrowRight, ShieldCheck, HelpCircle, Layers, Wallet, Clock, CheckCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatRupiah } from '../../utils/format';

export default function FundAvailability() {
    const { state } = useApp();
    const { currentUser, budgetRequests, realizations, units, globalAcademicYearId } = state;

    const isSuperAdmin = currentUser?.role === 'superadmin';
    const myUnitId = currentUser?.unitId;
    const myFieldId = currentUser?.fieldId;

    // Filter data for the current user and academic year
    const relevantRequests = useMemo(() => {
        return (budgetRequests || []).filter(req => {
            const isYear = req.academicYearId === globalAcademicYearId;
            if (!isYear) return false;
            if (isSuperAdmin) return true;
            if (myUnitId) return req.unitId === myUnitId;
            if (myFieldId) return req.fieldId === myFieldId;
            return false;
        });
    }, [budgetRequests, isSuperAdmin, myUnitId, myFieldId, globalAcademicYearId]);

    const relevantRealizations = useMemo(() => {
        return (realizations || []).filter(rel => {
            const isYear = rel.academicYearId === globalAcademicYearId;
            if (!isYear) return false;
            if (isSuperAdmin) return true;
            if (myUnitId) return rel.unitId === myUnitId;
            if (myFieldId) return rel.fieldId === myFieldId;
            return false;
        });
    }, [realizations, isSuperAdmin, myUnitId, myFieldId, globalAcademicYearId]);

    // Aggregate by Category (Expense Item)
    const fundPositions = useMemo(() => {
        const positions = {};

        // 1. Add from Approved Requests
        relevantRequests.filter(r => r.status === 'APPROVED').forEach(req => {
            (req.items || []).forEach(item => {
                const category = item.name || 'General';
                if (!positions[category]) {
                    positions[category] = { category, totalApproved: 0, totalUsed: 0 };
                }
                positions[category].totalApproved += (parseFloat(item.amount) || 0);
            });
        });

        // 2. Subtract from Realizations
        relevantRealizations.forEach(rel => {
            const category = rel.category || 'General';
            if (!positions[category]) {
                positions[category] = { category, totalApproved: 0, totalUsed: 0 };
            }
            positions[category].totalUsed += (parseFloat(rel.amount) || 0);
        });

        return Object.values(positions);
    }, [relevantRequests, relevantRealizations]);

    const totalApproved = relevantRequests.filter(r => r.status === 'APPROVED').reduce((sum, r) => sum + (parseFloat(r.totalAmount) || 0), 0);
    const totalUsed = relevantRealizations.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
    const totalBalance = totalApproved - totalUsed;
    const pendingAmount = relevantRequests.filter(r => r.status === 'PENDING').reduce((sum, r) => sum + (parseFloat(r.totalAmount) || 0), 0);

    return (
        <div className="p-8 animate-in fade-in duration-500">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2 font-display">Ketersediaan Dana & Saldo</h1>
                    <p className="text-slate-500 font-medium italic">
                        {isSuperAdmin ? 'Monitoring saldo kas seluruh unit kerja.' : `Status saldo kas Unit ${units.find(u => u.id === myUnitId)?.name || 'Yayasan'}.`}
                    </p>
                </div>
                <div className="flex items-center gap-3 px-6 py-3 bg-indigo-50 text-indigo-700 rounded-2xl border border-indigo-100 shadow-sm">
                    <ShieldCheck size={20} />
                    <span className="text-xs font-black uppercase tracking-widest">Saldo Real-Time</span>
                </div>
            </div>

            {/* Main Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
                <div className="card p-8 bg-white border-b-4 border-emerald-500 shadow-lg hover:translate-y-[-4px] transition-all">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4"><CheckCircle size={24} /></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Dana ACC (Masuk)</p>
                    <h2 className="text-2xl font-black text-slate-900">{formatRupiah(totalApproved)}</h2>
                </div>

                <div className="card p-8 bg-white border-b-4 border-rose-500 shadow-lg hover:translate-y-[-4px] transition-all">
                    <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center mb-4"><TrendingUp size={24} /></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Realisasi (Keluar)</p>
                    <h2 className="text-2xl font-black text-slate-900">{formatRupiah(totalUsed)}</h2>
                </div>

                <div className="card p-8 bg-indigo-600 text-white border-b-4 border-indigo-800 shadow-xl hover:translate-y-[-4px] transition-all">
                    <div className="w-12 h-12 bg-white/20 text-white rounded-xl flex items-center justify-center mb-4"><Wallet size={24} /></div>
                    <p className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-1">Saldo Kas di Tangan</p>
                    <h2 className="text-2xl font-black">{formatRupiah(totalBalance)}</h2>
                </div>

                <div className="card p-8 bg-white border-b-4 border-amber-500 shadow-lg hover:translate-y-[-4px] transition-all">
                    <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-4"><Clock size={24} /></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Menunggu ACC (Proses)</p>
                    <h2 className="text-2xl font-black text-amber-600">{formatRupiah(pendingAmount)}</h2>
                </div>
            </div>

            {/* Detailed Table */}
            <div className="card overflow-hidden shadow-2xl mb-10 rounded-[2rem] bg-white border-0">
                <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
                    <h3 className="font-black uppercase text-xs tracking-widest flex items-center gap-2">
                        <Layers className="text-indigo-400" size={16} /> Rincian Saldo per Kategori
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Kategori Pengeluaran</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Dana Cair (ACC)</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Realisasi</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sisa Saldo</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Penyerapan</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {fundPositions.map((item, idx) => {
                                const available = item.totalApproved - item.totalUsed;
                                const percentage = item.totalApproved > 0 ? (item.totalUsed / item.totalApproved) * 100 : 0;

                                return (
                                    <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-2 h-10 rounded-full bg-indigo-600 group-hover:scale-y-125 transition-transform" />
                                                <span className="font-black text-slate-700">{item.category}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 font-bold text-slate-500">
                                            {formatRupiah(item.totalApproved)}
                                        </td>
                                        <td className="px-8 py-6 font-black text-rose-600">
                                            {formatRupiah(item.totalUsed)}
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className={`text-lg font-black ${available < 0 ? 'text-rose-600' : 'text-indigo-600'}`}>
                                                {formatRupiah(available)}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6 text-right w-64">
                                            <div className="flex flex-col gap-2">
                                                <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                    <span>Terpakai</span>
                                                    <span>{percentage.toFixed(1)}%</span>
                                                </div>
                                                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-200">
                                                    <div
                                                        className="h-full bg-indigo-600 shadow-sm"
                                                        style={{ width: `${Math.min(100, percentage)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {fundPositions.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="px-8 py-20 text-center text-slate-400 font-medium italic">
                                        Belum ada data saldo kas. Lakukan pengajuan dana terlebih dahulu.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Helper Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-8 bg-indigo-50 rounded-[2.5rem] border border-indigo-100 flex items-start gap-4">
                    <div className="p-3 bg-white text-indigo-600 rounded-2xl shadow-sm"><Info size={24} /></div>
                    <div>
                        <h4 className="font-black text-slate-900 uppercase text-xs tracking-widest mb-2">Informasi Saldo</h4>
                        <p className="text-sm text-slate-600 leading-relaxed font-semibold">
                            "Saldo Kas di Tangan" adalah dana yang sudah Anda ajukan dan telah disetujui (ACC) oleh Superadmin, dikurangi dengan laporan realisasi pengeluaran yang Anda catat.
                        </p>
                    </div>
                </div>
                <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 flex items-start gap-4">
                    <div className="p-3 bg-white text-slate-400 rounded-2xl shadow-sm"><HelpCircle size={24} /></div>
                    <div>
                        <h4 className="font-black text-slate-900 uppercase text-xs tracking-widest mb-2">Pencatatan Realisasi</h4>
                        <p className="text-sm text-slate-500 leading-relaxed font-semibold">
                            Pastikan Anda segera mencatat pengeluaran di menu **Laporan Realisasi** agar sisa saldo kas Anda selalu akurat dan up-to-date.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
