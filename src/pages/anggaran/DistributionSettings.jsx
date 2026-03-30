import React, { useState } from 'react';
import { Share2, Plus, Trash2, Save, Info, ArrowRight, Building2, Layers, Percent } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function DistributionSettings() {
    const { state, dispatch } = useApp();
    const { units = [], fields = [], incomeItems = [], distributionSettings = [] } = state;

    const [selectedUnit, setSelectedUnit] = useState(units[0]?.id || '');
    const [selectedIncomeItem, setSelectedIncomeItem] = useState(incomeItems[0]?.id || '');
    
    // Find current settings for the selection
    const currentSettings = distributionSettings.filter(s => 
        s.unitId === selectedUnit && s.incomeItemId === selectedIncomeItem
    );

    const [tempSettings, setTempSettings] = useState(currentSettings);

    // Sync tempSettings when currentSettings changes
    React.useEffect(() => {
        setTempSettings(currentSettings);
    }, [selectedUnit, selectedIncomeItem, distributionSettings]);

    const handleAddRow = () => {
        setTempSettings([...tempSettings, {
            id: crypto.randomUUID(),
            unitId: selectedUnit,
            incomeItemId: selectedIncomeItem,
            destType: 'unit', // 'unit' or 'field'
            destId: selectedUnit,
            expenseItemId: state.expenseItems[0]?.id || '',
            percentage: 0
        }]);
    };

    const handleRemoveRow = (id) => {
        setTempSettings(tempSettings.filter(s => s.id !== id));
    };

    const handleUpdateRow = (id, field, value) => {
        setTempSettings(tempSettings.map(s => {
            if (s.id === id) {
                const updated = { ...s, [field]: value };
                if (field === 'destType') {
                    updated.destId = value === 'unit' ? units[0]?.id : fields[0]?.id;
                }
                return updated;
            }
            return s;
        }));
    };

    const totalPercentage = tempSettings.reduce((sum, s) => sum + (parseFloat(s.percentage) || 0), 0);

    const handleSave = () => {
        if (totalPercentage !== 100) {
            alert('Total persentase harus 100%!');
            return;
        }
        
        dispatch({
            type: 'UPDATE_DISTRIBUTION_SETTINGS',
            payload: {
                unitId: selectedUnit,
                incomeItemId: selectedIncomeItem,
                settings: tempSettings
            }
        });
    };

    return (
        <div className="p-8 animate-in">
            {/* Header */}
            <div className="mb-8 p-10 bg-gradient-to-br from-slate-900 to-blue-900 rounded-[40px] text-white shadow-2xl relative overflow-hidden">
                <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/20">
                            <Share2 size={24} className="text-blue-400" />
                        </div>
                        <h1 className="text-3xl font-black font-display tracking-tight">Pengaturan Distribusi</h1>
                    </div>
                    <p className="text-blue-200/80 font-medium max-w-xl">Konfigurasikan persentase pembagian dana dari item penerimaan unit ke berbagai pos pengeluaran unit atau bidang terkait.</p>
                </div>
                <div className="absolute top-0 right-0 p-8 opacity-10 scale-150 rotate-12">
                    <Percent size={160} />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Selection Sidebar */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="card p-6 border-2 border-blue-50">
                        <label className="form-label">Unit Sumber Dana</label>
                        <select 
                            className="form-select mb-6"
                            value={selectedUnit}
                            onChange={e => setSelectedUnit(e.target.value)}
                        >
                            <option value="">Pilih Unit</option>
                            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>

                        <label className="form-label">Item Penerimaan</label>
                        <select 
                            className="form-select"
                            value={selectedIncomeItem}
                            onChange={e => setSelectedIncomeItem(e.target.value)}
                        >
                            <option value="">Pilih Penerimaan</option>
                            {incomeItems.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                        </select>
                        
                        <div className="mt-8 p-4 bg-blue-50 rounded-2xl border border-blue-100 italic text-xs text-blue-700 leading-relaxed">
                            <Info size={14} className="mb-2" />
                            Pilih unit dan item penerimaan (misal: SPP) untuk mengatur bagaimana dana tersebut dibagi secara otomatis.
                        </div>
                    </div>
                </div>

                {/* Main Settings Area */}
                <div className="lg:col-span-3">
                    <div className="card shadow-xl overflow-hidden">
                        <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-black text-slate-900 uppercase text-xs tracking-widest">Daftar Distribusi Dana</h3>
                            <div className={`px-4 py-1.5 rounded-full text-xs font-black transition-all ${totalPercentage === 100 ? 'bg-emerald-500 text-white' : 'bg-rose-100 text-rose-600 border border-rose-200'}`}>
                                Total: {totalPercentage}% {totalPercentage !== 100 && '(Harus 100%)'}
                            </div>
                        </div>

                        <div className="p-8 space-y-4">
                            {tempSettings.map((row, index) => (
                                <div key={row.id} className="flex flex-col md:flex-row gap-4 p-6 bg-slate-50/50 hover:bg-white border hover:border-blue-200 rounded-[32px] transition-all group relative">
                                    {/* Destination Selection */}
                                    <div className="flex-1">
                                        <label className="form-label">Tujuan (Unit/Bidang)</label>
                                        <div className="flex gap-2 p-1 bg-white border border-slate-200 rounded-2xl mb-3">
                                            <button 
                                                onClick={() => handleUpdateRow(row.id, 'destType', 'unit')}
                                                className={`flex-1 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${row.destType === 'unit' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}
                                            >
                                                Unit
                                            </button>
                                            <button 
                                                onClick={() => handleUpdateRow(row.id, 'destType', 'field')}
                                                className={`flex-1 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${row.destType === 'field' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}
                                            >
                                                Bidang
                                            </button>
                                        </div>
                                        <select 
                                            className="form-select !py-2 !text-xs"
                                            value={row.destId}
                                            onChange={e => handleUpdateRow(row.id, 'destId', e.target.value)}
                                        >
                                            <option value="">Pilih Tujuan</option>
                                            {row.destType === 'unit' 
                                                ? units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)
                                                : fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)
                                            }
                                        </select>
                                    </div>

                                    {/* Expense Item */}
                                    <div className="flex-1">
                                        <label className="form-label">Pos Pengeluaran</label>
                                        <select 
                                            className="form-select !py-3 !text-xs mt-auto"
                                            value={row.expenseItemId}
                                            onChange={e => handleUpdateRow(row.id, 'expenseItemId', e.target.value)}
                                        >
                                            <option value="">Pilih Pos</option>
                                            {state.expenseItems.map(i => (
                                                <option key={i.id} value={i.id}>{i.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Percentage */}
                                    <div className="w-full md:w-32">
                                        <label className="form-label">Persentase</label>
                                        <div className="relative">
                                            <input 
                                                type="number" 
                                                className="form-input !py-3 !text-sm !pr-10 font-bold"
                                                value={row.percentage}
                                                onChange={e => handleUpdateRow(row.id, 'percentage', e.target.value)}
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                                        </div>
                                    </div>

                                    {/* Delete Row */}
                                    <div className="flex items-end pb-1 px-2">
                                        <button 
                                            onClick={() => handleRemoveRow(row.id)}
                                            className="p-3 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                </div>
                            ))}

                            <button 
                                onClick={handleAddRow}
                                className="w-full py-6 border-4 border-dashed border-slate-100 rounded-[32px] text-slate-400 font-black uppercase tracking-[0.2em] text-xs hover:border-blue-200 hover:text-blue-600 hover:bg-blue-50/20 transition-all flex items-center justify-center gap-3"
                            >
                                <Plus size={18} />
                                <span>Tambah Aturan Distribusi</span>
                            </button>
                        </div>

                        <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                            <button onClick={() => setTempSettings(currentSettings)} className="btn btn-secondary !rounded-2xl">Reset Perubahan</button>
                            <button 
                                onClick={handleSave}
                                disabled={totalPercentage !== 100}
                                className={`btn btn-primary !rounded-2xl shadow-xl ${totalPercentage !== 100 ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <Save size={18} />
                                <span>Simpan Konfigurasi</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
