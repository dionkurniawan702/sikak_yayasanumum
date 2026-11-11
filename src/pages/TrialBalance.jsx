import { useState, Fragment, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { bangunNeracaSaldo, buildHierarchyAccounts, getAvailableTransactionYears } from '../utils/accounting';
import { formatTanggal } from '../utils/format';
import { CheckCircle, AlertTriangle, Printer, FileSpreadsheet, Scale, Coins, Check, ArrowRightLeft } from 'lucide-react';
import CurrencyDisplay from '../components/CurrencyDisplay';
import * as XLSX from 'xlsx';

export default function TrialBalance() {
    const { state } = useApp();
    const accounts = useMemo(() => state.accounts.filter(a => !a.isDeleted), [state.accounts]);
    const journals = useMemo(() => state.journals.filter(j => !j.isDeleted), [state.journals]);
    const reportRef = useRef(null);

    // Filter Tahun Dinamis (Hanya tahun dengan transaksi)
    const availableYears = useMemo(() => getAvailableTransactionYears(journals), [journals]);
    const [selectedYear, setSelectedYear] = useState(() => availableYears[0] || new Date().getFullYear().toString());

    // Update selectedYear if availableYears changed and current selection isn't included
    const activeYear = availableYears.includes(selectedYear) ? selectedYear : (availableYears[0] || new Date().getFullYear().toString());

    const trialBalance = useMemo(() => {
        return bangunNeracaSaldo(journals, accounts, activeYear);
    }, [journals, accounts, activeYear]);

    const totalDebit = useMemo(() => trialBalance.reduce((s, r) => s + (r.debit || 0), 0), [trialBalance]);
    const totalCredit = useMemo(() => trialBalance.reduce((s, r) => s + (r.credit || 0), 0), [trialBalance]);
    const diff = Math.abs(totalDebit - totalCredit);
    const isBalanced = diff < 1;

    const exportToExcel = () => {
        const data = [
            { 'Kode Akun': 'YAYASAN DARELIMAN', 'Nama Akun': '', 'Tipe': '', 'Dana': '', 'Debit': '', 'Kredit': '' },
            { 'Kode Akun': `NERACA SALDO (TRIAL BALANCE) - TAHUN ${activeYear}`, 'Nama Akun': '', 'Tipe': '', 'Dana': '', 'Debit': '', 'Kredit': '' },
            { 'Kode Akun': `Per Tanggal 31 Desember ${activeYear}`, 'Nama Akun': '', 'Tipe': '', 'Dana': '', 'Debit': '', 'Kredit': '' },
            {}
        ];

        trialBalance.forEach(r => {
            data.push({
                'Kode Akun': r.code,
                'Nama Akun': r.name,
                'Tipe': r.type,
                'Dana': r.fund,
                'Debit': r.debit || 0,
                'Kredit': r.credit || 0
            });
        });

        data.push({});
        data.push({
            'Kode Akun': 'TOTAL SALDO',
            'Nama Akun': isBalanced ? 'SEIMBANG (BALANCED)' : 'SELISIH',
            'Tipe': '',
            'Dana': '',
            'Debit': totalDebit,
            'Kredit': totalCredit
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `NeracaSaldo_${activeYear}`);
        XLSX.writeFile(wb, `SIKAD-Dareliman-NeracaSaldo-${activeYear}.xlsx`);
    };

    const types = ['Aset', 'Kewajiban', 'Aset Neto', 'Pendapatan', 'Beban'];

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header Kontrol & Navigasi */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 print:hidden">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                            <Scale size={22} />
                        </div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Neraca Saldo</h2>
                    </div>
                    <p className="text-slate-500 font-medium text-sm">Validasi keseimbangan mutasi debit & kredit (Trial Balance PSAK 35)</p>
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
                        <Coins size={22} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Debit</p>
                        <h4 className="text-lg font-black text-slate-900"><CurrencyDisplay value={totalDebit} useColor={false} /></h4>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        <Coins size={22} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Kredit</p>
                        <h4 className="text-lg font-black text-slate-900"><CurrencyDisplay value={totalCredit} useColor={false} /></h4>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-600 flex items-center justify-center shrink-0">
                        <ArrowRightLeft size={22} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Selisih Debit-Kredit</p>
                        <h4 className={`text-lg font-black ${isBalanced ? 'text-emerald-600' : 'text-rose-600'}`}>
                            <CurrencyDisplay value={diff} useColor={false} />
                        </h4>
                    </div>
                </div>

                <div className={`p-5 rounded-3xl border flex items-center gap-4 ${isBalanced ? 'bg-emerald-50/80 border-emerald-100 text-emerald-800' : 'bg-rose-50/80 border-rose-100 text-rose-800'}`}>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isBalanced ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                        {isBalanced ? <CheckCircle size={24} /> : <AlertTriangle size={24} />}
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider opacity-70">Status Keseimbangan</p>
                        <h4 className="text-sm font-black">{isBalanced ? 'Jurnal Seimbang' : 'Terdapat Selisih!'}</h4>
                        <p className="text-[11px] opacity-80">{trialBalance.length} akun aktif</p>
                    </div>
                </div>
            </div>

            {/* Kontainer Lembar Laporan Formal */}
            <div className="bg-white p-8 md:p-12 rounded-[32px] border border-slate-100 shadow-xl overflow-hidden" ref={reportRef}>
                {/* Header Formal Instansi */}
                <div className="text-center mb-10 pb-8 border-b-2 border-slate-200">
                    <p className="text-xs font-black tracking-[0.25em] text-slate-400 uppercase mb-1">LAPORAN KEUANGAN YAYASAN</p>
                    <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">YAYASAN DARELIMAN</h1>
                    <h2 className="text-lg font-bold text-blue-600 mt-1 uppercase tracking-wide">NERACA SALDO (TRIAL BALANCE)</h2>
                    <div className="inline-block mt-3 px-4 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                        Posisi Per 31 Desember {activeYear}
                    </div>
                </div>

                {/* Tabel Neraca Saldo */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-[11px] font-black text-slate-500 uppercase tracking-wider border-y border-slate-200">
                                <th className="px-6 py-4 w-36">Kode Akun</th>
                                <th className="px-6 py-4">Nama Akun Rekening</th>
                                <th className="px-6 py-4 text-right w-48">Debit (Rp)</th>
                                <th className="px-6 py-4 text-right w-48">Kredit (Rp)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {types.map(type => {
                                const typeHierarchy = buildHierarchyAccounts(journals, accounts, type, null, activeYear);
                                if (typeHierarchy.length === 0) return null;

                                return (
                                    <Fragment key={type}>
                                        {/* Kategori Utama Banner */}
                                        <tr className="bg-slate-100/70">
                                            <td colSpan={4} className="px-6 py-2.5 font-black text-xs text-slate-800 uppercase tracking-wider">
                                                {type}
                                            </td>
                                        </tr>

                                        {typeHierarchy.map(st => (
                                            <Fragment key={st.name}>
                                                {/* Sub-Kategori / Golongan */}
                                                <tr className="bg-slate-50/50">
                                                    <td colSpan={4} className="px-8 py-2 font-bold text-xs text-slate-600">
                                                        {st.name}
                                                    </td>
                                                </tr>

                                                {st.headers.map(header => {
                                                    const childrenWithData = header.children.map(c => {
                                                        const bal = trialBalance.find(tb => tb.accountId === c.id);
                                                        return { ...c, debit: bal?.debit || 0, credit: bal?.credit || 0 };
                                                    }).filter(c => c.debit !== 0 || c.credit !== 0);

                                                    if (childrenWithData.length === 0) return null;

                                                    return (
                                                        <Fragment key={header.id}>
                                                            {childrenWithData.map(child => (
                                                                <tr key={child.id} className="hover:bg-blue-50/20 transition-colors">
                                                                    <td className="px-10 py-3 font-mono font-bold text-slate-500 text-xs">
                                                                        {child.code}
                                                                    </td>
                                                                    <td className="px-6 py-3 font-medium text-slate-700">
                                                                        {child.name}
                                                                    </td>
                                                                    <td className="px-6 py-3 text-right font-bold text-slate-800 tabular-nums">
                                                                        {child.debit > 0 ? <CurrencyDisplay value={child.debit} useColor={false} /> : '-'}
                                                                    </td>
                                                                    <td className="px-6 py-3 text-right font-bold text-slate-800 tabular-nums">
                                                                        {child.credit > 0 ? <CurrencyDisplay value={child.credit} useColor={false} /> : '-'}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </Fragment>
                                                    );
                                                })}
                                            </Fragment>
                                        ))}
                                    </Fragment>
                                );
                            })}

                            {/* Baris Total Akumulasi */}
                            <tr className="bg-gradient-to-r from-[#1C375B] via-[#265187] to-[#1B7678] text-white font-bold">
                                <td colSpan={2} className="px-8 py-5 text-right text-xs uppercase tracking-wider text-sky-100">
                                    Total Mutasi Terakumulasi
                                </td>
                                <td className="px-6 py-5 text-right text-base tabular-nums">
                                    <CurrencyDisplay value={totalDebit} useColor={false} />
                                </td>
                                <td className="px-6 py-5 text-right text-base tabular-nums">
                                    <CurrencyDisplay value={totalCredit} useColor={false} />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Footer Informasi Cetak */}
                <div className="mt-10 pt-6 border-t border-slate-100 flex justify-between items-center text-xs text-slate-400">
                    <p>Dicetak melalui SIKAD Yayasan Dareliman pada {formatTanggal(new Date().toISOString())}</p>
                    <p className="font-mono">Status: {isBalanced ? 'SEIMBANG (BALANCED)' : 'SELISIH'}</p>
                </div>
            </div>
        </div>
    );
}
