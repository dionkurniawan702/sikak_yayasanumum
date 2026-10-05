import { useState, Fragment, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { hitungSaldoPerTipe, buildHierarchyAccounts, getAvailableTransactionYears } from '../utils/accounting';
import { formatTanggal } from '../utils/format';
import { TrendingUp, TrendingDown, Printer, FileSpreadsheet, Activity, Coins, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import CurrencyDisplay from '../components/CurrencyDisplay';
import ReportRow from '../components/ReportRow';
import * as XLSX from 'xlsx';

export default function ActivityReport() {
    const { state } = useApp();
    const accounts = useMemo(() => state.accounts.filter(a => !a.isDeleted), [state.accounts]);
    const journals = useMemo(() => state.journals.filter(j => !j.isDeleted), [state.journals]);
    const assets = useMemo(() => state.assets.filter(a => !a.isDeleted), [state.assets]);
    const reportRef = useRef(null);

    // Filter Tahun Dinamis (Hanya tahun dengan transaksi)
    const availableYears = useMemo(() => getAvailableTransactionYears(journals), [journals]);
    const [selectedYear, setSelectedYear] = useState(() => availableYears[0] || new Date().getFullYear().toString());
    const [expandedRows, setExpandedRows] = useState({});

    const activeYear = availableYears.includes(selectedYear) ? selectedYear : (availableYears[0] || new Date().getFullYear().toString());
    const currentYearStr = activeYear;
    const prevYearStr = (parseInt(activeYear, 10) - 1).toString();

    const toggleRow = (id) => {
        setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // Helper untuk mendapatkan hierarki Pendapatan & Beban per tahun
    const getCompHierarchy = (type) => {
        const currSubTypes = buildHierarchyAccounts(journals, accounts, type, null, currentYearStr, assets, true);
        const prevSubTypes = buildHierarchyAccounts(journals, accounts, type, null, prevYearStr, assets, true);

        const curr = currSubTypes.flatMap(st => st.headers);
        const prev = prevSubTypes.flatMap(st => st.headers);

        return curr.map(h => {
            const prevHeader = prev.find(ph => ph.id === h.id);
            return {
                ...h,
                saldoPrev: prevHeader ? prevHeader.saldo : 0,
                children: h.children.map(c => {
                    const prevChild = prevHeader?.children.find(pc => pc.id === c.id);
                    return { ...c, saldoPrev: prevChild ? prevChild.saldo : 0 };
                })
            };
        });
    };

    const pendapatan = useMemo(() => getCompHierarchy('Pendapatan'), [journals, accounts, assets, currentYearStr, prevYearStr]);
    const beban = useMemo(() => getCompHierarchy('Beban'), [journals, accounts, assets, currentYearStr, prevYearStr]);

    const totalPendapatanCurr = useMemo(() => Math.abs(pendapatan.reduce((s, h) => s + h.saldo, 0)), [pendapatan]);
    const totalPendapatanPrev = useMemo(() => Math.abs(pendapatan.reduce((s, h) => s + h.saldoPrev, 0)), [pendapatan]);

    const totalBebanCurr = useMemo(() => beban.reduce((s, h) => s + h.saldo, 0), [beban]);
    const totalBebanPrev = useMemo(() => beban.reduce((s, h) => s + h.saldoPrev, 0), [beban]);

    const surplusCurr = totalPendapatanCurr - totalBebanCurr;
    const surplusPrev = totalPendapatanPrev - totalBebanPrev;

    const exportToExcel = () => {
        const data = [];
        data.push({ 'Keterangan': 'YAYASAN DARELIMAN' });
        data.push({ 'Keterangan': `LAPORAN AKTIVITAS - TAHUN ${currentYearStr}` });
        data.push({ 'Keterangan': `Untuk Periode yang Berakhir pada 31 Desember ${currentYearStr} dan ${prevYearStr}` });
        data.push({});

        data.push({ 'Keterangan': 'PENDAPATAN', 'Tahun Berjalan': `Tahun ${currentYearStr}`, 'Tahun Sebelumnya': `Tahun ${prevYearStr}` });
        pendapatan.forEach(h => {
            data.push({ 'Keterangan': h.name, 'Tahun Berjalan': Math.abs(h.saldo), 'Tahun Sebelumnya': Math.abs(h.saldoPrev) });
            h.children.forEach(c => {
                data.push({ 'Keterangan': `  ${c.name}`, 'Tahun Berjalan': Math.abs(c.saldo), 'Tahun Sebelumnya': Math.abs(c.saldoPrev) });
            });
        });
        data.push({ 'Keterangan': 'TOTAL PENDAPATAN', 'Tahun Berjalan': totalPendapatanCurr, 'Tahun Sebelumnya': totalPendapatanPrev });
        data.push({});

        data.push({ 'Keterangan': 'BEBAN & PENGELUARAN' });
        beban.forEach(h => {
            data.push({ 'Keterangan': h.name, 'Tahun Berjalan': h.saldo, 'Tahun Sebelumnya': h.saldoPrev });
            h.children.forEach(c => {
                data.push({ 'Keterangan': `  ${c.name}`, 'Tahun Berjalan': c.saldo, 'Tahun Sebelumnya': c.saldoPrev });
            });
        });
        data.push({ 'Keterangan': 'TOTAL BEBAN', 'Tahun Berjalan': totalBebanCurr, 'Tahun Sebelumnya': totalBebanPrev });
        data.push({});

        data.push({ 'Keterangan': 'SURPLUS / (DEFISIT) BERJALAN', 'Tahun Berjalan': surplusCurr, 'Tahun Sebelumnya': surplusPrev });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Aktivitas_${currentYearStr}`);
        XLSX.writeFile(wb, `SIKAD-Dareliman-LaporanAktivitas-${currentYearStr}.xlsx`);
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header Kontrol */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 print:hidden">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                            <Activity size={22} />
                        </div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Laporan Aktivitas</h2>
                    </div>
                    <p className="text-slate-500 font-medium text-sm">Pendapatan, Beban, dan Perubahan Aset Neto Periode Berjalan (PSAK 35)</p>
                </div>

                <div className="flex flex-wrap gap-3 items-center">
                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-2xl border border-slate-200 shadow-sm">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Tahun:</span>
                        <select 
                            className="bg-transparent border-none text-sm font-bold text-slate-800 focus:outline-none cursor-pointer"
                            value={activeYear} 
                            onChange={e => setSelectedYear(e.target.value)}
                        >
                            {availableYears.map(year => (
                                <option key={year} value={year}>Tahun {year}</option>
                            ))}
                        </select>
                    </div>

                    <button 
                        onClick={exportToExcel} 
                        className="btn bg-white text-emerald-600 border border-emerald-200 hover:bg-emerald-50 px-5 py-2.5 rounded-2xl shadow-sm text-sm font-bold flex items-center gap-2 transition-all"
                    >
                        <FileSpreadsheet size={16} /> Export Excel
                    </button>
                    <button 
                        onClick={() => window.print()} 
                        className="btn bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-2xl shadow-lg shadow-blue-500/20 text-sm font-bold flex items-center gap-2 transition-all"
                    >
                        <Printer size={16} /> Cetak Laporan
                    </button>
                </div>
            </div>

            {/* KPI Cards / Ringkasan Eksekutif */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8 print:hidden">
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <ArrowUpRight size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Pendapatan</p>
                        <h4 className="text-lg font-black text-slate-900"><CurrencyDisplay value={totalPendapatanCurr} useColor={false} /></h4>
                        <p className="text-[10px] text-slate-400">Thn Lalu: <CurrencyDisplay value={totalPendapatanPrev} useColor={false} /></p>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                        <ArrowDownRight size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Beban</p>
                        <h4 className="text-lg font-black text-slate-900"><CurrencyDisplay value={totalBebanCurr} useColor={false} /></h4>
                        <p className="text-[10px] text-slate-400">Thn Lalu: <CurrencyDisplay value={totalBebanPrev} useColor={false} /></p>
                    </div>
                </div>

                <div className={`p-5 rounded-3xl border flex items-center gap-4 ${surplusCurr >= 0 ? 'bg-emerald-50/80 border-emerald-100 text-emerald-800' : 'bg-rose-50/80 border-rose-100 text-rose-800'}`}>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${surplusCurr >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                        {surplusCurr >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider opacity-70">Surplus / (Defisit) Berjalan</p>
                        <h4 className="text-lg font-black"><CurrencyDisplay value={surplusCurr} /></h4>
                        <p className="text-[10px] opacity-80">Thn Lalu: <CurrencyDisplay value={surplusPrev} /></p>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        <Coins size={22} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Rasio Efisiensi Beban</p>
                        <h4 className="text-lg font-black text-slate-900">
                            {totalPendapatanCurr > 0 ? `${((totalBebanCurr / totalPendapatanCurr) * 100).toFixed(1)}%` : '0%'}
                        </h4>
                        <p className="text-[10px] text-slate-400">dari total pendapatan</p>
                    </div>
                </div>
            </div>

            {/* Lembar Laporan Formal */}
            <div className="bg-white p-8 md:p-12 rounded-[36px] border border-slate-100 shadow-xl overflow-hidden" ref={reportRef}>
                {/* Header Formal Instansi */}
                <div className="text-center mb-10 pb-8 border-b-2 border-slate-200">
                    <p className="text-xs font-black tracking-[0.25em] text-slate-400 uppercase mb-1">LAPORAN KEUANGAN YAYASAN</p>
                    <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">YAYASAN DARELIMAN</h1>
                    <h2 className="text-lg font-bold text-blue-600 mt-1 uppercase tracking-wide">LAPORAN AKTIVITAS</h2>
                    <div className="inline-block mt-3 px-4 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                        Untuk Periode yang Berakhir pada 31 Desember {currentYearStr} dan 31 Desember {prevYearStr}
                    </div>
                </div>

                {/* PENDAPATAN */}
                <div className="mb-12">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                            <TrendingUp size={18} />
                        </div>
                        <h3 className="text-base font-black text-slate-800 uppercase tracking-wider">PENDAPATAN</h3>
                    </div>
                    <div className="overflow-hidden bg-white rounded-2xl border border-slate-200/80 p-2">
                        <table className="w-full text-left border-separate border-spacing-y-1">
                            <thead className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                <tr>
                                    <th className="px-5 py-3">Uraian Pendapatan</th>
                                    <th className="px-5 py-3 text-right">Tahun {currentYearStr}</th>
                                    <th className="px-5 py-3 text-right opacity-60">Tahun {prevYearStr}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pendapatan.map(h => (
                                    <Fragment key={h.id}>
                                        <ReportRow 
                                            id={h.id}
                                            name={h.name}
                                            valCurr={Math.abs(h.saldo)}
                                            valPrev={Math.abs(h.saldoPrev)}
                                            type="category"
                                            isParent={true}
                                            isExpanded={!!expandedRows[h.id]}
                                            onToggle={toggleRow}
                                        />
                                        {expandedRows[h.id] && h.children.map(c => (
                                            <ReportRow 
                                                key={c.id}
                                                id={c.id}
                                                name={c.name}
                                                valCurr={Math.abs(c.saldo)}
                                                valPrev={Math.abs(c.saldoPrev)}
                                                level={1}
                                                type="detail"
                                            />
                                        ))}
                                    </Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-3 p-5 bg-blue-50/80 border border-blue-100 rounded-2xl flex justify-between items-center">
                        <span className="font-black text-xs text-blue-900 uppercase tracking-wider">Total Pendapatan Terakumulasi</span>
                        <div className="text-right">
                           <p className="text-xl font-black text-blue-900 tabular-nums"><CurrencyDisplay value={totalPendapatanCurr} useColor={false} /></p>
                           <p className="text-[10px] font-bold text-blue-600">Thn Lalu: <CurrencyDisplay value={totalPendapatanPrev} useColor={false} /></p>
                        </div>
                    </div>
                </div>

                {/* BEBAN */}
                <div className="mb-12">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                            <TrendingDown size={18} />
                        </div>
                        <h3 className="text-base font-black text-slate-800 uppercase tracking-wider">BEBAN & PENGELUARAN</h3>
                    </div>
                    <div className="overflow-hidden bg-white rounded-2xl border border-slate-200/80 p-2">
                        <table className="w-full text-left border-separate border-spacing-y-1">
                            <thead className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                <tr>
                                    <th className="px-5 py-3">Uraian Beban</th>
                                    <th className="px-5 py-3 text-right">Tahun {currentYearStr}</th>
                                    <th className="px-5 py-3 text-right opacity-60">Tahun {prevYearStr}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {beban.map(h => (
                                    <Fragment key={h.id}>
                                        <ReportRow 
                                            id={h.id}
                                            name={h.name}
                                            valCurr={h.saldo}
                                            valPrev={h.saldoPrev}
                                            type="category"
                                            isParent={true}
                                            isExpanded={!!expandedRows[h.id]}
                                            onToggle={toggleRow}
                                        />
                                        {expandedRows[h.id] && h.children.map(c => (
                                            <ReportRow 
                                                key={c.id}
                                                id={c.id}
                                                name={c.name}
                                                valCurr={c.saldo}
                                                valPrev={c.saldoPrev}
                                                level={1}
                                                type="detail"
                                            />
                                        ))}
                                    </Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-3 p-5 bg-slate-50 border border-slate-200 rounded-2xl flex justify-between items-center">
                        <span className="font-black text-xs text-slate-600 uppercase tracking-wider">Total Beban & Pengeluaran</span>
                        <div className="text-right">
                           <p className="text-xl font-black text-slate-900 tabular-nums"><CurrencyDisplay value={totalBebanCurr} useColor={false} /></p>
                           <p className="text-[10px] font-bold text-slate-500">Thn Lalu: <CurrencyDisplay value={totalBebanPrev} useColor={false} /></p>
                        </div>
                    </div>
                </div>

                {/* SURPLUS / DEFISIT BANNER */}
                <div className={`p-8 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl ${surplusCurr >= 0 ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white' : 'bg-gradient-to-r from-rose-600 to-red-700 text-white'}`}>
                    <div className="flex items-center gap-4">
                        <div className="p-3.5 bg-white/20 rounded-2xl backdrop-blur-sm">
                            <Activity size={32} />
                        </div>
                        <div>
                            <p className="font-black text-[10px] uppercase tracking-[0.25em] text-white/70 mb-0.5">Kenaikan (Penurunan) Aset Neto</p>
                            <h3 className="text-2xl font-black uppercase tracking-tight">{surplusCurr >= 0 ? 'SURPLUS AKTIVITAS BERJALAN' : 'DEFISIT AKTIVITAS BERJALAN'}</h3>
                        </div>
                    </div>
                    <div className="text-left md:text-right">
                        <p className="text-3xl font-black tabular-nums"><CurrencyDisplay value={surplusCurr} useColor={false} /></p>
                        <p className="text-xs font-bold text-white/70 mt-1">Tahun Sebelumnya: <CurrencyDisplay value={surplusPrev} useColor={false} /></p>
                    </div>
                </div>

                {/* Footer Informasi Cetak */}
                <div className="mt-10 pt-6 border-t border-slate-100 flex justify-between items-center text-xs text-slate-400">
                    <p>Dicetak melalui SIKAD Yayasan Dareliman pada {formatTanggal(new Date().toISOString())}</p>
                    <p className="font-mono">Standar PSAK 35 / ISAK 35 (Entitas Nirlaba)</p>
                </div>
            </div>
        </div>
    );
}
