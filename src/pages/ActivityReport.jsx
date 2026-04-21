import { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { hitungSaldoPerTipe, buildHierarchyAccounts } from '../utils/accounting';
import { formatRupiah, formatTanggal } from '../utils/format';
import { TrendingUp, TrendingDown, Printer, Download, Filter, Activity, FileSpreadsheet } from 'lucide-react';
import CurrencyDisplay from '../components/CurrencyDisplay';
import ReportRow from '../components/ReportRow';
import * as XLSX from 'xlsx';

export default function ActivityReport() {
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
        data.push({ 'Keterangan': 'LAPORAN AKTIVITAS', 'Tahun Berjalan': currentYearStr, 'Tahun Sebelumnya': prevYearStr });
        data.push({});

        data.push({ 'Keterangan': 'PENDAPATAN' });
        pendapatan.forEach(h => {
            data.push({ 'Keterangan': h.name, 'Tahun Berjalan': Math.abs(h.saldo), 'Tahun Sebelumnya': Math.abs(h.saldoPrev) });
            h.children.forEach(c => {
                data.push({ 'Keterangan': `  ${c.name}`, 'Tahun Berjalan': Math.abs(c.saldo), 'Tahun Sebelumnya': Math.abs(c.saldoPrev) });
            });
        });
        data.push({ 'Keterangan': 'TOTAL PENDAPATAN', 'Tahun Berjalan': totalPendapatanCurr, 'Tahun Sebelumnya': totalPendapatanPrev });
        data.push({});

        data.push({ 'Keterangan': 'BEBAN' });
        beban.forEach(h => {
            data.push({ 'Keterangan': h.name, 'Tahun Berjalan': h.saldo, 'Tahun Sebelumnya': h.saldoPrev });
            h.children.forEach(c => {
                data.push({ 'Keterangan': `  ${c.name}`, 'Tahun Berjalan': c.saldo, 'Tahun Sebelumnya': c.saldoPrev });
            });
        });
        data.push({ 'Keterangan': 'TOTAL BEBAN', 'Tahun Berjalan': totalBebanCurr, 'Tahun Sebelumnya': totalBebanPrev });
        data.push({});

        data.push({ 'Keterangan': 'SURPLUS (DEFISIT)', 'Tahun Berjalan': surplusCurr, 'Tahun Sebelumnya': surplusPrev });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'ActivityReport');
        XLSX.writeFile(wb, `SIKAK-Yayasan-LaporanAktivitas-${selectedYear}.xlsx`);
    };

    // Helper untuk mendapatkan hierarki Pendapatan & Beban
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

    const pendapatan = getCompHierarchy('Pendapatan');
    const beban = getCompHierarchy('Beban');

    const totalPendapatanCurr = Math.abs(pendapatan.reduce((s, h) => s + h.saldo, 0));
    const totalPendapatanPrev = Math.abs(pendapatan.reduce((s, h) => s + h.saldoPrev, 0));

    const totalBebanCurr = beban.reduce((s, h) => s + h.saldo, 0);
    const totalBebanPrev = beban.reduce((s, h) => s + h.saldoPrev, 0);

    const surplusCurr = totalPendapatanCurr - totalBebanCurr;
    const surplusPrev = totalPendapatanPrev - totalBebanPrev;

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-8 print:hidden">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Laporan Aktivitas</h2>
                    <p className="text-slate-500 font-medium tracking-tight">Perubahan Aset Neto: Pendapatan & Beban (PSAK 35)</p>
                </div>
                <div className="flex gap-4 items-center">
                    <select className="form-select rounded-2xl border-slate-200 text-xs font-bold" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
                        {state.academicYears?.filter(y => !y.isDeleted).map(y => (
                            <option key={y.id} value={y.name}>Tahun {y.name}</option>
                        ))}
                    </select>
                    <button onClick={exportToExcel} className="btn bg-white text-emerald-600 border-emerald-100 hover:bg-emerald-50 px-8 py-3 rounded-2xl shadow-sm font-black flex items-center gap-2">
                        <FileSpreadsheet size={18} /> Export Excel
                    </button>
                    <button onClick={() => window.print()} className="btn btn-primary px-8 py-3 rounded-2xl shadow-xl shadow-blue-500/20 font-black">
                        <Printer size={18} /> Cetak Laporan
                    </button>
                </div>
            </div>

            <div className="bg-white p-12 rounded-[40px] border border-slate-100 shadow-2xl animate-in" ref={reportRef}>
                {/* Header Formal */}
                <div className="text-center mb-16 pb-8 border-b-4 border-double border-slate-200">
                    <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">SIKAK YAYASAN UMUM</h1>
                    <h2 className="text-xl font-bold text-slate-600">LAPORAN AKTIVITAS</h2>
                    <p className="text-sm font-medium text-slate-400 mt-2 lowercase tracking-widest">Untuk Tahun yang Berakhir {currentYearStr}</p>
                </div>

                {/* PENDAPATAN */}
                <div className="mb-12">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                            <TrendingUp size={24} />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-widest">PENDAPATAN</h3>
                    </div>
                    <div className="overflow-hidden bg-white rounded-[32px] border border-slate-100 p-2">
                        <table className="w-full text-left border-separate border-spacing-y-1">
                            <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">
                                <tr>
                                    <th className="px-6 py-4">Uraian Pendapatan</th>
                                    <th className="px-6 py-4 text-right">Tahun {currentYearStr}</th>
                                    <th className="px-6 py-4 text-right opacity-40">Tahun {prevYearStr}</th>
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
                    <div className="mt-4 p-6 bg-blue-600 rounded-3xl text-white flex justify-between items-center shadow-lg shadow-blue-500/20">
                        <span className="font-black text-xs uppercase tracking-[0.2em] opacity-60">Total Pendapatan Terakumulasi</span>
                        <div className="text-right">
                           <p className="text-2xl font-black"><CurrencyDisplay value={totalPendapatanCurr} useColor={false} /></p>
                           <p className="text-[10px] font-bold opacity-40 italic">Tahun Lalu: <CurrencyDisplay value={totalPendapatanPrev} useColor={false} /></p>
                        </div>
                    </div>
                </div>

                {/* BEBAN */}
                <div className="mb-16">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center">
                            <TrendingDown size={24} />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-widest">BEBAN & PENGELUARAN</h3>
                    </div>
                    <div className="overflow-hidden bg-white rounded-[32px] border border-slate-100 p-2">
                        <table className="w-full text-left border-separate border-spacing-y-1">
                            <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">
                                <tr>
                                    <th className="px-6 py-4">Uraian Beban</th>
                                    <th className="px-6 py-4 text-right">Tahun {currentYearStr}</th>
                                    <th className="px-6 py-4 text-right opacity-40">Tahun {prevYearStr}</th>
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
                    <div className="mt-4 p-6 bg-slate-800 rounded-3xl text-white flex justify-between items-center">
                        <span className="font-black text-xs uppercase tracking-[0.2em] opacity-40">Total Beban & Pengeluaran</span>
                        <div className="text-right">
                           <p className="text-2xl font-black"><CurrencyDisplay value={totalBebanCurr} useColor={false} /></p>
                           <p className="text-[10px] font-bold opacity-40 italic">Tahun Lalu: <CurrencyDisplay value={totalBebanPrev} useColor={false} /></p>
                        </div>
                    </div>
                </div>

                {/* SURPLUS / DEFISIT */}
                <div className={`p-10 rounded-[40px] flex justify-between items-center shadow-2xl ${surplusCurr >= 0 ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-white/20 rounded-2xl">
                            <Activity size={32} />
                        </div>
                        <div>
                            <p className="font-black text-[10px] uppercase tracking-[0.3em] opacity-40 mb-1">Kenaikan (Penurunan) Aset Neto</p>
                            <h3 className="text-3xl font-black uppercase tracking-tighter">{surplusCurr >= 0 ? 'SURPLUS BERJALAN' : 'DEFISIT BERJALAN'}</h3>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-4xl font-black"><CurrencyDisplay value={surplusCurr} useColor={false} /></p>
                        <p className="text-xs font-bold opacity-60">Tahun Sebelumnya: <CurrencyDisplay value={surplusPrev} useColor={false} /></p>
                    </div>
                </div>
            </div>
        </div>
    );
}
