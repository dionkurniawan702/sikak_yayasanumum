import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { bangunBukuBesar } from '../utils/accounting';
import { formatRupiah, formatTanggal } from '../utils/format';
import { BookMarked, Calendar, Search, Filter } from 'lucide-react';
import CurrencyDisplay from '../components/CurrencyDisplay';

export default function GeneralLedger() {
    const { state } = useApp();
    const accounts = state.accounts.filter(a => !a.isDeleted);
    const journals = state.journals.filter(j => !j.isDeleted);
    const detailAccounts = accounts
        .filter(a => a.category === 'detail')
        .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

    const TIPE_URUTAN = ['Aset', 'Kewajiban', 'Aset Neto', 'Pendapatan', 'Beban'];
    const groupedAccounts = TIPE_URUTAN.map(tipe => ({
        tipe,
        accounts: detailAccounts.filter(a => a.type === tipe)
    })).filter(g => g.accounts.length > 0);

    const [selectedAccount, setSelectedAccount] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const ledgerEntries = selectedAccount
        ? bangunBukuBesar(journals, selectedAccount, startDate || null, endDate || null, accounts)
        : [];

    const selectedAcc = accounts.find(a => a.id === selectedAccount);

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Buku Besar</h2>
                    <p className="text-slate-500 font-medium">Laporan rincian mutasi akun secara periodik</p>
                </div>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm mb-8 animate-in">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                    <div className="md:col-span-2">
                        <label className="form-label">Pilih Akun Rekening</label>
                        <select className="form-select rounded-2xl border-slate-200" value={selectedAccount} onChange={e => setSelectedAccount(e.target.value)}>
                            <option value="">-- Pilih Akun Detail --</option>
                            {groupedAccounts.map(g => (
                                <optgroup key={g.tipe} label={g.tipe.toUpperCase()}>
                                    {g.accounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                                </optgroup>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Tanggal Mulai</label>
                        <input type="date" className="form-input rounded-2xl border-slate-200" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                    <div>
                        <label className="form-label">Tanggal Selesai</label>
                        <input type="date" className="form-input rounded-2xl border-slate-200" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                </div>
            </div>

            {!selectedAccount ? (
                <div className="bg-white p-20 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center animate-in">
                    <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mb-6">
                        <BookMarked size={40} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 mb-2">Buku Besar Siap</h3>
                    <p className="text-slate-500 max-w-sm">Silakan pilih akun di atas untuk menampilkan rincian riwayat transaksi dan saldo berjalan.</p>
                </div>
            ) : (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden animate-in">
                    <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div>
                            <h3 className="text-2xl font-black text-slate-900 leading-tight">
                                <span className="text-blue-600 mr-2">{selectedAcc?.code}</span>
                                {selectedAcc?.name}
                            </h3>
                            <div className="flex gap-2 mt-2">
                                <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-[9px] font-black uppercase tracking-widest">{selectedAcc?.type}</span>
                                <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-[9px] font-black uppercase tracking-widest">{selectedAcc?.fund}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Saldo Akhir Periode</p>
                            <h4 className="text-3xl font-black text-slate-900">
                                <CurrencyDisplay value={ledgerEntries.length > 0 ? ledgerEntries[ledgerEntries.length - 1].saldo : 0} />
                            </h4>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                <tr>
                                    <th className="px-8 py-6">Tanggal</th>
                                    <th className="px-8 py-6">Journal ID</th>
                                    <th className="px-8 py-6">Keterangan Transaksi</th>
                                    <th className="px-8 py-6 text-right">Debit</th>
                                    <th className="px-8 py-6 text-right">Kredit</th>
                                    <th className="px-8 py-6 text-right">Saldo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {ledgerEntries.map((entry, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-8 py-4 text-slate-500 text-xs font-medium">{formatTanggal(entry.date)}</td>
                                        <td className="px-8 py-4 font-bold text-blue-600 text-xs">{entry.journalId}</td>
                                        <td className="px-8 py-4">
                                            <p className="font-bold text-slate-800 text-sm leading-tight">{entry.description}</p>
                                        </td>
                                        <td className="px-8 py-4 text-right">
                                            {entry.debit > 0 ? <CurrencyDisplay value={entry.debit} /> : '-'}
                                        </td>
                                        <td className="px-8 py-4 text-right">
                                            {entry.credit > 0 ? <CurrencyDisplay value={entry.credit} /> : '-'}
                                        </td>
                                        <td className="px-8 py-4 text-right font-black text-slate-900">
                                            <CurrencyDisplay value={entry.saldo} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
