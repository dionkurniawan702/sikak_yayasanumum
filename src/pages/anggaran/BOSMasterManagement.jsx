import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { 
    Plus, Edit2, Trash2, ShieldCheck, ChevronRight, 
    Layers, Filter, AlertCircle, CheckCircle2, Box, Calendar
} from 'lucide-react';
import { generateId } from '../../utils/format';

export default function BOSMasterManagement() {
    const { state, dispatch } = useApp();
    const { bosStages = [], bosPosList = [], academicYears = [] } = state;

    const [activeTab, setActiveTab] = useState('STAGES'); // 'STAGES' | 'POS'
    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(false);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({ name: '', academicYearId: '' });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            let actionType;
            let payload;

            if (activeTab === 'STAGES') {
                actionType = editingItem ? 'EDIT_BOS_STAGE' : 'ADD_BOS_STAGE';
                payload = { ...formData, id: editingItem ? editingItem.id : `BSTG-${generateId()}` };
            } else if (activeTab === 'POS') {
                actionType = editingItem ? 'EDIT_BOS_POS' : 'ADD_BOS_POS';
                payload = { name: formData.name, id: editingItem ? editingItem.id : `BPOS-${generateId()}` };
            }

            dispatch({ type: actionType, payload });
            await api.pushAction({ type: actionType, payload }, state);
            
            setMessage({ type: 'success', text: 'Data berhasil disimpan' });
            setIsModalOpen(false);
            setEditingItem(null);
            setFormData({ name: '', academicYearId: '' });
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const handleDelete = async (item) => {
        if (!window.confirm('Hapus data ini?')) return;
        try {
            let actionType;
            if (activeTab === 'STAGES') actionType = 'DELETE_BOS_STAGE';
            else if (activeTab === 'POS') actionType = 'DELETE_BOS_POS';

            dispatch({ type: actionType, payload: item.id });
            await api.pushAction({ type: actionType, payload: item.id }, state);
            setMessage({ type: 'success', text: 'Data berhasil dihapus' });
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        }
    };

    const tabs = [
        { id: 'STAGES', label: 'Tahap BOS', icon: Calendar, color: 'emerald' },
        { id: 'POS', label: 'POS Anggaran', icon: Box, color: 'blue' }
    ];

    return (
        <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-200">
                            <ShieldCheck size={28} />
                        </div>
                        Master Pengaturan BOS
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">Kelola Tahap dan POS Anggaran untuk pendanaan BOS</p>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100 rounded-full w-fit">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`
                            flex items-center gap-2.5 px-6 py-3.5 rounded-full text-sm font-black transition-all duration-300
                            ${activeTab === tab.id 
                                ? `bg-white text-slate-900 shadow-xl shadow-slate-200` 
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}
                        `}
                    >
                        <tab.icon size={18} className={activeTab === tab.id ? `text-${tab.color}-600` : ''} />
                        {tab.label}
                    </button>
                ))}
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

            {/* Main Content Area */}
            <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/10">
                    <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">
                            Daftar {tabs.find(t => t.id === activeTab).label}
                        </h2>
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">
                            Manajemen data {tabs.find(t => t.id === activeTab).label.toLowerCase()} BOS
                        </p>
                    </div>
                    <button 
                        onClick={() => {
                            setEditingItem(null);
                            setFormData({ name: '', academicYearId: '' });
                            setIsModalOpen(true);
                        }}
                        className={`flex items-center gap-2 px-6 py-3.5 text-white rounded-2xl font-bold transition-all shadow-lg active:scale-95 ${
                            activeTab === 'STAGES' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100' :
                            'bg-blue-600 hover:bg-blue-700 shadow-blue-100'
                        }`}
                    >
                        <Plus size={20} />
                        Tambah Data
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                <th className="px-8 py-5">Nama Komponen</th>
                                {activeTab === 'STAGES' && <th className="px-8 py-5">Tahun Ajaran</th>}
                                <th className="px-8 py-5 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {(activeTab === 'STAGES' ? bosStages : bosPosList).filter(item => !item.isDeleted).map(item => (
                                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-8 py-5 font-bold text-slate-700">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full opacity-40 group-hover:opacity-100 transition-opacity ${
                                                activeTab === 'STAGES' ? 'bg-emerald-400' : 'bg-blue-400'
                                            }`} />
                                            {item.name}
                                        </div>
                                    </td>
                                    {activeTab === 'STAGES' && (
                                        <td className="px-8 py-5">
                                            <span className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-full font-black uppercase tracking-tight">
                                                {academicYears.find(ay => ay.id === item.academicYearId)?.name || 'Global'}
                                            </span>
                                        </td>
                                    )}
                                    <td className="px-8 py-5 text-right">
                                        <div className="flex items-center justify-end gap-2 text-slate-400">
                                            <button onClick={() => {
                                                setEditingItem(item);
                                                setFormData({ 
                                                    name: item.name, 
                                                    academicYearId: item.academicYearId || '' 
                                                });
                                                setIsModalOpen(true);
                                            }} className="p-2.5 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                                                <Edit2 size={18} />
                                            </button>
                                            <button onClick={() => handleDelete(item)} className="p-2.5 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Unified Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className={`p-8 border-b border-slate-50 ${
                            activeTab === 'STAGES' ? 'bg-emerald-50/50' : 'bg-blue-50/50'
                        }`}>
                            <h2 className="text-2xl font-black text-slate-900">
                                {editingItem ? 'Edit Data' : `Tambah ${tabs.find(t => t.id === activeTab).label}`}
                            </h2>
                            <p className="text-slate-500 text-sm font-medium mt-1">
                                Masukkan detail informasi {tabs.find(t => t.id === activeTab).label}
                            </p>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Nama {tabs.find(t => t.id === activeTab).label}</label>
                                <input 
                                    type="text" 
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:bg-white outline-none transition-all font-bold text-slate-900"
                                    placeholder="Contoh: BOS Reguler, Honor Guru, dll"
                                />
                            </div>

                            {activeTab === 'STAGES' && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Tahun Ajaran</label>
                                    <select 
                                        value={formData.academicYearId}
                                        onChange={(e) => setFormData({ ...formData, academicYearId: e.target.value })}
                                        className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:bg-white outline-none transition-all font-bold text-slate-900 appearance-none"
                                    >
                                        <option value="">Pilih Tahun Ajaran...</option>
                                        {academicYears.map(ay => <option key={ay.id} value={ay.id}>{ay.name}</option>)}
                                    </select>
                                </div>
                            )}

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
                                    className={`flex-1 px-6 py-4 text-white rounded-2xl font-bold transition-all shadow-lg active:scale-95 ${
                                        activeTab === 'STAGES' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100' :
                                        'bg-blue-600 hover:bg-blue-700 shadow-blue-100'
                                    }`}
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
