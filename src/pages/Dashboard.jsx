import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatRupiah, formatTanggal } from '../utils/format';
import { hitungSaldoAkun } from '../utils/accounting';
import { hitungNilaiBuku } from '../utils/depreciation';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Landmark, TrendingUp, HardDrive, ArrowUpRight, ArrowDownRight, Clock, Send, Plus, Trash2 } from 'lucide-react';
import CurrencyDisplay from '../components/CurrencyDisplay';

const COLORS = ['#DF6B45', '#475D70', '#D49B27', '#157A52', '#7C9387'];

export default function Dashboard() {
    const navigate = useNavigate();
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

    const pieTotal = pieData.reduce((s, d) => s + d.value, 0);
    const netPeriod = totalPenghimpunan - totalBeban;
    const spendingRatio = totalPenghimpunan > 0 ? Math.min(100, Math.round((totalBeban / totalPenghimpunan) * 100)) : 0;

    return (
        <div className="p-4 lg:p-8 max-w-[1440px] mx-auto w-full space-y-5 animate-in fade-in duration-500">
            {/* Page Title Row + Quick Action Buttons (Ferna style) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl lg:text-[28px] font-extrabold text-[#13261E] tracking-tight leading-tight">
                        Ikhtisar Keuangan
                    </h2>
                    <p className="text-xs font-medium text-[#6A7B73] mt-0.5">
                        Aset kelolaan, arus dana tahun {currentYear}, dan posisi transaksi aktif Yayasan Umum.
                    </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                    <button
                        type="button"
                        onClick={() => navigate('/anggaran/rab?source=Yayasan')}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-[#F2F6F4] text-[#24372F] border border-[#D9E2DC] rounded-xl text-xs font-bold shadow-[0_1px_2px_rgba(16,32,26,0.03)] transition-all cursor-pointer active:scale-95"
                    >
                        <Landmark size={14} className="text-[#157A52]" />
                        Lihat RAB
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate('/jurnal')}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#157A52] hover:bg-[#0F5E3F] text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95"
                    >
                        <Send size={14} />
                        Catat Jurnal
                    </button>
                </div>
            </div>

            {/* Ferna Top 3-Part Summary Strip */}
            <div className="bg-white rounded-2xl border border-[#E4EAE6] shadow-[0_1px_2px_rgba(16,32,26,0.03)] grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#ECF0ED]">
                {/* Part 1: Total Aset Kelolaan */}
                <div className="lg:col-span-4 p-5 lg:p-6 flex flex-col justify-between gap-3">
                    <div>
                        <p className="text-xs font-semibold text-[#6A7B73]">Total Aset Kelolaan</p>
                        <h3 className="text-2xl lg:text-[30px] font-extrabold text-[#13261E] tracking-tight tabular-nums mt-1 leading-none">
                            <CurrencyDisplay value={totalAset} />
                        </h3>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#E4F1EA] text-[#0D6844] text-[10px] font-bold tabular-nums">
                            <ArrowUpRight size={11} /> Aset Tetap (NBV)
                        </span>
                        <span className="text-xs font-bold text-[#45574F] tabular-nums">
                            {formatRupiah(totalNilaiBukuAset)}
                        </span>
                    </div>
                </div>

                {/* Part 2: Segmented Asset Composition Bar + Legend */}
                <div className="lg:col-span-5 p-5 lg:p-6 flex flex-col justify-between gap-4">
                    <div className="w-full h-3 rounded-full bg-[#EFF4F1] overflow-hidden flex gap-0.5 p-0.5">
                        {pieData.length > 0 && pieTotal > 0 ? (
                            pieData.map((d, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        width: `${Math.max(4, (d.value / pieTotal) * 100)}%`,
                                        backgroundColor: COLORS[idx % COLORS.length]
                                    }}
                                    className="h-full rounded-full transition-all"
                                    title={`${d.name}: ${formatRupiah(d.value)}`}
                                />
                            ))
                        ) : (
                            <div className="w-full h-full bg-[#DCE5DF] rounded-full" />
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2">
                        {pieData.slice(0, 4).map((d, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-2 min-w-0 text-xs">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <span
                                        className="w-2 h-2 rounded-full shrink-0"
                                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                                    />
                                    <span className="font-medium text-[#52635B] truncate" title={d.name}>{d.name}</span>
                                </div>
                                <span className="font-bold text-[#13261E] tabular-nums shrink-0">{formatRupiah(d.value)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Part 3: Selisih Periode & Rasio Beban */}
                <div className="lg:col-span-3 p-5 lg:p-6 flex flex-col justify-between gap-3">
                    <div>
                        <p className="text-xs font-semibold text-[#6A7B73]">Saldo Bersih ({currentYear})</p>
                        <h3 className={`text-2xl font-extrabold tracking-tight tabular-nums mt-1 leading-none ${netPeriod < 0 ? 'text-rose-600' : 'text-[#157A52]'}`}>
                            {formatRupiah(netPeriod)}
                        </h3>
                        <p className="text-[11px] font-medium text-[#6A7B73] mt-1.5 tabular-nums">
                            {spendingRatio}% beban terhadap penerimaan periode
                        </p>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#E8EFEA] overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${netPeriod < 0 ? 'bg-rose-500' : 'bg-[#157A52]'}`}
                            style={{ width: `${Math.max(6, Math.min(100, 100 - spendingRatio))}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Cash Flow Chart + Right Breakdown Card (Ferna 2-column split) */}
            <div className="bg-white rounded-2xl border border-[#E4EAE6] shadow-[0_1px_2px_rgba(16,32,26,0.03)] p-5 lg:p-6">
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
                    {/* Left 8 Cols: Cash Flow BarChart */}
                    <div className="xl:col-span-8 flex flex-col">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                            <div>
                                <h4 className="text-base font-extrabold text-[#13261E] tracking-tight">
                                    Arus Kas &amp; Aktivitas Dana
                                </h4>
                                <p className="text-xs font-medium text-[#6A7B73]">
                                    Perbandingan penerimaan dan pengeluaran bulanan Yayasan
                                </p>
                            </div>
                            <div className="flex items-center gap-4 text-xs font-semibold text-[#45574F]">
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-[#1E3448]" /> Masuk
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-[#DF6B45]" /> Keluar
                                </span>
                            </div>
                        </div>

                        <div className="flex-1 min-h-[290px]">
                            <ResponsiveContainer width="100%" height={295}>
                                <BarChart data={barData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barGap={6}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EDF2EF" />
                                    <XAxis dataKey="bulan" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#7A8A82', fontWeight: 600 }} dy={8} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#7A8A82', fontWeight: 600 }} tickFormatter={v => `${(v/1000000).toFixed(0)}jt`} />
                                    <Tooltip
                                        cursor={{ fill: '#F4F7F5' }}
                                        formatter={(value) => formatRupiah(value)}
                                        contentStyle={{ borderRadius: '14px', border: '1px solid #E4EAE6', boxShadow: '0 8px 20px -4px rgba(16,32,26,0.08)', fontSize: '12px', fontWeight: 700 }}
                                    />
                                    <Bar dataKey="masuk" name="Penerimaan" fill="#1E3448" radius={[8, 8, 8, 8]} barSize={18} />
                                    <Bar dataKey="keluar" name="Pengeluaran" fill="#DF6B45" radius={[8, 8, 8, 8]} barSize={18} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Right 4 Cols: Soft Sage Inner Summary Panel (Ferna "Where it went") */}
                    <div className="xl:col-span-4 bg-[#F7FAF8] border border-[#E6ECE8] rounded-xl p-5 flex flex-col justify-between gap-5">
                        <div>
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#E4F1EA] text-[#0D6844] text-[10px] font-bold mb-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#157A52]" />
                                Periode {currentYear}
                            </div>
                            <h4 className="text-lg font-extrabold text-[#13261E] tracking-tight">Ringkasan Arus</h4>

                            <div className="grid grid-cols-3 gap-2 mt-4 pb-4 border-b border-[#E3E9E5]">
                                <div>
                                    <p className="text-[10px] font-bold text-[#7A8A82] uppercase tracking-wider">Masuk</p>
                                    <p className="text-xs font-extrabold text-[#157A52] tabular-nums mt-0.5 truncate" title={formatRupiah(totalPenghimpunan)}>
                                        {formatRupiah(totalPenghimpunan)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-[#7A8A82] uppercase tracking-wider">Keluar</p>
                                    <p className="text-xs font-extrabold text-[#13261E] tabular-nums mt-0.5 truncate" title={formatRupiah(totalBeban)}>
                                        {formatRupiah(totalBeban)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-[#7A8A82] uppercase tracking-wider">Net</p>
                                    <p className={`text-xs font-extrabold tabular-nums mt-0.5 truncate ${netPeriod >= 0 ? 'text-[#157A52]' : 'text-rose-600'}`} title={formatRupiah(netPeriod)}>
                                        {formatRupiah(netPeriod)}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-4 space-y-3">
                                <p className="text-[11px] font-bold text-[#6A7B73] uppercase tracking-wider">Komposisi Pos Aset</p>
                                {pieData.length === 0 ? (
                                    <p className="text-xs text-[#7A8A82] py-4 text-center">Belum ada saldo akun aset detail.</p>
                                ) : (
                                    pieData.slice(0, 4).map((item, idx) => {
                                        const pct = pieTotal > 0 ? Math.round((item.value / pieTotal) * 100) : 0;
                                        return (
                                            <div key={idx} className="space-y-1.5">
                                                <div className="flex items-center justify-between gap-2 text-xs">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span
                                                            className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[10px] font-extrabold shrink-0"
                                                            style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                                                        >
                                                            {pct}%
                                                        </span>
                                                        <span className="font-semibold text-[#24372F] truncate" title={item.name}>{item.name}</span>
                                                    </div>
                                                    <span className="font-bold text-[#13261E] tabular-nums shrink-0">{formatRupiah(item.value)}</span>
                                                </div>
                                                <div className="w-full h-1.5 rounded-full bg-[#E5EBE7] overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full"
                                                        style={{ width: `${Math.max(4, pct)}%`, backgroundColor: COLORS[idx % COLORS.length] }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        <div className="pt-3 border-t border-[#E3E9E5] flex items-center justify-between text-xs">
                            <span className="font-semibold text-[#6A7B73]">Aset Tetap (NBV)</span>
                            <span className="font-extrabold text-[#13261E] tabular-nums">{formatRupiah(totalNilaiBukuAset)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Audit Trail */}
            <div className="bg-white p-5 lg:p-6 rounded-2xl border border-[#E4EAE6] shadow-[0_1px_2px_rgba(16,32,26,0.03)]">
                <div className="flex items-center justify-between gap-4 mb-4">
                    <h4 className="text-base font-extrabold text-[#13261E] flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-lg bg-[#E4F1EA] text-[#157A52] flex items-center justify-center">
                            <Clock size={15} />
                        </span>
                        Jejak Transaksi Terbaru
                    </h4>
                    <button
                        type="button"
                        onClick={() => navigate('/jurnal')}
                        className="text-xs font-bold text-[#157A52] hover:text-[#0F5E3F] cursor-pointer"
                    >
                        Lihat semua →
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-[#E6ECE8] uppercase text-[10px] font-bold tracking-wider text-[#7A8A82]">
                                <th className="pb-3">No. Reff</th>
                                <th className="pb-3">Deskripsi</th>
                                <th className="pb-3 text-right">Nominal</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F0F4F1]">
                            {recentJournals.map((j) => (
                                <tr key={j.id} className="group hover:bg-[#F7FAF8] transition-colors">
                                    <td className="py-3.5 font-bold text-xs text-[#157A52] tabular-nums whitespace-nowrap pr-4">{j.id}</td>
                                    <td className="py-3.5 pr-4">
                                        <p className="font-semibold text-[#1E3129] text-sm">{j.description}</p>
                                        <p className="text-[11px] text-[#7A8A82]">{j.date}</p>
                                    </td>
                                    <td className="py-3.5 text-right font-extrabold text-[#13261E] tabular-nums whitespace-nowrap">
                                        <CurrencyDisplay value={j.entries.reduce((s,e) => s + (e.debit||0), 0)} />
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
