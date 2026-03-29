import { Fragment, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { bangunNeracaSaldo, buildHierarchyAccounts } from '../utils/accounting';
import { formatRupiah } from '../utils/format';
import { CheckCircle, AlertTriangle, Download, Printer, FileText } from 'lucide-react';
import CurrencyDisplay from '../components/CurrencyDisplay';

export default function TrialBalance() {
    const { state } = useApp();
    const accounts = state.accounts.filter(a => !a.isDeleted);
    const journals = state.journals.filter(j => !j.isDeleted);
    const reportRef = useRef(null);

    const trialBalance = bangunNeracaSaldo(journals, accounts);
    const totalDebit = trialBalance.reduce((s, r) => s + r.debit, 0);
    const totalCredit = trialBalance.reduce((s, r) => s + r.credit, 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 1;

    const types = ['Aset', 'Kewajiban', 'Aset Neto', 'Pendapatan', 'Beban'];

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-8 print:hidden">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Neraca Saldo</h2>
                    <p className="text-slate-500 font-medium tracking-tight">Validasi keseimbangan mutasi debit & kredit (Trial Balance)</p>
                </div>
                <div className="flex gap-4">
                    <button onClick={() => window.print()} className="btn btn-primary px-8 py-3 rounded-2xl shadow-xl shadow-blue-500/20 font-black">
                        <Printer size={18} /> Cetak Laporan
                    </button>
                </div>
            </div>

            <div className="animate-in">
                {/* Balance Indicator */}
                <div className={`p-6 rounded-3xl border flex items-center justify-between mb-8 print:hidden ${isBalanced ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                    <div className="flex items-center gap-4">
                        <div className={`p-4 rounded-2xl ${isBalanced ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                            {isBalanced ? <CheckCircle size={28} /> : <AlertTriangle size={28} />}
                        </div>
                        <div>
                            <h4 className={`text-lg font-black ${isBalanced ? 'text-emerald-800' : 'text-rose-800'}`}>
                                {isBalanced ? 'Status: Jurnal Seimbang' : 'Status: Terdapat Selisih!'}
                            </h4>
                            <p className="text-sm opacity-60">Total Debit-Kredit: <CurrencyDisplay value={totalDebit} /></p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-12 rounded-3xl border border-slate-100 shadow-xl overflow-hidden" ref={reportRef}>
                    {/* Header Formal */}
                    <div className="text-center mb-10 pb-8 border-b-4 border-double border-slate-200">
                        <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">SIKAK YAYASAN UMUM</h1>
                        <h2 className="text-xl font-bold text-slate-600">NERACA SALDO (TRIAL BALANCE)</h2>
                        <p className="text-sm font-medium text-slate-400 mt-2 lowercase tracking-widest">Per Tanggal {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>

                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4">Kode Akun</th>
                                <th className="px-6 py-4">Nama Akun Rekening</th>
                                <th className="px-6 py-4 text-right">Debit</th>
                                <th className="px-6 py-4 text-right">Kredit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {types.map(type => {
                                const typeHierarchy = buildHierarchyAccounts(journals, accounts, type);
                                if (typeHierarchy.length === 0) return null;

                                return (
                                    <Fragment key={type}>
                                        <tr className="bg-blue-50/30">
                                            <td colSpan={4} className="px-6 py-3 font-black text-[10px] text-blue-600 uppercase tracking-widest">{type}</td>
                                        </tr>
                                        {typeHierarchy.map(st => (
                                            <Fragment key={st.name}>
                                                <tr className="bg-slate-50/50">
                                                    <td colSpan={4} className="px-8 py-2 font-bold text-xs text-slate-700">{st.name}</td>
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
                                                                <tr key={child.id} className="hover:bg-slate-50/30 transition-colors">
                                                                    <td className="px-10 py-3 font-mono font-bold text-slate-400 text-xs italic">{child.code}</td>
                                                                    <td className="px-6 py-3 text-sm font-medium text-slate-600">{child.name}</td>
                                                                    <td className="px-6 py-3 text-right font-bold text-slate-800">
                                                                        {child.debit ? <CurrencyDisplay value={child.debit} /> : '-'}
                                                                    </td>
                                                                    <td className="px-6 py-3 text-right font-bold text-slate-800">
                                                                        {child.credit ? <CurrencyDisplay value={child.credit} /> : '-'}
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
                            <tr className="bg-blue-600 text-white font-black text-sm">
                                <td colSpan={2} className="px-6 py-5 text-right uppercase tracking-widest">Total Saldo Terakumulasi</td>
                                <td className="px-6 py-5 text-right"><CurrencyDisplay value={totalDebit} useColor={false} /></td>
                                <td className="px-6 py-5 text-right"><CurrencyDisplay value={totalCredit} useColor={false} /></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
