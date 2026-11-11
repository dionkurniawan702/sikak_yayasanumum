import { useState, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { hitungSaldoAkun, getAvailableTransactionYears } from '../utils/accounting';
import { formatTanggal } from '../utils/format';
import { Printer, TrendingUp, PieChart, FileSpreadsheet, RefreshCw, Landmark, CheckCircle } from 'lucide-react';
import CurrencyDisplay from '../components/CurrencyDisplay';
import * as XLSX from 'xlsx';

export default function StatementOfChangesInNetAssets() {
    const { state } = useApp();
    const accounts = useMemo(() => state.accounts.filter(a => !a.isDeleted), [state.accounts]);
    const journals = useMemo(() => state.journals.filter(j => !j.isDeleted), [state.journals]);
    const assets = useMemo(() => state.assets.filter(a => !a.isDeleted), [state.assets]);
    const reportRef = useRef(null);

    // Filter Tahun Dinamis (Hanya tahun dengan transaksi)
    const availableYears = useMemo(() => getAvailableTransactionYears(journals), [journals]);
    const [selectedYear, setSelectedYear] = useState(() => availableYears[0] || new Date().getFullYear().toString());

    const activeYear = availableYears.includes(selectedYear) ? selectedYear : (availableYears[0] || new Date().getFullYear().toString());
    const currentYearStr = activeYear;
    const prevYearStr = (parseInt(activeYear, 10) - 1).toString();

    // Helper to get balance for a specific asset neto category and year
    const getNetAssetBalance = (categoryName, year) => {
        const type = 'Aset Neto';
        const catAccounts = accounts.filter(acc => acc.type === type && acc.fund === categoryName && acc.category === 'detail');

        return catAccounts.reduce((total, acc) => {
            const saldo = hitungSaldoAkun(journals, acc.id, accounts, year, assets);
            return total + (acc.normalBalance === 'kredit' ? saldo : -saldo);
        }, 0);
    };

    // Helper to get surplus/deficit for a specific category and year
    const getCategorySurplus = (categoryName, year) => {
        const pendapatan = accounts
            .filter(acc => acc.type === 'Pendapatan' && acc.fund === categoryName && acc.category === 'detail')
            .reduce((total, acc) => total + hitungSaldoAkun(journals, acc.id, accounts, year, assets, true), 0);

        const beban = accounts
            .filter(acc => acc.type === 'Beban' && acc.fund === categoryName && acc.category === 'detail')
            .reduce((total, acc) => total + hitungSaldoAkun(journals, acc.id, accounts, year, assets, true), 0);

        return Math.abs(pendapatan) - beban;
    };

    // Categories (Foundation net assets classification per PSAK 35)
    const categories = [
        { 
            id: 'unrestricted', 
            name: 'Aset Neto Tanpa Pembatasan', 
            fund: 'Dana Umum',
            desc: 'Dapat digunakan bebas untuk operasional umum dan tujuan yayasan tanpa restriksi pihak donor'
        },
        { 
            id: 'restricted', 
            name: 'Aset Neto Dengan Pembatasan', 
            fund: 'Dana Terikat',
            desc: 'Dibatasi penggunaannya oleh donor/pemberi dana untuk program, waktu, atau tujuan spesifik'
        }
    ];

    const reportData = useMemo(() => {
        return categories.map(cat => {
            const awal = getNetAssetBalance(cat.fund, prevYearStr);
            const surplus = getCategorySurplus(cat.fund, currentYearStr);
            const akhir = awal + surplus;
            return { ...cat, awal, surplus, akhir };
        });
    }, [accounts, journals, assets, currentYearStr, prevYearStr]);

    const totalAwal = useMemo(() => reportData.reduce((s, d) => s + d.awal, 0), [reportData]);
    const totalSurplus = useMemo(() => reportData.reduce((s, d) => s + d.surplus, 0), [reportData]);
    const totalAkhir = useMemo(() => reportData.reduce((s, d) => s + d.akhir, 0), [reportData]);
    const growthPercent = totalAwal > 0 ? ((totalSurplus / totalAwal) * 100).toFixed(1) : '0';

    const exportToExcel = () => {
        const data = [];
        data.push({ 'Klasifikasi Aset Neto': 'YAYASAN DARELIMAN' });
        data.push({ 'Klasifikasi Aset Neto': `LAPORAN PERUBAHAN ASET NETO - TAHUN ${currentYearStr}` });
        data.push({ 'Klasifikasi Aset Neto': `Untuk Tahun yang Berakhir pada 31 Desember ${currentYearStr}` });
        data.push({});

        reportData.forEach(d => {
            data.push({
                'Klasifikasi Aset Neto': d.name,
                'Saldo Awal (1 Jan)': d.awal,
                'Surplus / (Defisit)': d.surplus,
                'Saldo Akhir (31 Des)': d.akhir
            });
        });

        data.push({});
        data.push({
            'Klasifikasi Aset Neto': 'TOTAL SELURUH ASET NETO',
            'Saldo Awal (1 Jan)': totalAwal,
            'Surplus / (Defisit)': totalSurplus,
            'Saldo Akhir (31 Des)': totalAkhir
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `AsetNeto_${currentYearStr}`);
        XLSX.writeFile(wb, `SIKAD-Dareliman-PerubahanAsetNeto-${currentYearStr}.xlsx`);
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header Kontrol */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 print:hidden">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                            <PieChart size={22} />
                        </div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Perubahan Aset Neto</h2>
                    </div>
                    <p className="text-slate-500 font-medium text-sm">Rekonsiliasi Saldo Awal, Surplus/Defisit, dan Saldo Akhir (PSAK 35)</p>
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
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                        <Landmark size={22} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Aset Neto Awal</p>
                        <h4 className="text-lg font-black text-slate-900"><CurrencyDisplay value={totalAwal} useColor={false} /></h4>
                        <p className="text-[10px] text-slate-400">Per 1 Januari {currentYearStr}</p>
                    </div>
                </div>

                <div className={`p-5 rounded-3xl border flex items-center gap-4 ${totalSurplus >= 0 ? 'bg-emerald-50/80 border-emerald-100 text-emerald-800' : 'bg-rose-50/80 border-rose-100 text-rose-800'}`}>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${totalSurplus >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                        {totalSurplus >= 0 ? <TrendingUp size={24} /> : <RefreshCw size={24} />}
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider opacity-70">Surplus / (Defisit)</p>
                        <h4 className="text-lg font-black"><CurrencyDisplay value={totalSurplus} /></h4>
                        <p className="text-[10px] opacity-80">Pertumbuhan {growthPercent}%</p>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <PieChart size={22} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Aset Neto Akhir</p>
                        <h4 className="text-lg font-black text-blue-900"><CurrencyDisplay value={totalAkhir} useColor={false} /></h4>
                        <p className="text-[10px] text-slate-400">Per 31 Desember {currentYearStr}</p>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        <CheckCircle size={22} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Status Klasifikasi</p>
                        <h4 className="text-sm font-black text-slate-800">Standar PSAK 35</h4>
                        <p className="text-[10px] text-slate-400">Tanpa & Dengan Pembatasan</p>
                    </div>
                </div>
            </div>

            {/* Lembar Laporan Formal */}
            <div className="bg-white p-8 md:p-12 rounded-[36px] border border-slate-100 shadow-xl overflow-hidden" ref={reportRef}>
                {/* Header Formal Instansi */}
                <div className="text-center mb-10 pb-8 border-b-2 border-slate-200">
                    <p className="text-xs font-black tracking-[0.25em] text-slate-400 uppercase mb-1">LAPORAN KEUANGAN YAYASAN</p>
                    <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">YAYASAN DARELIMAN</h1>
                    <h2 className="text-lg font-bold text-blue-600 mt-1 uppercase tracking-wide">LAPORAN PERUBAHAN ASET NETO</h2>
                    <div className="inline-block mt-3 px-4 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                        Untuk Periode yang Berakhir pada 31 Desember {currentYearStr} (Standar PSAK 35)
                    </div>
                </div>

                <div className="overflow-hidden bg-white rounded-3xl border border-slate-200/80 mb-10 p-2">
                    <table className="w-full text-left border-separate border-spacing-y-1">
                        <thead className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Klasifikasi Aset Neto</th>
                                <th className="px-6 py-4 text-right">Saldo Awal (1 Jan)</th>
                                <th className="px-6 py-4 text-right">Surplus / (Defisit)</th>
                                <th className="px-6 py-4 text-right bg-slate-50/80">Saldo Akhir (31 Des)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportData.map(data => (
                                <tr key={data.id} className="hover:bg-blue-50/20 transition-colors group">
                                    <td className="px-6 py-5">
                                        <div className="flex items-start gap-3">
                                            <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                                            <div>
                                                <p className="font-black text-slate-800 text-sm tracking-tight">{data.name}</p>
                                                <p className="text-xs text-slate-400 font-medium mt-0.5 leading-relaxed">{data.desc}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-right font-bold text-slate-600 tabular-nums">
                                        <CurrencyDisplay value={data.awal} useColor={false} />
                                    </td>
                                    <td className="px-6 py-5 text-right font-black tabular-nums">
                                        <CurrencyDisplay value={data.surplus} />
                                    </td>
                                    <td className="px-6 py-5 text-right font-black text-slate-900 bg-slate-50/60 tabular-nums text-base">
                                        <CurrencyDisplay value={data.akhir} useColor={false} />
                                    </td>
                                </tr>
                            ))}
                            <tr className="bg-gradient-to-r from-[#1C375B] via-[#265187] to-[#1B7678] text-white font-bold">
                                <td className="px-6 py-6 text-xs uppercase tracking-wider text-sky-100">
                                    Total Seluruh Aset Neto
                                </td>
                                <td className="px-6 py-6 text-right tabular-nums">
                                    <CurrencyDisplay value={totalAwal} useColor={false} />
                                </td>
                                <td className="px-6 py-6 text-right tabular-nums">
                                    <CurrencyDisplay value={totalSurplus} useColor={false} />
                                </td>
                                <td className="px-6 py-6 text-right text-xl tabular-nums text-emerald-200">
                                    <CurrencyDisplay value={totalAkhir} useColor={false} />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Penjelasan Catatan / Narasi PSAK 35 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 bg-blue-50/80 rounded-2xl border border-blue-100 space-y-2">
                        <div className="flex items-center gap-2 text-blue-900 font-black text-xs uppercase tracking-wider">
                            <TrendingUp size={18} className="text-blue-600" />
                            <span>Analisis Pertumbuhan Aset Neto</span>
                        </div>
                        <p className="text-xs text-blue-700 font-medium leading-relaxed">
                            Aset neto mencerminkan kekayaan bersih yayasan yang tidak terdistribusi ke pemilik/pendiri. 
                            Perubahan neto pada tahun berjalan sebesar <strong><CurrencyDisplay value={totalSurplus} useColor={false} /></strong> berasal dari aktivitas operasional dan penerimaan donasi yayasan.
                        </p>
                    </div>

                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                        <div className="flex items-center gap-2 text-slate-700 font-black text-xs uppercase tracking-wider">
                            <RefreshCw size={18} className="text-slate-500" />
                            <span>Kebijakan Batasan (PSAK 35)</span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed">
                            Dana yang diterima dengan amanah khusus dari donatur atau muzakki diklasifikasikan ke dalam 
                            <strong> Aset Neto Dengan Pembatasan</strong> sampai amanah atau program tersebut terlaksana.
                        </p>
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
