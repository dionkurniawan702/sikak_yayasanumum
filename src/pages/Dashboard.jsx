import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatRupiah, formatTanggal } from '../utils/format';
import { hitungSaldoAkun } from '../utils/accounting';
import { hitungNilaiBuku } from '../utils/depreciation';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Landmark, TrendingUp, TrendingDown, HardDrive, ArrowUpRight, ArrowDownRight, Clock, Search, Gem, Trash2 } from 'lucide-react';
import CurrencyDisplay from '../components/CurrencyDisplay';

const COLORS = ['#0f2347', '#059669', '#d4af37', '#1e40af', '#10b981', '#b45309'];

export default function Dashboard() {
    const { state, dispatch } = useApp();
    const journals = state.journals.filter(j => !j.isDeleted);
    const accounts = state.accounts.filter(a => !a.isDeleted);
    const assets = state.assets.filter(a => !a.isDeleted);
    const programs = state.programs.filter(p => !p.isDeleted);
    const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);

    const currentYear = new Date().getFullYear().toString();

    // Summary Statistics (PSAK 35 adaptation)
    const totalAset = accounts
        .filter(a => a.category === 'detail' && a.type === 'Aset')
        .reduce((sum, acc) => sum + hitungSaldoAkun(journals, acc.id, accounts, null, assets), 0);

    const totalPenghimpunan = accounts
        .filter(a => a.category === 'detail' && a.type === 'Pendapatan')
        .reduce((sum, acc) => sum + Math.abs(hitungSaldoAkun(journals, acc.id, accounts, currentYear, assets, true)), 0);

    const totalBeban = accounts
        .filter(a => a.category === 'detail' && a.type === 'Beban')
        .reduce((sum, acc) => sum + hitungSaldoAkun(journals, acc.id, accounts, currentYear, assets, true), 0);

    const totalNilaiBukuAset = assets.reduce((sum, a) => sum + hitungNilaiBuku(a), 0);

    // Monthly Data
    const monthlyData = {};
    journals.forEach(j => {
        const month = j.date.slice(0, 7);
        if (!monthlyData[month]) monthlyData[month] = { bulan: month, masuk: 0, keluar: 0 };
        j.entries.forEach(e => {
            const acc = accounts.find(a => a.id === e.accountId);
            if (acc?.type === 'Pendapatan') monthlyData[month].masuk += (e.credit || 0);
            if (acc?.type === 'Beban') monthlyData[month].keluar += (e.debit || 0);
        });
    });
    const barData = Object.values(monthlyData).sort((a, b) => a.bulan.localeCompare(b.bulan));

    // Distribution
    const pieData = accounts
        .filter(a => a.category === 'detail' && a.type === 'Aset')
        .map(a => ({
            name: a.name,
            value: Math.abs(hitungSaldoAkun(journals, a.id, accounts, null, assets))
        }))
        .filter(d => d.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

    const recentJournals = [...journals].sort((a, b) => b.id.localeCompare(a.id)).slice(0, 5);

    return (
        <div className="p-6 lg:p-8">
            <div className="flex justify-between items-center mb-8 gap-4 flex-wrap">
                <div>
                    <h2 className="text-3xl font-black text-[#0f2347] tracking-tight">Executive Dashboard</h2>
                    <p className="text-slate-500 font-medium">Monitoring Real-time Keuangan Yayasan Umum</p>
                </div>
                <div className="bg-white px-4 py-2 rounded-xl shadow-xs border border-slate-200/80 flex items-center gap-2">
                    <Clock size={16} className="text-emerald-600" />
                    <span className="text-sm font-bold text-[#0f2347]">{formatTanggal(new Date())}</span>
                </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {[
                    { title: 'Total Aset Kelolaan', value: totalAset, icon: <Landmark />, iconClass: 'bg-[#0f2347]/5 text-[#0f2347] border-[#0f2347]/15', borderAccent: 'border-l-[#0f2347]', trend: '+12%', isUp: true },
                    { title: 'Penerimaan Periode', value: totalPenghimpunan, icon: <TrendingUp />, iconClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/70', borderAccent: 'border-l-emerald-600', trend: '+8.5%', isUp: true },
                    { title: 'Beban Operasional', value: totalBeban, icon: <TrendingDown />, iconClass: 'bg-amber-50 text-amber-700 border-amber-200/70', borderAccent: 'border-l-amber-500', trend: '-2.1%', isUp: false },
                    { title: 'Aset Tetap (NBV)', value: totalNilaiBukuAset, icon: <HardDrive />, iconClass: 'bg-emerald-50/70 text-[#0f2347] border-amber-200/70', borderAccent: 'border-l-amber-600', trend: 'Stabil', isUp: true },
                ].map((stat, idx) => (
                    <div key={idx} className={`bg-white p-6 rounded-2xl shadow-xs border border-slate-200/80 border-l-4 ${stat.borderAccent} relative overflow-hidden group hover:shadow-lg transition-all duration-300`}>
                        <div className="flex justify-between mb-4 relative z-10">
                            <div className={`p-3 rounded-xl border ${stat.iconClass} group-hover:scale-105 transition-transform`}>
                                {stat.icon}
                            </div>
                            <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-full h-fit ${stat.isUp ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'bg-amber-50 text-amber-800 border border-amber-200/70'}`}>
                                {stat.isUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                                {stat.trend}
                            </div>
                        </div>
                        <div className="relative z-10">
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.title}</p>
                            <h3 className="text-2xl font-black text-slate-900 leading-none">
                                <CurrencyDisplay value={stat.value} useColor={!stat.isUp && stat.value < 0} />
                            </h3>
                        </div>
                    </div>
                ))}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <div className="bg-white p-6 lg:p-8 rounded-2xl shadow-xs border border-slate-200/80">
                    <h4 className="text-lg font-black text-[#0f2347] mb-6 flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-600"></div>
                        Aktivitas Dana Yayasan
                    </h4>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={barData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="bulan" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} tickFormatter={v => `${(v/1000000).toFixed(0)}jt`} />
                            <Tooltip
                                cursor={{ fill: '#f8fafc' }}
                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                            />
                            <Bar dataKey="masuk" fill="#059669" radius={[6, 6, 0, 0]} barSize={20} />
                            <Bar dataKey="keluar" fill="#d4af37" radius={[6, 6, 0, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="bg-white p-6 lg:p-8 rounded-2xl shadow-xs border border-slate-200/80">
                    <h4 className="text-lg font-black text-[#0f2347] mb-6 flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#0f2347]"></div>
                        Komposisi Aset
                    </h4>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie data={pieData} innerRadius={80} outerRadius={110} paddingAngle={5} dataKey="value">
                                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                            <Legend verticalAlign="bottom" iconType="circle" />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Audit Trail */}
            <div className="bg-white p-6 lg:p-8 rounded-2xl shadow-xs border border-slate-200/80">
                <h4 className="text-lg font-black text-[#0f2347] mb-6 flex items-center gap-3">
                    <Clock size={20} className="text-emerald-600" />
                    Jejak Transaksi Terbaru
                </h4>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-100 uppercase text-[10px] font-black tracking-widest text-slate-400">
                                <th className="pb-4">No. Reff</th>
                                <th className="pb-4">Deskripsi</th>
                                <th className="pb-4 text-right">Nominal</th>
                                <th className="pb-4 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {recentJournals.map((j) => (
                                <tr key={j.id} className="group hover:bg-slate-50 transition-colors">
                                    <td className="py-4 font-bold text-xs text-emerald-700">{j.id}</td>
                                    <td className="py-4">
                                        <p className="font-bold text-slate-700 text-sm">{j.description}</p>
                                        <p className="text-[10px] text-slate-400">{j.date}</p>
                                    </td>
                                    <td className="py-4 text-right font-black text-slate-900">
                                        <CurrencyDisplay value={j.entries.reduce((s,e) => s + (e.debit||0), 0)} />
                                    </td>
                                    <td className="py-4 text-center">
                                        <button className="text-slate-200 hover:text-slate-400 transition-colors">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
