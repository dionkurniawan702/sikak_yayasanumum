import { useState, Fragment } from 'react';
import { useApp } from '../context/AppContext';
import { hitungSaldoAkun } from '../utils/accounting';
import { formatRupiah, formatTanggal } from '../utils/format';
import { Download, Printer, TrendingUp, Landmark, RefreshCw } from 'lucide-react';
import CurrencyDisplay from '../components/CurrencyDisplay';

export default function StatementOfChangesInNetAssets() {
    const { state } = useApp();
    const accounts = state.accounts.filter(a => !a.isDeleted);
    const journals = state.journals.filter(j => !j.isDeleted);
    const assets = state.assets.filter(a => !a.isDeleted);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
    const currentYearStr = selectedYear;
    const prevYearStr = (parseInt(selectedYear) - 1).toString();

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

    // Categories (Foundation net assets classification)
    const categories = [
        { id: 'unrestricted', name: 'Tanpa Pembatasan', fund: 'Dana Umum' },
        { id: 'restricted', name: 'Dengan Pembatasan', fund: 'Dana Terikat' }
    ];

    const reportData = categories.map(cat => {
        const awal = getNetAssetBalance(cat.fund, prevYearStr);
        const surplus = getCategorySurplus(cat.fund, currentYearStr);
        const akhir = awal + surplus;
        return { ...cat, awal, surplus, akhir };
    });

    const totalAwal = reportData.reduce((s, d) => s + d.awal, 0);
    const totalSurplus = reportData.reduce((s, d) => s + d.surplus, 0);
    const totalAkhir = reportData.reduce((s, d) => s + d.akhir, 0);

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-8 print:hidden">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Laporan Perubahan Aset Neto</h2>
                    <p className="text-slate-500 font-medium tracking-tight">Rekonsiliasi Saldo Awal, Surplus/Defisit, dan Saldo Akhir (PSAK 35)</p>
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

            <div className="bg-white p-12 rounded-[40px] border border-slate-100 shadow-2xl animate-in">
                {/* Header Formal */}
                <div className="text-center mb-16 pb-8 border-b-4 border-double border-slate-200">
                    <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">SIKAK YAYASAN UMUM</h1>
                    <h2 className="text-xl font-bold text-slate-600 uppercase tracking-widest leading-none mt-2">LAPORAN PERUBAHAN ASET NETO</h2>
                    <p className="text-sm font-medium text-slate-400 mt-2 lowercase tracking-widest">Untuk Tahun yang Berakhir pada 31 Desember {currentYearStr}</p>
                </div>

                <div className="overflow-hidden bg-slate-50 rounded-[32px] border border-slate-100 mb-12">
                    <table className="w-full text-left">
                        <thead className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                            <tr>
                                <th className="px-8 py-6">Klasifikasi Aset Neto</th>
                                <th className="px-8 py-6 text-right">Saldo Awal (1 Jan)</th>
                                <th className="px-8 py-6 text-right">Surplus / (Defisit)</th>
                                <th className="px-8 py-6 text-right bg-white">Saldo Akhir (31 Des)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {reportData.map(data => (
                                <tr key={data.id} className="hover:bg-blue-50/50 transition-colors">
                                    <td className="px-8 py-5">
                                        <p className="font-black text-slate-900 tracking-tight uppercase">{data.name}</p>
                                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Sesuai Klasifikasi PSAK 35</p>
                                    </td>
                                    <td className="px-8 py-5 text-right font-bold text-slate-600">
                                        <CurrencyDisplay value={data.awal} useColor={false} />
                                    </td>
                                    <td className="px-8 py-5 text-right font-black text-emerald-600">
                                        <CurrencyDisplay value={data.surplus} />
                                    </td>
                                    <td className="px-8 py-5 text-right font-black text-slate-900 bg-white/50">
                                        <CurrencyDisplay value={data.akhir} useColor={false} />
                                    </td>
                                </tr>
                            ))}
                            <tr className="bg-slate-900 text-white font-black">
                                <td className="px-8 py-8 text-xs uppercase tracking-[0.3em] opacity-60">Total Seluruh Aset Neto</td>
                                <td className="px-8 py-8 text-right"><CurrencyDisplay value={totalAwal} useColor={false} /></td>
                                <td className="px-8 py-8 text-right"><CurrencyDisplay value={totalSurplus} useColor={false} /></td>
                                <td className="px-8 py-8 text-right text-xl"><CurrencyDisplay value={totalAkhir} useColor={false} /></td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="p-8 bg-blue-50 rounded-[32px] border border-blue-100 space-y-4">
                        <div className="flex items-center gap-3">
                            <TrendingUp size={24} className="text-blue-600" />
                            <h4 className="font-black text-blue-900 uppercase text-xs tracking-widest">Analisis Pertumbuhan</h4>
                        </div>
                        <p className="text-xs text-blue-700 font-medium leading-relaxed">
                            Aset neto mencerminkan kekayaan bersih yayasan yang tidak terdistribusi ke pemilik. 
                            Kenaikan per periode sebesar <strong><CurrencyDisplay value={totalSurplus} useColor={false} /></strong> menunjukkan performa aktivitas yang positif.
                        </p>
                    </div>
                    <div className="p-8 bg-slate-50 rounded-[32px] border border-slate-100 space-y-4">
                        <div className="flex items-center gap-3">
                            <RefreshCw size={24} className="text-slate-400" />
                            <h4 className="font-black text-slate-500 uppercase text-xs tracking-widest">Kebijakan Klasifikasi</h4>
                        </div>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed italic">
                            Klasifikasi <strong>Dengan Pembatasan</strong> digunakan untuk dana yang memiliki restriksi dari pemberi sumber daya atau tujuan tertentu yang ditetapkan yayasan.
                        </p>
                    </div>
                </div>

                <div className="mt-20 pt-8 border-t border-slate-100 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">
                    Laporan ini disusun secara otomatis oleh SIKAK YAYASAN UMUM pada {formatTanggal(new Date().toISOString())}
                </div>
            </div>
        </div>
    );
}
