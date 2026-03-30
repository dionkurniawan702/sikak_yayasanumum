import React, { useState, useEffect } from 'react';
import { Building2, Plus, Edit2, Trash2, ChevronRight, LayoutGrid, Layers } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function FieldUnitManagement() {
    const { state, dispatch } = useApp();
    const [activeTab, setActiveTab] = useState('fields'); // 'fields' or 'units'
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({ name: '', fieldId: '' });

    // Dummy data for now if not in state
    const fields = state.fields || [];
    const units = state.units || [];

    const handleOpenModal = (item = null) => {
        if (item) {
            setEditingItem(item);
            setFormData({ name: item.name, fieldId: item.fieldId || '' });
        } else {
            setEditingItem(null);
            setFormData({ name: '', fieldId: activeTab === 'units' ? fields[0]?.id || '' : '' });
        }
        setShowModal(true);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const type = activeTab === 'fields' ? 'FIELD' : 'UNIT';
        const actionType = editingItem ? `EDIT_${type}` : `ADD_${type}`;
        
        dispatch({
            type: actionType,
            payload: editingItem ? { ...editingItem, ...formData } : { id: crypto.randomUUID(), ...formData }
        });
        
        setShowModal(false);
    };

    const handleDelete = (id) => {
        if (window.confirm('Hapus data ini?')) {
            const type = activeTab === 'fields' ? 'FIELD' : 'UNIT';
            dispatch({ type: `DELETE_${type}`, payload: id });
        }
    };

    return (
        <div className="p-8 animate-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-1">Struktur Yayasan</h1>
                    <p className="text-slate-500 font-medium">Manajemen Bidang dan Unit Pendidikan</p>
                </div>
                <button 
                    onClick={() => handleOpenModal()}
                    className="btn btn-primary shadow-blue-500/20"
                >
                    <Plus size={20} />
                    <span>Tambah {activeTab === 'fields' ? 'Bidang' : 'Unit'}</span>
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl w-fit mb-8">
                <button
                    onClick={() => setActiveTab('fields')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'fields' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <LayoutGrid size={18} />
                    <span>Daftar Bidang</span>
                </button>
                <button
                    onClick={() => setActiveTab('units')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'units' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Layers size={18} />
                    <span>Daftar Unit</span>
                </button>
            </div>

            {/* Content Table */}
            <div className="card overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100 font-display">
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nama {activeTab === 'fields' ? 'Bidang' : 'Unit'}</th>
                            {activeTab === 'units' && (
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Bidang Induk</th>
                            )}
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {activeTab === 'fields' ? (
                            fields.length > 0 ? fields.map(field => (
                                <tr key={field.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                                                {field.name.charAt(0)}
                                            </div>
                                            <span className="font-bold text-slate-700">{field.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleOpenModal(field)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"><Edit2 size={16} /></button>
                                            <button onClick={() => handleDelete(field.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"><Trash2 size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan="2" className="px-6 py-12 text-center text-slate-400 font-medium italic">Belum ada data bidang.</td></tr>
                            )
                        ) : (
                            units.length > 0 ? units.map(unit => (
                                <tr key={unit.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                                                {unit.name.charAt(0)}
                                            </div>
                                            <span className="font-bold text-slate-700">{unit.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">
                                            {fields.find(f => f.id === unit.fieldId)?.name || 'N/A'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleOpenModal(unit)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"><Edit2 size={16} /></button>
                                            <button onClick={() => handleDelete(unit.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"><Trash2 size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan="3" className="px-6 py-12 text-center text-slate-400 font-medium italic">Belum ada data unit.</td></tr>
                            )
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
                    <div className="bg-white rounded-[32px] w-full max-w-md relative z-10 shadow-2xl animate-in">
                        <div className="p-8">
                            <h2 className="text-2xl font-black text-slate-900 mb-6 font-display">
                                {editingItem ? 'Edit' : 'Tambah'} {activeTab === 'fields' ? 'Bidang' : 'Unit'}
                            </h2>
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div>
                                    <label className="form-label">Nama {activeTab === 'fields' ? 'Bidang' : 'Unit'}</label>
                                    <input
                                        type="text"
                                        required
                                        className="form-input"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder={`Contoh: ${activeTab === 'fields' ? 'Bidang SDM' : 'SDIT 1'}`}
                                    />
                                </div>
                                
                                {activeTab === 'units' && (
                                    <div>
                                        <label className="form-label">Bidang Induk</label>
                                        <select
                                            required
                                            className="form-select"
                                            value={formData.fieldId}
                                            onChange={e => setFormData({ ...formData, fieldId: e.target.value })}
                                        >
                                            <option value="">Pilih Bidang</option>
                                            {fields.map(f => (
                                                <option key={f.id} value={f.id}>{f.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div className="flex gap-3 pt-4">
                                    <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary flex-1">Batal</button>
                                    <button type="submit" className="btn btn-primary flex-1 shadow-blue-500/20">Simpan Data</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
