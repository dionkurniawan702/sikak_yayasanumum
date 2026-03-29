import { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { hitungSaldoAkun } from '../utils/accounting';
import { formatRupiah, formatTanggal } from '../utils/format';
import { Download, Printer, Activity, TrendingUp, TrendingDown, Landmark, Banknote } from 'lucide-react';
import CurrencyDisplay from '../components/CurrencyDisplay';

export default function CashFlowStatement() {
    const { state } = useApp();
    const accounts = state.accounts.filter(a => !a.isDeleted);
    const journals = state.journals.filter(j => !j.isDeleted);
    const assets = state.assets.filter(a => !a.isDeleted);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
    const reportRef = useRef(null);
    const currentYearStr = selectedYear;
    const prevYearStr = (parseInt(selectedYear) - 1).toString();

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
                    <button onClick={() => window.print()} className="btn btn-primary px-8 py-3 rounded-2xl shadow-xl shadow-blue-500/20 font-black">
                        <Printer size={18} /> Cetak Laporan
                    </button>
                </div>
            </div>

            <div className="bg-white p-12 rounded-[40px] border border-slate-100 shadow-2xl animate-in" ref={reportRef}>
                {/* Header Formal */}
                <div className="text-center mb-16 pb-8 border-b-4 border-double border-slate-200">
                    <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">SIKAK YAYASAN UMUM</h1>
                    <h2 className="text-xl font-bold text-slate-600 uppercase tracking-widest">LAPORAN ARUS KAS (METODE LANGSUNG)</h2>
                    <p className="text-sm font-medium text-slate-400 mt-2 lowercase tracking-widest">Untuk Periode yang Berakhir pada 31 Desember {currentYearStr}</p>
                </div>

                <div className="space-y-12">
                    {/* OPERATING */}
                    <div>
                        <div className="flex items-center gap-3 mb-6 pb-2 border-b-2 border-emerald-500 w-fit">
                            <Activity size={20} className="text-emerald-600" />
                            <h3 className="text-sm font-black text-emerald-800 uppercase tracking-widest">ARUS KAS DARI AKTIVITAS OPERASI</h3>
                        </div>
                        <div className="space-y-2">
                             <p className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Penerimaan Kas:</p>
                             {operatingReceipts.map((item, idx) => (
                                 <div key={idx} className="flex justify-between px-8 py-1 text-sm font-medium text-slate-600">
                                     <span>{item.label}</span>
                                     <span className="font-bold text-slate-900"><CurrencyDisplay value={item.value} /></span>
                                 </div>
                             ))}
                             <p className="px-4 mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pengeluaran Kas:</p>
                             {operatingPayments.map((item, idx) => (
                                 <div key={idx} className="flex justify-between px-8 py-1 text-sm font-medium text-slate-600">
                                     <span>{item.label}</span>
                                     <span className="font-bold text-rose-600"><CurrencyDisplay value={-item.value} /></span>
                                 </div>
                             ))}
                             <div className="mt-4 p-4 bg-emerald-50 rounded-2xl flex justify-between items-center">
                                 <span className="text-xs font-black text-emerald-800 uppercase tracking-widest">Arus Kas Bersih Operasional</span>
                                 <span className="text-lg font-black text-emerald-900"><CurrencyDisplay value={netOperatingCash} /></span>
                             </div>
                        </div>
                    </div>

                    {/* INVESTING */}
                    <div>
                        <div className="flex items-center gap-3 mb-6 pb-2 border-b-2 border-blue-500 w-fit">
                            <TrendingUp size={20} className="text-blue-600" />
                            <h3 className="text-sm font-black text-blue-800 uppercase tracking-widest">ARUS KAS DARI AKTIVITAS INVESTASI</h3>
                        </div>
                        {investingActivities.length > 0 ? (
                            <div className="space-y-2">
                                {investingActivities.map((item, idx) => (
                                    <div key={idx} className="flex justify-between px-8 py-1 text-sm font-medium text-slate-600">
                                        <span>{item.label}</span>
                                        <span className="font-bold text-slate-900"><CurrencyDisplay value={item.value} /></span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="px-8 text-xs text-slate-400 italic font-medium">Tidak ada aktivitas investasi periode ini</p>
                        )}
                        <div className="mt-4 p-4 bg-blue-50 rounded-2xl flex justify-between items-center">
                            <span className="text-xs font-black text-blue-800 uppercase tracking-widest">Arus Kas Bersih Investasi</span>
                            <span className="text-lg font-black text-blue-900"><CurrencyDisplay value={netInvestingCash} /></span>
                        </div>
                    </div>

                    {/* FINANCING */}
                    <div>
                        <div className="flex items-center gap-3 mb-6 pb-2 border-b-2 border-slate-800 w-fit">
                            <Landmark size={20} className="text-slate-800" />
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">ARUS KAS DARI AKTIVITAS PENDANAAN</h3>
                        </div>
                        {financingActivities.length > 0 ? (
                            <div className="space-y-2">
                                {financingActivities.map((item, idx) => (
                                    <div key={idx} className="flex justify-between px-8 py-1 text-sm font-medium text-slate-600">
                                        <span>{item.label}</span>
                                        <span className="font-bold text-slate-900"><CurrencyDisplay value={item.value} /></span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="px-8 text-xs text-slate-400 italic font-medium">Tidak ada aktivitas pendanaan periode ini</p>
                        )}
                        <div className="mt-4 p-4 bg-slate-50 rounded-2xl flex justify-between items-center">
                            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Arus Kas Bersih Pendanaan</span>
                            <span className="text-lg font-black text-slate-900"><CurrencyDisplay value={netFinancingCash} /></span>
                        </div>
                    </div>

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
                    Laporan ini disusun secara otomatis oleh SIKAK YAYASAN UMUM pada {formatTanggal(new Date().toISOString())}
                </div>
            </div>
        </div>
    );
}
