import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { hitungSaldoAkun } from '../utils/accounting';
import { formatRupiah } from '../utils/format';
import {
    Landmark,
    TrendingUp,
    TrendingDown,
    Printer,
    FileSpreadsheet,
    Search,
    Building2,
    Filter,
    ShieldCheck,
    CheckCircle2,
    Briefcase
} from 'lucide-react';
import CurrencyDisplay from '../components/CurrencyDisplay';
import * as XLSX from 'xlsx';

export default function WakafAssetReport() {
    const { state } = useApp();
    const accounts = useMemo(() => (state.accounts || []).filter(a => !a.isDeleted), [state.accounts]);
    const journals = useMemo(() => (state.journals || []).filter(j => !j.isDeleted), [state.journals]);
    const assets = useMemo(() => (state.assets || []).filter(a => !a.isDeleted), [state.assets]);

    // 1. Dapatkan daftar tahun transaksi secara dinamis
    const availableYears = useMemo(() => {
        const yearsSet = new Set();
        const currentYr = new Date().getFullYear().toString();
        yearsSet.add(currentYr);

        if (journals.length > 0) {
            journals.forEach(j => {
                if (j.date) {
                    const yr = j.date.substring(0, 4);
                    if (yr && /^\d{4}$/.test(yr)) {
                        yearsSet.add(yr);
                    }
                }
            });
        }

        if (state.academicYears && state.academicYears.length > 0) {
            state.academicYears.forEach(y => {
                if (!y.isDeleted && y.name) {
                    const yr = y.name.trim();
                    if (/^\d{4}$/.test(yr)) {
                        yearsSet.add(yr);
                    }
                }
            });
        }

        return Array.from(yearsSet).sort((a, b) => b - a);
    }, [journals, state.academicYears]);

    const [selectedYear, setSelectedYear] = useState(() => {
        const currentYr = new Date().getFullYear().toString();
        return availableYears.includes(currentYr) ? currentYr : availableYears[0] || currentYr;
    });

    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('ALL'); // 'ALL', 'PRODUKTIF', 'SOSIAL'
    const reportRef = useRef(null);

    const currentYearStr = selectedYear;
    const prevYearStr = (parseInt(selectedYear, 10) - 1).toString();

    // Filter daftar akun Aset Wakaf (atau akun Aset yang berhubungan dengan Wakaf/Mauquf)
    const wakafAccounts = useMemo(() => {
        return accounts.filter(acc => {
            if (acc.type !== 'Aset') return false;

            // Kategori detail saja
            if (acc.category !== 'detail') return false;

            // Memeriksa kata kunci wakaf, waqaf, mauquf, atau fund Dana Terikat/Wakaf
            const text = `${acc.code} ${acc.name} ${acc.fund || ''}`.toLowerCase();
            const isWakafKey = text.includes('wakaf') || text.includes('waqaf') || text.includes('mauquf') || text.includes('sawit') || text.includes('terikat');

            // Semua akun aset lancar & tetap di bawah hirarki jika dipicu
            return isWakafKey || acc.code.startsWith('1-1') || acc.code.startsWith('1-2');
        });
    }, [accounts]);

    // Kalkulasi Data Komparatif per Akun
    const computedData = useMemo(() => {
        return wakafAccounts.map(acc => {
            const saldoCurr = hitungSaldoAkun(journals, acc.id, accounts, currentYearStr, assets, false);
            const saldoPrev = hitungSaldoAkun(journals, acc.id, accounts, prevYearStr, assets, false);

            const selisih = saldoCurr - saldoPrev;
            const growthPct = saldoPrev !== 0 ? (selisih / Math.abs(saldoPrev)) * 100 : (saldoCurr !== 0 ? 100 : 0);

            // Tentukan Kategori Wakaf (Produktif vs Sosial/Fasilitas)
            const text = `${acc.name}`.toLowerCase();
            const isProduktif = text.includes('kebun') || text.includes('sawit') || text.includes('wallet') || text.includes('sewa') || text.includes('ruko') || text.includes('usaha') || text.includes('piutang');
            const classification = isProduktif ? 'PRODUKTIF' : 'SOSIAL';

            return {
                ...acc,
                saldoCurr,
                saldoPrev,
                selisih,
                growthPct,
                classification
            };
        });
    }, [wakafAccounts, journals, accounts, assets, currentYearStr, prevYearStr]);

    // Filter berdasarkan Pencarian & Kategori Wakaf
    const filteredData = useMemo(() => {
        return computedData.filter(item => {
            const matchSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.code.toLowerCase().includes(searchQuery.toLowerCase());
            const matchCat = categoryFilter === 'ALL' || item.classification === categoryFilter;
            return matchSearch && matchCat;
        });
    }, [computedData, searchQuery, categoryFilter]);

    // Totals
    const totalCurr = useMemo(() => filteredData.reduce((acc, item) => acc + item.saldoCurr, 0), [filteredData]);
    const totalPrev = useMemo(() => filteredData.reduce((acc, item) => acc + item.saldoPrev, 0), [filteredData]);
    const totalGrowth = totalCurr - totalPrev;
    const totalGrowthPct = totalPrev !== 0 ? (totalGrowth / Math.abs(totalPrev)) * 100 : (totalCurr !== 0 ? 100 : 0);

    const totalProduktif = useMemo(() => computedData.filter(i => i.classification === 'PRODUKTIF').reduce((a, b) => a + b.saldoCurr, 0), [computedData]);
    const totalSosial = useMemo(() => computedData.filter(i => i.classification === 'SOSIAL').reduce((a, b) => a + b.saldoCurr, 0), [computedData]);

    // Excel Export
    const exportToExcel = () => {
        const rows = [
            { Keterangan: 'LAPORAN RINCIAN ASET WAKAF' },
            { Keterangan: `Periode: 01-Jan s/d 31-Dec ${selectedYear}` },
            {},
            {
                'Kode Akun': 'Kode Akun',
                'Nama Akun / Peruntukan Aset Wakaf': 'Nama Akun / Peruntukan Aset Wakaf',
                'Kategori': 'Kategori',
                [`Tahun ${currentYearStr} (Rp)`]: `Tahun ${currentYearStr}`,
                [`Tahun ${prevYearStr} (Rp)`]: `Tahun ${prevYearStr}`,
                'Pertumbuhan (Rp)': 'Pertumbuhan (Rp)',
                'Pertumbuhan (%)': 'Pertumbuhan (%)'
            }
        ];

        filteredData.forEach(item => {
            rows.push({
                'Kode Akun': item.code,
                'Nama Akun / Peruntukan Aset Wakaf': item.name,
                'Kategori': item.classification === 'PRODUKTIF' ? 'Wakaf Produktif' : 'Wakaf Sosial/Fasilitas',
                [`Tahun ${currentYearStr} (Rp)`]: item.saldoCurr,
                [`Tahun ${prevYearStr} (Rp)`]: item.saldoPrev,
                'Pertumbuhan (Rp)': item.selisih,
                'Pertumbuhan (%)': `${item.growthPct.toFixed(2)}%`
            });
        });

        rows.push({});
        rows.push({
            'Kode Akun': 'TOTAL',
            'Nama Akun / Peruntukan Aset Wakaf': 'JUMLAH ASET WAKAF',
            'Kategori': '-',
            [`Tahun ${currentYearStr} (Rp)`]: totalCurr,
            [`Tahun ${prevYearStr} (Rp)`]: totalPrev,
            'Pertumbuhan (Rp)': totalGrowth,
            'Pertumbuhan (%)': `${totalGrowthPct.toFixed(2)}%`
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Rincian Aset Wakaf');
        XLSX.writeFile(wb, `SIKAD-Rincian-Aset-Wakaf-${selectedYear}.xlsx`);
    };

    return (
        <div className="p-8 space-y-8">
            {/* Header & Control Bar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-2xl">
                            <Landmark size={28} />
                        </div>
                        <div>
                            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Laporan Rincian Aset Wakaf</h2>
                            <p className="text-slate-500 font-medium tracking-tight">
                                Akumulasi &amp; Perbandingan Komparatif Portofolio Aset Wakaf (PSAK 35 / Nazhir Wakaf)
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Dynamic Year Selector */}
                    <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-2xl border border-slate-200 shadow-sm">
                        <Filter size={16} className="text-slate-400" />
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tahun:</span>
                        <select
                            className="form-select border-0 bg-transparent text-sm font-black text-slate-800 focus:ring-0 p-0 cursor-pointer"
                            value={selectedYear}
                            onChange={e => setSelectedYear(e.target.value)}
                        >
                            {availableYears.map(yr => (
                                <option key={yr} value={yr}>
                                    Tahun {yr}
                                </option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={exportToExcel}
                        className="btn bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200/60 px-5 py-2.5 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-sm"
                    >
                        <FileSpreadsheet size={18} /> Export Excel
                    </button>

                    <button
                        onClick={() => window.print()}
                        className="btn bg-blue-600 text-white hover:bg-blue-700 px-6 py-2.5 rounded-2xl font-black shadow-lg shadow-blue-500/20 flex items-center gap-2 transition-all"
                    >
                        <Printer size={18} /> Cetak Laporan
                    </button>
                </div>
            </div>

            {/* Executive Summary Cards (Print Hidden) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 print:hidden">
                <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-6 rounded-[28px] text-white shadow-xl shadow-emerald-600/15 relative overflow-hidden">
                    <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                    <p className="text-xs font-bold uppercase tracking-widest text-emerald-100/80 mb-2">Total Aset Wakaf ({currentYearStr})</p>
                    <h3 className="text-2xl font-black tracking-tight mb-2">
                        <CurrencyDisplay value={totalCurr} />
                    </h3>
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-200">
                        {totalGrowth >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        <span>
                            {totalGrowth >= 0 ? '+' : ''}{formatRupiah(totalGrowth)} ({totalGrowthPct.toFixed(1)}%) vs {prevYearStr}
                        </span>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-xl flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between text-slate-400 mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider">Wakaf Produktif</span>
                            <Briefcase size={18} className="text-amber-500" />
                        </div>
                        <h4 className="text-xl font-black text-slate-900">
                            <CurrencyDisplay value={totalProduktif} />
                        </h4>
                    </div>
                    <p className="text-[11px] font-semibold text-slate-400 mt-2">
                        Aset penghasil cashflow (Sawit, Ruko, Walet)
                    </p>
                </div>

                <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-xl flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between text-slate-400 mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider">Wakaf Sosial &amp; Fasilitas</span>
                            <Building2 size={18} className="text-blue-500" />
                        </div>
                        <h4 className="text-xl font-black text-slate-900">
                            <CurrencyDisplay value={totalSosial} />
                        </h4>
                    </div>
                    <p className="text-[11px] font-semibold text-slate-400 mt-2">
                        Sarana Ibadah, Pendidikan &amp; Sosial
                    </p>
                </div>

                <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-xl flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between text-slate-400 mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider">Total Portfolio Akun</span>
                            <ShieldCheck size={18} className="text-emerald-500" />
                        </div>
                        <h4 className="text-2xl font-black text-slate-900">
                            {filteredData.length} <span className="text-sm font-medium text-slate-400">Akun</span>
                        </h4>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 mt-2">
                        <CheckCircle2 size={13} /> Sesuai Standar Akuntansi Syariah
                    </div>
                </div>
            </div>

            {/* Filter & Search Bar (Print Hidden) */}
            <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-lg flex flex-col sm:flex-row justify-between items-center gap-4 print:hidden">
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Cari kode atau nama aset wakaf..."
                        className="form-input w-full pl-11 pr-4 py-2.5 rounded-2xl border-slate-200 text-xs font-medium focus:ring-2 focus:ring-emerald-500"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                        onClick={() => setCategoryFilter('ALL')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${categoryFilter === 'ALL' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                        Semua Kategori
                    </button>
                    <button
                        onClick={() => setCategoryFilter('PRODUKTIF')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${categoryFilter === 'PRODUKTIF' ? 'bg-amber-500 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                        Wakaf Produktif
                    </button>
                    <button
                        onClick={() => setCategoryFilter('SOSIAL')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${categoryFilter === 'SOSIAL' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                        Wakaf Sosial
                    </button>
                </div>
            </div>

            {/* Main Report Table Container */}
            <div className="bg-white rounded-[32px] border border-slate-100 shadow-2xl p-8 sm:p-12 animate-in" ref={reportRef}>
                {/* Print Header (Visible Only on Print) */}
                <div className="hidden print:block text-center mb-8 pb-6 border-b-2 border-slate-900">
                    <h1 className="text-2xl font-black uppercase text-slate-900 tracking-wider">YAYASAN DAR EL-IMAN</h1>
                    <h2 className="text-lg font-bold text-slate-700">LAPORAN RINCIAN ASET WAKAF</h2>
                    <p className="text-xs text-slate-500 font-medium">Periode: 01 Januari s/d 31 Desember {selectedYear}</p>
                </div>

                {/* Formal Title Block for Screen View */}
                <div className="print:hidden text-center mb-10 pb-8 border-b-4 border-double border-slate-200">
                    <span className="px-4 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-[11px] font-black uppercase tracking-widest inline-block mb-3">
                        Laporan Keuangan Syariah
                    </span>
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight">Laporan Rincian Aset Wakaf</h3>
                    <p className="text-slate-500 font-semibold text-sm mt-1">
                        Periode 01-Jan s/d 31-Dec {selectedYear}
                    </p>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b-2 border-slate-200 bg-slate-50/50 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                                <th className="py-4 px-4 w-28">Kode Akun</th>
                                <th className="py-4 px-4">Nama Akun &amp; Peruntukan Wakaf</th>
                                <th className="py-4 px-4 w-32 print:hidden">Kategori</th>
                                <th className="py-4 px-4 text-right w-44">Tahun {currentYearStr}</th>
                                <th className="py-4 px-4 text-right w-44">Tahun {prevYearStr}</th>
                                <th className="py-4 px-4 text-right w-40 print:hidden">Pertumbuhan</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                            {filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-slate-400 font-semibold italic">
                                        Tidak ada data aset wakaf yang sesuai dengan kriteria filter.
                                    </td>
                                </tr>
                            ) : (
                                filteredData.map((item, idx) => (
                                    <tr key={item.id || idx} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="py-3.5 px-4 font-mono font-bold text-slate-600">{item.code}</td>
                                        <td className="py-3.5 px-4 font-semibold text-slate-800">{item.name}</td>
                                        <td className="py-3.5 px-4 print:hidden">
                                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${item.classification === 'PRODUKTIF' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                                                {item.classification === 'PRODUKTIF' ? 'Wakaf Produktif' : 'Wakaf Sosial'}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-4 text-right font-black text-slate-900">
                                            <CurrencyDisplay value={item.saldoCurr} />
                                        </td>
                                        <td className="py-3.5 px-4 text-right font-bold text-slate-500">
                                            <CurrencyDisplay value={item.saldoPrev} />
                                        </td>
                                        <td className="py-3.5 px-4 text-right print:hidden font-bold">
                                            <div className={item.selisih >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                                                <span>{item.selisih >= 0 ? '+' : ''}{formatRupiah(item.selisih)}</span>
                                                <span className="text-[10px] block opacity-75">
                                                    ({item.growthPct >= 0 ? '+' : ''}{item.growthPct.toFixed(1)}%)
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        <tfoot>
                            <tr className="border-t-4 border-double border-slate-900 bg-slate-50 text-slate-900 font-black text-xs">
                                <td colSpan={3} className="py-5 px-4 text-sm tracking-tight uppercase">
                                    Jumlah Aset Wakaf
                                </td>
                                <td className="py-5 px-4 text-right text-sm text-emerald-700">
                                    <CurrencyDisplay value={totalCurr} />
                                </td>
                                <td className="py-5 px-4 text-right text-sm text-slate-600">
                                    <CurrencyDisplay value={totalPrev} />
                                </td>
                                <td className="py-5 px-4 text-right text-sm print:hidden">
                                    <span className={totalGrowth >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                                        {totalGrowth >= 0 ? '+' : ''}{formatRupiah(totalGrowth)}
                                    </span>
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {/* Printable Signature Footer */}
                <div className="hidden print:flex justify-between items-end mt-16 pt-8 border-t border-slate-200">
                    <div className="text-center w-48">
                        <p className="text-xs font-bold text-slate-600">Dibuat oleh,</p>
                        <div className="h-20" />
                        <p className="text-xs font-black underline text-slate-800">Bagian Akuntansi</p>
                    </div>
                    <div className="text-center w-48">
                        <p className="text-xs font-bold text-slate-600">Disetujui oleh,</p>
                        <div className="h-20" />
                        <p className="text-xs font-black underline text-slate-800">Nazhir / Ketua Yayasan</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
