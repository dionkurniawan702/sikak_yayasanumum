import React, { useMemo, useState } from 'react';
import { Building2, Layers, Wallet, ArrowRight, ArrowDownToLine, ArrowUpRight, PieChart } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import CurrencyDisplay from '../../components/CurrencyDisplay';

export default function BudgetDashboard() {
    const { state } = useApp();
    const { currentUser, students = [], units = [], fields = [], expenseItems = [], distributionSettings = [], studentStatuses = [] } = state;

    const [activeTab, setActiveTab] = useState(currentUser?.role === 'admin_bidang' ? 'fields' : 'units');
    const [expandedItem, setExpandedItem] = useState(null);

    // Engine Perhitungan Anggaran
    const {
        totalFoundation,
        totalUnitRetained,
        totalFieldDistributed,
        unitBudgets,
        fieldBudgets
    } = useMemo(() => {
        let tFoundation = 0;
        let tUnit = 0;
        let tField = 0;

        const uBudgets = {};
        units.filter(u => !u.isDeleted).forEach(u => {
            if (currentUser?.role === 'admin_unit' && u.id !== currentUser.unitId) return;
            uBudgets[u.id] = { id: u.id, name: u.name, total: 0, items: {}, studentCount: 0 };
        });

        const fBudgets = {};
        fields.filter(f => !f.isDeleted).forEach(f => {
            if (currentUser?.role === 'admin_bidang' && f.id !== currentUser.fieldId) return;
            fBudgets[f.id] = { id: f.id, name: f.name, total: 0, items: {} };
        });

        const activeStatusId = studentStatuses?.find(st => st.name === 'Aktif')?.id;
        const activeStudents = students.filter(s => !s.isDeleted && s.statusId === activeStatusId);

        activeStudents.forEach(student => {
            if (!student.unitId || !uBudgets[student.unitId]) return;
            
            uBudgets[student.unitId].studentCount += 1;

            if (student.incomeDetails && student.incomeDetails.length > 0) {
                student.incomeDetails.forEach(detail => {
                    const amount = parseFloat(detail.amount) || 0;
                    if (amount <= 0) return;

                    tFoundation += amount;

                    const rules = distributionSettings.filter(s => s.unitId === student.unitId && s.incomeItemId === detail.incomeItemId);
                    
                    if (rules.length === 0) {
                        tUnit += amount;
                        uBudgets[student.unitId].total += amount;
                        uBudgets[student.unitId].items['unallocated'] = (uBudgets[student.unitId].items['unallocated'] || 0) + amount;
                    } else {
                        rules.forEach(rule => {
                            const percent = parseFloat(rule.percentage) || 0;
                            const share = amount * (percent / 100);
                            if (share <= 0) return;

                            if (rule.destType === 'unit') {
                                tUnit += share;
                                uBudgets[student.unitId].total += share;
                                const exId = rule.expenseItemId || 'unallocated';
                                uBudgets[student.unitId].items[exId] = (uBudgets[student.unitId].items[exId] || 0) + share;
                            } else if (rule.destType === 'field') {
                                tField += share;
                                const targetFieldId = rule.destId;
                                
                                if (targetFieldId && fBudgets[targetFieldId]) {
                                    fBudgets[targetFieldId].total += share;
                                    const exId = rule.expenseItemId || 'unallocated';
                                    
                                    if (!fBudgets[targetFieldId].items[exId]) {
                                        fBudgets[targetFieldId].items[exId] = { total: 0, sources: {} };
                                    }
                                    fBudgets[targetFieldId].items[exId].total += share;
                                    fBudgets[targetFieldId].items[exId].sources[student.unitId] = (fBudgets[targetFieldId].items[exId].sources[student.unitId] || 0) + share;
                                }
                            }
                        });
                    }
                });
            }
        });

        return {
            totalFoundation: tFoundation,
            totalUnitRetained: currentUser?.role === 'admin_unit' ? Object.values(uBudgets).reduce((sum, u) => sum + u.total, 0) : tUnit,
            totalFieldDistributed: currentUser?.role === 'admin_bidang' ? Object.values(fBudgets).reduce((sum, f) => sum + f.total, 0) : tField,
            unitBudgets: Object.values(uBudgets).sort((a, b) => b.total - a.total),
            fieldBudgets: Object.values(fBudgets).sort((a, b) => b.total - a.total)
        };
    }, [students, units, fields, distributionSettings, studentStatuses, currentUser]);

    const getExpenseName = (id) => {
        if (id === 'unallocated') return 'Belum Dialokasikan (Pilih Pos di Setting)';
        const ex = expenseItems.find(e => e.id === id);
        return ex ? ex.name : 'Pos Tidak Ditemukan';
    };

    const toggleExpand = (id) => {
        setExpandedItem(expandedItem === id ? null : id);
    };

    return (
        <div className="p-8 animate-in pb-20">
            <div className="mb-8">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight font-display mb-2">Dashboard Anggaran</h1>
                <p className="text-slate-500 font-medium">Proyeksi Anggaran Penerimaan berdasarkan tagihan siswa dan aturan persentase distribusi dana.</p>
            </div>

            {/* Top Stat Cards */}
            <div className={`grid gap-6 mb-10 ${currentUser?.role === 'superadmin' || currentUser?.role === 'admin' ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-1 max-w-xl'}`}>
                
                {/* Tampilkan card Foundation HANYA untuk superadmin/admin */}
                {(currentUser?.role === 'superadmin' || currentUser?.role === 'admin') && (
                    <div className="card p-8 bg-gradient-to-br from-indigo-50 to-blue-50 border-blue-100">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
                                <Wallet size={24} />
                            </div>
                            <div>
                                <p className="text-xs font-black text-blue-400 uppercase tracking-widest">Total Yayasan (Dari Siswa)</p>
                                <h3 className="text-xl font-bold text-slate-900 leading-none mt-1">Estimasi Keseluruhan</h3>
                            </div>
                        </div>
                        <div className="text-4xl font-black text-blue-700 font-display">
                            <CurrencyDisplay value={totalFoundation} />
                        </div>
                    </div>
                )}
                
                {/* Tampilkan Kas Unit jika rolenya BUKAN admin_bidang */}
                {currentUser?.role !== 'admin_bidang' && (
                    <div className={currentUser?.role === 'admin_unit' ? "card p-8 bg-gradient-to-br from-indigo-50 to-blue-50 border-blue-100" : "card p-8 bg-white border-slate-100 border-2"}>
                        <div className="flex items-center gap-4 mb-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${currentUser?.role === 'admin_unit' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'}`}>
                                <ArrowDownToLine size={24} />
                            </div>
                            <div>
                                <p className={`text-xs font-black uppercase tracking-widest ${currentUser?.role === 'admin_unit' ? 'text-blue-400' : 'text-slate-400'}`}>
                                    {currentUser?.role === 'admin_unit' ? 'Total Dana Unit' : 'Ditahan di Unit'}
                                </p>
                                <h3 className="text-xl font-bold text-slate-900 leading-none mt-1">Alokasi Kas Unit</h3>
                            </div>
                        </div>
                        <div className={`font-black font-display ${currentUser?.role === 'admin_unit' ? 'text-5xl text-blue-700' : 'text-3xl text-slate-800'}`}>
                            <CurrencyDisplay value={totalUnitRetained} />
                        </div>
                    </div>
                )}
                
                {/* Tampilkan Kas Bidang jika rolenya BUKAN admin_unit */}
                {currentUser?.role !== 'admin_unit' && (
                    <div className={currentUser?.role === 'admin_bidang' ? "card p-8 bg-gradient-to-br from-indigo-50 to-blue-50 border-blue-100" : "card p-8 bg-white border-slate-100 border-2"}>
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                                <ArrowUpRight size={24} />
                            </div>
                            <div>
                                <p className="text-xs font-black text-blue-400 uppercase tracking-widest">
                                    {currentUser?.role === 'admin_bidang' ? 'Total Dana Bidang' : 'Disalurkan ke Bidang'}
                                </p>
                                <h3 className="text-xl font-bold text-slate-900 leading-none mt-1">Alokasi Kas Bidang</h3>
                            </div>
                        </div>
                        <div className={`font-black font-display ${currentUser?.role === 'admin_bidang' ? 'text-5xl text-blue-700' : 'text-3xl text-slate-800'}`}>
                            <CurrencyDisplay value={totalFieldDistributed} />
                        </div>
                    </div>
                )}
            </div>

            {/* Toggle Tabs */}
            {currentUser?.role !== 'admin_unit' && currentUser?.role !== 'admin_bidang' && (
                <div className="flex bg-slate-100 p-1.5 rounded-2xl w-max mb-6">
                    <button
                        onClick={() => setActiveTab('units')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'units' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Building2 size={16} /> Anggaran Unit
                    </button>
                    <button
                        onClick={() => setActiveTab('fields')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'fields' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Layers size={16} /> Anggaran Bidang
                    </button>
                </div>
            )}

            {/* Main Content Area */}
            <div className="space-y-6">
                {activeTab === 'units' ? (
                    unitBudgets.map(unit => (
                        <div key={unit.id} className="card bg-white border border-slate-100 overflow-hidden hover:border-slate-300 transition-all">
                            <div 
                                className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 transition-colors"
                                onClick={() => toggleExpand(unit.id)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-slate-100 text-slate-600 rounded-2xl flex items-center justify-center font-black text-xl font-display">
                                        {unit.name.charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-900">{unit.name}</h3>
                                        <p className="text-sm font-bold text-slate-400 mt-1">Dari {unit.studentCount} Siswa Aktif</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Dana Diterima Unit</p>
                                    <div className="text-2xl font-black text-slate-800 font-display">
                                        <CurrencyDisplay value={unit.total} />
                                    </div>
                                </div>
                            </div>

                            {/* Expanded Breakdown */}
                            {expandedItem === unit.id && (
                                <div className="p-6 bg-slate-50 border-t border-slate-100 space-y-4">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                                        <PieChart size={14} /> Distribusi ke Pos Pengeluaran Unit
                                    </h4>
                                    
                                    {Object.keys(unit.items).length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {Object.entries(unit.items).map(([exId, amount]) => (
                                                <div key={exId} className="p-4 bg-white rounded-2xl border border-slate-200">
                                                    <p className={`font-bold text-sm mb-2 line-clamp-2 ${exId === 'unallocated' ? 'text-rose-500' : 'text-slate-700'}`}>
                                                        {getExpenseName(exId)}
                                                    </p>
                                                    <p className="text-lg font-black text-slate-900">
                                                        <CurrencyDisplay value={amount} />
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-slate-400 font-medium italic">Tidak ada alokasi tagihan untuk unit ini.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    fieldBudgets.map(field => (
                        <div key={field.id} className="card bg-white border border-blue-100 overflow-hidden hover:border-blue-300 transition-all shadow-sm">
                            <div 
                                className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-blue-50/30 transition-colors"
                                onClick={() => toggleExpand(field.id)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
                                        <Layers size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-900">{field.name}</h3>
                                        <p className="text-sm font-bold text-blue-400 mt-1">Sumber</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Total Dana Disalurkan ke Bidang</p>
                                    <div className="text-2xl font-black text-blue-700 font-display">
                                        <CurrencyDisplay value={field.total} />
                                    </div>
                                </div>
                            </div>

                            {/* Expanded Breakdown for Fields */}
                            {expandedItem === field.id && (
                                <div className="p-6 bg-slate-50 border-t border-slate-100 space-y-6">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <PieChart size={14} /> Pos Pengeluaran Bidang & Sumber Unitnya
                                    </h4>
                                    
                                    {Object.keys(field.items).length > 0 ? (
                                        <div className="space-y-4">
                                            {Object.entries(field.items).map(([exId, data]) => (
                                                <div key={exId} className="p-5 bg-white rounded-[24px] border border-blue-100 shadow-sm flex flex-col md:flex-row md:items-start justify-between gap-6">
                                                    <div className="flex-1">
                                                        <p className={`font-black text-lg mb-1 ${exId === 'unallocated' ? 'text-rose-500' : 'text-slate-800'}`}>
                                                            {getExpenseName(exId)}
                                                        </p>
                                                        <p className="text-2xl font-black text-blue-600 mb-4 font-display">
                                                            <CurrencyDisplay value={data.total} />
                                                        </p>
                                                        
                                                        {/* Sources list */}
                                                        <div>
                                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                                                                <ArrowRight size={12} /> Bersumber Dari:
                                                            </p>
                                                            <div className="flex flex-wrap gap-2">
                                                                {Object.entries(data.sources).map(([unitId, srcAmount]) => {
                                                                    const srcUnit = units.find(u => u.id === unitId);
                                                                    return (
                                                                        <div key={unitId} className="px-3 py-1.5 bg-slate-100 rounded-lg flex items-center gap-2 border border-slate-200">
                                                                            <span className="font-bold text-xs text-slate-700">{srcUnit ? srcUnit.name : 'Unknown'}</span>
                                                                            <span className="text-[10px] font-black text-slate-400">|</span>
                                                                            <span className="font-black text-xs text-slate-500">
                                                                                <CurrencyDisplay value={srcAmount} />
                                                                            </span>
                                                                        </div>
                                                                    )
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-slate-400 font-medium italic">Tidak ada aliran dana ke bidang ini.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
            
            {(activeTab === 'units' && unitBudgets.length === 0) || (activeTab === 'fields' && fieldBudgets.length === 0) ? (
                <div className="py-20 text-center">
                    <p className="text-slate-400 font-medium">Tidak ada data untuk ditampilkan di kategori ini.</p>
                </div>
            ) : null}
        </div>
    );
}
