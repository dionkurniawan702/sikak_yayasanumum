import React, { useState, useEffect } from 'react';
import { Building2, Plus, Edit2, Trash2, ChevronRight, LayoutGrid, Layers, Share2, Percent, CheckCircle2, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function FieldUnitManagement() {
    const { state, dispatch } = useApp();
    const { fields = [], units = [], incomeItems = [], expenseItems = [], distributionSettings = [] } = state;

    const [activeTab, setActiveTab] = useState('fields'); // 'fields' or 'units'
    const [showModal, setShowModal] = useState(false);
    const [modalTab, setModalTab] = useState('info'); // 'info' or 'finance'
    
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({ name: '', fieldId: '' });
    
    // Financial Configuration State
    const [selectedIncomeItems, setSelectedIncomeItems] = useState([]); // List of income item IDs
    const [unitDistributions, setUnitDistributions] = useState({}); // { incomeItemId: [rules] }
    const [isSaved, setIsSaved] = useState(false);

    const handleOpenModal = (item = null) => {
        if (item) {
            setEditingItem(item);
            setFormData({ name: item.name, fieldId: item.fieldId || '' });
            
            if (activeTab === 'units') {
                // Load existing distribution settings for this unit
                const unitSettings = distributionSettings.filter(s => s.unitId === item.id);
                const uniqueIncomeItemIds = [...new Set(unitSettings.map(s => s.incomeItemId))];
                setSelectedIncomeItems(uniqueIncomeItemIds);
                
                const distMap = {};
                uniqueIncomeItemIds.forEach(id => {
                    distMap[id] = unitSettings.filter(s => s.incomeItemId === id);
                });
                setUnitDistributions(distMap);
            }
        } else {
            setEditingItem(null);
            setFormData({ name: '', fieldId: activeTab === 'units' ? fields[0]?.id || '' : '' });
            setSelectedIncomeItems([]);
            setUnitDistributions({});
        }
        setModalTab('info');
        setShowModal(true);
    };

    const toggleIncomeItem = (id) => {
        if (selectedIncomeItems.includes(id)) {
            setSelectedIncomeItems(prev => prev.filter(item => item !== id));
            const { [id]: removed, ...rest } = unitDistributions;
            setUnitDistributions(rest);
        } else {
            setSelectedIncomeItems(prev => [...prev, id]);
            
            const incomeName = incomeItems.find(i => i.id === id)?.name || '';
            const matchingExpense = expenseItems.find(e => 
                e.name.toLowerCase() === incomeName.toLowerCase() || 
                (e.sourceOfFunds && e.sourceOfFunds.toLowerCase() === incomeName.toLowerCase())
            );

            setUnitDistributions(prev => ({
                ...prev,
                [id]: [
                    { 
                        id: crypto.randomUUID(), 
                        destType: 'unit', 
                        destId: '', 
                        expenseItemId: matchingExpense ? matchingExpense.id : '', 
                        percentage: 100 
                    }
                ]
            }));
        }
    };

    const updateDistributionRule = (incomeId, ruleId, updates) => {
        setUnitDistributions(prev => ({
            ...prev,
            [incomeId]: prev[incomeId].map(r => r.id === ruleId ? { ...r, ...updates } : r)
        }));
    };

    const addDistributionRule = (incomeId) => {
        setUnitDistributions(prev => ({
            ...prev,
            [incomeId]: [
                ...prev[incomeId],
                { 
                    id: crypto.randomUUID(), 
                    destType: 'field', 
                    destId: formData.fieldId, 
                    expenseItemId: expenseItems.find(ex => ex.fieldId === formData.fieldId)?.id || '', 
                    percentage: 0 
                }
            ]
        }));
    };

    const removeDistributionRule = (incomeId, ruleId) => {
        setUnitDistributions(prev => ({
            ...prev,
            [incomeId]: prev[incomeId].filter(r => r.id !== ruleId)
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const type = activeTab === 'fields' ? 'FIELD' : 'UNIT';
        const id = editingItem ? editingItem.id : crypto.randomUUID();
        
        // 1. Dispatch Main Data (Field / Unit)
        dispatch({
            type: editingItem ? `EDIT_${type}` : `ADD_${type}`,
            payload: { id, ...formData }
        });

        // 2. Dispatch Financial Config if Unit
        if (type === 'UNIT') {
            // Flatten all rules into distributionSettings format
            selectedIncomeItems.forEach(incomeId => {
                const settings = unitDistributions[incomeId].map(rule => ({
                    ...rule,
                    unitId: id,
                    incomeItemId: incomeId,
                    // If destType is field, allow specific destId, defaulting to parent field
                    destId: rule.destType === 'field' ? (rule.destId || formData.fieldId) : id,
                    expenseItemId: rule.expenseItemId
                }));

                dispatch({
                    type: 'UPDATE_DISTRIBUTION_SETTINGS',
                    payload: {
                        unitId: id,
                        incomeItemId: incomeId,
                        settings: settings
                    }
                });
            });
        }
        
        if (!editingItem) {
            setEditingItem({ id, ...formData });
        }
        
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
    };

    const handleDelete = (id) => {
        if (window.confirm('Hapus data ini?')) {
            const type = activeTab === 'fields' ? 'FIELD' : 'UNIT';
            dispatch({ type: `DELETE_${type}`, payload: id });
        }
    };

    const calculateTotal = (incomeId) => {
        return (unitDistributions[incomeId] || []).reduce((sum, r) => sum + (parseFloat(r.percentage) || 0), 0);
    };

    return (
        <div className="p-8 animate-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-1">Struktur Yayasan</h1>
                    <p className="text-slate-500 font-medium">Manajemen Bidang dan Unit Pendidikan</p>
                </div>
                <button 
                    onClick={() => handleOpenModal()}
                    className="btn btn-primary shadow-blue-500/25 !rounded-2xl"
                >
                    <Plus size={20} />
                    <span>Tambah {activeTab === 'fields' ? 'Bidang' : 'Unit'}</span>
                </button>
            </div>

            {/* Tabs Main */}
            <div className="flex gap-2 p-1.5 bg-slate-100 rounded-[24px] w-fit mb-8 border border-slate-200">
                <button
                    onClick={() => setActiveTab('fields')}
                    className={`flex items-center gap-2 px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'fields' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <LayoutGrid size={16} />
                    <span>Daftar Bidang</span>
                </button>
                <button
                    onClick={() => setActiveTab('units')}
                    className={`flex items-center gap-2 px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'units' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Layers size={16} />
                    <span>Daftar Unit</span>
                </button>
            </div>

            {/* Content Table */}
            <div className="card shadow-xl overflow-hidden border-none rounded-[32px]">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100 font-display">
                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Nama {activeTab === 'fields' ? 'Bidang' : 'Unit'}</th>
                            {activeTab === 'units' && (
                                <>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Bidang Induk</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Konfigurasi Dana</th>
                                </>
                            )}
                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {activeTab === 'fields' ? (
                            fields.length > 0 ? fields.map(field => (
                                <tr key={field.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 flex items-center justify-center font-black text-lg border border-blue-100 shadow-sm">
                                                {field.name.charAt(0)}
                                            </div>
                                            <span className="font-black text-slate-800 text-lg tracking-tight">{field.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                            <button onClick={() => handleOpenModal(field)} className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all shadow-sm hover:shadow-md"><Edit2 size={18} /></button>
                                            <button onClick={() => handleDelete(field.id)} className="p-3 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all shadow-sm hover:shadow-md"><Trash2 size={18} /></button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan="2" className="px-8 py-16 text-center text-slate-400 font-bold italic text-lg bg-slate-50/30">Belum ada data bidang.</td></tr>
                            )
                        ) : (
                            units.length > 0 ? units.map(unit => {
                                const unitSettings = distributionSettings.filter(s => s.unitId === unit.id);
                                const configuredItems = [...new Set(unitSettings.map(s => s.incomeItemId))].length;

                                return (
                                    <tr key={unit.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 text-indigo-600 flex items-center justify-center font-black text-lg border border-indigo-100 shadow-sm">
                                                    {unit.name.charAt(0)}
                                                </div>
                                                <span className="font-black text-slate-800 text-lg tracking-tight">{unit.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className="px-4 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm">
                                                {fields.find(f => f.id === unit.fieldId)?.name || 'N/A'}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className={`flex items-center gap-2 font-bold text-xs ${configuredItems > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                {configuredItems > 0 ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                                                <span>{configuredItems} Item Penerimaan</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                                <button 
                                                    onClick={() => handleOpenModal(unit)} 
                                                    className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all shadow-sm hover:shadow-md flex items-center gap-2"
                                                    title="Edit Unit & Konfigurasi Dana"
                                                >
                                                    <Edit2 size={18} />
                                                </button>
                                                <button onClick={() => handleDelete(unit.id)} className="p-3 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all shadow-sm hover:shadow-md"><Trash2 size={18} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr><td colSpan="4" className="px-8 py-16 text-center text-slate-400 font-bold italic text-lg bg-slate-50/30">Belum ada data unit.</td></tr>
                            )
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setShowModal(false)} />
                    <div className="bg-white rounded-[48px] w-full max-w-4xl max-h-[90vh] overflow-hidden relative z-10 shadow-2xl animate-in scale-in">
                        <div className="flex flex-col h-full">
                            {/* Modal Header */}
                            <div className="p-10 pb-6 border-b border-slate-100">
                                <h2 className="text-3xl font-black text-slate-900 mb-8 font-display tracking-tight flex items-center gap-3">
                                    <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center">
                                        {editingItem ? <Edit2 size={24} /> : <Plus size={24} />}
                                    </div>
                                    {editingItem ? 'Edit' : 'Tambah'} {activeTab === 'fields' ? 'Bidang' : 'Unit'}
                                </h2>

                                {activeTab === 'units' && (
                                    <div className="flex gap-2 p-1.5 bg-slate-50 rounded-[20px] w-fit border border-slate-200">
                                        <button 
                                            onClick={() => setModalTab('info')}
                                            className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${modalTab === 'info' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            Informasi Umum
                                        </button>
                                        <button 
                                            onClick={() => setModalTab('finance')}
                                            className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${modalTab === 'finance' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            Konfigurasi Dana & Distribusi
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Modal Body */}
                            <div className="p-10 pt-6 overflow-y-auto max-h-[calc(90vh-300px)]">
                                <form id="unit-form" onSubmit={handleSubmit} className="space-y-8">
                                    {modalTab === 'info' ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-right-4">
                                            <div>
                                                <label className="form-label mb-3 ml-1">Nama {activeTab === 'fields' ? 'Bidang' : 'Unit'}</label>
                                                <input
                                                    type="text"
                                                    required
                                                    className="form-input !rounded-[24px] !py-4 font-bold text-lg"
                                                    value={formData.name}
                                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                    placeholder={`Contoh: ${activeTab === 'fields' ? 'Bidang SDM' : 'SDIT 1'}`}
                                                />
                                            </div>
                                            
                                            {activeTab === 'units' && (
                                                <div>
                                                    <label className="form-label mb-3 ml-1">Bidang Induk</label>
                                                    <select
                                                        required
                                                        className="form-select !rounded-[24px] !py-4 font-bold text-lg"
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
                                        </div>
                                    ) : (
                                        <div className="space-y-10 animate-in slide-in-from-left-4">
                                            {/* Step 1: Item Selection */}
                                            <div>
                                                <div className="flex items-center gap-3 mb-6">
                                                    <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center font-black text-sm">1</div>
                                                    <h3 className="text-xl font-black text-slate-800 tracking-tight">Pilih Item Penerimaan</h3>
                                                </div>
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                    {incomeItems.map(item => (
                                                        <button 
                                                            key={item.id}
                                                            type="button"
                                                            onClick={() => toggleIncomeItem(item.id)}
                                                            className={`p-4 rounded-3xl border-2 text-left transition-all ${selectedIncomeItems.includes(item.id) 
                                                                ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' 
                                                                : 'border-slate-100 hover:border-slate-300 text-slate-500'}`}
                                                        >
                                                            <div className="font-black text-xs uppercase tracking-wider mb-1 line-clamp-1">{item.name}</div>
                                                            <div className="flex justify-end mt-1">
                                                                {selectedIncomeItems.includes(item.id) ? <CheckCircle2 size={16} /> : <div className="w-4 h-4 rounded-full border-2 border-slate-200" />}
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Step 2: Distribution Config */}
                                            {selectedIncomeItems.length > 0 && (
                                                <div className="space-y-8">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center font-black text-sm">2</div>
                                                        <h3 className="text-xl font-black text-slate-800 tracking-tight">Aturan Pembagian Dana</h3>
                                                    </div>

                                                    <div className="space-y-6">
                                                        {selectedIncomeItems.map(incomeId => {
                                                            const item = incomeItems.find(i => i.id === incomeId);
                                                            const total = calculateTotal(incomeId);
                                                            
                                                            return (
                                                                <div key={incomeId} className="p-8 bg-slate-50 border border-slate-100 rounded-[40px] space-y-6">
                                                                    <div className="flex items-center justify-between">
                                                                        <div className="flex items-center gap-3">
                                                                            <Share2 className="text-blue-500" size={20} />
                                                                            <span className="font-black text-slate-800 text-lg">{item?.name}</span>
                                                                        </div>
                                                                        <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${total === 100 ? 'bg-emerald-500 text-white' : 'bg-rose-100 text-rose-600 border border-rose-200'}`}>
                                                                            Total: {total}% {total !== 100 && '(Harus 100%)'}
                                                                        </div>
                                                                    </div>

                                                                    <div className="space-y-4">
                                                                        {(unitDistributions[incomeId] || []).map((rule, idx) => (
                                                                            <div key={rule.id} className="flex flex-col md:flex-row gap-4 p-5 bg-white border border-slate-100 rounded-[28px] relative group hover:border-blue-200 transition-all shadow-sm">
                                                                                {/* Target Type */}
                                                                                <div className="flex-1">
                                                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Tujuan</label>
                                                                                    <div className="flex gap-2 p-1 bg-slate-50 border border-slate-100 rounded-xl">
                                                                                        <button 
                                                                                            type="button"
                                                                                            onClick={() => updateDistributionRule(incomeId, rule.id, { destType: 'unit' })}
                                                                                            className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${rule.destType === 'unit' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                                                        >Unit</button>
                                                                                        <button 
                                                                                            type="button"
                                                                                            onClick={() => updateDistributionRule(incomeId, rule.id, { destType: 'field' })}
                                                                                            className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${rule.destType === 'field' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                                                        >Bidang</button>
                                                                                    </div>
                                                                                </div>

                                                                                {/* Expense Item (Only for Unit) */}
                                                                                <div className="flex-[2]">
                                                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">
                                                                                        {rule.destType === 'unit' ? 'Pos Pengeluaran Unit' : 'Alokasi & Pos Pengeluaran Bidang'}
                                                                                    </label>
                                                                                    {rule.destType === 'unit' ? (
                                                                                        <select 
                                                                                            required
                                                                                            className="form-select w-full !py-2.5 !text-sm !rounded-xl"
                                                                                            value={rule.expenseItemId}
                                                                                            onChange={e => updateDistributionRule(incomeId, rule.id, { expenseItemId: e.target.value })}
                                                                                        >
                                                                                            <option value="">Pilih Pos Pengeluaran</option>
                                                                                            {expenseItems.filter(ex => !ex.isFieldOnly).map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
                                                                                        </select>
                                                                                    ) : (
                                                                                        <div className="flex gap-2 w-full">
                                                                                            <select
                                                                                                required
                                                                                                className="form-select w-1/2 !py-2.5 !text-sm !rounded-xl"
                                                                                                value={rule.destId || formData.fieldId}
                                                                                                onChange={e => updateDistributionRule(incomeId, rule.id, { destId: e.target.value })}
                                                                                            >
                                                                                                <option value="">Pilih Bidang</option>
                                                                                                {fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                                                                            </select>
                                                                                            <select
                                                                                                required
                                                                                                className="form-select w-1/2 !py-2.5 !text-sm !rounded-xl"
                                                                                                value={rule.expenseItemId}
                                                                                                onChange={e => updateDistributionRule(incomeId, rule.id, { expenseItemId: e.target.value })}
                                                                                            >
                                                                                                <option value="">Pos Pengeluaran</option>
                                                                                                {expenseItems.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
                                                                                            </select>
                                                                                        </div>
                                                                                    )}
                                                                                </div>

                                                                                {/* Percentage */}
                                                                                <div className="w-full md:w-24">
                                                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Persentase</label>
                                                                                    <div className="relative">
                                                                                        <input 
                                                                                            type="number" 
                                                                                            required
                                                                                            className="form-input !py-2.5 !text-sm !font-black !rounded-xl !pr-8"
                                                                                            value={rule.percentage}
                                                                                            onChange={e => updateDistributionRule(incomeId, rule.id, { percentage: e.target.value })}
                                                                                        />
                                                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 font-black text-xs text-[9px]">%</span>
                                                                                    </div>
                                                                                </div>

                                                                                {/* Action */}
                                                                                <div className="flex items-end pb-0.5">
                                                                                    <button 
                                                                                        type="button" 
                                                                                        onClick={() => removeDistributionRule(incomeId, rule.id)}
                                                                                        className="p-3 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                                                                    >
                                                                                        <Trash2 size={16} />
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        ))}

                                                                        <button 
                                                                            type="button" 
                                                                            onClick={() => addDistributionRule(incomeId)}
                                                                            className="w-full py-4 border-2 border-dashed border-slate-200 rounded-[28px] text-[10px] font-black text-slate-400 uppercase tracking-widest hover:border-blue-200 hover:text-blue-600 hover:bg-blue-50/50 transition-all flex items-center justify-center gap-2"
                                                                        >
                                                                            <Plus size={14} />
                                                                            <span>Tambah Distribusi</span>
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </form>
                            </div>

                            {/* Modal Footer */}
                            <div className="p-10 bg-slate-50 border-t border-slate-100 flex justify-between gap-4">
                                <div className="hidden md:flex items-center gap-2 text-slate-400 text-xs font-bold italic">
                                    <Info size={14} />
                                    <span>Klik simpan untuk menerapkan pengaturan dan konfigurasi dana</span>
                                </div>
                                <div className="flex gap-4 w-full md:w-auto">
                                    <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary !rounded-[24px] flex-1 md:flex-none py-4 px-10">Tutup</button>
                                    <button 
                                        form="unit-form"
                                        type="submit" 
                                        className={`btn !rounded-[24px] flex-1 md:flex-none py-4 px-10 transition-all font-black ${isSaved ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-xl shadow-emerald-500/25' : 'btn-primary shadow-xl shadow-blue-500/25'}`}
                                    >
                                        {isSaved ? '✓ Tersimpan' : 'Simpan Perubahan'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const Info = ({ size, className }) => (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
);
