import { useState, Fragment, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { hitungSaldoPerTipe, buildHierarchyAccounts, getAvailableTransactionYears } from '../utils/accounting';
import { formatTanggal } from '../utils/format';
import { Landmark, TrendingDown, Printer, FileSpreadsheet, PieChart, CheckCircle, AlertTriangle, ShieldCheck, Scale } from 'lucide-react';
import CurrencyDisplay from '../components/CurrencyDisplay';
import ReportRow from '../components/ReportRow';
import * as XLSX from 'xlsx';

export default function BalanceSheet() {
    const { state } = useApp();
    const accounts = useMemo(() => state.accounts.filter(a => !a.isDeleted), [state.accounts]);
    const journals = useMemo(() => state.journals.filter(j => !j.isDeleted), [state.journals]);
    const assets = useMemo(() => state.assets.filter(a => !a.isDeleted), [state.assets]);
    const reportRef = useRef(null);

    // Filter Tahun Dinamis
    const availableYears = useMemo(() => getAvailableTransactionYears(journals), [journals]);
    const [selectedYear, setSelectedYear] = useState(() => availableYears[0] || new Date().getFullYear().toString());
    const [expandedRows, setExpandedRows] = useState({});

    const activeYear = availableYears.includes(selectedYear) ? selectedYear : (availableYears[0] || new Date().getFullYear().toString());
    const currentYearStr = activeYear;
    const prevYearStr = (parseInt(activeYear, 10) - 1).toString();

    const toggleRow = (id) => {
        setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
    };

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

    const hierAset = useMemo(() => buildCompHierarchy('Aset'), [journals, accounts, assets, currentYearStr, prevYearStr]);
    const hierKew = useMemo(() => buildCompHierarchy('Kewajiban'), [journals, accounts, assets, currentYearStr, prevYearStr]);
    const hierNeto = useMemo(() => buildCompHierarchy('Aset Neto'), [journals, accounts, assets, currentYearStr, prevYearStr]);

    const totalAsetCurr = useMemo(() => hitungSaldoPerTipe(journals, accounts, 'Aset', currentYearStr, assets), [journals, accounts, assets, currentYearStr]);
    const totalAsetPrev = useMemo(() => hitungSaldoPerTipe(journals, accounts, 'Aset', prevYearStr, assets), [journals, accounts, assets, prevYearStr]);
    
    const totalKewCurr = useMemo(() => hitungSaldoPerTipe(journals, accounts, 'Kewajiban', currentYearStr, assets), [journals, accounts, assets, currentYearStr]);
    const totalKewPrev = useMemo(() => hitungSaldoPerTipe(journals, accounts, 'Kewajiban', prevYearStr, assets), [journals, accounts, assets, prevYearStr]);
    
    const totalNetoCurr = useMemo(() => hitungSaldoPerTipe(journals, accounts, 'Aset Neto', currentYearStr, assets), [journals, accounts, assets, currentYearStr]);
    const totalNetoPrev = useMemo(() => hitungSaldoPerTipe(journals, accounts, 'Aset Neto', prevYearStr, assets), [journals, accounts, assets, prevYearStr]);

    const getSurplus = (year) => {
        const p = hitungSaldoPerTipe(journals, accounts, 'Pendapatan', year, assets);
        const b = hitungSaldoPerTipe(journals, accounts, 'Beban', year, assets);
        return p - b;
    };

    const surplusCurr = useMemo(() => getSurplus(currentYearStr), [journals, accounts, assets, currentYearStr]);
    const surplusPrev = useMemo(() => getSurplus(prevYearStr), [journals, accounts, assets, prevYearStr]);

    const totalAsetNetoCurr = Math.abs(totalNetoCurr + surplusCurr);
    const totalPasivaCurr = Math.abs(totalKewCurr) + totalAsetNetoCurr;
    const isNeracaBalanced = Math.abs(totalAsetCurr - totalPasivaCurr) < 1;

    const exportToExcel = () => {
        const data = [];
        data.push({ 'Keterangan': 'YAYASAN DARELIMAN' });
        data.push({ 'Keterangan': `LAPORAN POSISI KEUANGAN (NERACA) - TAHUN ${currentYearStr}` });
        data.push({ 'Keterangan': `Per 31 Desember ${currentYearStr} dan ${prevYearStr}` });
        data.push({});
        
        data.push({ 'Keterangan': 'ASET (AKTIVA)', 'Tahun Berjalan': `Tahun ${currentYearStr}`, 'Tahun Sebelumnya': `Tahun ${prevYearStr}` });
        hierAset.forEach(st => {
            data.push({ 'Keterangan': st.name.toUpperCase(), 'Tahun Berjalan': st.saldo, 'Tahun Sebelumnya': st.saldoPrev });
            st.headers.forEach(h => {
                h.children.forEach(c => {
                    data.push({ 'Keterangan': `  ${c.name}`, 'Tahun Berjalan': c.saldo, 'Tahun Sebelumnya': c.saldoPrev });
                });
            });
        });
        data.push({ 'Keterangan': 'TOTAL ASET', 'Tahun Berjalan': totalAsetCurr, 'Tahun Sebelumnya': totalAsetPrev });
        data.push({});

        data.push({ 'Keterangan': 'LIABILITAS (KEWAJIBAN)' });
        hierKew.forEach(st => {
            st.headers.forEach(h => {
                h.children.forEach(c => {
                    data.push({ 'Keterangan': `  ${c.name}`, 'Tahun Berjalan': Math.abs(c.saldo), 'Tahun Sebelumnya': Math.abs(c.saldoPrev) });
                });
            });
        });
        data.push({ 'Keterangan': 'TOTAL LIABILITAS', 'Tahun Berjalan': Math.abs(totalKewCurr), 'Tahun Sebelumnya': Math.abs(totalKewPrev) });
        data.push({});

        data.push({ 'Keterangan': 'ASET NETO (EKUITAS)' });
        hierNeto.forEach(st => {
            st.headers.forEach(h => {
                h.children.forEach(c => {
                    data.push({ 'Keterangan': `  ${c.name}`, 'Tahun Berjalan': Math.abs(c.saldo), 'Tahun Sebelumnya': Math.abs(c.saldoPrev) });
                });
            });
        });
        data.push({ 'Keterangan': 'Surplus (Defisit) Aktivitas Berjalan', 'Tahun Berjalan': surplusCurr, 'Tahun Sebelumnya': surplusPrev });
        data.push({ 'Keterangan': 'TOTAL ASET NETO', 'Tahun Berjalan': totalAsetNetoCurr, 'Tahun Sebelumnya': Math.abs(totalNetoPrev + surplusPrev) });
        data.push({});
        data.push({ 'Keterangan': 'TOTAL LIABILITAS & ASET NETO (PASIVA)', 'Tahun Berjalan': totalPasivaCurr });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Neraca_${currentYearStr}`);
        XLSX.writeFile(wb, `SIKAD-Dareliman-PosisiKeuangan-${currentYearStr}.xlsx`);
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header Kontrol */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 print:hidden">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                            <Landmark size={22} />
                        </div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Posisi Keuangan</h2>
                    </div>
                    <p className="text-slate-500 font-medium text-sm">Neraca Entitas Nirlaba: Aset, Liabilitas, dan Aset Neto (PSAK 35)</p>
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
                        <Landmark size={22} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Aset (Aktiva)</p>
                        <h4 className="text-lg font-black text-slate-900"><CurrencyDisplay value={totalAsetCurr} useColor={false} /></h4>
                        <p className="text-[10px] text-slate-400">Tahun {prevYearStr}: <CurrencyDisplay value={totalAsetPrev} useColor={false} /></p>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                        <TrendingDown size={22} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Liabilitas</p>
                        <h4 className="text-lg font-black text-slate-900"><CurrencyDisplay value={Math.abs(totalKewCurr)} useColor={false} /></h4>
                        <p className="text-[10px] text-slate-400">Tahun {prevYearStr}: <CurrencyDisplay value={Math.abs(totalKewPrev)} useColor={false} /></p>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                        <PieChart size={22} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Aset Neto</p>
                        <h4 className="text-lg font-black text-slate-900"><CurrencyDisplay value={totalAsetNetoCurr} useColor={false} /></h4>
                        <p className="text-[10px] text-slate-400">Surplus: <CurrencyDisplay value={surplusCurr} /></p>
                    </div>
                </div>

                <div className={`p-5 rounded-3xl border flex items-center gap-4 ${isNeracaBalanced ? 'bg-emerald-50/80 border-emerald-100 text-emerald-800' : 'bg-rose-50/80 border-rose-100 text-rose-800'}`}>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isNeracaBalanced ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                        {isNeracaBalanced ? <CheckCircle size={24} /> : <AlertTriangle size={24} />}
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider opacity-70">Persamaan Neraca</p>
                        <h4 className="text-sm font-black">{isNeracaBalanced ? 'Aset = Liabilitas + Aset Neto' : 'Terdapat Selisih!'}</h4>
                        <p className="text-[11px] opacity-80">
                            Pasiva: <CurrencyDisplay value={totalPasivaCurr} useColor={false} />
                        </p>
                    </div>
                </div>
            </div>

            {/* Kontainer Lembar Laporan Formal */}
            <div className="bg-white p-8 md:p-12 rounded-[36px] border border-slate-100 shadow-xl overflow-hidden" ref={reportRef}>
                {/* Header Formal Instansi */}
                <div className="text-center mb-10 pb-8 border-b-2 border-slate-200">
                    <p className="text-xs font-black tracking-[0.25em] text-slate-400 uppercase mb-1">LAPORAN KEUANGAN YAYASAN</p>
                    <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">YAYASAN DARELIMAN</h1>
                    <h2 className="text-lg font-bold text-blue-600 mt-1 uppercase tracking-wide">LAPORAN POSISI KEUANGAN (NERACA)</h2>
                    <div className="inline-block mt-3 px-4 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                        Per 31 Desember {currentYearStr} dan 31 Desember {prevYearStr} (Standar PSAK 35)
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    {/* SISI ASET */}
                    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white flex justify-between items-center">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-blue-200 mb-0.5">Sisi Aktiva</p>
                                <h3 className="text-xl font-black">ASET</h3>
                            </div>
                            <Landmark size={28} className="text-blue-200 opacity-60" />
                        </div>
                        <div className="p-3 flex-1">
                            <table className="w-full text-left border-separate border-spacing-y-1">
                                <thead className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                    <tr>
                                        <th className="px-5 py-3">Uraian Akun</th>
                                        <th className="px-5 py-3 text-right">Tahun {currentYearStr}</th>
                                        <th className="px-5 py-3 text-right opacity-60">Tahun {prevYearStr}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {hierAset.map(st => (
                                        <Fragment key={st.name}>
                                            <ReportRow 
                                                id={st.name}
                                                name={st.name}
                                                valCurr={st.saldo}
                                                valPrev={st.saldoPrev}
                                                type="category"
                                                isParent={true}
                                                isExpanded={!!expandedRows[st.name]}
                                                onToggle={toggleRow}
                                            />
                                            
                                            {expandedRows[st.name] && st.headers.map(h => (
                                                <Fragment key={h.id}>
                                                    <ReportRow 
                                                        id={h.id}
                                                        name={h.name}
                                                        valCurr={h.saldo}
                                                        valPrev={h.saldoPrev}
                                                        level={1}
                                                        type="header"
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
                                                            level={2}
                                                            type="detail"
                                                        />
                                                    ))}
                                                </Fragment>
                                            ))}
                                        </Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="bg-blue-50/80 p-6 border-t border-blue-100 flex justify-between items-center mt-auto">
                            <span className="font-black text-blue-900 text-xs uppercase tracking-wider">Total Seluruh Aset</span>
                            <div className="text-right">
                                <p className="text-xl font-black text-blue-900 tabular-nums"><CurrencyDisplay value={totalAsetCurr} /></p>
                                <p className="text-[10px] font-bold text-blue-600">Thn Lalu: <CurrencyDisplay value={totalAsetPrev} /></p>
                            </div>
                        </div>
                    </div>

                    {/* SISI LIABILITAS & ASET NETO */}
                    <div className="space-y-8 flex flex-col">
                        {/* LIABILITAS */}
                        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
                            <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 text-white flex justify-between items-center">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Sisi Kewajiban</p>
                                    <h3 className="text-xl font-black">LIABILITAS</h3>
                                </div>
                                <TrendingDown size={28} className="text-slate-400 opacity-60" />
                            </div>
                            <div className="p-3">
                                <table className="w-full text-left border-separate border-spacing-y-1">
                                    <tbody>
                                        {hierKew.length === 0 ? (
                                            <tr><td className="px-4 py-6 text-center text-slate-400 text-xs italic font-medium">Tidak ada saldo liabilitas tercatat</td></tr>
                                        ) : hierKew.map(st => (
                                            <Fragment key={st.name}>
                                                <ReportRow 
                                                    id={st.name}
                                                    name={st.name}
                                                    valCurr={Math.abs(st.saldo)}
                                                    valPrev={Math.abs(st.saldoPrev)}
                                                    type="category"
                                                    isParent={true}
                                                    isExpanded={!!expandedRows[st.name]}
                                                    onToggle={toggleRow}
                                                />
                                                {expandedRows[st.name] && st.headers.map(h => (
                                                    <Fragment key={h.id}>
                                                        <ReportRow 
                                                            id={h.id}
                                                            name={h.name}
                                                            valCurr={Math.abs(h.saldo)}
                                                            valPrev={Math.abs(h.saldoPrev)}
                                                            level={1}
                                                            type="header"
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
                                                                level={2}
                                                                type="detail"
                                                            />
                                                        ))}
                                                    </Fragment>
                                                ))}
                                            </Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="bg-slate-50 p-5 border-t border-slate-100 flex justify-between items-center">
                                <span className="font-black text-slate-600 text-xs uppercase tracking-wider">Total Liabilitas</span>
                                <span className="font-black text-slate-900 tabular-nums"><CurrencyDisplay value={Math.abs(totalKewCurr)} /></span>
                            </div>
                        </div>

                        {/* ASET NETO */}
                        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden flex-1 flex flex-col">
                            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-6 text-white flex justify-between items-center">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-200 mb-0.5">Kekayaan Bersih Yayasan</p>
                                    <h3 className="text-xl font-black">ASET NETO</h3>
                                </div>
                                <PieChart size={28} className="text-emerald-200 opacity-60" />
                            </div>
                            <div className="p-3 flex-1">
                                <table className="w-full text-left border-separate border-spacing-y-1">
                                    <tbody>
                                        {hierNeto.map(st => (
                                            <Fragment key={st.name}>
                                                <ReportRow 
                                                    id={st.name}
                                                    name={st.name}
                                                    valCurr={Math.abs(st.saldo)}
                                                    valPrev={Math.abs(st.saldoPrev)}
                                                    type="category"
                                                    isParent={true}
                                                    isExpanded={!!expandedRows[st.name]}
                                                    onToggle={toggleRow}
                                                />
                                                {expandedRows[st.name] && st.headers.map(h => (
                                                    <Fragment key={h.id}>
                                                        <ReportRow 
                                                            id={h.id}
                                                            name={h.name}
                                                            valCurr={Math.abs(h.saldo)}
                                                            valPrev={Math.abs(h.saldoPrev)}
                                                            level={1}
                                                            type="header"
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
                                                                level={2}
                                                                type="detail"
                                                            />
                                                        ))}
                                                    </Fragment>
                                                ))}
                                            </Fragment>
                                        ))}
                                        <ReportRow 
                                            name="Surplus (Defisit) Aktivitas Berjalan"
                                            valCurr={surplusCurr}
                                            valPrev={surplusPrev}
                                            type="header"
                                        />
                                    </tbody>
                                </table>
                            </div>
                            <div className="bg-emerald-50/80 p-6 border-t border-emerald-100 flex justify-between items-center mt-auto">
                                <span className="font-black text-emerald-900 text-xs uppercase tracking-wider">Total Aset Neto</span>
                                <div className="text-right">
                                    <p className="text-xl font-black text-emerald-900 tabular-nums"><CurrencyDisplay value={totalAsetNetoCurr} /></p>
                                    <p className="text-[10px] font-bold text-emerald-600">Thn Lalu: <CurrencyDisplay value={Math.abs(totalNetoPrev + surplusPrev)} /></p>
                                </div>
                            </div>
                        </div>

                        {/* BALANCE EQUATION CHECK */}
                        <div className="p-5 rounded-2xl bg-slate-900 text-white flex justify-between items-center shadow-lg">
                            <span className="font-black text-xs uppercase tracking-wider text-slate-300">Total Pasiva (Liabilitas + Aset Neto)</span>
                            <div className="text-right">
                                <p className="text-xl font-black tabular-nums"><CurrencyDisplay value={totalPasivaCurr} useColor={false} /></p>
                            </div>
                        </div>
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
