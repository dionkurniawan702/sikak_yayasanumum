import { useState, Fragment, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { hitungSaldoPerTipe, buildHierarchyAccounts } from '../utils/accounting';
import { formatRupiah, formatTanggal } from '../utils/format';
import { Landmark, TrendingDown, Printer, Download, FileText, PieChart, FileSpreadsheet } from 'lucide-react';
import CurrencyDisplay from '../components/CurrencyDisplay';
import ReportRow from '../components/ReportRow';
import * as XLSX from 'xlsx';

export default function BalanceSheet() {
    const { state } = useApp();
    const accounts = state.accounts.filter(a => !a.isDeleted);
    const journals = state.journals.filter(j => !j.isDeleted);
    const assets = state.assets.filter(a => !a.isDeleted);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
    const [expandedRows, setExpandedRows] = useState({});
    const reportRef = useRef(null);
    const currentYearStr = selectedYear;
    const prevYearStr = (parseInt(selectedYear) - 1).toString();

    const toggleRow = (id) => {
        setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const exportToExcel = () => {
        const data = [];
        data.push({ 'Keterangan': 'LAPORAN POSISI KEUANGAN', 'Tahun Berjalan': currentYearStr, 'Tahun Sebelumnya': prevYearStr });
        data.push({});
        
        data.push({ 'Keterangan': 'ASET' });
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

        data.push({ 'Keterangan': 'LIABILITAS' });
        hierKew.forEach(st => {
            st.headers.forEach(h => {
                h.children.forEach(c => {
                    data.push({ 'Keterangan': `  ${c.name}`, 'Tahun Berjalan': Math.abs(c.saldo), 'Tahun Sebelumnya': Math.abs(c.saldoPrev) });
                });
            });
        });
        data.push({ 'Keterangan': 'TOTAL LIABILITAS', 'Tahun Berjalan': Math.abs(totalKewCurr), 'Tahun Sebelumnya': Math.abs(totalKewPrev) });
        data.push({});

        data.push({ 'Keterangan': 'ASET NETO' });
        hierNeto.forEach(st => {
            st.headers.forEach(h => {
                h.children.forEach(c => {
                    data.push({ 'Keterangan': `  ${c.name}`, 'Tahun Berjalan': Math.abs(c.saldo), 'Tahun Sebelumnya': Math.abs(c.saldoPrev) });
                });
            });
        });
        data.push({ 'Keterangan': 'Surplus (Defisit) Aktivitas', 'Tahun Berjalan': surplusCurr, 'Tahun Sebelumnya': surplusPrev });
        data.push({ 'Keterangan': 'TOTAL ASET NETO', 'Tahun Berjalan': Math.abs(totalNetoCurr + surplusCurr), 'Tahun Sebelumnya': Math.abs(totalNetoPrev + surplusPrev) });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'BalanceSheet');
        XLSX.writeFile(wb, `SIKAD-Dareliman-Neraca-${selectedYear}.xlsx`);
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
                    <button onClick={exportToExcel} className="btn bg-white text-emerald-600 border-emerald-100 hover:bg-emerald-50 px-8 py-3 rounded-2xl shadow-sm font-black flex items-center gap-2">
                        <FileSpreadsheet size={18} /> Export Excel
                    </button>
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
                    <div className="p-2">
                        <table className="w-full text-left border-separate border-spacing-y-1">
                            <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">
                                <tr>
                                    <th className="px-6 py-4">Uraian Aset</th>
                                    <th className="px-6 py-4 text-right">Tahun {currentYearStr}</th>
                                    <th className="px-6 py-4 text-right opacity-40">Tahun {prevYearStr}</th>
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
                        <div className="p-2">
                            <table className="w-full text-left border-separate border-spacing-y-1">
                                <tbody>
                                    {hierKew.length === 0 ? (
                                        <tr><td className="px-4 py-8 text-center text-slate-400 text-xs italic font-medium">Tidak ada saldo liabilitas tercatat</td></tr>
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
                        <div className="p-2">
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
