import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { 
    Plus, Search, Edit2, Trash2, Wallet, ChevronRight, 
    Layers, PieChart, Filter, AlertCircle, CheckCircle2 
} from 'lucide-react';
import { generateId } from '../../utils/format';

export default function ExpenseItemManagement() {
    const { state, dispatch } = useApp();
    const { expenseItems = [], incomeItems: allIncomeItems = [] } = state;
    const incomeItems = allIncomeItems.filter(i => !i.isDeleted);

    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({ name: '', sourceOfFunds: '', isBos: false });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    const filteredItems = (expenseItems || []).filter(item => 
        !item.isDeleted && (
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.sourceOfFunds || '').toLowerCase().includes(searchTerm.toLowerCase())
        )
    );

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.sourceOfFunds) {
            setMessage({ type: 'error', text: 'Sumber Dana wajib diisi!' });
            return;
        }
        setLoading(true);
        setMessage(null);

        try {
            if (editingItem) {
                const updatedItem = { ...editingItem, ...formData };
                dispatch({ type: 'EDIT_EXPENSE_ITEM', payload: updatedItem });
                await api.pushAction({ type: 'EDIT_EXPENSE_ITEM', payload: updatedItem }, state);
                setMessage({ type: 'success', text: 'Item pengeluaran berhasil diperbarui' });
            } else {
                const newItem = {
                    id: `EXP-${generateId()}`,
                    ...formData
                };
                dispatch({ type: 'ADD_EXPENSE_ITEM', payload: newItem });
                await api.pushAction({ type: 'ADD_EXPENSE_ITEM', payload: newItem }, state);
                setMessage({ type: 'success', text: 'Item pengeluaran berhasil ditambahkan' });
            }
            setIsModalOpen(false);
            setEditingItem(null);
            setFormData({ name: '', sourceOfFunds: '', isBos: false });
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Hapus item pengeluaran ini?')) return;
        try {
            dispatch({ type: 'DELETE_EXPENSE_ITEM', payload: id });
            await api.pushAction({ type: 'DELETE_EXPENSE_ITEM', payload: id }, state);
            setMessage({ type: 'success', text: 'Item berhasil dihapus' });
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
                        <div className="p-3 bg-rose-600 text-white rounded-2xl shadow-lg shadow-rose-200">
                            <Wallet size={28} />
                        </div>
                        Master Item Pengeluaran
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">Kelola kategori beban dan pemetaan sumber dananya</p>
                </div>
                
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => {
                            setEditingItem(null);
                            setFormData({ name: '', sourceOfFunds: '' });
                            setIsModalOpen(true);
                        }}
                        className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-6 py-3.5 rounded-2xl font-bold transition-all shadow-lg shadow-rose-200 active:scale-95"
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
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-rose-500" size={20} />
                        <input 
                            type="text" 
                            placeholder="Cari nama item atau sumber dana..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-6 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 outline-none transition-all font-medium"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="px-8 py-5 text-sm font-bold text-slate-500 uppercase tracking-wider">Item Pengeluaran</th>
                                <th className="px-8 py-5 text-sm font-bold text-slate-500 uppercase tracking-wider">Sumber Dana</th>
                                <th className="px-8 py-5 text-sm font-bold text-slate-500 uppercase tracking-wider text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-slate-600 font-medium text-sm">
                            {filteredItems.map((item) => (
                                <tr key={item.id} className="hover:bg-rose-50/30 transition-colors group">
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-rose-400 opacity-40 group-hover:opacity-100 transition-opacity" />
                                            <span className="text-slate-900 font-bold group-hover:text-rose-600 transition-colors">{item.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className="px-4 py-1.5 bg-blue-50 text-blue-700 rounded-xl text-xs font-black uppercase tracking-tight">
                                            {item.sourceOfFunds || 'Belum Diatur'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex items-center justify-end gap-2 text-slate-500">
                                            <button 
                                                onClick={() => {
                                                    setEditingItem(item);
                                                    setFormData({ 
                                                        name: item.name, 
                                                        sourceOfFunds: item.sourceOfFunds || '',
                                                        isBos: !!item.isBos
                                                    });
                                                    setIsModalOpen(true);
                                                }}
                                                className="p-2.5 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
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
                            ))}
                            {filteredItems.length === 0 && (
                                <tr>
                                    <td colSpan="3" className="px-8 py-20 text-center text-slate-400 font-medium">
                                        Tidak ada item pengeluaran yang ditemukan
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-6 bg-slate-50/30 border-t border-slate-50 flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-widest">
                    <span>Total: {filteredItems.length} Item</span>
                    <span className="flex items-center gap-1 opacity-40 cursor-default">
                        SIKAD DARELIMAN <ChevronRight size={12} /> Master Data
                    </span>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-slate-50 bg-rose-50/50">
                            <h2 className="text-2xl font-black text-slate-900">
                                {editingItem ? 'Edit Item' : 'Tambah Item Baru'}
                            </h2>
                            <p className="text-slate-500 text-sm font-medium mt-1 uppercase tracking-widest leading-relaxed">
                                {editingItem ? 'Perbarui kategori pengeluaran' : 'Masukkan informasi pengeluaran baru'}
                            </p>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Nama Item Pengeluaran</label>
                                <input 
                                    type="text" 
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-rose-500/10 focus:bg-white outline-none transition-all font-bold text-slate-900"
                                    placeholder="Contoh: Penggajian, Operasional, dll"
                                />
                            </div>

                            <div className="flex items-center gap-3 px-2">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only peer"
                                        checked={formData.isBos}
                                        onChange={(e) => setFormData({ ...formData, isBos: e.target.checked })}
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
                                    <span className="ml-3 text-sm font-bold text-slate-600">Item Khusus BOS?</span>
                                </label>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Sumber Dana</label>
                                <select 
                                    required
                                    value={formData.sourceOfFunds}
                                    onChange={(e) => setFormData({ ...formData, sourceOfFunds: e.target.value })}
                                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-rose-500/10 focus:bg-white outline-none transition-all font-bold text-slate-900 appearance-none"
                                >
                                    <option value="">Pilih Sumber Dana...</option>
                                    {incomeItems.map(item => (
                                        <option key={item.id} value={item.name}>{item.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button 
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold transition-all shadow-sm active:scale-95"
                                >
                                    Batal
                                </button>
                                <button 
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 px-6 py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-rose-200 active:scale-95 disabled:opacity-50"
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
