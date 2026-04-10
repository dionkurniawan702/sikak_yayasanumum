import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, Edit2, Trash2, X, Check, Info, Search, List, FileSpreadsheet } from 'lucide-react';
import CurrencyDisplay from '../components/CurrencyDisplay';
import * as XLSX from 'xlsx';

export default function ProgramManagement() {
    const { state, dispatch } = useApp();
    const programs = state.programs.filter(p => !p.isDeleted);
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const defaultFormData = { name: '', category: 'Umum', description: '', targetAmount: '', status: 'Aktif', initialDonationBalance: '', initialResultBalance: '', type: 'Donation' };
    const [formData, setFormData] = useState(defaultFormData);
    const [searchTerm, setSearchTerm] = useState('');

    const exportToExcel = () => {
        const data = filteredPrograms.map(p => ({
            'ID Program': p.id,
            'Nama Program': p.name,
            'Kategori': p.category,
            'Deskripsi': p.description || '',
            'Target Anggaran': p.targetAmount || 0,
            'Status': p.status
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Programs');
        XLSX.writeFile(wb, 'SIKAK-Yayasan-Programs.xlsx');
    };

    const filteredPrograms = programs.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.description || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSave = () => {
        if (!formData.name.trim()) return alert('Nama program wajib diisi');
        if (editingId) {
            dispatch({ type: 'EDIT_PROGRAM', payload: { id: editingId, ...formData } });
            setEditingId(null);
        } else {
            dispatch({ type: 'ADD_PROGRAM', payload: formData });
        }
        setFormData(defaultFormData);
        setIsAdding(false);
    };

    const handleEdit = (program) => {
        setEditingId(program.id);
        setFormData({ ...program });
        setIsAdding(true);
    };

    const handleDelete = (id) => {
        if (window.confirm('Hapus program ini?')) {
            dispatch({ type: 'DELETE_PROGRAM', payload: id });
        }
    };

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-black text-indigo-900 tracking-tight">Program Kegiatan & Donasi</h2>
                    <p className="text-slate-500 font-medium text-sm">Kelola daftar kegiatan yayasan dan alokasi dana donasi</p>
                </div>
                {!isAdding && (
                    <div className="flex gap-4">
                        <button onClick={exportToExcel} className="btn bg-white text-emerald-600 border-emerald-100 hover:bg-emerald-50 px-8 py-3 rounded-2xl shadow-sm font-black flex items-center gap-2">
                            <FileSpreadsheet size={18} /> Export
                        </button>
                        <button onClick={() => { setFormData(defaultFormData); setIsAdding(true); setEditingId(null); }} className="btn btn-primary px-8 py-3 rounded-2xl shadow-xl shadow-blue-500/20 font-black">
                            <Plus size={18} /> Tambah Program
                        </button>
                    </div>
                )}
            </div>

            {isAdding ? (
                <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-xl animate-in mb-8">
                    <div className="flex justify-between items-center mb-8 pb-6 border-b border-slate-50">
                        <h3 className="text-xl font-black text-slate-900">{editingId ? 'Ubah Program' : 'Program Baru'}</h3>
                        <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <div>
                                <label className="form-label">Nama Kegiatan / Program</label>
                                <input className="form-input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Pembangunan Masjid..." />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="form-label">Kategori</label>
                                    <select className="form-select" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                                        <option value="Umum">Umum</option>
                                        <option value="Sosial">Sosial</option>
                                        <option value="Pendidikan">Pendidikan</option>
                                        <option value="Dakwah">Dakwah</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label">Status</label>
                                    <select className="form-select" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                                        <option value="Aktif">Aktif</option>
                                        <option value="Selesai">Selesai</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="form-label">Deskripsi</label>
                                <textarea className="form-input h-32 resize-none" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Penjelasan singkat mengenai program..." />
                            </div>
                        </div>
                        <div className="space-y-6">
                            <div>
                                <label className="form-label">Target Pendanaan (Opsional)</label>
                                <input type="number" className="form-input" value={formData.targetAmount} onChange={e => setFormData({ ...formData, targetAmount: e.target.value })} placeholder="0" />
                            </div>
                            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Info size={14} className="text-blue-500" /> Saldo Awal Program
                                </h4>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Saldo Kas/Bank</label>
                                    <input type="number" className="form-input bg-white" value={formData.initialDonationBalance} onChange={e => setFormData({ ...formData, initialDonationBalance: e.target.value })} placeholder="0" />
                                </div>
                                <p className="text-[10px] text-slate-400 font-medium italic">* Saldo awal akan ditambahkan ke neraca saldo akun program terpilih.</p>
                            </div>
                        </div>
                    </div>
                    <div className="mt-12 flex justify-end gap-4">
                        <button onClick={() => setIsAdding(false)} className="px-6 py-2 text-xs font-black text-slate-400 uppercase tracking-widest">Batal</button>
                        <button onClick={handleSave} className="btn btn-primary px-12 py-4 rounded-2xl font-black tracking-tight">
                            <Check size={18} /> SIMPAN PROGRAM
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm mb-8 flex items-center gap-4">
                        <Search size={18} className="text-slate-400 ml-2" />
                        <input className="flex-1 bg-transparent border-none outline-none text-sm font-medium" placeholder="Cari program..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>

                    <div className="bg-white rounded-[32px] border border-slate-100 shadow-xl overflow-hidden animate-in">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                <tr>
                                    <th className="px-8 py-6">ID / Nama Program</th>
                                    <th className="px-8 py-6">Kategori</th>
                                    <th className="px-8 py-6 text-right">Target</th>
                                    <th className="px-8 py-6 text-center">Status</th>
                                    <th className="px-8 py-6 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredPrograms.map(p => (
                                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-8 py-4">
                                            <p className="font-bold text-slate-900 text-sm leading-tight">{p.name}</p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{p.id}</p>
                                        </td>
                                        <td className="px-8 py-4">
                                            <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[9px] font-black uppercase tracking-widest">{p.category}</span>
                                        </td>
                                        <td className="px-8 py-4 text-right font-black text-slate-900">
                                            {p.targetAmount ? <CurrencyDisplay value={p.targetAmount} /> : '-'}
                                        </td>
                                        <td className="px-8 py-4 text-center">
                                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${p.status === 'Aktif' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                                {p.status}
                                            </span>
                                        </td>
                                        <td className="px-8 py-4">
                                            <div className="flex justify-center gap-2">
                                                <button onClick={() => handleEdit(p)} className="p-2 text-slate-300 hover:text-blue-600 transition-all"><Edit2 size={16} /></button>
                                                <button onClick={() => handleDelete(p.id)} className="p-2 text-slate-300 hover:text-rose-600 transition-all"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}
