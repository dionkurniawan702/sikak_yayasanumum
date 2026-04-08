import React, { useState, useMemo, useEffect } from 'react';
import { 
    Calendar, Building2, Layers, Save, RefreshCw, 
    ArrowUpCircle, ArrowDownCircle, Info, ChevronRight,
    TrendingUp, Wallet, ShieldCheck, Download, Filter, 
    Send, CheckCircle2, XCircle, AlertCircle, MessageSquare
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatRupiah } from '../../utils/format';
import { api } from '../../services/api';
import { calculateRAP } from '../../utils/budgetEngine';

export default function RAB() {
    const { state, dispatch } = useApp();
    const { 
        units = [], 
        fields = [], 
        academicYears = [], 
        incomeItems = [], 
        expenseItems = [],
        rabPlans = [],
        currentUser
    } = state;

    // Filters & Selectors
    const [selectedYearId, setSelectedYearId] = useState('');
    const [selectedUnitId, setSelectedUnitId] = useState('FOUNDATION');
    const [activeTab, setActiveTab] = useState('INCOME'); // INCOME | EXPENSE | REVIEW (for admin)
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [showRejectionInput, setShowRejectionInput] = useState(null); // planId if reviewing

    // Local state for the current editing plan
    const [currentPlan, setCurrentPlan] = useState({
        income: {},
        expense: {},
        status: 'DRAFT',
        rejectionReason: null
    });

    // Set initial filters
    useEffect(() => {
        const currentYear = academicYears.find(ay => ay.isCurrent) || (academicYears.length > 0 ? academicYears[0] : null);
        if (currentYear) setSelectedYearId(currentYear.id);
        
        if (currentUser?.role === 'admin_unit') {
            setSelectedUnitId(currentUser.unitId);
        } else if (currentUser?.role === 'admin_bidang') {
            setSelectedUnitId(`FIELD-${currentUser.fieldId}`);
        }
    }, [academicYears, currentUser]);

    // Load existing plan when filters change
    useEffect(() => {
        if (!selectedYearId || !selectedUnitId) return;

        const planId = `${selectedYearId}-${selectedUnitId}`;
        const existingPlan = (rabPlans || []).find(p => p.id === planId);

        if (existingPlan) {
            setCurrentPlan({
                income: existingPlan.income || {},
                expense: existingPlan.expense || {},
                status: existingPlan.status || 'DRAFT',
                rejectionReason: existingPlan.rejectionReason || null
            });

            // Check if we should show a notification pop-up for this plan
            // If it was recently updated and status is APPROVED/REJECTED
            if ((existingPlan.status === 'APPROVED' || existingPlan.status === 'REJECTED') && !existingPlan.notified) {
                setShowStatusModal(true);
            }
        } else {
            setCurrentPlan({ income: {}, expense: {}, status: 'DRAFT', rejectionReason: null });
        }
    }, [selectedYearId, selectedUnitId, rabPlans]);

    // Calculate RAP for the selected context
    const rapData = useMemo(() => {
        if (!selectedYearId || !selectedUnitId) return { totalTarget: 0, itemAllocations: {} };
        
        let unitId = null;
        let fieldId = null;

        if (selectedUnitId.startsWith('FIELD-')) {
            fieldId = selectedUnitId.replace('FIELD-', '');
        } else if (selectedUnitId !== 'FOUNDATION') {
            unitId = selectedUnitId;
        }

        return calculateRAP(state, selectedYearId, unitId, fieldId);
    }, [state, selectedYearId, selectedUnitId]);

    const isLocked = currentPlan.status === 'PENDING' || (currentPlan.status === 'APPROVED' && currentUser?.role !== 'superadmin');

    const handleAmountChange = (type, itemId, value) => {
        const amount = parseFloat(value) || 0;
        setCurrentPlan(prev => ({
            ...prev,
            [type.toLowerCase()]: {
                ...prev[type.toLowerCase()],
                [itemId]: amount
            }
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        setMessage(null);

        const planId = `${selectedYearId}-${selectedUnitId}`;
        const newPlan = {
            id: planId,
            academicYearId: selectedYearId,
            unitId: selectedUnitId.startsWith('FIELD-') ? null : (selectedUnitId === 'FOUNDATION' ? 'FOUNDATION' : selectedUnitId),
            fieldId: selectedUnitId.startsWith('FIELD-') ? selectedUnitId.replace('FIELD-', '') : null,
            income: currentPlan.income,
            expense: currentPlan.expense,
            status: currentPlan.status, // Preserve status
            rejectionReason: currentPlan.rejectionReason,
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser?.username
        };

        try {
            dispatch({ type: 'SET_RAB_PLAN', payload: newPlan });
            await api.pushAction({ type: 'SET_RAB_PLAN', payload: newPlan }, state);
            setMessage({ type: 'success', text: 'Rencana Anggaran (RAB) berhasil disimpan secara permanen.' });
        } catch (error) {
            setMessage({ type: 'error', text: 'Gagal menyimpan RAB: ' + error.message });
        } finally {
            setIsSaving(false);
            setTimeout(() => setMessage(null), 5000);
        }
    };

    const handleSubmitReview = async () => {
        setIsSaving(true);
        const planId = `${selectedYearId}-${selectedUnitId}`;
        const submittedPlan = {
            ...(rabPlans.find(p => p.id === planId) || {
                id: planId,
                academicYearId: selectedYearId,
                unitId: selectedUnitId.startsWith('FIELD-') ? null : (selectedUnitId === 'FOUNDATION' ? 'FOUNDATION' : selectedUnitId),
                fieldId: selectedUnitId.startsWith('FIELD-') ? selectedUnitId.replace('FIELD-', '') : null,
                income: currentPlan.income,
                expense: currentPlan.expense,
            }),
            status: 'PENDING',
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser?.username
        };

        try {
            dispatch({ type: 'SET_RAB_PLAN', payload: submittedPlan });
            await api.pushAction({ type: 'SET_RAB_PLAN', payload: submittedPlan }, state);
            setMessage({ type: 'success', text: 'RAB telah dikirim ke Yayasan untuk direview.' });
        } catch (error) {
            setMessage({ type: 'error', text: 'Gagal mengirim RAB: ' + error.message });
        } finally {
            setIsSaving(false);
            setTimeout(() => setMessage(null), 5000);
        }
    };

    const handleApproval = async (planId, status, reason = null) => {
        const plan = rabPlans.find(p => p.id === planId);
        if (!plan) return;

        const updatedPlan = {
            ...plan,
            status: status,
            rejectionReason: reason,
            notified: false, // For unit notification
            approvedAt: status === 'APPROVED' ? new Date().toISOString() : null,
            approvedBy: status === 'APPROVED' ? currentUser.username : null
        };

        try {
            dispatch({ type: 'SET_RAB_PLAN', payload: updatedPlan });
            await api.pushAction({ type: 'SET_RAB_PLAN', payload: updatedPlan }, state);
            setMessage({ type: 'success', text: `Anggaran berhasil ${status === 'APPROVED' ? 'di-ACC' : 'ditolak'}.` });
            setShowRejectionInput(null);
            setRejectionReason('');
        } catch (error) {
            setMessage({ type: 'error', text: 'Gagal memproses persetujuan.' });
        }
    };

    const handleAcknowledgeStatus = () => {
        const planId = `${selectedYearId}-${selectedUnitId}`;
        const plan = rabPlans.find(p => p.id === planId);
        if (plan) {
            const updatedPlan = { ...plan, notified: true };
            dispatch({ type: 'SET_RAB_PLAN', payload: updatedPlan });
            api.pushAction({ type: 'SET_RAB_PLAN', payload: updatedPlan }, state);
        }
        setShowStatusModal(false);
    };

    const totalIncome = useMemo(() => 
        Object.values(currentPlan.income).reduce((sum, val) => sum + val, 0)
    , [currentPlan.income]);

    const totalExpense = useMemo(() => 
        Object.values(currentPlan.expense).reduce((sum, val) => sum + val, 0)
    , [currentPlan.expense]);

    const balance = totalIncome - totalExpense;

    return (
        <div className="p-4 lg:p-10 max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-700">
            {/* Top Toolbar */}
            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-3 text-blue-600 font-black uppercase tracking-[0.2em] text-[10px]">
                        <ShieldCheck size={14} />
                        <span>Manajemen Anggaran Bisnis & Pendidikan</span>
                    </div>
                    <h1 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tight flex items-center gap-4 italic shrink-0">
                        Rencana Anggaran Biaya (RAB)
                    </h1>
                    <p className="text-slate-500 font-medium max-w-xl">
                        Penyusunan rencana pendapatan dan belanja tahunan sesuai standar PSAK 35 Yayasan Umum.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    {/* Academic Year Selector */}
                    <div className="relative group">
                        <label className="absolute -top-2 left-4 px-2 bg-white text-[9px] font-black text-slate-400 uppercase tracking-widest z-10 transition-colors group-focus-within:text-blue-600">
                            Tahun Ajaran
                        </label>
                        <div className="flex items-center gap-2 bg-white border-2 border-slate-100 px-4 py-3.5 rounded-2xl shadow-sm focus-within:border-blue-500 transition-all">
                            <Calendar size={18} className="text-slate-400" />
                            <select 
                                className="bg-transparent border-none font-bold text-slate-900 outline-none pr-8 cursor-pointer"
                                value={selectedYearId}
                                onChange={e => setSelectedYearId(e.target.value)}
                            >
                                <option value="">Pilih Tahun</option>
                                {academicYears.map(ay => (
                                    <option key={ay.id} value={ay.id}>{ay.name}{ay.isCurrent ? ' (Aktif)' : ''}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Unit/Field Selector */}
                    <div className="relative group">
                        <label className="absolute -top-2 left-4 px-2 bg-white text-[9px] font-black text-slate-400 uppercase tracking-widest z-10 transition-colors group-focus-within:text-blue-600">
                            Entitas Kerja
                        </label>
                        <div className="flex items-center gap-2 bg-white border-2 border-slate-100 px-4 py-3.5 rounded-2xl shadow-sm focus-within:border-blue-500 transition-all">
                            <Building2 size={18} className="text-slate-400" />
                            <select 
                                className="bg-transparent border-none font-bold text-slate-900 outline-none pr-8 cursor-pointer"
                                value={selectedUnitId}
                                onChange={e => setSelectedUnitId(e.target.value)}
                                disabled={currentUser?.role !== 'superadmin'}
                            >
                                <option value="FOUNDATION">Yayasan (Konsolidasi)</option>
                                <optgroup label="Unit Pendidikan">
                                    {(units || []).filter(u => !u.isDeleted).map(u => (
                                        <option key={u.id} value={u.id}>{u.name}</option>
                                    ))}
                                </optgroup>
                                <optgroup label="Bidang Struktural">
                                    {(fields || []).filter(f => !f.isDeleted).map(f => (
                                        <option key={f.id} value={`FIELD-${f.id}`}>{f.name}</option>
                                    ))}
                                </optgroup>
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {currentPlan.status === 'DRAFT' || currentPlan.status === 'REJECTED' ? (
                            <>
                                <button 
                                    onClick={handleSave}
                                    disabled={isSaving || !selectedYearId || isLocked}
                                    className="bg-white border-2 border-slate-200 hover:border-slate-900 text-slate-900 px-6 py-4 rounded-2xl font-black text-xs tracking-tight transition-all flex items-center gap-3 disabled:opacity-50"
                                >
                                    <Save size={16} />
                                    SIMPAN DRAFT
                                </button>
                                <button 
                                    onClick={handleSubmitReview}
                                    disabled={isSaving || !selectedYearId || isLocked}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-black text-xs tracking-tight transition-all shadow-xl shadow-blue-100 flex items-center gap-3 disabled:opacity-50"
                                >
                                    <Send size={16} />
                                    KIRIM KE YAYASAN
                                </button>
                            </>
                        ) : (
                            <div className={`px-8 py-4 rounded-2xl font-black text-xs flex items-center gap-3 shadow-lg ${
                                currentPlan.status === 'PENDING' ? 'bg-amber-500 text-white shadow-amber-100' : 'bg-emerald-500 text-white shadow-emerald-100'
                            }`}>
                                {currentPlan.status === 'PENDING' ? <RefreshCw className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                                STATUS: {currentPlan.status}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Stats Banner */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-emerald-100 relative overflow-hidden group">
                    <div className="relative z-10">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">Target Penerimaan</p>
                        <h2 className="text-3xl font-black tracking-tight italic">{formatRupiah(totalIncome)}</h2>
                    </div>
                    <ArrowUpCircle className="absolute -bottom-4 -right-4 w-32 h-32 opacity-10 group-hover:scale-110 transition-transform duration-700" />
                </div>
                <div className="bg-gradient-to-br from-rose-500 to-pink-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-rose-100 relative overflow-hidden group">
                    <div className="relative z-10">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">Pagu Pengeluaran</p>
                        <h2 className="text-3xl font-black tracking-tight italic">{formatRupiah(totalExpense)}</h2>
                    </div>
                    <ArrowDownCircle className="absolute -bottom-4 -right-4 w-32 h-32 opacity-10 group-hover:scale-110 transition-transform duration-700" />
                </div>
                <div className={`${balance >= 0 ? 'bg-blue-600' : 'bg-slate-800'} p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden group transition-colors duration-500`}>
                    <div className="relative z-10 flex flex-col justify-between h-full">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">Alokasi (RAP) {selectedUnitId === 'FOUNDATION' ? 'Konsolidasi' : 'Unit'}</p>
                            <h2 className="text-3xl font-black tracking-tight italic">{formatRupiah(rapData.totalTarget)}</h2>
                        </div>
                        <div className="mt-4">
                            <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full transition-all duration-1000 ${totalExpense > rapData.totalTarget ? 'bg-rose-400' : 'bg-emerald-400'}`}
                                    style={{ width: `${Math.min(100, (totalExpense / (rapData.totalTarget || 1)) * 100)}%` }}
                                />
                            </div>
                            <p className="text-[10px] mt-1 font-bold opacity-70">
                                {((totalExpense / (rapData.totalTarget || 1)) * 100).toFixed(1)}% dari porsi dana digunakan
                            </p>
                        </div>
                    </div>
                    <TrendingUp className="absolute -bottom-4 -right-4 w-32 h-32 opacity-10 group-hover:scale-110 transition-transform duration-700" />
                </div>
            </div>

            {/* Main Content Card */}
            <div className="bg-white rounded-[3rem] shadow-2xl shadow-slate-200 border border-slate-100 overflow-hidden flex flex-col md:flex-row min-h-[600px]">
                {/* Side Navigation */}
                <div className="w-full md:w-80 bg-slate-50 border-r border-slate-100 p-8 space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-6">Navigasi Anggaran</p>
                    
                    <button 
                        onClick={() => setActiveTab('INCOME')}
                        className={`w-full flex items-center gap-4 p-5 rounded-3xl font-black text-sm tracking-tight transition-all ${
                            activeTab === 'INCOME' 
                            ? 'bg-white text-blue-600 shadow-xl shadow-blue-100/50 scale-[1.02]' 
                            : 'text-slate-400 hover:bg-slate-100'
                        }`}
                    >
                        <div className={`p-2 rounded-xl ${activeTab === 'INCOME' ? 'bg-blue-50' : 'bg-slate-100'}`}>
                            <ArrowUpCircle size={20} />
                        </div>
                        Penerimaan (Plan)
                    </button>

                    <button 
                        onClick={() => setActiveTab('EXPENSE')}
                        className={`w-full flex items-center gap-4 p-5 rounded-3xl font-black text-sm tracking-tight transition-all ${
                            activeTab === 'EXPENSE' 
                            ? 'bg-white text-rose-600 shadow-xl shadow-rose-100/50 scale-[1.02]' 
                            : 'text-slate-400 hover:bg-slate-100'
                        }`}
                    >
                        <div className={`p-2 rounded-xl ${activeTab === 'EXPENSE' ? 'bg-rose-50' : 'bg-slate-100'}`}>
                            <ArrowDownCircle size={20} />
                        </div>
                        Pengeluaran (Limit)
                    </button>

                    {currentUser?.role === 'superadmin' && (
                        <button 
                            onClick={() => setActiveTab('REVIEW')}
                            className={`w-full flex items-center gap-4 p-5 rounded-3xl font-black text-sm tracking-tight transition-all ${
                                activeTab === 'REVIEW' 
                                ? 'bg-white text-indigo-600 shadow-xl shadow-indigo-100/50 scale-[1.02]' 
                                : 'text-slate-400 hover:bg-slate-100'
                            }`}
                        >
                            <div className={`p-2 rounded-xl ${activeTab === 'REVIEW' ? 'bg-indigo-50' : 'bg-slate-100'}`}>
                                <ShieldCheck size={20} />
                            </div>
                            Review Anggaran
                        </button>
                    )}

                    <div className="pt-10 space-y-6">
                        <div className="p-6 bg-blue-50/50 rounded-3xl border border-blue-100">
                            <div className="flex items-center gap-2 text-blue-700 font-black text-[10px] uppercase tracking-widest mb-3">
                                <Info size={14} />
                                <span>Petunjuk PSAK 35</span>
                            </div>
                            <p className="text-[11px] text-blue-800 font-medium leading-relaxed">
                                Seluruh rencana anggaran ini akan dikategorikan sebagai <strong>Aset Neto Tanpa Pembatasan</strong> kecuali jika bersumber dari program terikat khusus.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 p-8 lg:p-12">
                    <div className="flex items-center justify-between mb-10">
                        <div>
                            <h3 className="text-2xl font-black text-slate-900 tracking-tight italic">
                                {activeTab === 'INCOME' ? 'Rencana Penerimaan Dana' : 'Pagu Pengeluaran Operasional'}
                            </h3>
                            <p className="text-slate-400 text-sm font-medium">Input nilai estimasi kas masuk/keluar untuk satu periode tahun ajaran.</p>
                        </div>
                        <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <Filter size={14} />
                            Tampilkan: Semua Pos
                        </div>
                    </div>

                    <div className="overflow-x-auto -mx-2">
                        <table className="w-full text-left border-separate border-spacing-y-3">
                            <thead>
                                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <th className="px-6 py-2">Nama Pos Anggaran</th>
                                    <th className="px-6 py-2">Kategori PSAK 35</th>
                                    <th className="px-6 py-2 text-right">Nilai Anggaran (IDR)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(activeTab === 'INCOME' ? (incomeItems || []) : (expenseItems || [])).map(item => {
                                    const allocated = rapData.itemAllocations[item.id] || 0;
                                    const budgeted = currentPlan[activeTab.toLowerCase()][item.id] || 0;
                                    const isOverBudget = activeTab === 'EXPENSE' && budgeted > (allocated + 1) && allocated > 0;

                                    return (
                                        <tr key={item.id} className="group transition-all">
                                            <td className="px-6 py-5 bg-slate-50 rounded-l-[20px] group-hover:bg-slate-100 transition-colors">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-1.5 h-6 rounded-full ${activeTab === 'INCOME' ? 'bg-emerald-400' : 'bg-rose-400'} opacity-30 group-hover:opacity-100 transition-opacity`} />
                                                    <div>
                                                        <span className="font-bold text-slate-700 uppercase tracking-tight text-sm italic block">{item.name}</span>
                                                        {activeTab === 'EXPENSE' && (
                                                            <span className={`text-[10px] font-black ${isOverBudget ? 'text-rose-600' : 'text-slate-400'}`}>
                                                                Alokasi: {formatRupiah(allocated)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 bg-slate-50 group-hover:bg-slate-100 transition-colors">
                                                <span className="px-3 py-1 bg-white border border-slate-200 rounded-full text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                    Tanpa Pembatasan
                                                </span>
                                            </td>
                                            <td className={`px-6 py-5 bg-slate-50 rounded-r-[20px] group-hover:bg-slate-100 transition-colors text-right ${isOverBudget ? 'bg-rose-50 border-r-4 border-rose-500' : ''}`}>
                                                <div className="flex items-center justify-end gap-3 group/input">
                                                    <span className="text-[11px] font-black text-slate-300 group-focus-within/input:text-blue-500 transition-colors tracking-tighter">RP.</span>
                                                    <input 
                                                        type="number" 
                                                        placeholder="0"
                                                        value={currentPlan[activeTab.toLowerCase()][item.id] || ''}
                                                        onChange={e => handleAmountChange(activeTab, item.id, e.target.value)}
                                                        disabled={isLocked}
                                                        className={`bg-transparent border-none text-right font-black focus:ring-0 w-32 xl:w-48 text-lg ${isLocked ? 'opacity-50' : 'text-slate-900'} ${isOverBudget ? 'text-rose-600' : ''}`}
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}

                                {activeTab === 'REVIEW' && (
                                    <tr>
                                        <td colSpan="3" className="p-0">
                                            <div className="space-y-4">
                                                {(rabPlans || []).filter(p => p.status === 'PENDING').map(plan => (
                                                    <div key={plan.id} className="p-8 bg-indigo-50/50 rounded-[32px] border-2 border-indigo-100">
                                                        <div className="flex justify-between items-start mb-6">
                                                            <div>
                                                                <h4 className="font-black text-slate-900 text-lg">
                                                                    {plan.unitId === 'FOUNDATION' ? 'Konsolidasi Yayasan' : (units.find(u => u.id === plan.unitId)?.name || 'Bidang')}
                                                                </h4>
                                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                                                                    Review Draft Anggaran {academicYears.find(ay => ay.id === plan.academicYearId)?.name}
                                                                </p>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <button 
                                                                    onClick={() => handleApproval(plan.id, 'APPROVED')}
                                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-100"
                                                                >
                                                                    <CheckCircle2 size={16} />
                                                                    ACC SEKARANG
                                                                </button>
                                                                <button 
                                                                    onClick={() => setShowRejectionInput(plan.id)}
                                                                    className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-3 rounded-2xl font-black text-xs flex items-center gap-2 shadow-lg shadow-rose-100"
                                                                >
                                                                    <XCircle size={16} />
                                                                    TOLAK
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {showRejectionInput === plan.id && (
                                                            <div className="mt-4 p-6 bg-white rounded-3xl border-2 border-rose-100 animate-in slide-in-from-top-4">
                                                                <label className="form-label text-rose-600 flex items-center gap-2">
                                                                    <MessageSquare size={14} />
                                                                    Alasan Penolakan
                                                                </label>
                                                                <textarea 
                                                                    className="form-textarea mt-2 mb-4 h-24"
                                                                    placeholder="Tulis alasan mengapa anggaran ini ditolak agar unit bisa memperbaikinya..."
                                                                    value={rejectionReason}
                                                                    onChange={e => setRejectionReason(e.target.value)}
                                                                />
                                                                <div className="flex justify-end gap-3">
                                                                    <button onClick={() => setShowRejectionInput(null)} className="btn btn-secondary !rounded-xl">Batal</button>
                                                                    <button 
                                                                        onClick={() => handleApproval(plan.id, 'REJECTED', rejectionReason)}
                                                                        className="btn btn-primary !bg-rose-600 !hover:bg-rose-700 !rounded-xl"
                                                                    >
                                                                        Konfirmasi Tolak
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                        
                                                        <div className="grid grid-cols-2 gap-4 mt-4">
                                                            <div className="p-4 bg-white rounded-2xl border border-indigo-100">
                                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Target Penerimaan</p>
                                                                <p className="font-black text-slate-900">{formatRupiah(Object.values(plan.income || {}).reduce((s, v) => s + v, 0))}</p>
                                                            </div>
                                                            <div className="p-4 bg-white rounded-2xl border border-indigo-100">
                                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Belanja</p>
                                                                <p className="font-black text-slate-900">{formatRupiah(Object.values(plan.expense || {}).reduce((s, v) => s + v, 0))}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}

                                                {(rabPlans || []).filter(p => p.status === 'PENDING').length === 0 && (
                                                    <div className="text-center py-20 bg-slate-50 rounded-[40px] border-4 border-dashed border-slate-100">
                                                        <CheckCircle2 size={48} className="mx-auto text-emerald-400 mb-4" />
                                                        <h4 className="font-black text-slate-900 uppercase text-xs tracking-widest">Semua Bersih!</h4>
                                                        <p className="text-slate-400 text-sm font-medium">Tidak ada anggaran yang menunggu review saat ini.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Empty State */}
                    {(activeTab === 'INCOME' ? (incomeItems || []) : (expenseItems || [])).length === 0 && (
                        <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
                            <div className="p-6 bg-slate-100 rounded-full text-slate-300">
                                <Layers size={48} />
                            </div>
                            <div>
                                <h4 className="font-black text-slate-900 uppercase text-xs tracking-widest">Master Data Kosong</h4>
                                <p className="text-slate-400 text-sm font-medium">Silakan tambahkan item {activeTab.toLowerCase()} di menu pengaturan terlebih dahulu.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Float Info Box */}
            {message && (
                <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-8 py-5 rounded-[2rem] shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-10 duration-500 z-[2000] ${
                    message.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                }`}>
                    <div className="p-2 bg-white/20 rounded-xl">
                        {message.type === 'success' ? <ShieldCheck size={20} /> : <AlertCircle size={20} />}
                    </div>
                    <div>
                        <p className="font-black text-sm tracking-tight">{message.text}</p>
                    </div>
                    <button onClick={() => setMessage(null)} className="ml-4 p-1 hover:bg-white/10 rounded-lg transition-colors">
                        <ChevronRight size={18} />
                    </button>
                </div>
            )}

            {/* Special Notification Pop-up for ACC/Reject */}
            {showStatusModal && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md" onClick={handleAcknowledgeStatus} />
                    <div className={`bg-white rounded-[3rem] w-full max-w-lg relative z-10 shadow-2xl overflow-hidden animate-in zoom-in duration-300 border-b-[12px] ${
                        currentPlan.status === 'APPROVED' ? 'border-emerald-500' : 'border-rose-500'
                    }`}>
                        <div className="p-10 text-center">
                            <div className={`w-24 h-24 mx-auto mb-6 rounded-[2rem] flex items-center justify-center shadow-2xl ${
                                currentPlan.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                            }`}>
                                {currentPlan.status === 'APPROVED' ? <CheckCircle2 size={48} strokeWidth={2.5} /> : <AlertCircle size={48} strokeWidth={2.5} />}
                            </div>

                            <h2 className="text-3xl font-black text-slate-900 mb-2 font-display">
                                Anggaran {currentPlan.status === 'APPROVED' ? 'Telah Di-ACC!' : 'Perlu Revisi'}
                            </h2>
                            <p className="text-slate-500 font-medium mb-8">
                                {currentPlan.status === 'APPROVED' 
                                    ? `Alhamdulillah, rencana anggaran unit Anda untuk periode ${academicYears.find(ay => ay.id === selectedYearId)?.name} telah disetujui oleh Yayasan.`
                                    : 'Mohon maaf, rencana anggaran Anda belum dapat disetujui dan memerlukan beberapa perbaikan.'
                                }
                            </p>

                            {currentPlan.status === 'REJECTED' && currentPlan.rejectionReason && (
                                <div className="mb-8 p-6 bg-rose-50 rounded-3xl border border-rose-100 text-left">
                                    <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <MessageSquare size={14} />
                                        Alasan Penolakan:
                                    </p>
                                    <p className="text-sm font-bold text-rose-800 leading-relaxed italic">
                                        "{currentPlan.rejectionReason}"
                                    </p>
                                </div>
                            )}

                            <button 
                                onClick={handleAcknowledgeStatus}
                                className={`w-full py-5 rounded-2xl font-black text-sm tracking-tight transition-all shadow-xl active:scale-95 ${
                                    currentPlan.status === 'APPROVED' 
                                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200' 
                                        : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200'
                                }`}
                            >
                                SAYA MENGERTI
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
