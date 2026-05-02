import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { 
    Plus, Search, Edit2, Trash2, Building2, 
    ChevronRight, AlertCircle, CheckCircle2, Users,
    Download, Upload, X
} from 'lucide-react';
import { generateId } from '../../utils/format';
import * as XLSX from 'xlsx';

export default function ClassManagement() {
    const { state, dispatch } = useApp();
    const { currentUser, classes = [], units = [] } = state;
    const isUnitAdmin = currentUser?.role === 'admin_unit';

    const [searchTerm, setSearchTerm] = useState('');
    const [unitFilter, setUnitFilter] = useState(isUnitAdmin ? currentUser.unitId : 'all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({ name: '', unitId: isUnitAdmin ? currentUser.unitId : '' });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        if (!formData.unitId && units.length > 0) {
            setFormData(prev => ({ ...prev, unitId: isUnitAdmin ? currentUser.unitId : units[0].id }));
        }
    }, [units]);

    const filteredItems = classes.filter(item => {
        if (isUnitAdmin && item.unitId !== currentUser.unitId) return false;
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesUnit = unitFilter === 'all' || item.unitId === unitFilter;
        return matchesSearch && matchesUnit && !item.isDeleted;
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            if (editingItem) {
                const updatedItem = { ...editingItem, ...formData };
                dispatch({ type: 'EDIT_CLASS', payload: updatedItem });
                await api.pushAction({ type: 'EDIT_CLASS', payload: updatedItem }, state);
                setMessage({ type: 'success', text: 'Kelas berhasil diperbarui' });
            } else {
                const newItem = {
                    id: `CLS-${generateId()}`,
                    ...formData
                };
                dispatch({ type: 'ADD_CLASS', payload: newItem });
                await api.pushAction({ type: 'ADD_CLASS', payload: newItem }, state);
                setMessage({ type: 'success', text: 'Kelas baru berhasil ditambahkan' });
            }
            setIsModalOpen(false);
            setEditingItem(null);
            setFormData({ name: '', unitId: isUnitAdmin ? currentUser.unitId : (units[0]?.id || '') });
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Hapus kelas ini?')) return;
        try {
            dispatch({ type: 'DELETE_CLASS', payload: id });
            await api.pushAction({ type: 'DELETE_CLASS', payload: id }, state);
            setMessage({ type: 'success', text: 'Kelas berhasil dihapus' });
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        }
    };

    const handleExport = () => {
        const exportData = filteredItems.map(item => ({
            'Nama Kelas': item.name,
            'Unit': units.find(u => u.id === item.unitId)?.name || ''
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Database Kelas");
        XLSX.writeFile(wb, `Database_Kelas_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleDownloadTemplate = () => {
        const template = [
            {
                'Nama Kelas': '7-A',
                'Unit': units.find(u => isUnitAdmin ? u.id === currentUser.unitId : true)?.name || 'Nama Unit'
            }
        ];

        const ws = XLSX.utils.json_to_sheet(template);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template Import Kelas");
        XLSX.writeFile(wb, "Template_Import_Kelas.xlsx");
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                if (data.length === 0) {
                    window.alert('File kosong atau format tidak sesuai.');
                    return;
                }

                if (!window.confirm(`Import ${data.length} data kelas?`)) return;

                let successCount = 0;
                let errorCount = 0;

                for (const item of data) {
                    try {
                        let unitId = isUnitAdmin ? currentUser.unitId : null;
                        if (!isUnitAdmin) {
                            const unit = units.find(u => u.name.toLowerCase() === item.Unit?.toString().toLowerCase());
                            unitId = unit?.id || units[0]?.id;
                        }

                        if (!item['Nama Kelas']) continue;

                        const newItem = {
                            id: `CLS-${generateId()}`,
                            name: item['Nama Kelas'].toString(),
                            unitId: unitId
                        };

                        dispatch({ type: 'ADD_CLASS', payload: newItem });
                        await api.pushAction({ type: 'ADD_CLASS', payload: newItem }, state);
                        successCount++;
                    } catch (err) {
                        console.error('Import Error:', err);
                        errorCount++;
                    }
                }

                window.alert(`Import Selesai!\nBerhasil: ${successCount}\nGagal: ${errorCount}`);
                setShowImportModal(false);
            } catch (err) {
                window.alert('Gagal membaca file: ' + err.message);
            }
        };
        reader.readAsBinaryString(file);
    };

    return (
        <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200">
                            <Users size={28} />
                        </div>
                        Database Kelas
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium italic">Kelola daftar kelas spesifik untuk setiap unit pendidikan</p>
                </div>
                
                <div className="flex items-center gap-3">
                    <button 
                        onClick={handleExport}
                        className="budget-export-btn !py-3.5"
                        disabled={filteredItems.length === 0}
                    >
                        <Download size={20} />
                        <span>Export</span>
                    </button>
                    <button 
                        onClick={() => setShowImportModal(true)}
                        className="flex items-center gap-2 px-6 py-3.5 rounded-2xl font-bold bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300 hover:shadow-lg transition-all active:scale-95"
                    >
                        <Upload size={20} />
                        <span>Import Masal</span>
                    </button>
                    <button 
                        onClick={() => {
                            setEditingItem(null);
                            setFormData({ name: '', unitId: isUnitAdmin ? currentUser.unitId : (units[0]?.id || '') });
                            setIsModalOpen(true);
                        }}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3.5 rounded-2xl font-bold transition-all shadow-lg shadow-indigo-200 active:scale-95"
                    >
                        <Plus size={20} />
                        Tambah Kelas
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
                            placeholder="Cari nama kelas..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-6 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-medium"
                        />
                    </div>
                    <div className="w-full lg:w-64">
                        <select 
                            value={unitFilter}
                            onChange={(e) => setUnitFilter(e.target.value)}
                            disabled={isUnitAdmin}
                            className={`w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-medium ${isUnitAdmin ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''}`}
                        >
                            <option value="all">Semua Unit</option>
                            {units.map(u => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="px-8 py-5 text-sm font-bold text-slate-500 uppercase tracking-wider">Nama Kelas</th>
                                <th className="px-8 py-5 text-sm font-bold text-slate-500 uppercase tracking-wider">Unit Pendidikan</th>
                                <th className="px-8 py-5 text-sm font-bold text-slate-500 uppercase tracking-wider text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-slate-600 font-medium text-sm">
                            {filteredItems.map((item) => (
                                <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors group">
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-indigo-400 opacity-40 group-hover:opacity-100 transition-opacity" />
                                            <span className="text-slate-900 font-bold group-hover:text-indigo-600 transition-colors">{item.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className="flex items-center gap-2 text-slate-500">
                                            <Building2 size={14} />
                                            {units.find(u => u.id === item.unitId)?.name || 'Unit Tidak Ditemukan'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex items-center justify-end gap-2">
                                            <button 
                                                onClick={() => {
                                                    setEditingItem(item);
                                                    setFormData({ name: item.name, unitId: item.unitId });
                                                    setIsModalOpen(true);
                                                }}
                                                className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
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
                                        Tidak ada data kelas yang ditemukan
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-6 bg-slate-50/30 border-t border-slate-50 flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-widest">
                    <span>Total: {filteredItems.length} Kelas</span>
                    <span className="flex items-center gap-1 opacity-40 cursor-default">
                        SIKAD DARELIMAN <ChevronRight size={12} /> Database Kelas
                    </span>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-slate-50">
                            <h2 className="text-2xl font-black text-slate-900">
                                {editingItem ? 'Edit Kelas' : 'Tambah Kelas Baru'}
                            </h2>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Nama Kelas</label>
                                <input 
                                    type="text" 
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:bg-white outline-none transition-all font-bold text-slate-900"
                                    placeholder="Contoh: 7-A, 10-IPA-1..."
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Unit Pendidikan</label>
                                <select 
                                    required
                                    value={formData.unitId}
                                    onChange={(e) => setFormData({ ...formData, unitId: e.target.value })}
                                    disabled={isUnitAdmin}
                                    className={`w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:bg-white outline-none transition-all font-bold text-slate-900 ${isUnitAdmin ? 'opacity-50 cursor-not-allowed cursor-not-allowed' : ''}`}
                                >
                                    {units.map(u => (
                                        <option key={u.id} value={u.id}>{u.name}</option>
                                    ))}
                                </select>
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
                                    className="flex-1 px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-200 active:scale-95 disabled:opacity-50"
                                >
                                    {loading ? 'Menyimpan...' : 'Simpan Data'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Import Modal */}
            {showImportModal && (
                <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900">Import Masal Kelas</h2>
                                <p className="text-slate-500 text-sm font-medium">Gunakan file Excel untuk mengimpor banyak kelas sekaligus</p>
                            </div>
                            <button onClick={() => setShowImportModal(false)} className="p-3 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-2xl transition-all">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-8">
                            <div className="mb-8 p-10 border-4 border-dashed border-slate-100 rounded-[32px] flex flex-col items-center justify-center text-center hover:border-indigo-200 transition-all group">
                                <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <Upload size={32} />
                                </div>
                                <button 
                                    onClick={handleDownloadTemplate}
                                    className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-6 hover:underline"
                                >
                                    Unduh Template Excel
                                </button>
                                <label className="cursor-pointer">
                                    <span className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3.5 rounded-2xl font-bold transition-all shadow-lg shadow-indigo-200 block">Pilih File XLSX</span>
                                    <input type="file" className="hidden" accept=".xlsx" onChange={handleFileUpload} />
                                </label>
                            </div>

                            <button onClick={() => setShowImportModal(false)} className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold transition-all">
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
