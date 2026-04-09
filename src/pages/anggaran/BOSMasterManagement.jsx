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

    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(false);

    // Modal State
    const [modalType, setModalType] = useState(null); // 'STAGE' | 'POS'
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({ name: '', academicYearId: '' });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const actionType = modalType === 'STAGE' 
                ? (editingItem ? 'EDIT_BOS_STAGE' : 'ADD_BOS_STAGE')
                : (editingItem ? 'EDIT_BOS_POS' : 'ADD_BOS_POS');
            
            const payload = {
                ...formData,
                id: editingItem ? editingItem.id : (modalType === 'STAGE' ? `BSTG-${generateId()}` : `BPOS-${generateId()}`)
            };

            // Remove academicYearId for POS as it's not in the DB schema
            if (modalType === 'POS') {
                delete payload.academicYearId;
            }

            dispatch({ type: actionType, payload });
            await api.pushAction({ type: actionType, payload }, state);
            
            setMessage({ type: 'success', text: 'Data berhasil disimpan' });
            setModalType(null);
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const handleDelete = async (type, id) => {
        if (!window.confirm('Hapus data ini?')) return;
        try {
            const actionType = type === 'STAGE' ? 'DELETE_BOS_STAGE' : 'DELETE_BOS_POS';
            dispatch({ type: actionType, payload: id });
            await api.pushAction({ type: actionType, payload: id }, state);
            setMessage({ type: 'success', text: 'Data berhasil dihapus' });
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        }
    };

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

            {/* Alert Message */}
            {message && (
                <div className={`p-4 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top duration-300 ${
                    message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                }`}>
                    {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                    <p className="font-bold text-sm">{message.text}</p>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* BOS Stages Section */}
                <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                    <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                        <div className="flex items-center gap-3">
                            <Calendar className="text-emerald-600" size={20} />
                            <h2 className="text-xl font-black text-slate-900 tracking-tight">Tahap BOS</h2>
                        </div>
                        <button 
                            onClick={() => {
                                setModalType('STAGE');
                                setEditingItem(null);
                                setFormData({ name: '', academicYearId: '' });
                            }}
                            className="p-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-md active:scale-95"
                        >
                            <Plus size={20} />
                        </button>
                    </div>
                    <div className="p-4 overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                                    <th className="p-4">Nama Tahap</th>
                                    <th className="p-4">Tahun Ajaran</th>
                                    <th className="p-4 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 font-bold text-sm text-slate-700">
                                {bosStages.filter(s => !s.isDeleted).map(stage => (
                                    <tr key={stage.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4">{stage.name}</td>
                                        <td className="p-4">
                                            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-lg">
                                                {academicYears.find(ay => ay.id === stage.academicYearId)?.name || 'Global'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => {
                                                    setModalType('STAGE');
                                                    setEditingItem(stage);
                                                    setFormData({ name: stage.name, academicYearId: stage.academicYearId || '' });
                                                }} className="p-2 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-all">
                                                    <Edit2 size={16} />
                                                </button>
                                                <button onClick={() => handleDelete('STAGE', stage.id)} className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-all">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* BOS POS Section */}
                <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                    <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                        <div className="flex items-center gap-3">
                            <Box className="text-blue-600" size={20} />
                            <h2 className="text-xl font-black text-slate-900 tracking-tight">POS Anggaran BOS</h2>
                        </div>
                        <button 
                            onClick={() => {
                                setModalType('POS');
                                setEditingItem(null);
                                setFormData({ name: '', academicYearId: '' });
                            }}
                            className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-md active:scale-95"
                        >
                            <Plus size={20} />
                        </button>
                    </div>
                    <div className="p-4 overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                                    <th className="p-4">Nama POS</th>
                                    <th className="p-4 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 font-bold text-sm text-slate-700">
                                {bosPosList.filter(p => !p.isDeleted).map(pos => (
                                    <tr key={pos.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4">{pos.name}</td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => {
                                                    setModalType('POS');
                                                    setEditingItem(pos);
                                                    setFormData({ name: pos.name, academicYearId: '' });
                                                }} className="p-2 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-all">
                                                    <Edit2 size={16} />
                                                </button>
                                                <button onClick={() => handleDelete('POS', pos.id)} className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-all">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {modalType && (
                <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className={`p-8 border-b border-slate-100 ${modalType === 'STAGE' ? 'bg-emerald-50/50' : 'bg-blue-50/50'}`}>
                            <h2 className="text-2xl font-black text-slate-900">
                                {editingItem ? 'Edit Data' : (modalType === 'STAGE' ? 'Tambah Tahap' : 'Tambah POS')}
                            </h2>
                            <p className="text-slate-500 text-sm font-medium mt-1">
                                Masukkan detail informasi {modalType === 'STAGE' ? 'Tahap BOS' : 'POS Anggaran'}
                            </p>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Nama {modalType === 'STAGE' ? 'Tahap' : 'POS'}</label>
                                <input 
                                    type="text" 
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:bg-white outline-none transition-all font-bold text-slate-900"
                                    placeholder={modalType === 'STAGE' ? 'Contoh: BOS THP 1 2025' : 'Contoh: Barang dan Jasa'}
                                />
                            </div>

                            {modalType === 'STAGE' && (
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
                                    onClick={() => setModalType(null)}
                                    className="flex-1 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold transition-all active:scale-95"
                                >
                                    Batal
                                </button>
                                <button 
                                    type="submit"
                                    disabled={loading}
                                    className={`flex-1 px-6 py-4 text-white rounded-2xl font-bold transition-all shadow-lg active:scale-95 ${modalType === 'STAGE' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-100'}`}
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
