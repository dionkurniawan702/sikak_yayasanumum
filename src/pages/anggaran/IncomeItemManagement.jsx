import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { 
    Plus, Search, Edit2, Trash2, HandCoins, Coins, ChevronRight, 
    Download, Upload, Filter, AlertCircle, CheckCircle2 
} from 'lucide-react';
import { generateId } from '../../utils/format';

export default function IncomeItemManagement() {
    const { state, dispatch } = useApp();
    const { incomeItems } = state;

    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({ name: '' });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    const filteredItems = (incomeItems || []).filter(item => 
        !item.isDeleted && item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            if (editingItem) {
                const updatedItem = { ...editingItem, name: formData.name };
                dispatch({ type: 'EDIT_INCOME_ITEM', payload: updatedItem });
                await api.pushAction({ type: 'EDIT_INCOME_ITEM', payload: updatedItem }, state);
                setMessage({ type: 'success', text: 'Item berhasil diperbarui' });
            } else {
                const newItem = {
                    id: `INC-${generateId()}`,
                    name: formData.name
                };
                dispatch({ type: 'ADD_INCOME_ITEM', payload: newItem });
                await api.pushAction({ type: 'ADD_INCOME_ITEM', payload: newItem }, state);
                setMessage({ type: 'success', text: 'Item berhasil ditambahkan' });
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
        if (!window.confirm(`Hapus ${pageTitle.toLowerCase()} ini?`)) return;
        try {
            dispatch({ type: 'DELETE_INCOME_ITEM', payload: id });
            await api.pushAction({ type: 'DELETE_INCOME_ITEM', payload: id }, state);
            setMessage({ type: 'success', text: 'Item berhasil dihapus' });
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        }
    };

    const isFundSourcePage = window.location.pathname.includes('sumber-dana');
    const pageTitle = isFundSourcePage ? 'Master Sumber Dana' : 'Master Item Penerimaan';
    const pageDesc = isFundSourcePage ? 'Kelola kategori sumber dana pendidikan dan yayasan' : 'Kelola kategori item penerimaan dan pendapatan';
    const PageIcon = isFundSourcePage ? HandCoins : Coins;

    return (
        <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-200">
                            <PageIcon size={28} />
                        </div>
                        {pageTitle}
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">{pageDesc}</p>
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
                        Tambah Item
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
                            placeholder={`Cari ${pageTitle.toLowerCase()}...`}
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
                                <th className="px-8 py-5 text-sm font-bold text-slate-500 uppercase tracking-wider">{pageTitle}</th>
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
                                            <span className="text-slate-900 font-bold group-hover:text-blue-600 transition-colors">{item.name}</span>
                                        </div>
                                    </td>
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
                                        Tidak ada {pageTitle.toLowerCase()} yang ditemukan
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
                                {editingItem ? 'Edit Item' : 'Tambah Item Baru'}
                            </h2>
                            <p className="text-slate-400 text-sm font-medium mt-1 uppercase tracking-widest leading-relaxed">
                                {editingItem ? `Perbarui kategori ${pageTitle.toLowerCase()}` : `Masukkan informasi ${pageTitle.toLowerCase()} baru`}
                            </p>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Nama {pageTitle}</label>
                                <input 
                                    type="text" 
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:bg-white outline-none transition-all font-bold text-slate-900"
                                    placeholder="Contoh: Gedung, Seragam, dll"
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button 
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold transition-all transition-all shadow-sm active:scale-95"
                                >
                                    Batal
                                </button>
                                <button 
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-200 active:scale-95 disabled:opacity-50"
                                >
                                    {loading ? 'Menyimpan...' : 'Simpan Item'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
