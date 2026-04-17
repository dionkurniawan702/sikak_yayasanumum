import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { 
    Plus, Search, Edit2, Trash2, Database, ChevronRight, 
    Filter, AlertCircle, CheckCircle2, Landmark, Box, Calendar, Wallet
} from 'lucide-react';
import { generateId, formatRupiah } from '../../utils/format';

export default function BOSDatabase() {
    const { state, dispatch } = useApp();
    const { 
        bosAllocations = [], 
        bosStages = [], 
        bosPosList = [], 
        units = [], 
        academicYears = [],
        currentUser
    } = state;

    const isSuperAdmin = currentUser?.role === 'superadmin';

    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({ 
        academicYearId: '', 
        stageId: '', 
        posId: '', 
        unitId: '', 
        amount: '' 
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    // Filter units that are BOS recipients
    const bosUnits = useMemo(() => {
        let list = units.filter(u => u.receivesBos && !u.isDeleted);
        if (!isSuperAdmin && currentUser?.unitId) {
            list = list.filter(u => u.id === currentUser.unitId);
        }
        return list;
    }, [units, isSuperAdmin, currentUser]);

    const filteredAllocations = useMemo(() => {
        return (bosAllocations || []).filter(item => {
            if (item.isDeleted) return false;
            
            // Role-based data visibility
            if (!isSuperAdmin && currentUser?.unitId && item.unitId !== currentUser.unitId) {
                return false;
            }

            const unit = units.find(u => u.id === item.unitId);
            const stage = bosStages.find(s => s.id === item.stageId);
            const pos = bosPosList.find(p => p.id === item.posId);
            
            const searchStr = `${unit?.name} ${stage?.name} ${pos?.name}`.toLowerCase();
            return searchStr.includes(searchTerm.toLowerCase());
        });
    }, [bosAllocations, units, bosStages, bosPosList, searchTerm, isSuperAdmin, currentUser]);

    const totalAllocated = useMemo(() => {
        return filteredAllocations.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    }, [filteredAllocations]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            const payload = {
                ...formData,
                amount: parseFloat(formData.amount) || 0,
                id: editingItem ? editingItem.id : `BALL-${generateId()}`
            };

            const actionType = editingItem ? 'EDIT_BOS_ALLOCATION' : 'ADD_BOS_ALLOCATION';
            
            dispatch({ type: actionType, payload });
            await api.pushAction({ type: actionType, payload }, state);
            
            setMessage({ type: 'success', text: 'Data alokasi BOS berhasil disimpan' });
            setIsModalOpen(false);
            setEditingItem(null);
            setFormData({ academicYearId: '', stageId: '', posId: '', unitId: '', amount: '' });
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Hapus records alokasi BOS ini?')) return;
        try {
            dispatch({ type: 'DELETE_BOS_ALLOCATION', payload: id });
            await api.pushAction({ type: 'DELETE_BOS_ALLOCATION', payload: id }, state);
            setMessage({ type: 'success', text: 'Data alokasi berhasil dihapus' });
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
                        <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-200">
                            <Database size={28} />
                        </div>
                        Database Alokasi BOS
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">Catat dan kelola alokasi dana BOS per unit pendidikan</p>
                </div>
                
                <button 
                    onClick={() => {
                        setEditingItem(null);
                        setFormData({ 
                            academicYearId: academicYears.find(ay => ay.isCurrent)?.id || '', 
                            stageId: '', 
                            posId: '', 
                            unitId: isSuperAdmin ? '' : (currentUser?.unitId || ''), 
                            amount: '' 
                        });
                        setIsModalOpen(true);
                    }}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3.5 rounded-2xl font-bold transition-all shadow-lg shadow-blue-200 active:scale-95"
                >
                    <Plus size={20} />
                    Input Alokasi Baru
                </button>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 flex items-center gap-5">
                    <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner">
                        <Wallet size={28} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Terdistribusi</p>
                        <p className="text-2xl font-black text-slate-900">{formatRupiah(totalAllocated)}</p>
                    </div>
                </div>
                {isSuperAdmin && (
                    <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 flex items-center gap-5 transition-all hover:scale-[1.02]">
                        <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner">
                            <Landmark size={28} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit Penerima</p>
                            <p className="text-2xl font-black text-slate-900">{bosUnits.length} Sekolah</p>
                        </div>
                    </div>
                )}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 flex items-center gap-5">
                    <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
                        <Calendar size={28} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tahun Ajaran Aktif</p>
                        <p className="text-2xl font-black text-slate-900">{academicYears.find(ay => ay.isCurrent)?.name || '-'}</p>
                    </div>
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

            {/* main Table */}
            <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex flex-col md:flex-row md:items-center gap-6">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                        <input 
                            type="text" 
                            placeholder="Cari berdasarkan Unit, Tahap, atau POS..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-14 pr-8 py-5 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-slate-900 shadow-sm"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tahun Ajaran</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit Penerima</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tahap BOS</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">POS Anggaran</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Jumlah Alokasi</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredAllocations.map((item) => {
                                const unit = units.find(u => u.id === item.unitId);
                                const stage = bosStages.find(s => s.id === item.stageId);
                                const pos = bosPosList.find(p => p.id === item.posId);
                                const ay = academicYears.find(a => a.id === item.academicYearId);
                                
                                return (
                                    <tr key={item.id} className="hover:bg-blue-50/30 transition-colors group">
                                        <td className="px-8 py-5">
                                            <span className="text-xs font-black text-slate-500 bg-slate-100 px-3 py-1 rounded-full uppercase">
                                                {ay?.name}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center font-black text-xs">
                                                    {unit?.name?.charAt(0)}
                                                </div>
                                                <span className="font-bold text-slate-800">{unit?.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className="font-bold text-slate-700">{stage?.name}</span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-2">
                                                <Box size={14} className="text-slate-300" />
                                                <span className="text-sm font-medium text-slate-600">{pos?.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <span className="font-black text-slate-900">{formatRupiah(item.amount)}</span>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => {
                                                        setEditingItem(item);
                                                        setFormData({ 
                                                            academicYearId: item.academicYearId, 
                                                            stageId: item.stageId, 
                                                            posId: item.posId, 
                                                            unitId: item.unitId, 
                                                            amount: item.amount.toString() 
                                                        });
                                                        setIsModalOpen(true);
                                                    }}
                                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                                >
                                                    <Edit2 size={18} />
                                                </button>
                                                <button onClick={() => handleDelete(item.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredAllocations.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="px-8 py-20 text-center text-slate-400 font-bold italic">
                                        Data alokasi dana tidak ditemukan.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-10 border-b border-slate-50 bg-blue-50/30">
                            <h2 className="text-2xl font-black text-slate-900">
                                {editingItem ? 'Edit Alokasi' : 'Pencatatan Alokasi Dana'}
                            </h2>
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1">
                                Masukkan detail alokasi dana BOS per unit pendidikan
                            </p>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="p-10 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tahun Ajaran</label>
                                    <select 
                                        required
                                        value={formData.academicYearId}
                                        onChange={(e) => setFormData({ ...formData, academicYearId: e.target.value })}
                                        className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:bg-white outline-none transition-all font-bold text-slate-900 appearance-none"
                                    >
                                        <option value="">Pilih...</option>
                                        {academicYears.map(ay => <option key={ay.id} value={ay.id}>{ay.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tahap BOS</label>
                                    <select 
                                        required
                                        value={formData.stageId}
                                        onChange={(e) => setFormData({ ...formData, stageId: e.target.value })}
                                        className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:bg-white outline-none transition-all font-bold text-slate-900 appearance-none"
                                    >
                                        <option value="">Pilih...</option>
                                        {/* Show only stages for selected academic year or all if none selected */}
                                        {bosStages.filter(s => !formData.academicYearId || s.academicYearId === formData.academicYearId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            {isSuperAdmin && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Unit Penerima</label>
                                    <select 
                                        required
                                        value={formData.unitId}
                                        onChange={(e) => setFormData({ ...formData, unitId: e.target.value })}
                                        className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:bg-white outline-none transition-all font-bold text-slate-900 appearance-none"
                                    >
                                        <option value="">Pilih Unit Sekolah...</option>
                                        {bosUnits.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                    </select>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">POS Anggaran</label>
                                <select 
                                    required
                                    value={formData.posId}
                                    onChange={(e) => setFormData({ ...formData, posId: e.target.value })}
                                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:bg-white outline-none transition-all font-bold text-slate-900 appearance-none"
                                >
                                    <option value="">Pilih POS Anggaran...</option>
                                    {bosPosList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nilai Dana (Rp)</label>
                                <div className="relative">
                                    <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-slate-400">Rp</span>
                                    <input 
                                        type="text" 
                                        required
                                        value={formData.amount ? parseInt(formData.amount).toLocaleString('id-ID') : ''}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, '');
                                            setFormData({ ...formData, amount: val });
                                        }}
                                        className="w-full pl-14 pr-8 py-5 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:bg-white outline-none transition-all font-black text-slate-900"
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4 pt-6">
                                <button 
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-8 py-5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all active:scale-95"
                                >
                                    Batal
                                </button>
                                <button 
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 px-8 py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-xl shadow-blue-200 active:scale-95"
                                >
                                    {loading ? 'Menyimpan...' : 'Simpan Alokasi'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
