import { useState, Fragment, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { hitungSaldoPerTipe, buildHierarchyAccounts } from '../utils/accounting';
import { formatRupiah, formatTanggal } from '../utils/format';
import { Landmark, TrendingDown, Printer, Download, FileText, PieChart } from 'lucide-react';
import CurrencyDisplay from '../components/CurrencyDisplay';

export default function BalanceSheet() {
    const { state } = useApp();
    const accounts = state.accounts.filter(a => !a.isDeleted);
    const journals = state.journals.filter(j => !j.isDeleted);
    const assets = state.assets.filter(a => !a.isDeleted);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
    const reportRef = useRef(null);
    const currentYearStr = selectedYear;
    const prevYearStr = (parseInt(selectedYear) - 1).toString();

    const buildCompHierarchy = (type) => {
        const curr = buildHierarchyAccounts(journals, accounts, type, null, currentYearStr, assets);
        const prev = buildHierarchyAccounts(journals, accounts, type, null, prevYearStr, assets);

        return curr.map(currSt => {
            const prevSt = prev.find(p => p.name === currSt.name);
            return {
                ...currSt,
                saldoPrev: prevSt ? prevSt.saldo : 0,
                headers: currSt.headers.map(h => {
                    const prevH = prevSt?.headers.find(ph => ph.id === h.id);
                    return {
                        ...h,
                        saldoPrev: prevH ? prevH.saldo : 0,
                        children: h.children.map(c => {
                            const prevC = prevH?.children.find(pc => pc.id === c.id);
                            return { ...c, saldoPrev: prevC ? prevC.saldo : 0 };
                        })
                    };
                })
            };
        });
    };

    const hierAset = buildCompHierarchy('Aset');
    const hierKew = buildCompHierarchy('Kewajiban');
    const hierNeto = buildCompHierarchy('Aset Neto');

    const totalAsetCurr = hitungSaldoPerTipe(journals, accounts, 'Aset', currentYearStr, assets);
    const totalAsetPrev = hitungSaldoPerTipe(journals, accounts, 'Aset', prevYearStr, assets);
    
    const totalKewCurr = hitungSaldoPerTipe(journals, accounts, 'Kewajiban', currentYearStr, assets);
    const totalKewPrev = hitungSaldoPerTipe(journals, accounts, 'Kewajiban', prevYearStr, assets);
    
    const totalNetoCurr = hitungSaldoPerTipe(journals, accounts, 'Aset Neto', currentYearStr, assets);
    const totalNetoPrev = hitungSaldoPerTipe(journals, accounts, 'Aset Neto', prevYearStr, assets);

    const getSurplus = (year) => {
        const p = hitungSaldoPerTipe(journals, accounts, 'Pendapatan', year, assets);
        const b = hitungSaldoPerTipe(journals, accounts, 'Beban', year, assets);
        return p - b;
    };

    const surplusCurr = getSurplus(currentYearStr);
    const surplusPrev = getSurplus(prevYearStr);

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-8 print:hidden">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Laporan Posisi Keuangan</h2>
                    <p className="text-slate-500 font-medium tracking-tight">Kompilasi Aset, Liabilitas, dan Aset Neto (PSAK 35)</p>
                </div>
                <div className="flex gap-4 items-center">
                    <select className="form-select rounded-2xl border-slate-200 text-xs font-bold" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
                        <option value="2026">Tahun 2026</option>
                        <option value="2025">Tahun 2025</option>
                        <option value="2024">Tahun 2024</option>
                    </select>
                    <button onClick={() => window.print()} className="btn btn-primary px-8 py-3 rounded-2xl shadow-xl shadow-blue-500/20 font-black">
                        <Printer size={18} /> Cetak Laporan
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 animate-in" ref={reportRef}>
                {/* SISI ASET */}
                <div className="bg-white rounded-[32px] border border-slate-100 shadow-xl overflow-hidden self-start">
                    <div className="bg-blue-600 p-8 text-white flex justify-between items-center">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Total Aktiva</p>
                            <h3 className="text-2xl font-black">ASET</h3>
                        </div>
                        <Landmark size={32} className="opacity-40" />
                    </div>
                    <div className="p-4">
                        <table className="w-full text-left">
                            <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                <tr>
                                    <th className="px-4 py-4">Uraian Aset</th>
                                    <th className="px-4 py-4 text-right">{currentYearStr}</th>
                                    <th className="px-4 py-4 text-right opacity-40">{prevYearStr}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {hierAset.map(st => (
                                    <Fragment key={st.name}>
                                        <tr className="bg-slate-50/50">
                                            <td className="px-4 py-3 font-black text-[10px] text-slate-500 uppercase tracking-widest">{st.name}</td>
                                            <td className="px-4 py-3 text-right font-black text-slate-900"><CurrencyDisplay value={st.saldo} /></td>
                                            <td className="px-4 py-3 text-right font-bold text-slate-300"><CurrencyDisplay value={st.saldoPrev} /></td>
                                        </tr>
                                        {st.headers.map(h => h.children.map(c => (
                                            <tr key={c.id} className="hover:bg-slate-50/30 transition-colors">
                                                <td className="px-8 py-2 text-sm font-medium text-slate-600">{c.name}</td>
                                                <td className="px-4 py-2 text-right text-sm font-bold text-slate-800"><CurrencyDisplay value={c.saldo} /></td>
                                                <td className="px-4 py-2 text-right text-sm font-medium text-slate-300"><CurrencyDisplay value={c.saldoPrev} /></td>
                                            </tr>
                                        )))}
                                    </Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="bg-blue-50 p-8 border-t border-blue-100 flex justify-between items-center">
                        <span className="font-black text-blue-800 uppercase tracking-widest">Total Seluruh Aset</span>
                        <div className="text-right">
                            <p className="text-2xl font-black text-blue-900"><CurrencyDisplay value={totalAsetCurr} /></p>
                            <p className="text-[10px] font-bold text-blue-400">Tahun Lalu: <CurrencyDisplay value={totalAsetPrev} /></p>
                        </div>
                    </div>
                </div>

                {/* SISI LIABILITAS & ASET NETO */}
                <div className="space-y-8">
                    {/* LIABILITAS */}
                    <div className="bg-white rounded-[32px] border border-slate-100 shadow-xl overflow-hidden">
                        <div className="bg-slate-800 p-8 text-white flex justify-between items-center">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Total Kewajiban</p>
                                <h3 className="text-2xl font-black">LIABILITAS</h3>
                            </div>
                            <TrendingDown size={32} className="opacity-40" />
                        </div>
                        <div className="p-4">
                            <table className="w-full text-left">
                                <tbody className="divide-y divide-slate-50">
                                    {hierKew.length === 0 ? (
                                        <tr><td className="px-4 py-8 text-center text-slate-400 text-xs italic font-medium">Tidak ada saldo liabilitas tercatat</td></tr>
                                    ) : hierKew.map(st => st.headers.map(h => h.children.map(c => (
                                        <tr key={c.id} className="hover:bg-slate-50/30 transition-colors">
                                            <td className="px-4 py-3 text-sm font-medium text-slate-600">{c.name}</td>
                                            <td className="px-4 py-3 text-right text-sm font-bold text-slate-800"><CurrencyDisplay value={Math.abs(c.saldo)} /></td>
                                        </tr>
                                    ))))}
                                </tbody>
                            </table>
                        </div>
                        <div className="bg-slate-50 p-6 border-t border-slate-100 flex justify-between items-center">
                            <span className="font-black text-slate-500 text-[10px] uppercase tracking-widest">Total Liabilitas</span>
                            <span className="font-black text-slate-900"><CurrencyDisplay value={Math.abs(totalKewCurr)} /></span>
                        </div>
                    </div>

                    {/* ASET NETO */}
                    <div className="bg-white rounded-[32px] border border-slate-100 shadow-xl overflow-hidden">
                        <div className="bg-emerald-600 p-8 text-white flex justify-between items-center">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Kekayaan Bersih</p>
                                <h3 className="text-2xl font-black">ASET NETO</h3>
                            </div>
                            <PieChart size={32} className="opacity-40" />
                        </div>
                        <div className="p-4">
                            <table className="w-full text-left">
                                <tbody className="divide-y divide-slate-50">
                                    {hierNeto.map(st => st.headers.map(h => h.children.map(c => (
                                        <tr key={c.id} className="hover:bg-slate-50/30 transition-colors">
                                            <td className="px-4 py-3 text-sm font-medium text-slate-600">{c.name}</td>
                                            <td className="px-4 py-3 text-right text-sm font-bold text-slate-800"><CurrencyDisplay value={Math.abs(c.saldo)} /></td>
                                        </tr>
                                    ))))}
                                    <tr className="bg-emerald-50/50">
                                        <td className="px-4 py-3 text-sm font-black text-emerald-800 italic">Surplus (Defisit) Aktivitas Berjalan</td>
                                        <td className="px-4 py-3 text-right font-black text-emerald-900 border-l border-emerald-100">
                                            <CurrencyDisplay value={surplusCurr} />
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="bg-emerald-50 p-8 border-t border-emerald-100 flex justify-between items-center">
                            <span className="font-black text-emerald-800 uppercase tracking-widest">Total Aset Neto</span>
                            <div className="text-right">
                                <p className="text-2xl font-black text-emerald-900"><CurrencyDisplay value={Math.abs(totalNetoCurr + surplusCurr)} /></p>
                                <p className="text-[10px] font-bold text-emerald-400">Tahun Lalu: <CurrencyDisplay value={Math.abs(totalNetoPrev + surplusPrev)} /></p>
                            </div>
                        </div>
                    </div>

                    {/* BALANCE EQUATION CHECK */}
                    <div className="p-6 rounded-3xl bg-slate-900 text-white flex justify-between items-center shadow-2xl">
                        <span className="font-black text-[10px] uppercase tracking-[0.2em] opacity-40">Total L&AN (Pasiva)</span>
                        <div className="text-right">
                            <p className="text-xl font-black"><CurrencyDisplay value={Math.abs(totalKewCurr + totalNetoCurr + surplusCurr)} useColor={false} /></p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="mt-12 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest print:mt-20">
                Laporan ini disusun secara otomatis sesuai standar PSAK 35 (Entitas Non-Laba)
            </div>
        </div>
    );
}
