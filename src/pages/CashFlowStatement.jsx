import { useState, Fragment, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { hitungSaldoAkun, getAvailableTransactionYears } from '../utils/accounting';
import { formatTanggal } from '../utils/format';
import { Printer, Banknote, FileSpreadsheet, TrendingUp, TrendingDown, ArrowRightLeft, Wallet } from 'lucide-react';
import CurrencyDisplay from '../components/CurrencyDisplay';
import ReportRow from '../components/ReportRow';
import * as XLSX from 'xlsx';

export default function CashFlowStatement() {
    const { state } = useApp();
    const accounts = useMemo(() => state.accounts.filter(a => !a.isDeleted), [state.accounts]);
    const journals = useMemo(() => state.journals.filter(j => !j.isDeleted), [state.journals]);
    const assets = useMemo(() => state.assets.filter(a => !a.isDeleted), [state.assets]);
    const reportRef = useRef(null);

    // Filter Tahun Dinamis (Hanya tahun dengan transaksi)
    const availableYears = useMemo(() => getAvailableTransactionYears(journals), [journals]);
    const [selectedYear, setSelectedYear] = useState(() => availableYears[0] || new Date().getFullYear().toString());
    const [expandedRows, setExpandedRows] = useState({ 'OPERATING': true, 'INVESTING': true, 'FINANCING': true });

    const activeYear = availableYears.includes(selectedYear) ? selectedYear : (availableYears[0] || new Date().getFullYear().toString());
    const currentYearStr = activeYear;
    const prevYearStr = (parseInt(activeYear, 10) - 1).toString();

    const toggleRow = (id) => {
        setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const cashAccounts = useMemo(() => accounts.filter(a => a.category === 'detail' && a.code.startsWith('1-11')), [accounts]);
    
    const getTotalCashBalance = (year) => {
        return cashAccounts.reduce((sum, acc) => {
            return sum + hitungSaldoAkun(journals, acc.id, accounts, year, assets, false);
        }, 0);
    };

    const operatingReceipts = useMemo(() => {
        return accounts
            .filter(a => a.type === 'Pendapatan' && a.category === 'detail')
            .map(acc => ({
                label: acc.name,
                value: Math.abs(hitungSaldoAkun(journals, acc.id, accounts, currentYearStr, assets, true))
            }))
            .filter(item => item.value > 0);
    }, [accounts, journals, currentYearStr, assets]);

    const totalReceipts = useMemo(() => operatingReceipts.reduce((sum, item) => sum + item.value, 0), [operatingReceipts]);

    const isNonCashAccount = (acc) => {
        const name = (acc.name || '').toLowerCase();
        return name.includes('penyusutan') || name.includes('amortisasi');
    };

    const operatingPayments = useMemo(() => {
        return accounts
            .filter(a => a.type === 'Beban' && a.category === 'detail' && !isNonCashAccount(a))
            .map(acc => ({
                label: acc.name,
                value: hitungSaldoAkun(journals, acc.id, accounts, currentYearStr, assets, true)
            }))
            .filter(item => item.value > 0);
    }, [accounts, journals, currentYearStr, assets]);

    const totalPayments = useMemo(() => operatingPayments.reduce((sum, item) => sum + item.value, 0), [operatingPayments]);
    const netOperatingCash = totalReceipts - totalPayments;

    const investingActivities = useMemo(() => {
        return accounts
            .filter(a => a.type === 'Aset' && a.category === 'detail' && !a.code.startsWith('1-1'))
            .map(acc => {
                const delta = hitungSaldoAkun(journals, acc.id, accounts, currentYearStr, assets, true);
                return { label: acc.name, value: -delta };
            })
            .filter(item => item.value !== 0);
    }, [accounts, journals, currentYearStr, assets]);

    const netInvestingCash = useMemo(() => investingActivities.reduce((sum, item) => sum + item.value, 0), [investingActivities]);

    const financingActivities = useMemo(() => {
        return accounts
            .filter(a => (a.type === 'Kewajiban' || a.type === 'Aset Neto') && a.category === 'detail')
            .map(acc => {
                const delta = hitungSaldoAkun(journals, acc.id, accounts, currentYearStr, assets, true);
                return { label: acc.name, value: delta }; 
            })
            .filter(item => item.value !== 0);
    }, [accounts, journals, currentYearStr, assets]);

    const netFinancingCash = useMemo(() => financingActivities.reduce((sum, item) => sum + item.value, 0), [financingActivities]);

    const cashStart = useMemo(() => getTotalCashBalance(prevYearStr), [cashAccounts, journals, accounts, prevYearStr, assets]);
    const cashEnd = useMemo(() => getTotalCashBalance(currentYearStr), [cashAccounts, journals, accounts, currentYearStr, assets]);
    const cashIncrease = cashEnd - cashStart;

    const exportToExcel = () => {
        const data = [];
        data.push({ 'Keterangan': 'YAYASAN DARELIMAN' });
        data.push({ 'Keterangan': `LAPORAN ARUS KAS (METODE LANGSUNG) - TAHUN ${currentYearStr}` });
        data.push({ 'Keterangan': `Untuk Periode yang Berakhir pada 31 Desember ${currentYearStr}` });
        data.push({});

        data.push({ 'Keterangan': '1. ARUS KAS DARI AKTIVITAS OPERASI' });
        data.push({ 'Keterangan': ' Penerimaan Kas:' });
        operatingReceipts.forEach(r => data.push({ 'Keterangan': `   ${r.label}`, 'Nilai': r.value }));
        data.push({ 'Keterangan': ' Total Penerimaan Kas', 'Nilai': totalReceipts });
        data.push({ 'Keterangan': ' Pengeluaran Kas:' });
        operatingPayments.forEach(p => data.push({ 'Keterangan': `   ${p.label}`, 'Nilai': -p.value }));
        data.push({ 'Keterangan': ' Total Pengeluaran Kas', 'Nilai': -totalPayments });
        data.push({ 'Keterangan': 'Arus Kas Bersih dari Aktivitas Operasi', 'Nilai': netOperatingCash });
        data.push({});

        data.push({ 'Keterangan': '2. ARUS KAS DARI AKTIVITAS INVESTASI' });
        investingActivities.forEach(i => data.push({ 'Keterangan': `   ${i.label}`, 'Nilai': i.value }));
        data.push({ 'Keterangan': 'Arus Kas Bersih dari Aktivitas Investasi', 'Nilai': netInvestingCash });
        data.push({});

        data.push({ 'Keterangan': '3. ARUS KAS DARI AKTIVITAS PENDANAAN' });
        financingActivities.forEach(f => data.push({ 'Keterangan': `   ${f.label}`, 'Nilai': f.value }));
        data.push({ 'Keterangan': 'Arus Kas Bersih dari Aktivitas Pendanaan', 'Nilai': netFinancingCash });
        data.push({});

        data.push({ 'Keterangan': 'Kenaikan (Penurunan) Bersih Kas & Setara Kas', 'Nilai': cashIncrease });
        data.push({ 'Keterangan': `Kas & Setara Kas Awal Periode (1 Jan ${currentYearStr})`, 'Nilai': cashStart });
        data.push({ 'Keterangan': `KAS & SETARA KAS AKHIR PERIODE (31 Des ${currentYearStr})`, 'Nilai': cashEnd });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `ArusKas_${currentYearStr}`);
        XLSX.writeFile(wb, `SIKAD-Dareliman-ArusKas-${currentYearStr}.xlsx`);
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header Kontrol */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 print:hidden">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                            <Banknote size={22} />
                        </div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Laporan Arus Kas</h2>
                    </div>
                    <p className="text-slate-500 font-medium text-sm">Metode Langsung — Aktivitas Operasi, Investasi, & Pendanaan (PSAK 35)</p>
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
                        <Wallet size={22} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Kas Awal Periode</p>
                        <h4 className="text-lg font-black text-slate-900"><CurrencyDisplay value={cashStart} useColor={false} /></h4>
                        <p className="text-[10px] text-slate-400">Per 1 Januari {currentYearStr}</p>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <ArrowRightLeft size={22} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Arus Kas Operasional</p>
                        <h4 className="text-lg font-black text-slate-900"><CurrencyDisplay value={netOperatingCash} /></h4>
                        <p className="text-[10px] text-slate-400">Aktivitas Utama</p>
                    </div>
                </div>

                <div className={`p-5 rounded-3xl border flex items-center gap-4 ${cashIncrease >= 0 ? 'bg-emerald-50/80 border-emerald-100 text-emerald-800' : 'bg-rose-50/80 border-rose-100 text-rose-800'}`}>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${cashIncrease >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                        {cashIncrease >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider opacity-70">Mutasi Bersih Kas</p>
                        <h4 className="text-lg font-black"><CurrencyDisplay value={cashIncrease} /></h4>
                        <p className="text-[10px] opacity-80">{cashIncrease >= 0 ? 'Kenaikan Kas' : 'Penurunan Kas'}</p>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                        <Banknote size={22} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Kas Akhir Periode</p>
                        <h4 className="text-lg font-black text-emerald-700"><CurrencyDisplay value={cashEnd} useColor={false} /></h4>
                        <p className="text-[10px] text-slate-400">Per 31 Desember {currentYearStr}</p>
                    </div>
                </div>
            </div>

            {/* Lembar Laporan Formal */}
            <div className="bg-white p-8 md:p-12 rounded-[36px] border border-slate-100 shadow-xl overflow-hidden" ref={reportRef}>
                {/* Header Formal Instansi */}
                <div className="text-center mb-10 pb-8 border-b-2 border-slate-200">
                    <p className="text-xs font-black tracking-[0.25em] text-slate-400 uppercase mb-1">LAPORAN KEUANGAN YAYASAN</p>
                    <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">YAYASAN DARELIMAN</h1>
                    <h2 className="text-lg font-bold text-blue-600 mt-1 uppercase tracking-wide">LAPORAN ARUS KAS (METODE LANGSUNG)</h2>
                    <div className="inline-block mt-3 px-4 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                        Untuk Periode yang Berakhir pada 31 Desember {currentYearStr}
                    </div>
                </div>

                <div className="space-y-8">
                    {/* AKTIVITAS OPERASI, INVESTASI, PENDANAAN TABEL */}
                    <div className="overflow-hidden bg-white rounded-3xl border border-slate-200/80 p-2">
                        <table className="w-full text-left border-separate border-spacing-y-1">
                            <tbody>
                                {/* OPERATING */}
                                <ReportRow 
                                    id="OPERATING"
                                    name="1. ARUS KAS DARI AKTIVITAS OPERASI"
                                    valCurr={netOperatingCash}
                                    valPrev={0}
                                    type="category"
                                    isParent={true}
                                    isExpanded={!!expandedRows['OPERATING']}
                                    onToggle={toggleRow}
                                />
                                {expandedRows['OPERATING'] && (
                                    <Fragment>
                                        <ReportRow name="Penerimaan Kas dari Aktivitas Yayasan:" valCurr={totalReceipts} type="header" level={1} />
                                        {operatingReceipts.map((item, idx) => (
                                            <ReportRow key={`rec-${idx}`} name={item.label} valCurr={item.value} level={2} />
                                        ))}
                                        <ReportRow name="Pengeluaran Kas untuk Operasional & Program:" valCurr={-totalPayments} type="header" level={1} />
                                        {operatingPayments.map((item, idx) => (
                                            <ReportRow key={`pay-${idx}`} name={item.label} valCurr={-item.value} level={2} />
                                        ))}
                                    </Fragment>
                                )}

                                {/* INVESTING */}
                                <ReportRow 
                                    id="INVESTING"
                                    name="2. ARUS KAS DARI AKTIVITAS INVESTASI"
                                    valCurr={netInvestingCash}
                                    valPrev={0}
                                    type="category"
                                    isParent={true}
                                    isExpanded={!!expandedRows['INVESTING']}
                                    onToggle={toggleRow}
                                />
                                {expandedRows['INVESTING'] && (
                                    investingActivities.length === 0 ? (
                                        <tr><td colSpan={3} className="px-10 py-3 text-slate-400 text-xs italic">Tidak ada arus kas investasi pada periode ini</td></tr>
                                    ) : (
                                        investingActivities.map((item, idx) => (
                                            <ReportRow key={`inv-${idx}`} name={item.label} valCurr={item.value} level={1} />
                                        ))
                                    )
                                )}

                                {/* FINANCING */}
                                <ReportRow 
                                    id="FINANCING"
                                    name="3. ARUS KAS DARI AKTIVITAS PENDANAAN"
                                    valCurr={netFinancingCash}
                                    valPrev={0}
                                    type="category"
                                    isParent={true}
                                    isExpanded={!!expandedRows['FINANCING']}
                                    onToggle={toggleRow}
                                />
                                {expandedRows['FINANCING'] && (
                                    financingActivities.length === 0 ? (
                                        <tr><td colSpan={3} className="px-10 py-3 text-slate-400 text-xs italic">Tidak ada arus kas pendanaan pada periode ini</td></tr>
                                    ) : (
                                        financingActivities.map((item, idx) => (
                                            <ReportRow key={`fin-${idx}`} name={item.label} valCurr={item.value} level={1} />
                                        ))
                                    )
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* REKONSILIASI SALDO KAS */}
                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200/80 space-y-4">
                        <div className="flex justify-between items-center px-4 text-slate-700 font-bold text-xs uppercase tracking-wider">
                            <span>Kenaikan (Penurunan) Bersih Kas & Setara Kas</span>
                            <span className="text-base"><CurrencyDisplay value={cashIncrease} /></span>
                        </div>
                        <div className="flex justify-between items-center px-4 text-slate-500 font-medium text-xs border-t border-slate-200 pt-3">
                            <span>Kas & Setara Kas pada Awal Periode (1 Januari {currentYearStr})</span>
                            <span className="font-bold"><CurrencyDisplay value={cashStart} useColor={false} /></span>
                        </div>
                        <div className="p-6 bg-gradient-to-r from-[#103E2D] via-[#156947] to-[#1D885D] text-white rounded-2xl flex justify-between items-center shadow-md border border-[#2A946B]/30">
                             <div className="flex items-center gap-3">
                                 <Banknote size={28} className="text-emerald-200" />
                                 <span className="font-bold text-sm uppercase tracking-wider">KAS &amp; SETARA KAS AKHIR PERIODE (31 DESEMBER {currentYearStr})</span>
                             </div>
                             <span className="text-2xl font-bold text-emerald-200 tabular-nums"><CurrencyDisplay value={cashEnd} useColor={false} /></span>
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
