import { useState, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { getAvailableTransactionYears } from '../utils/accounting';
import { formatTanggal } from '../utils/format';
import {
    Printer, LayoutGrid, List, Wallet,
    ArrowUpRight, ArrowDownRight, Search, FileSpreadsheet, X, Coins, HeartHandshake, CheckCircle2
} from 'lucide-react';
import CurrencyDisplay from '../components/CurrencyDisplay';
import * as XLSX from 'xlsx';

export default function ProgramReport() {
    const { state } = useApp();
    const journals = useMemo(() => state.journals.filter(j => !j.isDeleted), [state.journals]);
    const accounts = useMemo(() => state.accounts.filter(a => !a.isDeleted), [state.accounts]);
    const programs = useMemo(() => state.programs.filter(p => !p.isDeleted), [state.programs]);
    const reportRef = useRef(null);

    // Filter Tahun Dinamis (Hanya tahun dengan transaksi)
    const availableYears = useMemo(() => getAvailableTransactionYears(journals), [journals]);
    const [selectedYear, setSelectedYear] = useState(() => availableYears[0] || new Date().getFullYear().toString());

    const activeYear = availableYears.includes(selectedYear) ? selectedYear : (availableYears[0] || new Date().getFullYear().toString());
    const defaultStart = `${activeYear}-01-01`;
    const defaultEnd = `${activeYear}-12-31`;

    const [programFilters, setProgramFilters] = useState({});
    const [viewMode, setViewMode] = useState('grid');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProgramLedger, setSelectedProgramLedger] = useState(null);

    const updateFilter = (id, field, value) => {
        setProgramFilters(prev => ({
            ...prev,
            [id]: { 
                start: prev[id]?.start || defaultStart,
                end: prev[id]?.end || defaultEnd,
                [field]: value 
            }
        }));
    };

    const handleYearChange = (year) => {
        setSelectedYear(year);
        // Reset individual overrides to align with selected year
        const newStart = `${year}-01-01`;
        const newEnd = `${year}-12-31`;
        const updated = {};
        programs.forEach(p => {
            updated[p.id] = { start: newStart, end: newEnd };
        });
        setProgramFilters(updated);
    };

    const programSummary = useMemo(() => {
        return programs
            .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .map(program => {
                const filter = programFilters[program.id] || { start: defaultStart, end: defaultEnd };

                const aggregate = (type, codes, normal) => {
                    const matchingIds = accounts
                        .filter(a => a.type === type && codes.some(c => a.code.startsWith(c)))
                        .map(a => a.id);

                    let total = 0;
                    journals.forEach(journal => {
                        const jDateOnly = journal.date ? journal.date.substring(0, 10) : '';
                        if (filter.start && jDateOnly < filter.start) return;
                        if (filter.end && jDateOnly > filter.end) return;
                        if (journal.programId !== program.id) return;

                        journal.entries?.forEach(entry => {
                            if (matchingIds.includes(entry.accountId)) {
                                if (normal === 'kredit') {
                                    total += (entry.credit || 0) - (entry.debit || 0);
                                } else {
                                    total += (entry.debit || 0) - (entry.credit || 0);
                                }
                            }
                        });
                    });
                    return total;
                };

                const donasiMasuk = aggregate('Pendapatan', ['4-1', '4-2'], 'kredit');
                const penyaluranSosial = aggregate('Beban', ['5-1'], 'debit');
                const bebanOperasional = aggregate('Beban', ['6-1'], 'debit');
                const bebanLainnya = aggregate('Beban', ['5-2', '5-8'], 'debit');

                const totalDonasi = (program.initialDonationBalance || 0) + donasiMasuk;
                const totalPenyaluran = penyaluranSosial + bebanOperasional + bebanLainnya;
                const totalNetoProgram = totalDonasi - totalPenyaluran;

                return {
                    ...program,
                    donasiMasuk,
                    penyaluranSosial,
                    bebanOperasional,
                    bebanLainnya,
                    totalPenyaluran,
                    totalSaldo: totalNetoProgram,
                    filterStart: filter.start,
                    filterEnd: filter.end
                };
            });
    }, [programs, searchTerm, programFilters, defaultStart, defaultEnd, accounts, journals]);

    const totalAllDonasi = useMemo(() => programSummary.reduce((s, p) => s + (p.donasiMasuk + (p.initialDonationBalance || 0)), 0), [programSummary]);
    const totalAllPenyaluran = useMemo(() => programSummary.reduce((s, p) => s + p.totalPenyaluran, 0), [programSummary]);
    const totalAllSisa = useMemo(() => programSummary.reduce((s, p) => s + p.totalSaldo, 0), [programSummary]);

    const getProgramLedger = (programId) => {
        return journals
            .filter(j => j.programId === programId)
            .sort((a, b) => new Date(a.date) - new Date(b.date));
    };

    const exportToExcel = () => {
        const data = [];
        data.push({ 'Kode Program': 'YAYASAN DARELIMAN' });
        data.push({ 'Kode Program': `LAPORAN PROGRAM DONASI - TAHUN ${activeYear}` });
        data.push({ 'Kode Program': `Periode ${defaultStart} s/d ${defaultEnd}` });
        data.push({});

        data.push({
            'Kode Program': 'ID',
            'Nama Program': 'Nama Program Donasi',
            'Kategori': 'Kategori',
            'Saldo Awal': 'Saldo Awal',
            'Donasi Masuk': 'Donasi Masuk',
            'Total Penyaluran': 'Penyaluran Program',
            'Sisa Saldo': 'Sisa Saldo Netto'
        });

        programSummary.forEach(p => {
            data.push({
                'Kode Program': p.id,
                'Nama Program': p.name,
                'Kategori': p.category || '-',
                'Saldo Awal': p.initialDonationBalance || 0,
                'Donasi Masuk': p.donasiMasuk,
                'Total Penyaluran': p.totalPenyaluran,
                'Sisa Saldo': p.totalSaldo
            });
        });

        data.push({});
        data.push({
            'Kode Program': 'TOTAL KONSOLIDASI',
            'Nama Program': '',
            'Kategori': '',
            'Saldo Awal': '',
            'Donasi Masuk': totalAllDonasi,
            'Total Penyaluran': totalAllPenyaluran,
            'Sisa Saldo': totalAllSisa
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Program_${activeYear}`);
        XLSX.writeFile(wb, `SIKAD-Dareliman-ProgramDonasi-${activeYear}.xlsx`);
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header Kontrol */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 print:hidden">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                            <HeartHandshake size={22} />
                        </div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Program Donasi</h2>
                    </div>
                    <p className="text-slate-500 font-medium text-sm">Analisis penerimaan donasi dan penyaluran dana per program sosial yayasan</p>
                </div>

                <div className="flex flex-wrap gap-3 items-center">
                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-2xl border border-slate-200 shadow-sm">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Tahun:</span>
                        <select 
                            className="bg-transparent border-none text-sm font-bold text-slate-800 focus:outline-none cursor-pointer"
                            value={activeYear} 
                            onChange={e => handleYearChange(e.target.value)}
                        >
                            {availableYears.map(year => (
                                <option key={year} value={year}>Tahun {year}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex bg-slate-100 p-1 rounded-2xl">
                        <button 
                            onClick={() => setViewMode('grid')} 
                            className={`p-2 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600 font-bold' : 'text-slate-400'}`}
                            title="Tampilan Kartu (Grid)"
                        >
                            <LayoutGrid size={18}/>
                        </button>
                        <button 
                            onClick={() => setViewMode('table')} 
                            className={`p-2 rounded-xl transition-all ${viewMode === 'table' ? 'bg-white shadow-sm text-blue-600 font-bold' : 'text-slate-400'}`}
                            title="Tampilan Tabel"
                        >
                            <List size={18}/>
                        </button>
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
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Donasi Masuk</p>
                        <h4 className="text-lg font-black text-slate-900"><CurrencyDisplay value={totalAllDonasi} useColor={false} /></h4>
                        <p className="text-[10px] text-slate-400">Tahun {activeYear}</p>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                        <ArrowDownRight size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Penyaluran</p>
                        <h4 className="text-lg font-black text-slate-900"><CurrencyDisplay value={totalAllPenyaluran} useColor={false} /></h4>
                        <p className="text-[10px] text-slate-400">Program Sosial</p>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                        <Wallet size={22} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Sisa Saldo Program</p>
                        <h4 className="text-lg font-black text-emerald-700"><CurrencyDisplay value={totalAllSisa} /></h4>
                        <p className="text-[10px] text-slate-400">Netto Donasi</p>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        <CheckCircle2 size={22} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Program Aktif</p>
                        <h4 className="text-lg font-black text-slate-900">{programs.length} Program</h4>
                        <p className="text-[10px] text-slate-400">Tahun {activeYear}</p>
                    </div>
                </div>
            </div>

            {/* Pencarian */}
            <div className="mb-6 print:hidden">
                <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
                    <Search size={18} className="text-slate-400 ml-2" />
                    <input 
                        className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-slate-700 placeholder:text-slate-400" 
                        placeholder="Cari program donasi berdasarkan nama..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                    />
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')} className="p-1 rounded-full hover:bg-slate-100 text-slate-400">
                            <X size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* Kontainer Lembar Laporan */}
            <div className="animate-in" ref={reportRef}>
                <div className="hidden print:block text-center mb-10 pb-6 border-b-2 border-slate-200">
                    <p className="text-xs font-black tracking-[0.25em] text-slate-400 uppercase mb-1">LAPORAN KEUANGAN YAYASAN</p>
                    <h1 className="text-2xl font-black text-slate-900 uppercase">YAYASAN DARELIMAN</h1>
                    <h2 className="text-lg font-bold text-blue-600 mt-1 uppercase">LAPORAN PROGRAM DONASI</h2>
                    <p className="text-xs text-slate-500 font-semibold mt-1">Periode Konsolidasi Tahun {activeYear}</p>
                </div>

                {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {programSummary.map(p => (
                            <div key={p.id} className="bg-white p-8 rounded-[36px] border border-slate-200/80 shadow-sm hover:shadow-xl hover:border-blue-300 transition-all flex flex-col group">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="space-y-1">
                                        <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-wider">{p.category || 'Program Donasi'}</span>
                                        <h3 className="text-xl font-black text-slate-900 group-hover:text-blue-600 transition-colors uppercase leading-tight mt-1">{p.name}</h3>
                                        <p className="text-xs font-mono font-bold text-slate-400">{p.id}</p>
                                    </div>
                                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                                        <Wallet size={24} />
                                    </div>
                                </div>

                                {/* Filter Periode Per Program */}
                                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-2xl mb-6 print:hidden">
                                     <div>
                                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Dari</label>
                                         <input 
                                            type="date" 
                                            className="w-full bg-white border border-slate-200 rounded-xl text-xs font-bold p-2 text-slate-700" 
                                            value={p.filterStart} 
                                            onChange={e => updateFilter(p.id, 'start', e.target.value)} 
                                         />
                                     </div>
                                     <div>
                                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Sampai</label>
                                         <input 
                                            type="date" 
                                            className="w-full bg-white border border-slate-200 rounded-xl text-xs font-bold p-2 text-slate-700" 
                                            value={p.filterEnd} 
                                            onChange={e => updateFilter(p.id, 'end', e.target.value)} 
                                         />
                                     </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                            <ArrowUpRight size={14} className="text-emerald-500" /> Penerimaan
                                        </p>
                                        <p className="text-base font-black text-slate-900 tracking-tight"><CurrencyDisplay value={p.donasiMasuk + (p.initialDonationBalance || 0)} useColor={false} /></p>
                                    </div>
                                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                            <ArrowDownRight size={14} className="text-rose-500" /> Penyaluran
                                        </p>
                                        <p className="text-base font-black text-slate-900 tracking-tight"><CurrencyDisplay value={p.totalPenyaluran} useColor={false} /></p>
                                    </div>
                                </div>

                                <div className="mt-auto pt-5 border-t border-slate-100 flex justify-between items-center">
                                     <div>
                                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Sisa Saldo Bersih</p>
                                         <h4 className="text-2xl font-black text-slate-900 tracking-tight"><CurrencyDisplay value={p.totalSaldo} /></h4>
                                     </div>
                                     <button 
                                        onClick={() => setSelectedProgramLedger(p.id)} 
                                        className="px-4 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-blue-600 transition-all text-xs font-bold flex items-center gap-2 print:hidden"
                                     >
                                         <List size={16} /> Riwayat
                                     </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-white rounded-[32px] border border-slate-200/80 shadow-xl overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4">Nama Program</th>
                                    <th className="px-6 py-4">Kategori</th>
                                    <th className="px-6 py-4 text-right">Saldo Awal</th>
                                    <th className="px-6 py-4 text-right">Donasi Masuk</th>
                                    <th className="px-6 py-4 text-right">Penyaluran</th>
                                    <th className="px-6 py-4 text-right">Sisa Saldo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm">
                                {programSummary.map(p => (
                                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 font-bold text-slate-900">{p.name}</td>
                                        <td className="px-6 py-4 text-xs font-semibold text-slate-500">{p.category || '-'}</td>
                                        <td className="px-6 py-4 text-right font-medium text-slate-500 tabular-nums"><CurrencyDisplay value={p.initialDonationBalance || 0} useColor={false} /></td>
                                        <td className="px-6 py-4 text-right font-bold text-emerald-600 tabular-nums"><CurrencyDisplay value={p.donasiMasuk} useColor={false} /></td>
                                        <td className="px-6 py-4 text-right font-bold text-rose-600 tabular-nums"><CurrencyDisplay value={p.totalPenyaluran} useColor={false} /></td>
                                        <td className="px-6 py-4 text-right font-black text-slate-900 tabular-nums"><CurrencyDisplay value={p.totalSaldo} /></td>
                                    </tr>
                                ))}
                                <tr className="bg-slate-900 text-white font-black text-sm">
                                    <td colSpan={2} className="px-6 py-5 text-right text-xs uppercase tracking-widest text-slate-300">Total Konsolidasi Seluruh Program</td>
                                    <td className="px-6 py-5 text-right">-</td>
                                    <td className="px-6 py-5 text-right tabular-nums"><CurrencyDisplay value={totalAllDonasi} useColor={false} /></td>
                                    <td className="px-6 py-5 text-right tabular-nums"><CurrencyDisplay value={totalAllPenyaluran} useColor={false} /></td>
                                    <td className="px-6 py-5 text-right tabular-nums text-emerald-400 text-base"><CurrencyDisplay value={totalAllSisa} useColor={false} /></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal Detail Buku Besar Program */}
            {selectedProgramLedger && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-4xl max-h-[85vh] rounded-[32px] shadow-2xl flex flex-col overflow-hidden animate-in">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="text-xl font-black text-slate-900">
                                    Riwayat Transaksi: {programs.find(p => p.id === selectedProgramLedger)?.name}
                                </h3>
                                <p className="text-xs font-mono text-slate-400 mt-0.5">Program ID: {selectedProgramLedger}</p>
                            </div>
                            <button onClick={() => setSelectedProgramLedger(null)} className="p-2 rounded-2xl bg-white hover:bg-slate-200 text-slate-600 transition-all">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1">
                            {getProgramLedger(selectedProgramLedger).length === 0 ? (
                                <div className="py-16 text-center text-slate-400 font-medium text-sm">
                                    Belum ada jurnal transaksi khusus yang tertaut langsung dengan program ini.
                                </div>
                            ) : (
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                        <tr>
                                            <th className="px-4 py-3">Tanggal</th>
                                            <th className="px-4 py-3">ID Jurnal</th>
                                            <th className="px-4 py-3">Keterangan</th>
                                            <th className="px-4 py-3 text-right">Debit</th>
                                            <th className="px-4 py-3 text-right">Kredit</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {getProgramLedger(selectedProgramLedger).map(j => {
                                            const totDebit = j.entries?.reduce((s, e) => s + (e.debit || 0), 0) || 0;
                                            const totCredit = j.entries?.reduce((s, e) => s + (e.credit || 0), 0) || 0;
                                            return (
                                                <tr key={j.id} className="hover:bg-slate-50/50">
                                                    <td className="px-4 py-3 text-xs font-semibold text-slate-500">{formatTanggal(j.date)}</td>
                                                    <td className="px-4 py-3 text-xs font-mono font-bold text-blue-600">{j.id}</td>
                                                    <td className="px-4 py-3 font-medium text-slate-700">{j.description}</td>
                                                    <td className="px-4 py-3 text-right font-bold tabular-nums">{totDebit > 0 ? <CurrencyDisplay value={totDebit} useColor={false} /> : '-'}</td>
                                                    <td className="px-4 py-3 text-right font-bold tabular-nums">{totCredit > 0 ? <CurrencyDisplay value={totCredit} useColor={false} /> : '-'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
