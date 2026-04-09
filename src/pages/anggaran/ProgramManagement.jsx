import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { 
    Plus, Search, Edit2, Trash2, Layout, ChevronRight, 
    Layers, Filter, AlertCircle, CheckCircle2, Building2
} from 'lucide-react';
import { generateId } from '../../utils/format';

export default function ProgramManagement() {
    const { state, dispatch } = useApp();
    const { programs = [], units = [], fields = [], currentUser } = state;

    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({ name: '', description: '', unitId: '', fieldId: '', type: 'Expense' });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    // Initial Unit/Field for unit/bidang admins
    const initialUnitId = currentUser?.role === 'admin_unit' ? currentUser.unitId : '';
    const initialFieldId = currentUser?.role === 'admin_bidang' ? currentUser.fieldId : '';

    const filteredItems = programs.filter(item => {
        if (item.isDeleted || item.type !== 'Expense') return false;
        
        // Removed unit/bidang filtering to make programs shared across the foundation
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (item.description || '').toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            const dataToSave = {
                ...formData,
                unitId: currentUser?.role === 'admin_unit' ? currentUser.unitId : formData.unitId,
                fieldId: currentUser?.role === 'admin_bidang' ? currentUser.fieldId : formData.fieldId
            };

            if (editingItem) {
                const updatedItem = { ...editingItem, ...dataToSave };
                dispatch({ type: 'EDIT_PROGRAM', payload: updatedItem });
                await api.pushAction({ type: 'EDIT_PROGRAM', payload: updatedItem }, state);
                setMessage({ type: 'success', text: 'Program berhasil diperbarui' });
            } else {
                const newItem = {
                    id: `PRG-${generateId()}`,
                    ...dataToSave
                };
                dispatch({ type: 'ADD_PROGRAM', payload: newItem });
                await api.pushAction({ type: 'ADD_PROGRAM', payload: newItem }, state);
                setMessage({ type: 'success', text: 'Program berhasil ditambahkan' });
            }
            setIsModalOpen(false);
            setEditingItem(null);
            setFormData({ name: '', description: '', unitId: '', fieldId: '', type: 'Expense' });
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Hapus program ini?')) return;
        try {
            dispatch({ type: 'DELETE_PROGRAM', payload: id });
            await api.pushAction({ type: 'DELETE_PROGRAM', payload: id }, state);
            setMessage({ type: 'success', text: 'Program berhasil dihapus' });
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        }
    };

    return (
        <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200">
                            <Layout size={28} />
                        </div>
                        Master Program Belanja
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">Kelola daftar program kerja dan belanja untuk unit/bidang Anda</p>
                </div>
                
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => {
                            setEditingItem(null);
                            setFormData({ name: '', description: '', unitId: initialUnitId, fieldId: initialFieldId, type: 'Expense' });
                            setIsModalOpen(true);
                        }}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3.5 rounded-2xl font-bold transition-all shadow-lg shadow-indigo-200 active:scale-95"
                    >
                        <Plus size={20} />
                        Tambah Program
                    </button>
                </div>
            </div>

            {/* Alert Message */}
            {message && (
                <div className={`p-4 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top duration-300 ${
                    message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                }`}>
                    {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                    <p className="font-bold text-sm">{message.text}</p>
                </div>
            )}

            {/* Content Card */}
            <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                <div className="p-6 lg:p-8 border-b border-slate-50 bg-slate-50/30 flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-indigo-500" size={20} />
                        <input 
                            type="text" 
                            placeholder="Cari nama program..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-6 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-medium"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="px-8 py-5 text-sm font-bold text-slate-500 uppercase tracking-wider">Nama Program</th>
                                <th className="px-8 py-5 text-sm font-bold text-slate-500 uppercase tracking-wider">Unit/Bidang</th>
                                <th className="px-8 py-5 text-sm font-bold text-slate-500 uppercase tracking-wider">Tipe</th>
                                <th className="px-8 py-5 text-sm font-bold text-slate-500 uppercase tracking-wider">Keterangan</th>
                                <th className="px-8 py-5 text-sm font-bold text-slate-500 uppercase tracking-wider text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-600 font-medium text-sm">
                            {filteredItems.map((item) => {
                                const unitObj = units.find(u => u.id === item.unitId);
                                const fieldObj = fields.find(f => f.id === item.fieldId);
                                return (
                                    <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors group">
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 rounded-full bg-indigo-400 opacity-40 group-hover:opacity-100 transition-opacity" />
                                                <span className="text-slate-900 font-bold group-hover:text-indigo-600 transition-colors">{item.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-slate-800">{unitObj ? unitObj.name : (fieldObj ? fieldObj.name : 'Shared / Global')}</span>
                                                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-black">
                                                    Penanggung Jawab
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${item.type === 'Expense' ? 'bg-orange-50 text-orange-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                                {item.type === 'Expense' ? 'Belanja' : 'Donasi'}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 max-w-xs truncate">
                                            {item.description || '-'}
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center justify-end gap-2 text-slate-500">
                                                <button 
                                                    onClick={() => {
                                                        setEditingItem(item);
                                                        setFormData({ 
                                                            name: item.name, 
                                                            description: item.description || '',
                                                            unitId: item.unitId || '',
                                                            fieldId: item.fieldId || '',
                                                            type: item.type || 'Expense'
                                                        });
                                                        setIsModalOpen(true);
                                                    }}
                                                    className="p-2.5 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={18} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(item.id)}
                                                    className="p-2.5 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                                    title="Hapus"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredItems.length === 0 && (
                                <tr>
                                    <td colSpan="4" className="px-8 py-20 text-center text-slate-400 font-medium">
                                        Tidak ada program belanja yang ditemukan
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-6 bg-slate-50/30 border-t border-slate-50 flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-widest">
                    <span>Total: {filteredItems.length} Program</span>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-slate-100 bg-indigo-50/50">
                            <h2 className="text-2xl font-black text-slate-900">
                                {editingItem ? 'Edit Program' : 'Tambah Program'}
                            </h2>
                            <p className="text-slate-500 text-sm font-medium mt-1">
                                Definisikan program belanja unit/bidang Anda
                            </p>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Nama Program</label>
                                <input 
                                    type="text" 
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:bg-white outline-none transition-all font-bold text-slate-900"
                                    placeholder="Contoh: Pembangunan Masjid"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Keterangan</label>
                                <textarea 
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:bg-white outline-none transition-all font-medium text-slate-700 min-h-[100px]"
                                    placeholder="Penjelasan singkat mengenai program ini..."
                                />
                            </div>

                            {currentUser?.role === 'superadmin' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Unit</label>
                                        <select 
                                            value={formData.unitId}
                                            onChange={(e) => setFormData({ ...formData, unitId: e.target.value, fieldId: '' })}
                                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold text-xs"
                                        >
                                            <option value="">(Opsional)</option>
                                            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Bidang</label>
                                        <select 
                                            value={formData.fieldId}
                                            onChange={(e) => setFormData({ ...formData, fieldId: e.target.value, unitId: '' })}
                                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold text-xs"
                                        >
                                            <option value="">(Opsional)</option>
                                            {fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Tipe Program</label>
                                <select 
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:bg-white outline-none transition-all font-bold text-slate-900"
                                >
                                    <option value="Expense">Belanja Pendidikan (Ekskul, Operasional, dsb)</option>
                                    <option value="Donation">Donasi Yayasan (Masuk Laporan Program)</option>
                                </select>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button 
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold transition-all shadow-sm"
                                >
                                    Batal
                                </button>
                                <button 
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-200"
                                >
                                    {loading ? 'Menyimpan...' : 'Simpan Program'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
