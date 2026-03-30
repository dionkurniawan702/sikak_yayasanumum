import React, { useState, useEffect } from 'react';
import { Landmark, TrendingUp, PieChart, Info, ArrowRight, ShieldCheck, HelpCircle, Layers } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { formatRupiah } from '../../utils/format';

export default function FundAvailability() {
    const { state } = useApp();
    const { currentUser } = state;
    const [fundPositions, setFundPositions] = useState([]);
    const [loading, setLoading] = useState(true);

    const unitId = currentUser?.unitId || 'UNIT-ALL'; // Fallback if no unit

    useEffect(() => {
        if (unitId) {
            setLoading(true);
            api.fetchFundAvailability(unitId).then(data => {
                setFundPositions(data);
                setLoading(false);
            }).catch(() => setLoading(false));
        }
    }, [unitId]);

    const totalAllocated = fundPositions.reduce((sum, item) => sum + (parseFloat(item.totalAllocated) || 0), 0);
    const totalUsed = fundPositions.reduce((sum, item) => sum + (parseFloat(item.totalUsed) || 0), 0);
    const totalAvailable = totalAllocated - totalUsed;

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-500 font-bold animate-pulse uppercase tracking-widest text-xs">Menghitung Ketersediaan Dana...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 animate-in">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2 font-display">Ketersediaan Dana</h1>
                    <p className="text-slate-500 font-medium italic">Status real-time alokasi dan sisa dana untuk Unit {state.units.find(u => u.id === unitId)?.name || 'Yayasan'}.</p>
                </div>
                <div className="flex items-center gap-3 px-6 py-3 bg-blue-50 text-blue-700 rounded-2xl border border-blue-100">
                    <ShieldCheck size={20} />
                    <span className="text-sm font-black uppercase tracking-widest">Tervalidasi Sistem</span>
                </div>
            </div>

            {/* Main Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="card p-8 border-l-8 border-l-blue-600 bg-gradient-to-br from-white to-blue-50/30">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Alokasi Tahunan</p>
                    <h2 className="text-3xl font-black text-slate-900 font-display">{formatRupiah(totalAllocated)}</h2>
                    <div className="mt-4 flex items-center gap-2 text-blue-600 text-xs font-bold">
                        <TrendingUp size={14} />
                        <span>Sesuai Alokasi Distribusi</span>
                    </div>
                </div>
                <div className="card p-8 border-l-8 border-l-amber-500 bg-gradient-to-br from-white to-amber-50/30">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Dana Keluar (Cair)</p>
                    <h2 className="text-3xl font-black text-slate-900 font-display">{formatRupiah(totalUsed)}</h2>
                    <div className="mt-4 flex items-center gap-2 text-amber-600 text-xs font-bold">
                        <PieChart size={14} />
                        <span>{totalAllocated > 0 ? ((totalUsed / totalAllocated) * 100).toFixed(1) : 0}% dari Alokasi</span>
                    </div>
                </div>
                <div className="card p-8 border-l-8 border-l-emerald-500 bg-gradient-to-br from-white to-emerald-50/30">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Sisa Dana (Available)</p>
                    <h2 className={`text-3xl font-black font-display ${totalAvailable < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {formatRupiah(totalAvailable)}
                    </h2>
                    <div className="mt-4 flex items-center gap-2 text-emerald-600 text-xs font-bold">
                        <Landmark size={14} />
                        <span>Siap Digunakan</span>
                    </div>
                </div>
            </div>

            {/* Detailed Table */}
            <div className="card overflow-hidden shadow-xl mb-10">
                <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
                    <h3 className="font-black uppercase text-xs tracking-widest flex items-center gap-2">
                        <Layers className="text-blue-400" size={16} /> Pos Anggaran Unit
                    </h3>
                    <div className="flex items-center gap-4">
                         <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-emerald-500" />
                            <span className="text-[10px] font-bold">Aman</span>
                         </div>
                         <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-rose-500" />
                            <span className="text-[10px] font-bold">Kritis</span>
                         </div>
                    </div>
                </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Kategori Pos</th>
                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Alokasi Dana</th>
                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Dana Digunakan</th>
                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sisa Saldo</th>
                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Progress</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {fundPositions.map((item, idx) => {
                        const available = item.available;
                        const percentage = item.totalAllocated > 0 ? (item.totalUsed / item.totalAllocated) * 100 : 0;
                        const colors = ['blue', 'indigo', 'emerald', 'amber', 'rose', 'purple'];
                        const color = colors[idx % colors.length];
                        
                        return (
                            <tr key={item.expenseItemId} className="hover:bg-slate-50/50 transition-colors group">
                                <td className="px-8 py-6">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-2 h-10 rounded-full bg-${color}-500 group-hover:scale-y-125 transition-transform`} />
                                        <span className="font-black text-slate-700">{item.expenseItemName}</span>
                                    </div>
                                </td>
                                <td className="px-8 py-6 font-bold text-slate-500">
                                    {formatRupiah(item.totalAllocated)}
                                </td>
                                <td className="px-8 py-6">
                                    <div className="flex flex-col">
                                        <span className="font-black text-slate-900 text-lg">{formatRupiah(item.totalUsed)}</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Realisasi</span>
                                    </div>
                                </td>
                                <td className="px-8 py-6">
                                    <span className={`text-lg font-black ${available < 5000000 ? 'text-rose-600' : 'text-blue-600'}`}>
                                        {formatRupiah(available)}
                                    </span>
                                </td>
                                <td className="px-8 py-6 text-right w-64">
                                    <div className="flex flex-col gap-2">
                                        <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            <span>Usage</span>
                                            <span>{percentage.toFixed(1)}%</span>
                                        </div>
                                        <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-200 p-0.5">
                                            <div 
                                                className={`h-full rounded-full bg-${color}-500 shadow-sm`}
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
                                Belum ada data alokasi dana untuk unit ini.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
            </div>

            {/* Helper Alert */}
            <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1 p-8 bg-blue-50 rounded-[32px] border border-blue-100 flex items-start gap-5">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm shrink-0">
                        <Info size={24} />
                    </div>
                    <div>
                        <h4 className="font-black text-slate-900 mb-2 font-display uppercase tracking-wider text-sm">Bagaimana Saldo Dihitung?</h4>
                        <p className="text-sm text-slate-600 leading-relaxed font-semibold pr-4">
                            Saldo tersedia dihitung secara real-time berdasarkan total pembayaran siswa yang masuk dikalikan dengan persentase distribusi, dikurangi dengan permintaan dana yang telah disetujui.
                        </p>
                    </div>
                </div>
                <div className="flex-1 p-8 bg-slate-50 rounded-[32px] border border-slate-100 flex items-start gap-5">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 shadow-sm shrink-0">
                        <HelpCircle size={24} />
                    </div>
                    <div>
                        <h4 className="font-black text-slate-900 mb-2 font-display uppercase tracking-wider text-sm">Butuh Bantuan?</h4>
                        <p className="text-sm text-slate-500 leading-relaxed font-semibold pr-4">
                            Jika terdapat ketidaksesuaian data saldo, silakan hubungi Bidang Keuangan untuk rekonsiliasi data setoran siswa.
                        </p>
                        <button className="mt-4 flex items-center gap-2 text-xs font-black text-blue-600 hover:gap-3 transition-all">
                            Hubungi Support <ArrowRight size={14} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
