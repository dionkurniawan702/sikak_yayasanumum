import { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { formatRupiah, formatTanggal } from '../utils/format';
import {
    Plus, Trash2, Save, AlertTriangle, CheckCircle, Calendar, FileText,
    Hash, Receipt, Phone, Hourglass, List, PenLine, Download, Upload, History, Info, Pencil, X, Users
} from 'lucide-react';
import * as XLSX from 'xlsx';
import CurrencyDisplay from '../components/CurrencyDisplay';

export default function JournalEntry() {
    const { state, dispatch } = useApp();
    const accounts = state.accounts.filter(a => !a.isDeleted);
    const journals = state.journals.filter(j => !j.isDeleted);
    const programs = state.programs.filter(p => !p.isDeleted);
    const detailAccounts = accounts
        .filter(a => a.category === 'detail')
        .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

    const TIPE_URUTAN = ['Aset', 'Kewajiban', 'Aset Neto', 'Pendapatan', 'Beban'];
    const groupedAccounts = TIPE_URUTAN.map(tipe => ({
        tipe,
        accounts: detailAccounts.filter(a => a.type === tipe)
    })).filter(g => g.accounts.length > 0);
    const fileInputRef = useRef(null);

    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [reference, setReference] = useState('');
    const [proof, setProof] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [economicLife, setEconomicLife] = useState('');
    const [assetPosition, setAssetPosition] = useState('');
    const [assetRoom, setAssetRoom] = useState('');
    const [assetCondition, setAssetCondition] = useState('');
    const [programId, setProgramId] = useState('PRG-GEN');
    const [rows, setRows] = useState([
        { accountId: '', debit: '', credit: '' },
        { accountId: '', debit: '', credit: '' },
    ]);
    const [viewMode, setViewMode] = useState('input');
    const [editingJournal, setEditingJournal] = useState(null);
    const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
    const [historySearch, setHistorySearch] = useState('');

    const exportHistoryToExcel = () => {
        const data = journals.map(j => ({
            'ID Jurnal': j.id,
            'Tanggal': j.date,
            'Deskripsi': j.description,
            'Pihak Terkait': j.name || '-',
            'Referesi': j.reference || '-',
            'Total': j.entries.reduce((s, e) => s + e.debit, 0)
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'History');
        XLSX.writeFile(wb, 'SIKAK-Yayasan-Journal-History.xlsx');
    };

    const TAX_GROUPS = [
        { label: 'Kelompok 1 (4 Tahun) - Peralatan/Laptop/Motor', value: '4' },
        { label: 'Kelompok 2 (8 Tahun) - Kendaraan/Mesin/AC', value: '8' },
        { label: 'Kelompok 3 (16 Tahun) - Alat Berat/Mesin Kimia', value: '16' },
        { label: 'Kelompok 4 (20 Tahun) - Bangunan Permanen', value: '20' },
        { label: 'Bangunan Tidak Permanen (10 Tahun)', value: '10' },
    ];

    const totalDebit = rows.reduce((s, r) => s + (parseFloat(r.debit) || 0), 0);
    const totalCredit = rows.reduce((s, r) => s + (parseFloat(r.credit) || 0), 0);
    const isBalanced = totalDebit > 0 && Math.abs(totalDebit - totalCredit) < 0.01;
    const difference = Math.abs(totalDebit - totalCredit);

    const filteredJournals = journals
        .filter(j => 
            j.description.toLowerCase().includes(historySearch.toLowerCase()) || 
            (j.name || '').toLowerCase().includes(historySearch.toLowerCase()) ||
            j.id.toLowerCase().includes(historySearch.toLowerCase())
        )
        .sort((a, b) => b.id.localeCompare(a.id))
        .slice(0, 50);

    function addRow() {
        setRows([...rows, { accountId: '', debit: '', credit: '' }]);
    }

    function removeRow(idx) {
        if (rows.length <= 2) return;
        setRows(rows.filter((_, i) => i !== idx));
    }

    function updateRow(idx, field, value) {
        setRows(rows.map((r, i) => i === idx ? { ...r, [field]: value, ...(field === 'debit' && value ? { credit: '' } : field === 'credit' && value ? { debit: '' } : {}) } : r));
    }

    function handleEdit(journal) {
        setEditingJournal(journal);
        setDate(journal.date);
        setName(journal.name || '');
        setDescription(journal.description);
        setReference(journal.reference || '');
        setProof(journal.proof || '');
        setPhoneNumber(journal.phoneNumber || '');
        setEconomicLife(journal.economicLife || '');
        setAssetPosition(journal.assetPosition || '');
        setAssetRoom(journal.assetRoom || '');
        setAssetCondition(journal.assetCondition || '');
        setProgramId(journal.programId || 'PRG-GEN');
        setRows(journal.entries.map(e => ({
            accountId: e.accountId,
            debit: e.debit > 0 ? String(e.debit) : '',
            credit: e.credit > 0 ? String(e.credit) : '',
        })));
        setViewMode('input');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function handleSave() {
        if (!date || !description || !isBalanced) return alert('Periksa kembali input jurnal!');
        const entries = rows
            .filter(r => r.accountId && (parseFloat(r.debit) || parseFloat(r.credit)))
            .map(r => ({
                accountId: r.accountId,
                accountName: detailAccounts.find(a => a.id === r.accountId)?.name || '',
                debit: parseFloat(r.debit) || 0,
                credit: parseFloat(r.credit) || 0,
            }));

        const payload = { 
            date, name, description, entries, reference, proof, 
            phoneNumber, economicLife, programId,
            assetPosition, assetRoom, assetCondition
        };

        if (editingJournal) {
            dispatch({ type: 'EDIT_JOURNAL', payload: { ...payload, id: editingJournal.id } });
            setEditingJournal(null);
        } else {
            dispatch({ type: 'ADD_JOURNAL', payload });
        }
        resetForm();
    }

    function resetForm() {
        setDate(new Date().toISOString().slice(0, 10));
        setName('');
        setDescription('');
        setReference('');
        setProof('');
        setRows([{ accountId: '', debit: '', credit: '' }, { accountId: '', debit: '', credit: '' }]);
    }

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Jurnal Umum</h2>
                    <p className="text-slate-500 font-medium tracking-tight">Pencatatan Transaksi Yayasan — Double Entry System</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setViewMode('input')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'input' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-400'}`}>Input</button>
                    <button onClick={() => setViewMode('list')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'list' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-400'}`}>Riwayat</button>
                </div>
            </div>

            {viewMode === 'input' && (
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl animate-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Tanggal Transaksi</label>
                            <input type="date" className="form-input rounded-2xl border-slate-200" value={date} onChange={e => setDate(e.target.value)} />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Pihak Terkait</label>
                            <input className="form-input rounded-2xl border-slate-200" value={name} onChange={e => setName(e.target.value)} placeholder="Nama Donatur / Vendor" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Keterangan Jurnal</label>
                            <input className="form-input rounded-2xl border-slate-200" value={description} onChange={e => setDescription(e.target.value)} placeholder="Deskripsi lengkap transaksi..." />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">No. Referensi / Bukti</label>
                            <input className="form-input rounded-2xl border-slate-200" value={reference} onChange={e => setReference(e.target.value)} placeholder="REF/001" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Program Sosial</label>
                            <select className="form-select rounded-2xl border-slate-200" value={programId} onChange={e => setProgramId(e.target.value)}>
                                {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="bg-slate-50/50 rounded-3xl p-6 mb-8 border border-slate-100">
                        <table className="w-full text-left">
                            <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                <tr>
                                    <th className="pb-4 px-4">Akun Rekening</th>
                                    <th className="pb-4 px-4 text-right">Debit</th>
                                    <th className="pb-4 px-4 text-right">Kredit</th>
                                    <th className="pb-4 px-4 w-12"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, idx) => (
                                    <tr key={idx}>
                                        <td className="py-2 px-2">
                                            <select className="form-select rounded-xl border-slate-100 bg-white" value={row.accountId} onChange={e => updateRow(idx, 'accountId', e.target.value)}>
                                                <option value="">Pilih Akun</option>
                                                {groupedAccounts.map(g => (
                                                    <optgroup key={g.tipe} label={g.tipe.toUpperCase()}>
                                                        {g.accounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                                                    </optgroup>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="py-2 px-2">
                                            <input type="number" className="form-input rounded-xl border-slate-100 bg-white text-right font-bold" value={row.debit} onChange={e => updateRow(idx, 'debit', e.target.value)} placeholder="0" />
                                        </td>
                                        <td className="py-2 px-2">
                                            <input type="number" className="form-input rounded-xl border-slate-100 bg-white text-right font-bold" value={row.credit} onChange={e => updateRow(idx, 'credit', e.target.value)} placeholder="0" />
                                        </td>
                                        <td className="py-2 px-2 text-center">
                                            <button onClick={() => removeRow(idx)} className="text-rose-400 hover:text-rose-600 transition-colors"><Trash2 size={16} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <button onClick={addRow} className="mt-4 flex items-center gap-2 text-xs font-black text-blue-600 uppercase tracking-widest px-4 py-2 bg-blue-50 rounded-xl hover:bg-blue-100 transition-all">
                            <Plus size={14} /> Tambah Baris
                        </button>
                    </div>

                    <div className={`p-6 rounded-3xl border flex justify-between items-center mb-8 ${isBalanced ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                        <div className="flex items-center gap-4">
                            {isBalanced ? <CheckCircle className="text-emerald-500" /> : <AlertTriangle className="text-rose-500" />}
                            <div>
                                <p className={`text-sm font-black ${isBalanced ? 'text-emerald-800' : 'text-rose-800'}`}>{isBalanced ? 'JURNAL SEIMBANG' : 'JURNAL TIDAK SEIMBANG'}</p>
                                <p className="text-xs opacity-60">Selisih: <CurrencyDisplay value={difference} /></p>
                            </div>
                        </div>
                        <div className="text-right">
                           <p className="text-[10px] font-black opacity-40 uppercase tracking-widest">Total Debit</p>
                           <p className="text-xl font-black text-slate-800"><CurrencyDisplay value={totalDebit} /></p>
                        </div>
                    </div>

                    <div className="flex justify-end gap-4">
                        <button onClick={resetForm} className="px-8 py-3 rounded-2xl font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest text-xs">Reset</button>
                        <button onClick={handleSave} disabled={!isBalanced} className="btn btn-primary px-12 py-4 rounded-2xl shadow-xl shadow-blue-500/30 font-black tracking-tight">
                            <Save size={18} /> {editingJournal ? 'SIMPAN PERUBAHAN' : 'POSTING JURNAL'}
                        </button>
                    </div>
                </div>
            )}

            {viewMode === 'list' && (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden animate-in">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <tr>
                                <th colSpan={4} className="px-8 py-4">
                                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                                        <div className="relative flex-1 w-full">
                                            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input className="form-input pl-12 rounded-2xl border-slate-200" placeholder="Cari di riwayat..." value={historySearch} onChange={e => setHistorySearch(e.target.value)} />
                                        </div>
                                        <button onClick={exportHistoryToExcel} className="btn bg-white text-emerald-600 border-emerald-100 px-8 py-3 rounded-2xl shadow-sm font-black flex items-center gap-2">
                                            <FileSpreadsheet size={18} /> Export Excel
                                        </button>
                                    </div>
                                </th>
                            </tr>
                            <tr>
                                <th className="px-8 py-6">ID / Tanggal</th>
                                <th className="px-8 py-6">Deskripsi Transaksi</th>
                                <th className="px-8 py-6 text-right">Nilai Total</th>
                                <th className="px-8 py-6 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredJournals.map(j => (
                                <tr key={j.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-8 py-4">
                                        <p className="font-bold text-blue-600 text-xs">{j.id}</p>
                                        <p className="text-slate-500 text-xs font-medium">{j.date}</p>
                                    </td>
                                    <td className="px-8 py-4">
                                        <p className="font-bold text-slate-800 text-sm">{j.description}</p>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{programs.find(p => p.id === j.programId)?.name || 'Umum'}</p>
                                    </td>
                                    <td className="px-8 py-4 text-right font-black text-slate-800">
                                        <CurrencyDisplay value={j.entries.reduce((s, e) => s + e.debit, 0)} />
                                    </td>
                                    <td className="px-8 py-4">
                                        <div className="flex justify-center gap-2">
                                            <button onClick={() => handleEdit(j)} className="p-2 text-slate-300 hover:text-blue-600 transition-all"><Pencil size={16}/></button>
                                            <button onClick={() => dispatch({type:'DELETE_JOURNAL', payload: j.id})} className="p-2 text-slate-300 hover:text-rose-600 transition-all"><Trash2 size={16}/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
