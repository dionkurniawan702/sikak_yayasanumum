import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { 
    Building2, CheckCircle2, AlertCircle, ShieldCheck, 
    ToggleLeft, ToggleRight, Search, Landmark
} from 'lucide-react';

export default function BOSRecipientUnitManagement() {
    const { state, dispatch } = useApp();
    const { units = [], fields = [] } = state;

    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    const filteredUnits = (units || []).filter(u => 
        !u.isDeleted && 
        u.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleToggleBos = async (unit) => {
        setLoading(true);
        setMessage(null);
        try {
            const updatedUnit = { ...unit, receivesBos: !unit.receivesBos };
            
            // Dispatch to local state
            dispatch({ type: 'EDIT_UNIT', payload: updatedUnit });
            
            // Push to server
            await api.pushAction({ type: 'EDIT_UNIT', payload: updatedUnit }, state);
            
            setMessage({ 
                type: 'success', 
                text: `${unit.name} ${updatedUnit.receivesBos ? 'sekarang' : 'tidak lagi'} menerima BOS` 
            });
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    return (
        <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200">
                            <Building2 size={28} />
                        </div>
                        Unit Penerima BOS
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">Tetapkan unit yang berhak mengelola Dana BOS</p>
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

            {/* Search & Statistics */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-3">
                    <div className="relative group">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                        <input 
                            type="text"
                            placeholder="Cari unit pendidikan..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-14 pr-8 py-5 bg-white border border-slate-200 rounded-[2rem] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-900 shadow-xl shadow-slate-200/50"
                        />
                    </div>
                </div>
                <div className="bg-white border border-slate-100 rounded-[2rem] p-6 flex items-center gap-4 shadow-xl shadow-slate-200/50">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                        <Landmark size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Penerima</p>
                        <p className="text-2xl font-black text-slate-900">{units.filter(u => u.receivesBos && !u.isDeleted).length}</p>
                    </div>
                </div>
            </div>

            {/* Units Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredUnits.map(unit => {
                    const field = fields.find(f => f.id === unit.fieldId);
                    return (
                        <div 
                            key={unit.id}
                            className={`group relative bg-white border rounded-[2.5rem] p-8 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 ${
                                unit.receivesBos ? 'border-emerald-200 shadow-emerald-100/50' : 'border-slate-100 shadow-slate-200/50'
                            }`}
                        >
                            {/* Status Badge */}
                            <div className="absolute top-6 right-8">
                                {unit.receivesBos ? (
                                    <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-wider">
                                        <ShieldCheck size={12} />
                                        Penerima BOS
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-[10px] font-black uppercase tracking-wider">
                                        Non-BOS
                                    </span>
                                )}
                            </div>

                            <div className="flex flex-col h-full">
                                <div className="mb-6">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
                                        {field?.name || 'UMUM'}
                                    </p>
                                    <h3 className="text-xl font-black text-slate-900 leading-tight group-hover:text-indigo-600 transition-colors">
                                        {unit.name}
                                    </h3>
                                </div>

                                <div className="mt-auto flex items-center justify-between pt-6 border-t border-slate-50">
                                    <span className="text-sm font-bold text-slate-500">Akses BOS</span>
                                    <button
                                        onClick={() => handleToggleBos(unit)}
                                        disabled={loading}
                                        className={`transition-all duration-300 ${
                                            unit.receivesBos ? 'text-emerald-500' : 'text-slate-300 hover:text-slate-400'
                                        }`}
                                    >
                                        {unit.receivesBos ? (
                                            <ToggleRight size={44} strokeWidth={1.5} />
                                        ) : (
                                            <ToggleLeft size={44} strokeWidth={1.5} />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {filteredUnits.length === 0 && (
                    <div className="col-span-full py-20 text-center bg-slate-50 rounded-[3rem] border border-dashed border-slate-200">
                        <Building2 className="mx-auto text-slate-300 mb-4" size={48} />
                        <p className="text-slate-400 font-bold">Tidak ada unit yang ditemukan</p>
                    </div>
                )}
            </div>
        </div>
    );
}
