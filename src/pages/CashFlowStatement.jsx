import { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { hitungSaldoAkun } from '../utils/accounting';
import { formatRupiah, formatTanggal } from '../utils/format';
import { Download, Printer, Activity, TrendingUp, TrendingDown, Landmark, Banknote, FileSpreadsheet } from 'lucide-react';
import CurrencyDisplay from '../components/CurrencyDisplay';
import ReportRow from '../components/ReportRow';
import * as XLSX from 'xlsx';

export default function CashFlowStatement() {
    const { state } = useApp();
    const accounts = state.accounts.filter(a => !a.isDeleted);
    const journals = state.journals.filter(j => !j.isDeleted);
    const assets = state.assets.filter(a => !a.isDeleted);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
    const [expandedRows, setExpandedRows] = useState({ 'OPERATING': true }); // Default expand operating
    const reportRef = useRef(null);
    const currentYearStr = selectedYear;
    const prevYearStr = (parseInt(selectedYear) - 1).toString();

    const toggleRow = (id) => {
        setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const exportToExcel = () => {
        const data = [];
        data.push({ 'Keterangan': 'LAPORAN ARUS KAS (METODE LANGSUNG)', 'Nilai': currentYearStr });
        data.push({});

        data.push({ 'Keterangan': 'ARUS KAS DARI AKTIVITAS OPERASI' });
        data.push({ 'Keterangan': ' Penerimaan Kas:' });
        operatingReceipts.forEach(r => data.push({ 'Keterangan': `  ${r.label}`, 'Nilai': r.value }));
        data.push({ 'Keterangan': ' Pengeluaran Kas:' });
        operatingPayments.forEach(p => data.push({ 'Keterangan': `  ${p.label}`, 'Nilai': -p.value }));
        data.push({ 'Keterangan': 'Arus Kas Bersih Operasional', 'Nilai': netOperatingCash });
        data.push({});

        data.push({ 'Keterangan': 'ARUS KAS DARI AKTIVITAS INVESTASI' });
        investingActivities.forEach(i => data.push({ 'Keterangan': `  ${i.label}`, 'Nilai': i.value }));
        data.push({ 'Keterangan': 'Arus Kas Bersih Investasi', 'Nilai': netInvestingCash });
        data.push({});

        data.push({ 'Keterangan': 'ARUS KAS DARI AKTIVITAS PENDANAAN' });
        financingActivities.forEach(f => data.push({ 'Keterangan': `  ${f.label}`, 'Nilai': f.value }));
        data.push({ 'Keterangan': 'Arus Kas Bersih Pendanaan', 'Nilai': netFinancingCash });
        data.push({});

        data.push({ 'Keterangan': 'Kenaikan (Penurunan) Kas Bersih', 'Nilai': cashIncrease });
        data.push({ 'Keterangan': 'Kas Awal Periode', 'Nilai': cashStart });
        data.push({ 'Keterangan': 'KAS AKHIR PERIODE', 'Nilai': cashEnd });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'CashFlow');
        XLSX.writeFile(wb, `SIKAD-Dareliman-ArusKas-${selectedYear}.xlsx`);
    };

    const cashAccounts = accounts.filter(a => a.category === 'detail' && a.code.startsWith('1-11'));
    
    const getTotalCashBalance = (year) => {
        return cashAccounts.reduce((sum, acc) => {
            return sum + hitungSaldoAkun(journals, acc.id, accounts, year, assets, false);
        }, 0);
    };

    const operatingReceipts = accounts
        .filter(a => a.type === 'Pendapatan' && a.category === 'detail')
        .map(acc => ({
            label: acc.name,
            value: Math.abs(hitungSaldoAkun(journals, acc.id, accounts, currentYearStr, assets, true))
        }))
        .filter(item => item.value > 0);

    const totalReceipts = operatingReceipts.reduce((sum, item) => sum + item.value, 0);

    const isNonCashAccount = (acc) => {
        const name = acc.name.toLowerCase();
        return name.includes('penyusutan') || name.includes('amortisasi');
    };

    const operatingPayments = accounts
        .filter(a => a.type === 'Beban' && a.category === 'detail' && !isNonCashAccount(a))
        .map(acc => ({
            label: acc.name,
            value: hitungSaldoAkun(journals, acc.id, accounts, currentYearStr, assets, true)
        }))
        .filter(item => item.value > 0);

    const totalPayments = operatingPayments.reduce((sum, item) => sum + item.value, 0);
    const netOperatingCash = totalReceipts - totalPayments;

    const investingActivities = accounts
        .filter(a => a.type === 'Aset' && a.category === 'detail' && !a.code.startsWith('1-1'))
        .map(acc => {
            const delta = hitungSaldoAkun(journals, acc.id, accounts, currentYearStr, assets, true);
            return { label: acc.name, value: -delta };
        })
        .filter(item => item.value !== 0);

    const netInvestingCash = investingActivities.reduce((sum, item) => sum + item.value, 0);

    const financingActivities = accounts
        .filter(a => (a.type === 'Kewajiban' || a.type === 'Aset Neto') && a.category === 'detail')
        .map(acc => {
            const delta = hitungSaldoAkun(journals, acc.id, accounts, currentYearStr, assets, true);
            return { label: acc.name, value: delta }; 
        })
        .filter(item => item.value !== 0);

    const netFinancingCash = financingActivities.reduce((sum, item) => sum + item.value, 0);

    const cashStart = getTotalCashBalance(prevYearStr);
    const cashEnd = getTotalCashBalance(currentYearStr);
    const cashIncrease = cashEnd - cashStart;

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-8 print:hidden">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Laporan Arus Kas</h2>
                    <p className="text-slate-500 font-medium tracking-tight">Metode Langsung — Aktivitas Operasi, Investasi, & Pendanaan</p>
                </div>
                <div className="flex gap-4 items-center">
                    <select className="form-select rounded-2xl border-slate-200 text-xs font-bold" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
                        <option value="2026">2026</option>
                        <option value="2025">2025</option>
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
                    <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">SIKAD DARELIMAN</h1>
                    <h2 className="text-xl font-bold text-slate-600 uppercase tracking-widest">LAPORAN ARUS KAS (METODE LANGSUNG)</h2>
                    <p className="text-sm font-medium text-slate-400 mt-2 lowercase tracking-widest">Untuk Periode yang Berakhir pada 31 Desember {currentYearStr}</p>
                </div>

                <div className="space-y-12">
                    {/* OPERATING */}
                    <div className="overflow-hidden bg-white rounded-[32px] border border-slate-100 p-2">
                        <table className="w-full text-left border-separate border-spacing-y-1">
                            <tbody>
                                {/* OPERATING */}
                                <ReportRow 
                                    id="OPERATING"
                                    name="ARUS KAS DARI AKTIVITAS OPERASI"
                                    valCurr={netOperatingCash}
                                    valPrev={0}
                                    type="category"
                                    isParent={true}
                                    isExpanded={!!expandedRows['OPERATING']}
                                    onToggle={toggleRow}
                                />
                                {expandedRows['OPERATING'] && (
                                    <Fragment>
                                        <ReportRow name="Penerimaan Kas" valCurr={totalReceipts} type="header" level={1} />
                                        {operatingReceipts.map((item, idx) => (
                                            <ReportRow key={`rec-${idx}`} name={item.label} valCurr={item.value} level={2} />
                                        ))}
                                        <ReportRow name="Pengeluaran Kas" valCurr={-totalPayments} type="header" level={1} />
                                        {operatingPayments.map((item, idx) => (
                                            <ReportRow key={`pay-${idx}`} name={item.label} valCurr={-item.value} level={2} />
                                        ))}
                                    </Fragment>
                                )}

                                {/* INVESTING */}
                                <ReportRow 
                                    id="INVESTING"
                                    name="ARUS KAS DARI AKTIVITAS INVESTASI"
                                    valCurr={netInvestingCash}
                                    valPrev={0}
                                    type="category"
                                    isParent={true}
                                    isExpanded={!!expandedRows['INVESTING']}
                                    onToggle={toggleRow}
                                />
                                {expandedRows['INVESTING'] && investingActivities.map((item, idx) => (
                                    <ReportRow key={`inv-${idx}`} name={item.label} valCurr={item.value} level={1} />
                                ))}

                                {/* FINANCING */}
                                <ReportRow 
                                    id="FINANCING"
                                    name="ARUS KAS DARI AKTIVITAS PENDANAAN"
                                    valCurr={netFinancingCash}
                                    valPrev={0}
                                    type="category"
                                    isParent={true}
                                    isExpanded={!!expandedRows['FINANCING']}
                                    onToggle={toggleRow}
                                />
                                {expandedRows['FINANCING'] && financingActivities.map((item, idx) => (
                                    <ReportRow key={`fin-${idx}`} name={item.label} valCurr={item.value} level={1} />
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="space-y-0"></div>

                    {/* SUMMARY */}
                    <div className="pt-12 border-t-2 border-slate-900">
                        <div className="flex justify-between mb-4 px-4 text-slate-600 font-bold uppercase tracking-widest text-xs">
                            <span>Kenaikan (Penurunan) Kas Bersih</span>
                            <span className="text-slate-900"><CurrencyDisplay value={cashIncrease} /></span>
                        </div>
                        <div className="flex justify-between mb-8 px-4 text-slate-400 font-medium uppercase tracking-widest text-[10px]">
                            <span>Kas & Setara Kas pada Awal Periode</span>
                            <span><CurrencyDisplay value={cashStart} useColor={false} /></span>
                        </div>
                        <div className="p-8 bg-slate-900 text-white rounded-[32px] flex justify-between items-center shadow-2xl">
                             <div className="flex items-center gap-4">
                                 <Banknote size={32} className="opacity-40" />
                                 <span className="font-black text-sm uppercase tracking-[0.3em]">KAS AKHIR PERIODE</span>
                             </div>
                             <span className="text-3xl font-black"><CurrencyDisplay value={cashEnd} useColor={false} /></span>
                        </div>
                    </div>
                </div>

                <div className="mt-20 pt-8 border-t border-slate-100 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">
                    Laporan ini disusun secara otomatis oleh SIKAD (Sistem Keuangan Dareliman) pada {formatTanggal(new Date().toISOString())}
                </div>
            </div>
        </div>
    );
}
