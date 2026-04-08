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

// Helper to generate 12 months for an academic year (July to June)
const generateMonths = (academicYearName) => {
    if (!academicYearName) return [];
    const [startYearStr, endYearStr] = academicYearName.split('/');
    const startYear = parseInt(startYearStr);
    const endYear = parseInt(endYearStr);
    
    const months = [];
    const monthNames = [
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni'
    ];

    monthNames.forEach((name, index) => {
        const year = index < 6 ? startYear : endYear;
        const monthNum = index < 6 ? (index + 7) : (index - 5);
        months.push({
            id: `${year}-${String(monthNum).padStart(2, '0')}`,
            name: `${name}-${year}`,
            label: name,
            year: year
        });
    });
    return months;
};

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
    const [searchTerm, setSearchTerm] = useState('');
    const [fundSourceFilter, setFundSourceFilter] = useState('all');
    const [editingItem, setEditingItem] = useState(null); // { id, name, sourceOfFunds }

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

    const handleItemUpdate = (itemId, field, value) => {
        const type = activeTab.toLowerCase();
        setCurrentPlan(prev => {
            const currentItem = prev[type][itemId] || {
                volume: 0, satuan: '', kali: 1, harga: 0, total: 0, months: {}
            };
            
            const updatedItem = { ...currentItem, [field]: value };
            
            // Recalculate total if volume, kali, or harga changes
            if (['volume', 'kali', 'harga'].includes(field)) {
                updatedItem.total = (parseFloat(updatedItem.volume) || 0) * 
                                   (parseFloat(updatedItem.kali) || 0) * 
                                   (parseFloat(updatedItem.harga) || 0);
            }
            
            return {
                ...prev,
                [type]: { ...prev[type], [itemId]: updatedItem }
            };
        });
    };

    const handleCloseModal = () => {
        setEditingItem(null);
        setMessage({ type: 'success', text: 'Rincian sementara disimpan ke draft. Klik "SIMPAN DRAFT" di atas untuk menyimpan ke database!' });
        setTimeout(() => setMessage(null), 8000);
    };

    const handleMonthlyUpdate = (itemId, monthId, field, value) => {
        const type = activeTab.toLowerCase();
        setCurrentPlan(prev => {
            const currentItem = prev[type][itemId] || {
                volume: 0, satuan: '', kali: 1, harga: 0, total: 0, months: {}
            };
            
            const currentMonths = currentItem.months || {};
            const currentMonthData = currentMonths[monthId] || { jumlah: 0, m: false };
            
            const updatedMonthData = { ...currentMonthData, [field]: value };
            const updatedMonths = { ...currentMonths, [monthId]: updatedMonthData };
            
            return {
                ...prev,
                [type]: {
                    ...prev[type],
                    [itemId]: { ...currentItem, months: updatedMonths }
                }
            };
        });
    };

    const handleDistributeMonthly = (itemId) => {
        const type = activeTab.toLowerCase();
        const item = currentPlan[type][itemId];
        if (!item || item.total <= 0) return;

        const perMonth = Math.floor(item.total / 12);
        const remainder = item.total % 12;

        const updatedMonths = {};
        months.forEach((m, idx) => {
            updatedMonths[m.id] = { 
                jumlah: perMonth + (idx === 0 ? remainder : 0), 
                m: true 
            };
        });

        setCurrentPlan(prev => ({
            ...prev,
            [type]: {
                ...prev[type],
                [itemId]: { ...item, months: updatedMonths }
            }
        }));
    };

    const months = useMemo(() => {
        const selectedYear = academicYears.find(ay => ay.id === selectedYearId);
        return generateMonths(selectedYear?.name);
    }, [selectedYearId, academicYears]);

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
        Object.values(currentPlan.income).reduce((sum, val) => sum + (val.total || 0), 0)
    , [currentPlan.income]);

    const totalExpense = useMemo(() => 
        Object.values(currentPlan.expense).reduce((sum, val) => sum + (val.total || 0), 0)
    , [currentPlan.expense]);

    const balance = totalIncome - totalExpense;

    return (
        <div className="p-4 lg:p-10 max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-700">
            {/* Top Toolbar */}
            <div className="flex flex-col gap-6">
                <div className="flex items-center gap-4 flex-wrap">
                    <select 
                        className="p-3 bg-white border border-slate-300 rounded-lg font-bold text-slate-700 min-w-[200px] shadow-sm"
                        value={selectedUnitId}
                        onChange={e => setSelectedUnitId(e.target.value)}
                        disabled={currentUser?.role !== 'superadmin'}
                    >
                        <option value="FOUNDATION">Yayasan (Konsolidasi)</option>
                        {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>

                    <select 
                        className="p-3 bg-white border border-slate-300 rounded-lg font-bold text-slate-700 min-w-[200px] shadow-sm"
                        value={fundSourceFilter}
                        onChange={e => setFundSourceFilter(e.target.value)}
                    >
                        <option value="all">Semua Sumber Dana</option>
                        <option value="Yayasan">Yayasan</option>
                        <option value="BOS">BOS</option>
                    </select>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <input 
                        type="text"
                        placeholder="Cari Program Belanja..."
                        className="p-3 bg-white border border-slate-300 rounded-lg font-medium text-slate-700 w-full max-w-[300px] shadow-sm focus:ring-2 focus:ring-blue-100 outline-none"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                    
                    <button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-black text-xs transition-all shadow-md">
                        Cari
                    </button>
                    
                    <div className="flex items-center gap-3 ml-auto">
                        <button 
                            onClick={handleSave}
                            disabled={isSaving || !selectedYearId || isLocked}
                            className="bg-white border border-slate-300 hover:border-slate-900 text-slate-900 px-6 py-3 rounded-lg font-black text-xs transition-all disabled:opacity-50 shadow-sm"
                        >
                            SIMPAN DRAFT
                        </button>
                        <button 
                            onClick={handleSubmitReview}
                            disabled={isSaving || !selectedYearId || isLocked}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-lg font-black text-xs transition-all shadow-md disabled:opacity-50"
                        >
                            KIRIM KE YAYASAN
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-6 bg-slate-50 border border-slate-200 rounded-2xl shadow-inner">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</p>
                        <p className={`font-black uppercase tracking-tight ${currentPlan.status === 'APPROVED' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {currentPlan.status === 'APPROVED' ? 'Approved' : 'Not approved'}
                        </p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status Pengisian</p>
                        <p className="font-black text-slate-700 italic">
                            Pengisian semester {new Date().getMonth() > 5 ? '1' : '2'}
                        </p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Keterangan</p>
                        <p className="font-black text-slate-400">-</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status Pengajuan</p>
                        <p className="font-black text-slate-700 italic">
                            {currentPlan.status === 'DRAFT' ? 'Belum Diajukan' : 'Sudah Diajukan'}
                        </p>
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
                                {activeTab === 'INCOME' ? 'Rencana Penerimaan Dana' : (activeTab === 'EXPENSE' ? 'Pagu Pengeluaran Operasional' : 'Review Draft Anggaran')}
                            </h3>
                            <p className="text-slate-400 text-sm font-medium">
                                {activeTab === 'REVIEW' ? 'Review pengajuan anggaran dari setiap unit dan bidang struktural.' : 'Input nilai estimasi kas masuk/keluar untuk satu periode tahun ajaran.'}
                            </p>
                        </div>
                        <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <Filter size={14} />
                            Tampilkan: Semua Pos
                        </div>
                    </div>

                    {activeTab !== 'REVIEW' ? (
                        <div className="overflow-hidden border-2 border-slate-200 rounded-[2.5rem] shadow-xl bg-white relative">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-[#cbdba6] text-slate-800 text-[10px] uppercase font-black tracking-widest border-b border-white">
                                        <th className="p-6">Item Anggaran</th>
                                        <th className="p-6">Sumber Dana</th>
                                        <th className="p-6 text-right">Alokasi (PAGU)</th>
                                        <th className="p-6 text-right">Rencana (DRAFT)</th>
                                        <th className="p-6 text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {(activeTab === 'INCOME' ? (incomeItems || []) : (expenseItems || []))
                                        .filter(item => {
                                            const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
                                            const matchesFund = fundSourceFilter === 'all' || item.sourceOfFunds === fundSourceFilter;
                                            return matchesSearch && matchesFund;
                                        })
                                        .map(item => {
                                            const type = activeTab.toLowerCase();
                                            const detail = currentPlan[type][item.id] || { 
                                                volume: 0, satuan: '', kali: 1, harga: 0, total: 0, months: {} 
                                            };
                                            const allocated = rapData.itemAllocations[item.id] || 0;
                                            const isOverBudget = activeTab === 'EXPENSE' && detail.total > (allocated + 1) && allocated > 0;
                                            const hasData = detail.total > 0;

                                            return (
                                                <tr key={item.id} className={`group hover:bg-slate-50 transition-colors ${isOverBudget ? 'bg-rose-50/30' : ''}`}>
                                                    <td className="p-6">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-2 h-2 rounded-full ${hasData ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                                                            <span className="font-bold text-slate-700 text-sm uppercase tracking-tight">{item.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-6">
                                                        <span className="px-3 py-1 bg-white border border-slate-200 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                            {item.sourceOfFunds || 'LAINNYA'}
                                                        </span>
                                                    </td>
                                                    <td className="p-6 text-right text-xs font-black text-slate-400 italic">
                                                        {formatRupiah(allocated)}
                                                    </td>
                                                    <td className={`p-6 text-right text-sm font-black ${isOverBudget ? 'text-rose-600' : (hasData ? 'text-emerald-600' : 'text-slate-300')}`}>
                                                        {formatRupiah(detail.total)}
                                                    </td>
                                                    <td className="p-6 text-center">
                                                        <button 
                                                            onClick={() => setEditingItem(item)}
                                                            className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                                                                hasData 
                                                                ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' 
                                                                : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                                            }`}
                                                        >
                                                            {hasData ? 'Ubah Rincian' : 'Isi Rincian'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
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
                                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-medium mt-2 mb-4 h-24 focus:ring-2 focus:ring-rose-100 outline-none"
                                                placeholder="Tulis alasan mengapa anggaran ini ditolak agar unit bisa memperbaikinya..."
                                                value={rejectionReason}
                                                onChange={e => setRejectionReason(e.target.value)}
                                            />
                                            <div className="flex justify-end gap-3">
                                                <button onClick={() => setShowRejectionInput(null)} className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs uppercase">Batal</button>
                                                <button 
                                                    onClick={() => handleApproval(plan.id, 'REJECTED', rejectionReason)}
                                                    className="px-6 py-3 bg-rose-600 text-white rounded-xl font-bold text-xs uppercase shadow-md shadow-rose-100"
                                                >
                                                    Konfirmasi Tolak
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    
                                    <div className="grid grid-cols-2 gap-4 mt-4">
                                        <div className="p-4 bg-white rounded-2xl border border-indigo-100">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Target Penerimaan</p>
                                            <p className="font-black text-slate-900">{formatRupiah(Object.values(plan.income || {}).reduce((s, v) => s + (v.total || 0), 0))}</p>
                                        </div>
                                        <div className="p-4 bg-white rounded-2xl border border-indigo-100">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Belanja</p>
                                            <p className="font-black text-slate-900">{formatRupiah(Object.values(plan.expense || {}).reduce((s, v) => s + (v.total || 0), 0))}</p>
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
                    )}

                    {/* Empty State */}
                    {activeTab !== 'REVIEW' && (activeTab === 'INCOME' ? (incomeItems || []) : (expenseItems || [])).length === 0 && (
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

            {/* Detail Modal */}
            {editingItem && (
                <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setEditingItem(null)} />
                    <div className="bg-white rounded-[3rem] w-full max-w-5xl relative z-10 shadow-2xl overflow-hidden animate-in zoom-in duration-300 flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="p-8 lg:p-10 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 tracking-tight italic uppercase">{editingItem.name}</h2>
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-1">
                                    Sumber Dana: {editingItem.sourceOfFunds || 'Umum'} • TA {academicYears.find(ay => ay.id === selectedYearId)?.name}
                                </p>
                            </div>
                            <button 
                                onClick={() => setEditingItem(null)}
                                className="p-4 hover:bg-slate-200 rounded-2xl text-slate-400 transition-colors"
                            >
                                <XCircle size={24} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-8 lg:p-10 space-y-10">
                            {/* Calculation Details */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Volume</label>
                                    <input 
                                        type="number"
                                        className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-slate-700 outline-none focus:border-blue-500 transition-all"
                                        value={currentPlan[activeTab.toLowerCase()][editingItem.id]?.volume || ''}
                                        onChange={e => handleItemUpdate(editingItem.id, 'volume', e.target.value)}
                                        placeholder="0"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Satuan</label>
                                    <input 
                                        type="text"
                                        className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-slate-700 outline-none focus:border-blue-500 transition-all uppercase"
                                        value={currentPlan[activeTab.toLowerCase()][editingItem.id]?.satuan || ''}
                                        onChange={e => handleItemUpdate(editingItem.id, 'satuan', e.target.value)}
                                        placeholder="E.G. UNIT"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kali (Freq)</label>
                                    <input 
                                        type="number"
                                        className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-slate-700 outline-none focus:border-blue-500 transition-all"
                                        value={currentPlan[activeTab.toLowerCase()][editingItem.id]?.kali || ''}
                                        onChange={e => handleItemUpdate(editingItem.id, 'kali', e.target.value)}
                                        placeholder="1"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Harga Satuan</label>
                                    <input 
                                        type="number"
                                        className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-slate-700 outline-none focus:border-blue-500 transition-all"
                                        value={currentPlan[activeTab.toLowerCase()][editingItem.id]?.harga || ''}
                                        onChange={e => handleItemUpdate(editingItem.id, 'harga', e.target.value)}
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            {/* Monthly Breakdown Table */}
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight italic">Rincian Alokasi Per Bulan</h4>
                                    <button 
                                        onClick={() => handleDistributeMonthly(editingItem.id)}
                                        className="text-blue-600 font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-blue-50 px-4 py-2 rounded-xl transition-all"
                                    >
                                        <RefreshCw size={14} />
                                        Bagi Rata (12 Bulan)
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {months.map(m => {
                                        const mData = currentPlan[activeTab.toLowerCase()][editingItem.id]?.months?.[m.id] || { jumlah: 0, m: false };
                                        return (
                                            <div key={m.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{m.label}</span>
                                                    <input 
                                                        type="checkbox"
                                                        checked={mData.m}
                                                        onChange={e => handleMonthlyUpdate(editingItem.id, m.id, 'm', e.target.checked)}
                                                        className="w-4 h-4 rounded text-blue-600"
                                                    />
                                                </div>
                                                <input 
                                                    type="number"
                                                    className="w-full bg-transparent font-black text-slate-700 outline-none border-b border-dashed border-slate-200 focus:border-blue-500 pb-1"
                                                    value={mData.jumlah || ''}
                                                    onChange={e => handleMonthlyUpdate(editingItem.id, m.id, 'jumlah', parseFloat(e.target.value) || 0)}
                                                    placeholder="0"
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-8 bg-slate-900 flex items-center justify-between text-white">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50">Total Terhitung</span>
                                <h3 className="text-3xl font-black italic">{formatRupiah(currentPlan[activeTab.toLowerCase()][editingItem.id]?.total || 0)}</h3>
                            </div>
                            <button 
                                onClick={handleCloseModal}
                                className="bg-white text-slate-900 px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-400 hover:text-white transition-all shadow-xl shadow-black/20"
                            >
                                SIMPAN RINCIAN
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
