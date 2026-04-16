import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { 
    Plus, Search, Edit2, Trash2, ChevronRight, 
    AlertCircle, CheckCircle2, Eye, EyeOff, Star
} from 'lucide-react';
import { generateId } from '../utils/format';

/**
 * GenericMasterManagement
 * @param {Object} props
 * @param {string} props.title - Page title (e.g., 'Tahun Ajaran')
 * @param {string} props.entity - State key (e.g., 'academicYears')
 * @param {string} props.actionPrefix - Reducer action prefix (e.g., 'ACADEMIC_YEAR')
 * @param {React.Component} props.icon - Lucide icon component
 * @param {string} props.description - Page subtitle
 */
export default function GenericMasterManagement({ 
    title, 
    entity, 
    actionPrefix, 
    icon: Icon, 
    description 
}) {
    const { state, dispatch } = useApp();
    const items = state[entity] || [];

    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({ name: '' });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    const filteredItems = items.filter(item => 
        (item.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            if (editingItem) {
                const { startDate, endDate, ...cleanEditingItem } = editingItem;
                const updatedItem = { ...cleanEditingItem, name: formData.name };
                dispatch({ type: `EDIT_${actionPrefix}`, payload: updatedItem });
                await api.pushAction({ type: `EDIT_${actionPrefix}`, payload: updatedItem }, state);
                setMessage({ type: 'success', text: `${title} berhasil diperbarui` });
            } else {
                const currentYear = new Date().getFullYear();
                const defaultDates = actionPrefix === 'ACADEMIC_YEAR' ? {
                    isCurrent: false
                } : {};

                const newItem = {
                    id: `${actionPrefix.substring(0,3)}-${generateId()}`,
                    name: formData.name,
                    ...defaultDates
                };
                dispatch({ type: `ADD_${actionPrefix}`, payload: newItem });
                await api.pushAction({ type: `ADD_${actionPrefix}`, payload: newItem }, state);
                setMessage({ type: 'success', text: `${title} berhasil ditambahkan` });
            }
            setIsModalOpen(false);
            setEditingItem(null);
            setFormData({ name: '' });
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm(`Hapus ${title.toLowerCase()} ini?`)) return;
        try {
            await api.pushAction({ type: `DELETE_${actionPrefix}`, payload: id }, state);
            dispatch({ type: `DELETE_${actionPrefix}`, payload: id });
            setMessage({ type: 'success', text: `${title} berhasil dihapus` });
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        }
    };

    const handleToggleActive = async (item) => {
        if (item.isCurrent && item.isActive) {
            setMessage({ type: 'error', text: 'Tahun ajaran aktif saat ini tidak dapat dinonaktifkan' });
            setTimeout(() => setMessage(null), 3000);
            return;
        }

        const updatedItem = { ...item, isActive: !item.isActive };
        try {
            dispatch({ type: `EDIT_${actionPrefix}`, payload: updatedItem });
            await api.pushAction({ type: `EDIT_${actionPrefix}`, payload: updatedItem }, state);
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
            // Rollback on failure
            dispatch({ type: `EDIT_${actionPrefix}`, payload: item });
        }
    };

    return (
        <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-200">
                            {Icon && <Icon size={28} />}
                        </div>
                        Manajemen {title}
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">{description}</p>
                </div>
                
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => {
                            setEditingItem(null);
                            setFormData({ name: '' });
                            setIsModalOpen(true);
                        }}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3.5 rounded-2xl font-bold transition-all shadow-lg shadow-blue-200 active:scale-95"
                    >
                        <Plus size={20} />
                        Tambah {title}
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
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-500" size={20} />
                        <input 
                            type="text" 
                            placeholder={`Cari ${title.toLowerCase()}...`}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-6 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-medium"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="px-8 py-5 text-sm font-bold text-slate-500 uppercase tracking-wider w-24">ID</th>
                                <th className="px-8 py-5 text-sm font-bold text-slate-500 uppercase tracking-wider">{title}</th>
                                {entity === 'academicYears' && (
                                    <th className="px-8 py-5 text-sm font-bold text-slate-500 uppercase tracking-wider text-center">Status</th>
                                )}
                                <th className="px-8 py-5 text-sm font-bold text-slate-500 uppercase tracking-wider text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-slate-600 font-medium text-sm">
                            {filteredItems.map((item, idx) => (
                                <tr key={item.id} className="hover:bg-blue-50/30 transition-colors group">
                                    <td className="px-8 py-5">
                                        <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase">
                                            {item.id.split('-').pop()}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-blue-400 opacity-40 group-hover:opacity-100 transition-opacity" />
                                            <div className="flex flex-col">
                                                <span className="text-slate-900 font-bold group-hover:text-blue-600 transition-colors">{item.name}</span>
                                                {item.isCurrent && (
                                                    <span className="text-[10px] text-blue-600 font-black uppercase tracking-widest mt-0.5 flex items-center gap-1">
                                                        <Star size={10} fill="currentColor" /> Tahun Berjalan
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    {entity === 'academicYears' && (
                                        <td className="px-8 py-5">
                                            <div className="flex justify-center">
                                                <button 
                                                    onClick={() => handleToggleActive(item)}
                                                    className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${
                                                        item.isActive 
                                                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                                                            : 'bg-slate-50 text-slate-400 border border-slate-200'
                                                    }`}
                                                >
                                                    {item.isActive ? <Eye size={12} /> : <EyeOff size={12} />}
                                                    {item.isActive ? 'Aktif' : 'Non-Aktif'}
                                                </button>
                                            </div>
                                        </td>
                                    )}
                                    <td className="px-8 py-5">
                                        <div className="flex items-center justify-end gap-2">
                                            <button 
                                                onClick={() => {
                                                    setEditingItem(item);
                                                    setFormData({ name: item.name });
                                                    setIsModalOpen(true);
                                                }}
                                                className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                                title="Edit"
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(item.id)}
                                                className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                                title="Hapus"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredItems.length === 0 && (
                                <tr>
                                    <td colSpan="3" className="px-8 py-20 text-center text-slate-400 font-medium">
                                        Tidak ada data {title.toLowerCase()} yang ditemukan
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-6 bg-slate-50/30 border-t border-slate-50 flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-widest">
                    <span>Total: {filteredItems.length} Item</span>
                    <span className="flex items-center gap-1 opacity-40 cursor-default">
                        Sikak Yayasan <ChevronRight size={12} /> Master Data
                    </span>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-slate-50">
                            <h2 className="text-2xl font-black text-slate-900">
                                {editingItem ? `Edit ${title}` : `Tambah ${title} Baru`}
                            </h2>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Nama {title}</label>
                                <input 
                                    type="text" 
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:bg-white outline-none transition-all font-bold text-slate-900"
                                    placeholder={`Masukkan nama ${title.toLowerCase()}...`}
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button 
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold transition-all active:scale-95"
                                >
                                    Batal
                                </button>
                                <button 
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-200 active:scale-95 disabled:opacity-50"
                                >
                                    {loading ? 'Menyimpan...' : 'Simpan Data'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
