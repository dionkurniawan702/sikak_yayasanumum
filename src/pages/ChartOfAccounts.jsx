import { useState, Fragment, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, Pencil, Trash2, X, Search, Wallet, CreditCard, PieChart, Activity, Info, FileSpreadsheet } from 'lucide-react';
import { formatRupiah, generateId } from '../utils/format';
import { hitungSaldoAkun, hitungSaldoPerTipe, buildHierarchyAccounts, resolveAccountSubType } from '../utils/accounting';
import { api } from '../services/api';
import * as XLSX from 'xlsx';
import CurrencyDisplay from '../components/CurrencyDisplay';

const TIPE_AKUN = ['Aset', 'Kewajiban', 'Aset Neto', 'Saldo Dana', 'Pendapatan', 'Beban'];
const JENIS_DANA = ['Dana Umum', 'Dana Terikat'];
const KATEGORI = ['header', 'detail'];

const emptyForm = { code: '', name: '', type: 'Aset', subType: '', fund: 'Dana Umum', category: 'detail', normalBalance: 'debit', initialBalance: 0 };

export default function ChartOfAccounts() {
    const { state, dispatch } = useApp();
    const accounts = state.accounts.filter(a => !a.isDeleted);
    const journals = state.journals.filter(j => !j.isDeleted);
    const assets = state.assets.filter(a => !a.isDeleted);
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [search, setSearch] = useState('');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
    const [filterType, setFilterType] = useState('');
    const [viewMode, setViewMode] = useState('list');
    const [isSaving, setIsSaving] = useState(false);
    const [deleteLoadingId, setDeleteLoadingId] = useState(null);
    const fileInputRef = useRef(null);

    // Auto-repair any accounts with mismatched/corrupted subType in state & remote
    useEffect(() => {
        if (!accounts || accounts.length === 0) return;
        accounts.forEach(async (acc) => {
            const correctSubType = resolveAccountSubType(acc);
            if (acc.subType !== correctSubType) {
                const fixedAcc = { ...acc, subType: correctSubType };
                dispatch({ type: 'EDIT_ACCOUNT', payload: fixedAcc });
                try {
                    await api.pushAction({ type: 'EDIT_ACCOUNT', payload: fixedAcc }, state);
                } catch (err) {
                    console.warn('[ChartOfAccounts] Auto-repair sync notice:', err);
                }
            }
        });
    }, [accounts.length]);

    const exportToExcel = () => {
        const data = [];
        subTypeHierarchy.forEach(st => {
            data.push({ 'Tipe': st.name, 'Kode': '', 'Nama': '', 'Saldo': '' });
            st.headers.forEach(h => {
                data.push({ 'Tipe': '', 'Kode': h.code, 'Nama': h.name, 'Saldo': h.saldo });
                h.children.forEach(c => {
                    data.push({ 'Tipe': '', 'Kode': c.code, 'Nama': `   ${c.name}`, 'Saldo': c.saldo });
                });
            });
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'CoA');
        XLSX.writeFile(wb, `SIKAD-Dareliman-ChartOfAccounts-${selectedYear}.xlsx`);
    };

    let subTypeHierarchy = [];
    TIPE_AKUN.forEach(type => {
        if (filterType && type !== filterType) return;
        const typeHierarchy = buildHierarchyAccounts(journals, accounts, type, null, selectedYear, assets, false, true);
        subTypeHierarchy = [...subTypeHierarchy, ...typeHierarchy];
    });

    const hierarchicalFiltered = subTypeHierarchy.map(st => {
        const filteredHeaders = st.headers.map(header => {
            const headerMatches = (!search || header.name.toLowerCase().includes(search.toLowerCase()) || header.code.includes(search));
            const filteredChildren = header.children.filter(child =>
                (!search || child.name.toLowerCase().includes(search.toLowerCase()) || child.code.includes(search))
            );
            return (headerMatches || filteredChildren.length > 0) ? { ...header, filteredChildren } : null;
        }).filter(h => h !== null);

        return filteredHeaders.length > 0 ? { ...st, headers: filteredHeaders } : null;
    }).filter(st => st !== null);

    const totalAset = hitungSaldoPerTipe(journals, accounts, 'Aset', selectedYear, assets);
    const totalKewajiban = hitungSaldoPerTipe(journals, accounts, 'Kewajiban', selectedYear, assets);
    const totalAsetNeto = hitungSaldoPerTipe(journals, accounts, 'Aset Neto', selectedYear, assets);

    const totalPasiva = totalKewajiban + totalAsetNeto;
    const isBalance = Math.abs(totalAset - totalPasiva) < 0.01;

    function openAdd() {
        setEditId(null);
        setForm(emptyForm);
        setShowModal(true);
    }

    function openEdit(acc) {
        setEditId(acc.id);
        const isDebit = ['Aset', 'Beban'].includes(acc.type);
        setForm({
            code: acc.code,
            name: acc.name,
            type: acc.type,
            subType: acc.subType || '',
            fund: acc.fund || 'Dana Umum',
            category: acc.category || (acc.isParent ? 'header' : 'detail'),
            normalBalance: isDebit ? 'debit' : 'kredit',
            initialBalance: Math.abs(acc.initialBalance !== undefined ? acc.initialBalance : (parseFloat(acc.balance) || 0))
        });
        setShowModal(true);
    }

    async function handleSave() {
        if (!form.code || !form.name) return alert('Kode dan Nama Akun wajib diisi!');
        const isDebit = ['Aset', 'Beban'].includes(form.type);
        const resolvedSubType = resolveAccountSubType(form);

        const finalForm = {
            ...form,
            subType: resolvedSubType,
            normalBalance: isDebit ? 'debit' : 'kredit',
            isParent: form.category === 'header'
        };

        setIsSaving(true);
        try {
            if (editId && !editId.startsWith('ORPHAN-')) {
                const payload = { ...finalForm, id: editId };
                dispatch({ type: 'EDIT_ACCOUNT', payload });
                await api.pushAction({ type: 'EDIT_ACCOUNT', payload }, state);
            } else {
                const payload = { ...finalForm, id: generateId('ACC') };
                dispatch({ type: 'ADD_ACCOUNT', payload });
                await api.pushAction({ type: 'ADD_ACCOUNT', payload }, state);
            }
            setShowModal(false);
        } catch (err) {
            console.error('[ChartOfAccounts] Gagal menyimpan akun:', err);
            alert('Gagal menyimpan akun ke server: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    }

    async function handleDelete(id) {
        if (window.confirm('Hapus akun ini? Akun akan dipindahkan ke tempat sampah.')) {
            setDeleteLoadingId(id);
            try {
                dispatch({ type: 'DELETE_ACCOUNT', payload: id });
                await api.pushAction({ type: 'DELETE_ACCOUNT', payload: id }, state);
                window.alert('Akun berhasil dipindahkan ke tempat sampah');
            } catch (err) {
                console.error('[ChartOfAccounts] Gagal menghapus akun:', err);
                alert('Gagal menghapus akun di server: ' + err.message);
            } finally {
                setDeleteLoadingId(null);
            }
        }
    }

    return (
        <Fragment>
            <div className="p-8 border-b border-slate-100 bg-white shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
                        <PieChart size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Daftar Akun</h2>
                        <p className="text-sm text-slate-500 font-medium tracking-tight">Struktur Akun Standar PSAK 35 — Yayasan Umum</p>
                    </div>
                </div>
            </div>

            <div className="p-8 animate-in">
                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-6">
                        <div className="p-4 bg-blue-50 rounded-2xl text-blue-600"><Wallet size={24}/></div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Aset</p>
                            <h3 className="text-xl font-black text-slate-900"><CurrencyDisplay value={totalAset} /></h3>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-6">
                        <div className="p-4 bg-indigo-50 rounded-2xl text-indigo-600"><CreditCard size={24}/></div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Liabilitas & Aset Neto</p>
                            <h3 className="text-xl font-black text-slate-900"><CurrencyDisplay value={totalPasiva} /></h3>
                        </div>
                    </div>
                    <div className={`p-6 rounded-3xl border shadow-sm flex items-center gap-6 ${isBalance ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                        <div className={`p-4 rounded-2xl ${isBalance ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                            <Activity size={24}/>
                        </div>
                        <div>
                            <p className="text-[10px] font-black opacity-60 uppercase tracking-widest mb-1">Status Neraca</p>
                            <h3 className={`text-xl font-black ${isBalance ? 'text-emerald-700' : 'text-rose-700'}`}>{isBalance ? 'SEIMBANG' : 'SELISIH!'}</h3>
                        </div>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="relative flex-1 md:w-80">
                            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                className="form-input pl-12 rounded-2xl border-slate-200"
                                placeholder="Cari akun..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <select
                            className="form-select rounded-2xl border-slate-200"
                            value={filterType}
                            onChange={e => setFilterType(e.target.value)}
                        >
                            <option value="">Semua Tipe</option>
                            {TIPE_AKUN.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div className="flex gap-4 w-full md:w-auto">
                        <button onClick={exportToExcel} className="btn bg-white text-emerald-600 border-emerald-100 hover:bg-emerald-50 w-full md:w-auto py-3 px-8 rounded-2xl shadow-sm font-bold flex items-center gap-2">
                            <FileSpreadsheet size={18} /> Export Excel
                        </button>
                        <button onClick={openAdd} className="btn btn-primary w-full md:w-auto py-3 px-8 rounded-2xl shadow-lg shadow-blue-500/20 font-bold">
                            <Plus size={18} /> Tambah Akun
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                            <tr>
                                <th className="px-8 py-6 uppercase tracking-widest">Kode Akun</th>
                                <th className="px-8 py-6">Nama Akun</th>
                                <th className="px-8 py-6 text-right">Saldo Berjalan</th>
                                <th className="px-8 py-6 text-center w-32">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {hierarchicalFiltered.map(st => (
                                <Fragment key={st.name}>
                                    <tr className="bg-slate-50/50">
                                        <td colSpan={4} className="px-8 py-4 font-black text-xs text-slate-800 flex items-center gap-3">
                                            <div className="w-1.5 h-4 bg-blue-600 rounded-full"></div>
                                            {st.name.toUpperCase()} 
                                        </td>
                                    </tr>
                                    {st.headers.map(header => (
                                        <Fragment key={header.id}>
                                            <tr className="hover:bg-slate-50/30 transition-colors">
                                                <td className="px-8 py-4 font-mono font-bold text-blue-600 text-sm">{header.code}</td>
                                                <td className="px-8 py-4">
                                                    <p className="font-bold text-slate-900 text-sm">{header.name}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">HEADER</p>
                                                </td>
                                                <td className="px-8 py-4 text-right font-black text-slate-900">
                                                    <CurrencyDisplay value={header.saldo} />
                                                </td>
                                                <td className="px-8 py-4">
                                                    <div className="flex justify-center gap-2">
                                                        <button onClick={() => openEdit(header)} className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Pencil size={16} /></button>
                                                        <button onClick={() => handleDelete(header.id)} className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={16} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                            {header.filteredChildren.map(child => (
                                                <tr key={child.id} className="bg-slate-50/10 hover:bg-slate-50 transition-colors">
                                                    <td className="px-12 py-3 font-mono text-slate-400 text-xs italic">{child.code}</td>
                                                    <td className="px-8 py-3 text-sm font-medium text-slate-600 px-12">{child.name}</td>
                                                    <td className="px-8 py-3 text-right font-bold text-slate-700">
                                                        <CurrencyDisplay value={child.saldo} />
                                                    </td>
                                                    <td className="px-8 py-3 text-center">
                                                        <div className="flex justify-center gap-2">
                                                            <button onClick={() => openEdit(child)} className="p-1.5 text-slate-300 hover:text-blue-600 hover:bg-white rounded-lg shadow-sm transition-all"><Pencil size={14} /></button>
                                                            <button onClick={() => handleDelete(child.id)} className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-white rounded-lg shadow-sm transition-all"><Trash2 size={14} /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </Fragment>
                                    ))}
                                </Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm shadow-2xl animate-in">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-100">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="text-xl font-black text-slate-900">{editId ? 'Ubah Akun' : 'Akun Baru'}</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                        </div>
                        <div className="p-8 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Kode Akun</label>
                                    <input className="form-input rounded-2xl border-slate-200" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="1-1101" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Tipe Akun</label>
                                    <select className="form-select rounded-2xl border-slate-200" value={form.type} onChange={e => setForm({ ...form, type: e.target.value, subType: '' })}>
                                        {TIPE_AKUN.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Nama Akun</label>
                                <input className="form-input rounded-2xl border-slate-200" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Kas Yayasan" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Jenis Dana</label>
                                    <select className="form-select rounded-2xl border-slate-200" value={form.fund} onChange={e => setForm({ ...form, fund: e.target.value })}>
                                        {JENIS_DANA.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Kategori</label>
                                    <select className="form-select rounded-2xl border-slate-200" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                                        {KATEGORI.map(k => <option key={k} value={k}>{k === 'header' ? 'Header (Induk)' : 'Detail (Anak)'}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Saldo Awal</label>
                                <input type="number" className="form-input rounded-2xl border-slate-200" value={form.initialBalance} onChange={e => setForm({ ...form, initialBalance: parseFloat(e.target.value) || 0 })} />
                            </div>
                        </div>
                        <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex justify-end gap-4">
                            <button onClick={() => setShowModal(false)} className="px-6 py-2 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest">Batal</button>
                            <button onClick={handleSave} disabled={isSaving} className="btn btn-primary px-8 py-3 rounded-2xl shadow-lg shadow-blue-500/20 font-black tracking-tight tracking-wide disabled:opacity-50">
                                {isSaving ? 'Menyimpan...' : (editId ? 'Simpan' : 'Tambah')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Fragment>
    );
}
