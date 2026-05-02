import React, { useMemo, useState } from 'react';
import { 
    LayoutDashboard, 
    TrendingUp, 
    Building2, 
    Layers, 
    FileSpreadsheet, 
    Gem,
    ArrowUpRight,
    ArrowDownRight,
    PieChart,
    ChevronDown,
    ChevronRight,
    Target,
    Wallet,
    Landmark
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatRupiah } from '../../utils/format';
import * as XLSX from 'xlsx';

export default function RealizationDashboard() {
    const { state, dispatch } = useApp();
    const { 
        currentUser, 
        units = [], 
        fields = [], 
        expenseItems = [], 
        rabPlans = [],
        budgetReports = [],
        academicYears = [],
        bosAllocations = []
    } = state;

    const [sourceMode, setSourceMode] = useState('YAYASAN'); // 'YAYASAN' or 'BOS'
    const selectedAcademicYearId = state.globalAcademicYearId || '';
    const setSelectedAcademicYearId = (id) => dispatch({ type: 'SET_GLOBAL_YEAR', payload: id });

    const [expandedItems, setExpandedItems] = useState({});
    const toggleExpand = (id) => setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));

    // ========== CALCULATIONS ENGINE ==========
    const dashboardData = useMemo(() => {
        const isBOS = sourceMode === 'BOS';
        
        // 1. Get Base Budgets (RAB)
        const unitRAB = {};
        const fieldRAB = {};
        units.forEach(u => unitRAB[u.id] = { budget: 0, spent: 0, items: {} });
        fields.forEach(f => fieldRAB[f.id] = { budget: 0, spent: 0, items: {} });

        // Process RAB Plans
        rabPlans.filter(p => p.status === 'APPROVED' && p.academicYearId === selectedAcademicYearId).forEach(plan => {
            Object.entries(plan.expense || {}).forEach(([exId, detail]) => {
                const bosAmount = parseFloat(detail.bosAmount) || 0;
                const totalAmount = parseFloat(detail.total) || 0;
                
                let amount = 0;
                if (isBOS) {
                    if (detail.useBos) amount = bosAmount;
                } else {
                    amount = totalAmount - bosAmount;
                }

                if (amount <= 0) return;

                const exItem = expenseItems.find(e => e.id === exId);
                const itemName = (exItem?.name || '').toLowerCase().trim();
                const isField = (exItem && exItem.fieldId && !exItem.unitId) || 
                                   itemName.includes('penggajian') || 
                                   itemName.includes('pengembangan (umum)') ||
                                   itemName.includes('honor') ||
                                   itemName.includes('yayasan');

                if (!isField && plan.unitId && unitRAB[plan.unitId]) {
                    unitRAB[plan.unitId].budget += amount;
                    unitRAB[plan.unitId].items[exId] = (unitRAB[plan.unitId].items[exId] || 0) + amount;
                } else if (plan.fieldId && fieldRAB[plan.fieldId]) {
                    fieldRAB[plan.fieldId].budget += amount;
                    fieldRAB[plan.fieldId].items[exId] = (fieldRAB[plan.fieldId].items[exId] || 0) + amount;
                }
            });
        });

        // 2. Get Actual Spending (Reports)
        budgetReports.filter(r => 
            r.status === 'APPROVED' && 
            r.academicYearId === selectedAcademicYearId && 
            !r.isDeleted &&
            (isBOS ? r.planId?.endsWith('-BOS') : !r.planId?.endsWith('-BOS'))
        ).forEach(report => {
            const amount = parseFloat(report.amount) || 0;
            const exId = report.expenseItemId;
            const exItem = expenseItems.find(e => e.id === exId);
            const itemName = (exItem?.name || '').toLowerCase().trim();
            const isField = (exItem && exItem.fieldId && !exItem.unitId) || 
                               itemName.includes('penggajian') || 
                               itemName.includes('pengembangan (umum)') ||
                               itemName.includes('honor') ||
                               itemName.includes('yayasan');

            if (!isField && report.unitId && unitRAB[report.unitId]) {
                unitRAB[report.unitId].spent += amount;
                // We track spent in items separately if we want detail, but for now focus on unit/field
            } else if (report.fieldId && fieldRAB[report.fieldId]) {
                fieldRAB[report.fieldId].spent += amount;
            }
        });

        // 3. Format for Display
        const unitsList = units.filter(u => !u.isDeleted && (currentUser.role === 'admin_unit' ? u.id === currentUser.unitId : true))
            .map(u => ({
                id: u.id,
                name: u.name,
                budget: unitRAB[u.id].budget,
                spent: unitRAB[u.id].spent,
                remaining: unitRAB[u.id].budget - unitRAB[u.id].spent,
                percent: unitRAB[u.id].budget > 0 ? (unitRAB[u.id].spent / unitRAB[u.id].budget) * 100 : 0
            })).filter(u => u.budget > 0 || u.spent > 0);

        const fieldsList = fields.filter(f => !f.isDeleted && (currentUser.role === 'admin_bidang' ? f.id === currentUser.fieldId : true))
            .map(f => ({
                id: f.id,
                name: f.name,
                budget: fieldRAB[f.id].budget,
                spent: fieldRAB[f.id].spent,
                remaining: fieldRAB[f.id].budget - fieldRAB[f.id].spent,
                percent: fieldRAB[f.id].budget > 0 ? (fieldRAB[f.id].spent / fieldRAB[f.id].budget) * 100 : 0
            })).filter(f => f.budget > 0 || f.spent > 0);

        const totalBudget = [...unitsList, ...fieldsList].reduce((s, x) => s + x.budget, 0);
        const totalSpent = [...unitsList, ...fieldsList].reduce((s, x) => s + x.spent, 0);

        return { unitsList, fieldsList, totalBudget, totalSpent };
    }, [sourceMode, selectedAcademicYearId, units, fields, rabPlans, budgetReports, expenseItems, currentUser]);

    const absorptionRate = dashboardData.totalBudget > 0 ? (dashboardData.totalSpent / dashboardData.totalBudget) * 100 : 0;

    return (
        <div className="p-8 pb-24 animate-in">
            {/* HEADER */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-12">
                <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic">Dashboard Realisasi</h2>
                    <p className="text-slate-500 font-medium tracking-tight">Analisis efisiensi penyerapan anggaran {sourceMode === 'YAYASAN' ? 'Yayasan' : 'BOS'}</p>
                </div>

                <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
                    <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                        <button
                            onClick={() => setSourceMode('YAYASAN')}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${sourceMode === 'YAYASAN' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <Building2 size={14} />
                            Yayasan
                        </button>
                        {(currentUser?.role !== 'admin_bidang' || currentUser?.role === 'superadmin') && (
                            <button
                                onClick={() => setSourceMode('BOS')}
                                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${sourceMode === 'BOS' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <Gem size={14} />
                                BOS
                            </button>
                        )}
                    </div>

                    <select
                        value={selectedAcademicYearId}
                        onChange={(e) => setSelectedAcademicYearId(e.target.value)}
                        className="p-3 bg-white border-2 border-slate-100 rounded-2xl font-black text-xs text-slate-800 uppercase tracking-widest focus:ring-4 focus:ring-blue-50 outline-none transition-all shadow-sm"
                    >
                        {academicYears.filter(y => !y.isDeleted).map(y => (
                            <option key={y.id} value={y.id}>Tahun {y.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* METRICS CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden group">
                    <div className="relative z-10">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Anggaran</p>
                        <h3 className="text-2xl font-black text-slate-900">{formatRupiah(dashboardData.totalBudget)}</h3>
                        <div className="mt-4 flex items-center gap-2 text-blue-600 font-bold text-xs">
                            <Target size={14} />
                            <span>RAB {sourceMode}</span>
                        </div>
                    </div>
                    <Target size={100} className="absolute -bottom-6 -right-6 text-slate-50 group-hover:text-blue-50/50 transition-colors" />
                </div>

                <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden group">
                    <div className="relative z-10">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Terpakai</p>
                        <h3 className="text-2xl font-black text-slate-900">{formatRupiah(dashboardData.totalSpent)}</h3>
                        <div className="mt-4 flex items-center gap-2 text-emerald-600 font-bold text-xs">
                            <ArrowUpRight size={14} />
                            <span>Realisasi Berjalan</span>
                        </div>
                    </div>
                    <TrendingUp size={100} className="absolute -bottom-6 -right-6 text-slate-50 group-hover:text-emerald-50/50 transition-colors" />
                </div>

                <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden group">
                    <div className="relative z-10">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Sisa Anggaran</p>
                        <h3 className="text-2xl font-black text-slate-900">{formatRupiah(dashboardData.totalBudget - dashboardData.totalSpent)}</h3>
                        <div className="mt-4 flex items-center gap-2 text-amber-600 font-bold text-xs">
                            <Wallet size={14} />
                            <span>Sisa RAB</span>
                        </div>
                    </div>
                    <Landmark size={100} className="absolute -bottom-6 -right-6 text-slate-50 group-hover:text-amber-50/50 transition-colors" />
                </div>

                <div className="bg-slate-900 p-8 rounded-[32px] shadow-2xl relative overflow-hidden group">
                    <div className="relative z-10">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Serapan Dana</p>
                        <h3 className="text-4xl font-black text-white">{absorptionRate.toFixed(1)}%</h3>
                        <div className="mt-4 w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-blue-500 rounded-full transition-all duration-1000" 
                                style={{ width: `${Math.min(absorptionRate, 100)}%` }}
                            />
                        </div>
                    </div>
                    <PieChart size={100} className="absolute -bottom-6 -right-6 text-white/5" />
                </div>
            </div>

            {/* MAIN DATA TABLES */}
            <div className="space-y-12">
                {/* BIDANG REALISASI */}
                {currentUser.role !== 'admin_unit' && (
                    <div className="bg-white rounded-[40px] border border-slate-100 shadow-2xl overflow-hidden">
                        <div className="p-8 border-b border-slate-50 bg-slate-50/50 flex items-center gap-4">
                            <div className="p-3 bg-white rounded-2xl shadow-sm text-indigo-600">
                                <Layers size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">Serapan Anggaran Per Bidang</h3>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Konsolidasi Operasional Yayasan</p>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-slate-50/30 text-left">
                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nama Bidang</th>
                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Anggaran</th>
                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Realisasi</th>
                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Efisiensi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {dashboardData.fieldsList.map(f => (
                                        <tr key={f.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-8 py-6">
                                                <span className="font-black text-slate-900 uppercase tracking-tight text-sm">{f.name}</span>
                                            </td>
                                            <td className="px-8 py-6 text-right font-bold text-slate-600">{formatRupiah(f.budget)}</td>
                                            <td className="px-8 py-6 text-right font-black text-slate-900">{formatRupiah(f.spent)}</td>
                                            <td className="px-8 py-6 min-w-[200px]">
                                                <div className="flex items-center gap-4">
                                                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                        <div 
                                                            className={`h-full rounded-full transition-all duration-1000 ${f.percent > 90 ? 'bg-rose-500' : f.percent > 70 ? 'bg-amber-500' : 'bg-blue-500'}`}
                                                            style={{ width: `${Math.min(f.percent, 100)}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[10px] font-black text-slate-500 w-10">{f.percent.toFixed(0)}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* UNIT REALISASI */}
                {currentUser.role !== 'admin_bidang' && (
                    <div className="bg-white rounded-[40px] border border-slate-100 shadow-2xl overflow-hidden">
                        <div className="p-8 border-b border-slate-50 bg-slate-50/50 flex items-center gap-4">
                            <div className="p-3 bg-white rounded-2xl shadow-sm text-blue-600">
                                <Building2 size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">Serapan Anggaran Per Unit</h3>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Detail Operasional Pendidikan & Unit Kerja</p>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-slate-50/30 text-left">
                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nama Unit</th>
                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Anggaran</th>
                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Realisasi</th>
                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Efisiensi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {dashboardData.unitsList.map(u => (
                                        <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-8 py-6">
                                                <span className="font-black text-slate-900 uppercase tracking-tight text-sm">{u.name}</span>
                                            </td>
                                            <td className="px-8 py-6 text-right font-bold text-slate-600">{formatRupiah(u.budget)}</td>
                                            <td className="px-8 py-6 text-right font-black text-slate-900">{formatRupiah(u.spent)}</td>
                                            <td className="px-8 py-6 min-w-[200px]">
                                                <div className="flex items-center gap-4">
                                                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                        <div 
                                                            className={`h-full rounded-full transition-all duration-1000 ${u.percent > 90 ? 'bg-rose-500' : u.percent > 70 ? 'bg-amber-500' : 'bg-blue-500'}`}
                                                            style={{ width: `${Math.min(u.percent, 100)}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[10px] font-black text-slate-500 w-10">{u.percent.toFixed(0)}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            <div className="mt-20 text-center">
                <div className="inline-block px-10 py-3 bg-white border border-slate-100 rounded-full shadow-sm">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">
                        Sistem Keuangan Dareliman — SIKAD
                    </p>
                </div>
            </div>
        </div>
    );
}


