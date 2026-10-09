import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    ArrowLeftRight, FileText, Upload, CheckCircle2, XCircle, Clock,
    AlertCircle, Search, Filter, Download, Plus, Eye, Trash2,
    Calendar, Building2, Layers, CheckCheck, X, FileCheck2,
    Send, Info, Sparkles, Printer, ExternalLink, ShieldCheck
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useApp } from '../../context/AppContext';
import { formatRupiah, formatTanggal, formatTanggalPendek } from '../../utils/format';
import { api } from '../../services/api';

export default function BudgetShiftManagement() {
    const { state, dispatch } = useApp();
    const {
        budgetShifts = [],
        expenseItems = [],
        units = [],
        fields = [],
        academicYears = [],
        currentUser,
        globalAcademicYearId
    } = state;

    const isSuperAdmin = currentUser?.role === 'superadmin';
    const isUnitAdmin = currentUser?.role === 'admin_unit';
    const isFieldAdmin = currentUser?.role === 'admin_bidang';
    const userUnitId = currentUser?.unitId;
    const userFieldId = currentUser?.fieldId;

    // Filter states
    const [selectedYearId, setSelectedYearId] = useState(
        globalAcademicYearId || academicYears.find(y => y.isCurrent)?.id || academicYears[0]?.id || ''
    );
    const [activeTab, setActiveTab] = useState('register'); // 'register', 'approval', 'new'
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [typeFilter, setTypeFilter] = useState('ALL');
    const [unitFilter, setUnitFilter] = useState('ALL');

    // Modals
    const [showFormModal, setShowFormModal] = useState(false);
    const [formMode, setFormMode] = useState('REQUEST'); // 'REQUEST' (Unit) or 'INSTRUCTION' (Pengurus)
    const [previewDoc, setPreviewDoc] = useState(null); // { title, fileProof, fileName, fileType, letterNumber }
    const [printDoc, setPrintDoc] = useState(null); // Document for official voucher slip printing
    const [rejectModal, setRejectModal] = useState(null); // Shift item being rejected
    const [rejectReason, setRejectReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Form data
    const [formData, setFormData] = useState({
        transferScope: 'INTERNAL_UNIT', // 'INTERNAL_UNIT' or 'CROSS_UNIT'
        fromUnitId: '',
        fromFieldId: '',
        toUnitId: '',
        toFieldId: '',
        fromExpenseItemId: '',
        toExpenseItemId: '',
        amount: '',
        letterNumber: '',
        letterDate: new Date().toISOString().slice(0, 10),
        reason: '',
        fileProof: null,
        fileName: '',
        fileType: ''
    });

    // Sync selected year if global changes
    useEffect(() => {
        if (globalAcademicYearId && !selectedYearId) {
            setSelectedYearId(globalAcademicYearId);
        }
    }, [globalAcademicYearId]);

    // Set default unit when opening form for unit admin
    useEffect(() => {
        if (isUnitAdmin && userUnitId) {
            setFormData(prev => ({
                ...prev,
                fromUnitId: userUnitId,
                toUnitId: userUnitId,
                transferScope: 'INTERNAL_UNIT'
            }));
        }
    }, [isUnitAdmin, userUnitId]);

    // Active year object
    const selectedYear = academicYears.find(y => y.id === selectedYearId);

    // Filtered shifts
    const filteredShifts = useMemo(() => {
        return budgetShifts.filter(s => {
            if (s.isDeleted) return false;
            if (selectedYearId && s.academicYearId !== selectedYearId) return false;

            // Unit admin restriction: can only see their own shifts (incoming or outgoing)
            if (isUnitAdmin && userUnitId) {
                if (s.fromUnitId !== userUnitId && s.toUnitId !== userUnitId) return false;
            }

            // Status filter
            if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;

            // Type filter
            if (typeFilter !== 'ALL' && s.type !== typeFilter) return false;

            // Unit dropdown filter
            if (unitFilter !== 'ALL') {
                if (s.fromUnitId !== unitFilter && s.toUnitId !== unitFilter) return false;
            }

            // Search query
            if (searchTerm.trim()) {
                const q = searchTerm.toLowerCase();
                const codeMatch = (s.code || '').toLowerCase().includes(q);
                const letterMatch = (s.letterNumber || '').toLowerCase().includes(q);
                const reasonMatch = (s.reason || '').toLowerCase().includes(q);
                const reqNameMatch = (s.requestedByName || '').toLowerCase().includes(q);
                const fromExpense = expenseItems.find(e => e.id === s.fromExpenseItemId)?.name?.toLowerCase() || '';
                const toExpense = expenseItems.find(e => e.id === s.toExpenseItemId)?.name?.toLowerCase() || '';

                if (!codeMatch && !letterMatch && !reasonMatch && !reqNameMatch && !fromExpense.includes(q) && !toExpense.includes(q)) {
                    return false;
                }
            }

            return true;
        });
    }, [budgetShifts, selectedYearId, isUnitAdmin, userUnitId, statusFilter, typeFilter, unitFilter, searchTerm, expenseItems]);

    // Pending shifts count for approval badge
    const pendingShifts = useMemo(() => {
        return budgetShifts.filter(s => {
            if (s.isDeleted || s.status !== 'PENDING') return false;
            if (selectedYearId && s.academicYearId !== selectedYearId) return false;
            if (isUnitAdmin && userUnitId) {
                return s.fromUnitId === userUnitId || s.toUnitId === userUnitId;
            }
            return true;
        });
    }, [budgetShifts, selectedYearId, isUnitAdmin, userUnitId]);

    // Statistics
    const stats = useMemo(() => {
        const activeYearShifts = budgetShifts.filter(s => !s.isDeleted && s.academicYearId === selectedYearId);
        const approved = activeYearShifts.filter(s => s.status === 'APPROVED' || s.status === 'APPLIED');
        const pending = activeYearShifts.filter(s => s.status === 'PENDING');
        const fromUnit = activeYearShifts.filter(s => s.type === 'UNIT_REQUEST');
        const fromManagement = activeYearShifts.filter(s => s.type === 'MANAGEMENT_ORDER');

        const totalNominalApproved = approved.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
        const totalNominalPending = pending.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);

        return {
            totalCount: activeYearShifts.length,
            approvedCount: approved.length,
            pendingCount: pending.length,
            totalNominalApproved,
            totalNominalPending,
            unitRequestCount: fromUnit.length,
            managementOrderCount: fromManagement.length
        };
    }, [budgetShifts, selectedYearId]);

    // Helpers
    const getUnitName = (id) => units.find(u => u.id === id)?.name || '-';
    const getFieldName = (id) => fields.find(f => f.id === id)?.name || '-';
    const getExpenseName = (id) => expenseItems.find(e => e.id === id)?.name || '(Pos Anggaran Tidak Ditemukan)';

    // Handler file upload
    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
            if (file.size > 5 * 1024 * 1024) {
                alert('Ukuran dokumen PDF maksimal 5 MB!');
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                setFormData(prev => ({
                    ...prev,
                    fileProof: event.target.result,
                    fileName: file.name,
                    fileType: 'pdf'
                }));
            };
            reader.readAsDataURL(file);
        } else if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const maxDim = 1400;
                    if (width > maxDim || height > maxDim) {
                        if (width > height) {
                            height = Math.round((height * maxDim) / width);
                            width = maxDim;
                        } else {
                            width = Math.round((width * maxDim) / height);
                            height = maxDim;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
                    setFormData(prev => ({
                        ...prev,
                        fileProof: compressedDataUrl,
                        fileName: file.name,
                        fileType: 'image'
                    }));
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        } else {
            alert('Format berkas tidak didukung. Harap unggah file PDF atau Gambar (JPG/PNG).');
        }
    };

    const resetForm = () => {
        setFormData({
            transferScope: 'INTERNAL_UNIT',
            fromUnitId: isUnitAdmin ? userUnitId : '',
            fromFieldId: '',
            toUnitId: isUnitAdmin ? userUnitId : '',
            toFieldId: '',
            fromExpenseItemId: '',
            toExpenseItemId: '',
            amount: '',
            letterNumber: '',
            letterDate: new Date().toISOString().slice(0, 10),
            reason: '',
            fileProof: null,
            fileName: '',
            fileType: ''
        });
    };

    const openCreateModal = (mode = 'REQUEST') => {
        setFormMode(mode);
        resetForm();
        if (mode === 'INSTRUCTION') {
            setFormData(prev => ({
                ...prev,
                transferScope: 'INTERNAL_UNIT'
            }));
        }
        setShowFormModal(true);
    };

    // Submit handler
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedYearId) {
            alert('Pilih Tahun Ajaran terlebih dahulu!');
            return;
        }

        const amountNum = parseFloat(formData.amount);
        if (!amountNum || amountNum <= 0) {
            alert('Nominal pergeseran harus lebih besar dari 0!');
            return;
        }

        if (!formData.reason.trim()) {
            alert('Alasan atau penjelasan urgensi pergeseran anggaran wajib diisi!');
            return;
        }

        if (!formData.letterNumber.trim() && !formData.fileProof) {
            const confirmNoDoc = window.confirm(
                'Perhatian: Nomor Surat/Memo atau Dokumen lampiran belum diisi.\nApakah ini kasus pergeseran mendadak/darurat yang suratnya akan disusulkan?'
            );
            if (!confirmNoDoc) return;
        }

        setSubmitting(true);
        try {
            const payload = {
                academicYearId: selectedYearId,
                transferScope: formData.transferScope,
                fromUnitId: formData.fromUnitId || null,
                fromFieldId: formData.fromFieldId || null,
                toUnitId: formData.toUnitId || null,
                toFieldId: formData.toFieldId || null,
                fromExpenseItemId: formData.fromExpenseItemId || null,
                toExpenseItemId: formData.toExpenseItemId || null,
                amount: amountNum,
                letterNumber: formData.letterNumber.trim() || null,
                letterDate: formData.letterDate || null,
                fileProof: formData.fileProof || null,
                fileName: formData.fileName || null,
                fileType: formData.fileType || null,
                reason: formData.reason.trim(),
                requestedBy: currentUser?.id,
                requestedByName: currentUser?.name || currentUser?.username
            };

            let res;
            if (formMode === 'INSTRUCTION') {
                payload.type = 'MANAGEMENT_ORDER';
                payload.approvedBy = currentUser?.id;
                payload.approvedByName = currentUser?.name || 'Pengurus/Yayasan';
                res = await api.createBudgetShiftInstruction(payload);
            } else {
                payload.type = 'UNIT_REQUEST';
                res = await api.createBudgetShiftRequest(payload);
            }

            if (res && (res.data || res.success)) {
                const savedItem = res.data || { ...payload, id: 'PGS-' + Date.now(), status: formMode === 'INSTRUCTION' ? 'APPLIED' : 'PENDING' };
                dispatch({ type: 'ADD_BUDGET_SHIFT', payload: savedItem });
                setShowFormModal(false);
                resetForm();
                alert(
                    formMode === 'INSTRUCTION'
                        ? '✅ Instruksi pergeseran anggaran dari Pengurus Yayasan berhasil diterapkan!'
                        : '✅ Permohonan pergeseran anggaran berhasil diajukan dan menunggu persetujuan Pengurus!'
                );
            } else {
                throw new Error(res?.error || 'Gagal menyimpan data.');
            }
        } catch (err) {
            console.error(err);
            alert(`Gagal menyimpan: ${err.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    // Approval handler
    const handleApprove = async (shift) => {
        if (!window.confirm(`Setujui permohonan pergeseran anggaran sebesar ${formatRupiah(shift.amount)} untuk ${getUnitName(shift.fromUnitId)}?`)) {
            return;
        }

        try {
            const res = await api.approveBudgetShift(shift.id, {
                approvedBy: currentUser?.id,
                approvedByName: currentUser?.name || 'Superadmin'
            });

            if (res && (res.success || res.data)) {
                dispatch({
                    type: 'UPDATE_BUDGET_SHIFT',
                    payload: {
                        id: shift.id,
                        status: 'APPROVED',
                        approvedBy: currentUser?.id,
                        approvedByName: currentUser?.name || 'Superadmin',
                        approvedAt: new Date().toISOString()
                    }
                });
                alert('✅ Permohonan pergeseran anggaran telah disetujui.');
            } else {
                throw new Error(res?.error || 'Gagal menyetujui');
            }
        } catch (err) {
            alert(`Gagal memproses persetujuan: ${err.message}`);
        }
    };

    // Rejection handler
    const handleConfirmReject = async () => {
        if (!rejectReason.trim()) {
            alert('Alasan penolakan permohonan wajib diisi!');
            return;
        }

        try {
            const res = await api.rejectBudgetShift(rejectModal.id, {
                approvedBy: currentUser?.id,
                approvedByName: currentUser?.name || 'Superadmin',
                rejectionReason: rejectReason.trim()
            });

            if (res && (res.success || res.data)) {
                dispatch({
                    type: 'UPDATE_BUDGET_SHIFT',
                    payload: {
                        id: rejectModal.id,
                        status: 'REJECTED',
                        rejectionReason: rejectReason.trim(),
                        approvedBy: currentUser?.id,
                        approvedByName: currentUser?.name || 'Superadmin',
                        approvedAt: new Date().toISOString()
                    }
                });
                setRejectModal(null);
                setRejectReason('');
                alert('Permohonan pergeseran anggaran telah ditolak.');
            } else {
                throw new Error(res?.error || 'Gagal menolak');
            }
        } catch (err) {
            alert(`Gagal memproses penolakan: ${err.message}`);
        }
    };

    // Delete handler
    const handleDelete = async (shift) => {
        if (!window.confirm(`Hapus catatan pergeseran anggaran ${shift.code}?`)) return;

        try {
            await api.deleteBudgetShift(shift.id);
            dispatch({ type: 'DELETE_BUDGET_SHIFT', payload: shift.id });
        } catch (err) {
            alert(`Gagal menghapus: ${err.message}`);
        }
    };

    // Export Excel Register
    const exportToExcel = () => {
        const rows = filteredShifts.map((s, idx) => ({
            'No': idx + 1,
            'No. Registrasi': s.code || '-',
            'Tanggal': formatTanggalPendek(s.createdAt),
            'Tipe Alur': s.type === 'MANAGEMENT_ORDER' ? 'Instruksi Pengurus' : 'Permohonan Unit',
            'Ruang Lingkup': s.transferScope === 'CROSS_UNIT' ? 'Lintas Unit' : 'Internal Unit',
            'Unit Asal': getUnitName(s.fromUnitId),
            'Pos Asal (Dipangkas)': getExpenseName(s.fromExpenseItemId),
            'Unit Tujuan': getUnitName(s.toUnitId),
            'Pos Tujuan (Ditambah)': getExpenseName(s.toExpenseItemId),
            'Nominal (Rp)': parseFloat(s.amount) || 0,
            'No. Surat / Memo': s.letterNumber || '(Tanpa No Surat)',
            'Tgl Surat': s.letterDate ? formatTanggalPendek(s.letterDate) : '-',
            'Alasan / Urgensi': s.reason || '-',
            'Status': s.status,
            'Diajukan Oleh': s.requestedByName || '-',
            'Disetujui Oleh': s.approvedByName || '-'
        }));

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Register Pergeseran Anggaran');
        XLSX.writeFile(wb, `Register_Pergeseran_Anggaran_${selectedYear?.name || 'All'}.xlsx`);
    };

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white p-6 md:p-8 rounded-3xl shadow-xl shadow-indigo-950/20 relative overflow-hidden">
                <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
                
                <div className="relative z-10 space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-semibold text-blue-200">
                        <ArrowLeftRight className="w-3.5 h-3.5 text-cyan-400" />
                        Tata Kelola & Mutasi Anggaran Berjalan
                    </div>
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-3">
                        Pergeseran & Revisi Anggaran
                    </h1>
                    <p className="text-sm text-blue-100/75 max-w-2xl leading-relaxed">
                        Pencatatan resmi pergeseran mata anggaran mendadak maupun berkala dengan bukti surat permohonan unit dan memo instruksi yayasan secara transparan.
                    </p>
                </div>

                <div className="relative z-10 flex flex-wrap items-center gap-3">
                    {/* Tahun Ajaran Selector */}
                    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-1.5 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-blue-300 ml-2" />
                        <select
                            value={selectedYearId}
                            onChange={(e) => setSelectedYearId(e.target.value)}
                            className="bg-transparent text-white font-bold text-sm focus:outline-none pr-3 py-1 cursor-pointer"
                        >
                            {academicYears.filter(y => !y.isDeleted).map(y => (
                                <option key={y.id} value={y.id} className="text-slate-800">
                                    TA {y.name} {y.isCurrent ? '(Aktif)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                        {isSuperAdmin && (
                            <button
                                onClick={() => openCreateModal('INSTRUCTION')}
                                className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-2xl font-bold text-xs shadow-lg shadow-amber-500/30 flex items-center gap-2 transition-all transform active:scale-95"
                            >
                                <Sparkles className="w-4 h-4" />
                                + Memo Instruksi Pengurus
                            </button>
                        )}

                        <button
                            onClick={() => openCreateModal('REQUEST')}
                            className="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-2xl font-bold text-xs shadow-lg shadow-blue-500/30 flex items-center gap-2 transition-all transform active:scale-95"
                        >
                            <Plus className="w-4 h-4" />
                            + Ajukan Pergeseran
                        </button>
                    </div>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                        <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pergeseran Disetujui</div>
                        <div className="text-xl font-black text-slate-900">{formatRupiah(stats.totalNominalApproved)}</div>
                        <div className="text-[11px] font-medium text-emerald-600 mt-0.5">{stats.approvedCount} transaksi diterapkan</div>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                        <Clock className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Menunggu Persetujuan</div>
                        <div className="text-xl font-black text-slate-900">{formatRupiah(stats.totalNominalPending)}</div>
                        <div className="text-[11px] font-medium text-amber-600 mt-0.5">{stats.pendingCount} permohonan antre</div>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Permohonan Unit</div>
                        <div className="text-xl font-black text-slate-900">{stats.unitRequestCount} Berkas</div>
                        <div className="text-[11px] font-medium text-slate-500 mt-0.5">Bottom-Up (Surat Permohonan)</div>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                        <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Instruksi Pengurus</div>
                        <div className="text-xl font-black text-slate-900">{stats.managementOrderCount} Berkas</div>
                        <div className="text-[11px] font-medium text-indigo-600 mt-0.5">Top-Down (Memo / SK Yayasan)</div>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setActiveTab('register')}
                        className={`px-5 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all ${
                            activeTab === 'register'
                                ? 'bg-slate-900 text-white shadow-md'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        <FileText className="w-4 h-4" />
                        Buku Register Pergeseran ({filteredShifts.length})
                    </button>

                    <button
                        onClick={() => setActiveTab('approval')}
                        className={`px-5 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all relative ${
                            activeTab === 'approval'
                                ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
                                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                        }`}
                    >
                        <Clock className="w-4 h-4" />
                        Meja Persetujuan
                        {pendingShifts.length > 0 && (
                            <span className="ml-1 px-2 py-0.5 bg-rose-500 text-white text-[10px] rounded-full font-black animate-pulse">
                                {pendingShifts.length}
                            </span>
                        )}
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={exportToExcel}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-semibold text-xs flex items-center gap-2 transition-all border border-slate-200"
                    >
                        <Download className="w-3.5 h-3.5" />
                        Export Excel
                    </button>
                </div>
            </div>

            {/* TAB 1: BUKU REGISTER PERGESERAN */}
            {activeTab === 'register' && (
                <div className="space-y-4">
                    {/* Filter Bar */}
                    <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="relative flex-1 max-w-md">
                            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Cari nomor surat, kode reg, pos anggaran, atau alasan..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:border-blue-500 transition-all font-medium text-slate-800"
                            />
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer"
                            >
                                <option value="ALL">Semua Status</option>
                                <option value="PENDING">Menunggu Persetujuan</option>
                                <option value="APPROVED">Disetujui</option>
                                <option value="APPLIED">Diterapkan (Instruksi)</option>
                                <option value="REJECTED">Ditolak</option>
                            </select>

                            <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer"
                            >
                                <option value="ALL">Semua Tipe</option>
                                <option value="UNIT_REQUEST">Permohonan Unit</option>
                                <option value="MANAGEMENT_ORDER">Instruksi Pengurus</option>
                            </select>

                            {!isUnitAdmin && (
                                <select
                                    value={unitFilter}
                                    onChange={(e) => setUnitFilter(e.target.value)}
                                    className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer"
                                >
                                    <option value="ALL">Semua Unit</option>
                                    {units.filter(u => !u.isDeleted).map(u => (
                                        <option key={u.id} value={u.id}>{u.name}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>

                    {/* Table View */}
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-black text-slate-400 uppercase tracking-wider">
                                        <th className="py-4 px-4 text-center w-12">No</th>
                                        <th className="py-4 px-4">No. Registrasi & Tanggal</th>
                                        <th className="py-4 px-4">Tipe & Lingkup</th>
                                        <th className="py-4 px-4">Pergeseran Pos Belanja</th>
                                        <th className="py-4 px-4 text-right">Nominal</th>
                                        <th className="py-4 px-4">Surat / Memo Bukti</th>
                                        <th className="py-4 px-4">Status</th>
                                        <th className="py-4 px-4 text-center w-28">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                                    {filteredShifts.length === 0 ? (
                                        <tr>
                                            <td colSpan="8" className="text-center py-12 text-slate-400">
                                                <ArrowLeftRight className="w-10 h-10 mx-auto text-slate-300 mb-2 stroke-[1.5]" />
                                                Belum ada data pergeseran anggaran yang sesuai kriteria.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredShifts.map((s, idx) => {
                                            const isApprovedOrApplied = s.status === 'APPROVED' || s.status === 'APPLIED';
                                            const isPending = s.status === 'PENDING';
                                            const isRejected = s.status === 'REJECTED';

                                            return (
                                                <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                                                    <td className="py-4 px-4 text-center text-slate-400 font-bold">{idx + 1}</td>
                                                    <td className="py-4 px-4">
                                                        <div className="font-bold text-slate-900">{s.code || '-'}</div>
                                                        <div className="text-[11px] text-slate-400">{formatTanggalPendek(s.createdAt)}</div>
                                                    </td>
                                                    <td className="py-4 px-4">
                                                        <div className="flex flex-col gap-1 items-start">
                                                            {s.type === 'MANAGEMENT_ORDER' ? (
                                                                <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-200">
                                                                    Instruksi Pengurus
                                                                </span>
                                                            ) : (
                                                                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200">
                                                                    Permohonan Unit
                                                                </span>
                                                            )}
                                                            <span className="text-[10px] text-slate-500 font-medium">
                                                                {s.transferScope === 'CROSS_UNIT' ? 'Lintas Unit' : 'Internal Unit'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-4 max-w-xs">
                                                        <div className="space-y-1">
                                                            <div className="text-rose-600 flex items-center gap-1.5">
                                                                <span className="text-[10px] font-black uppercase px-1 rounded bg-rose-50 border border-rose-200">DARI (-)</span>
                                                                <span className="font-bold truncate">{getExpenseName(s.fromExpenseItemId)}</span>
                                                            </div>
                                                            {s.fromUnitId !== s.toUnitId && (
                                                                <div className="text-[10px] text-slate-400 pl-7">Unit: {getUnitName(s.fromUnitId)}</div>
                                                            )}
                                                            <div className="text-emerald-600 flex items-center gap-1.5">
                                                                <span className="text-[10px] font-black uppercase px-1 rounded bg-emerald-50 border border-emerald-200">KE (+)</span>
                                                                <span className="font-bold truncate">{getExpenseName(s.toExpenseItemId)}</span>
                                                            </div>
                                                            {s.fromUnitId !== s.toUnitId && (
                                                                <div className="text-[10px] text-slate-400 pl-7">Unit: {getUnitName(s.toUnitId)}</div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-4 text-right">
                                                        <div className="font-black text-slate-900 text-sm">
                                                            {formatRupiah(s.amount)}
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-4">
                                                        <div className="space-y-1">
                                                            <div className="font-semibold text-slate-800">
                                                                {s.letterNumber || <span className="text-amber-600 italic text-[11px] font-normal">(Tanpa No Surat)</span>}
                                                            </div>
                                                            {s.fileProof ? (
                                                                <button
                                                                    onClick={() => setPreviewDoc({
                                                                        title: s.code,
                                                                        fileProof: s.fileProof,
                                                                        fileName: s.fileName || 'Dokumen Bukti',
                                                                        fileType: s.fileType || (s.fileName?.endsWith('.pdf') ? 'pdf' : 'image'),
                                                                        letterNumber: s.letterNumber
                                                                    })}
                                                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline"
                                                                >
                                                                    <Eye className="w-3 h-3" />
                                                                    Lihat Bukti Berkas
                                                                </button>
                                                            ) : (
                                                                <span className="text-[10px] text-slate-400 italic">Tidak ada lampiran berkas</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-4">
                                                        {isPending && (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                                                                <Clock className="w-3 h-3" />
                                                                Menunggu
                                                            </span>
                                                        )}
                                                        {isApprovedOrApplied && (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                                                <CheckCircle2 className="w-3 h-3" />
                                                                {s.status === 'APPLIED' ? 'Diterapkan' : 'Disetujui'}
                                                            </span>
                                                        )}
                                                        {isRejected && (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold" title={s.rejectionReason}>
                                                                <XCircle className="w-3 h-3" />
                                                                Ditolak
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-4 px-4 text-center">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <button
                                                                onClick={() => setPrintDoc(s)}
                                                                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                                                                title="Cetak Berita Acara Pergeseran"
                                                            >
                                                                <Printer className="w-4 h-4" />
                                                            </button>

                                                            {isSuperAdmin && isPending && (
                                                                <>
                                                                    <button
                                                                        onClick={() => handleApprove(s)}
                                                                        className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors"
                                                                        title="Setujui Permohonan"
                                                                    >
                                                                        <CheckCircle2 className="w-4 h-4" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            setRejectModal(s);
                                                                            setRejectReason('');
                                                                        }}
                                                                        className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors"
                                                                        title="Tolak Permohonan"
                                                                    >
                                                                        <XCircle className="w-4 h-4" />
                                                                    </button>
                                                                </>
                                                            )}

                                                            {isSuperAdmin && (
                                                                <button
                                                                    onClick={() => handleDelete(s)}
                                                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                                    title="Hapus Catatan"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: MEJA PERSETUJUAN (APPROVAL QUEUE) */}
            {activeTab === 'approval' && (
                <div className="space-y-4">
                    {pendingShifts.length === 0 ? (
                        <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center text-slate-400 shadow-sm">
                            <CheckCheck className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                            <h3 className="text-base font-bold text-slate-800">Semua Permohonan Telah Diproses</h3>
                            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                                Tidak ada permohonan pergeseran anggaran yang sedang menunggu persetujuan saat ini.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {pendingShifts.map((s) => (
                                <div key={s.id} className="bg-white rounded-3xl border border-amber-200/80 shadow-md p-6 space-y-4 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-amber-400 to-orange-500" />
                                    
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                                                Menunggu Persetujuan
                                            </span>
                                            <h3 className="font-black text-slate-900 text-lg mt-2">{s.code}</h3>
                                            <div className="text-xs text-slate-500">
                                                Diajukan oleh: <span className="font-semibold text-slate-700">{s.requestedByName || 'Unit'}</span> ({formatTanggal(s.createdAt)})
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] font-bold text-slate-400 uppercase">Nominal Digeser</div>
                                            <div className="text-xl font-black text-blue-600">{formatRupiah(s.amount)}</div>
                                        </div>
                                    </div>

                                    {/* Pergeseran Detail */}
                                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-slate-500">Unit Terkait:</span>
                                            <span className="font-bold text-slate-800">{getUnitName(s.fromUnitId)}</span>
                                        </div>
                                        <div className="border-t border-slate-200/60 pt-2 space-y-1.5">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="font-semibold text-rose-600 flex items-center gap-1">
                                                    <span className="px-1 bg-rose-100 text-rose-700 rounded text-[9px] font-black">DARI (-)</span>
                                                    {getExpenseName(s.fromExpenseItemId)}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="font-semibold text-emerald-600 flex items-center gap-1">
                                                    <span className="px-1 bg-emerald-100 text-emerald-700 rounded text-[9px] font-black">KE (+)</span>
                                                    {getExpenseName(s.toExpenseItemId)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Penjelasan & Berkas */}
                                    <div className="space-y-2 text-xs">
                                        <div className="text-slate-500 font-semibold">Alasan / Urgensi Kebutuhan:</div>
                                        <div className="p-3 bg-amber-50/50 rounded-xl text-slate-700 italic border border-amber-100">
                                            "{s.reason}"
                                        </div>

                                        <div className="flex items-center justify-between pt-2">
                                            <span className="text-slate-500">No. Surat Permohonan:</span>
                                            <span className="font-bold text-slate-800">{s.letterNumber || '(Tanpa No Surat)'}</span>
                                        </div>

                                        {s.fileProof && (
                                            <button
                                                onClick={() => setPreviewDoc({
                                                    title: s.code,
                                                    fileProof: s.fileProof,
                                                    fileName: s.fileName || 'Dokumen Permohonan',
                                                    fileType: s.fileType || (s.fileName?.endsWith('.pdf') ? 'pdf' : 'image'),
                                                    letterNumber: s.letterNumber
                                                })}
                                                className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl flex items-center justify-center gap-2 transition-all mt-2"
                                            >
                                                <Eye className="w-3.5 h-3.5" />
                                                Periksa Surat Permohonan Unit (Lampiran)
                                            </button>
                                        )}
                                    </div>

                                    {/* Decision Actions */}
                                    {isSuperAdmin && (
                                        <div className="pt-3 border-t border-slate-100 flex items-center gap-3">
                                            <button
                                                onClick={() => handleApprove(s)}
                                                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all"
                                            >
                                                <CheckCircle2 className="w-4 h-4" />
                                                Setujui Pergeseran
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setRejectModal(s);
                                                    setRejectReason('');
                                                }}
                                                className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-2xl border border-rose-200 transition-all"
                                            >
                                                Tolak
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* MODAL: FORM PENGAJUAN / INSTRUKSI */}
            {showFormModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 md:p-8 space-y-6 my-8 animate-in fade-in zoom-in-95 duration-200 border border-slate-100">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                            <div>
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                    formMode === 'INSTRUCTION'
                                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                        : 'bg-blue-100 text-blue-800 border border-blue-200'
                                }`}>
                                    {formMode === 'INSTRUCTION' ? 'Top-Down (Kebijakan Pusat)' : 'Bottom-Up (Permohonan Unit)'}
                                </span>
                                <h2 className="text-xl font-black text-slate-900 mt-1">
                                    {formMode === 'INSTRUCTION' ? 'Instruksi Pengurus / Yayasan' : 'Form Permohonan Pergeseran Anggaran'}
                                </h2>
                            </div>
                            <button
                                onClick={() => setShowFormModal(false)}
                                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Ruang Lingkup */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Ruang Lingkup Pergeseran
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({
                                            ...prev,
                                            transferScope: 'INTERNAL_UNIT',
                                            toUnitId: prev.fromUnitId
                                        }))}
                                        className={`py-2 px-3 rounded-2xl text-xs font-bold border transition-all text-center ${
                                            formData.transferScope === 'INTERNAL_UNIT'
                                                ? 'bg-blue-50 border-blue-400 text-blue-700 shadow-sm'
                                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                        }`}
                                    >
                                        Internal Unit yang Sama
                                    </button>
                                    <button
                                        type="button"
                                        disabled={isUnitAdmin}
                                        onClick={() => setFormData(prev => ({ ...prev, transferScope: 'CROSS_UNIT' }))}
                                        className={`py-2 px-3 rounded-2xl text-xs font-bold border transition-all text-center ${
                                            formData.transferScope === 'CROSS_UNIT'
                                                ? 'bg-blue-50 border-blue-400 text-blue-700 shadow-sm'
                                                : isUnitAdmin
                                                    ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                                                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                        }`}
                                    >
                                        Lintas Unit / Bidang {isUnitAdmin ? '(Wewenang Yayasan)' : ''}
                                    </button>
                                </div>
                            </div>

                            {/* Unit Pemilihan */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Unit Sumber (Yang Dipotong) <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        disabled={isUnitAdmin}
                                        value={formData.fromUnitId}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setFormData(prev => ({
                                                ...prev,
                                                fromUnitId: val,
                                                toUnitId: prev.transferScope === 'INTERNAL_UNIT' ? val : prev.toUnitId
                                            }));
                                        }}
                                        required
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                                    >
                                        <option value="">Pilih Unit Sumber...</option>
                                        {units.filter(u => !u.isDeleted).map(u => (
                                            <option key={u.id} value={u.id}>{u.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Unit Tujuan (Yang Ditambah) <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        disabled={isUnitAdmin || formData.transferScope === 'INTERNAL_UNIT'}
                                        value={formData.toUnitId}
                                        onChange={(e) => setFormData(prev => ({ ...prev, toUnitId: e.target.value }))}
                                        required
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                                    >
                                        <option value="">Pilih Unit Sasaran...</option>
                                        {units.filter(u => !u.isDeleted).map(u => (
                                            <option key={u.id} value={u.id}>{u.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Pos Anggaran */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-3 bg-rose-50/50 rounded-2xl border border-rose-100 space-y-1.5">
                                    <label className="block text-xs font-bold text-rose-700">
                                        Pos Anggaran Sumber (-) <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        value={formData.fromExpenseItemId}
                                        onChange={(e) => setFormData(prev => ({ ...prev, fromExpenseItemId: e.target.value }))}
                                        required
                                        className="w-full p-2.5 bg-white border border-rose-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-rose-400"
                                    >
                                        <option value="">Pilih Pos yang Dikurangi...</option>
                                        {expenseItems.filter(e => !e.isDeleted).map(e => (
                                            <option key={e.id} value={e.id}>{e.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="p-3 bg-emerald-50/50 rounded-2xl border border-emerald-100 space-y-1.5">
                                    <label className="block text-xs font-bold text-emerald-700">
                                        Pos Anggaran Tujuan (+) <span className="text-emerald-500">*</span>
                                    </label>
                                    <select
                                        value={formData.toExpenseItemId}
                                        onChange={(e) => setFormData(prev => ({ ...prev, toExpenseItemId: e.target.value }))}
                                        required
                                        className="w-full p-2.5 bg-white border border-emerald-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-400"
                                    >
                                        <option value="">Pilih Pos yang Ditambah...</option>
                                        {expenseItems.filter(e => !e.isDeleted && e.id !== formData.fromExpenseItemId).map(e => (
                                            <option key={e.id} value={e.id}>{e.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Nominal */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Nominal yang Digeser (Rp) <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">Rp</span>
                                    <input
                                        type="number"
                                        min="1"
                                        placeholder="Contoh: 5000000"
                                        value={formData.amount}
                                        onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                                        required
                                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                                {formData.amount && (
                                    <div className="text-[11px] font-semibold text-blue-600 mt-1">
                                        Terbaca: {formatRupiah(formData.amount)}
                                    </div>
                                )}
                            </div>

                            {/* Legalitas: No Surat / Memo & Dokumen */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        {formMode === 'INSTRUCTION' ? 'Nomor Memo / SK Pengurus' : 'Nomor Surat Permohonan Unit'}
                                    </label>
                                    <input
                                        type="text"
                                        placeholder={formMode === 'INSTRUCTION' ? 'Contoh: MEMO/YYS/2026/042' : 'Contoh: 021/SDIT-1/V/2026'}
                                        value={formData.letterNumber}
                                        onChange={(e) => setFormData(prev => ({ ...prev, letterNumber: e.target.value }))}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Tanggal Surat / Memo
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.letterDate}
                                        onChange={(e) => setFormData(prev => ({ ...prev, letterDate: e.target.value }))}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            {/* Alasan / Urgensi */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Alasan / Justifikasi Urgensi Kebutuhan <span className="text-rose-500">*</span>
                                </label>
                                <textarea
                                    rows="3"
                                    placeholder="Jelaskan secara mendalam mengapa pergeseran anggaran ini harus dilakukan (misal: kondisi darurat sarpras rusak, efisiensi operasional, dsb)..."
                                    value={formData.reason}
                                    onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                                    required
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                                />
                            </div>

                            {/* Upload Bukti Dokumen */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Lampiran Berkas (PDF / Scan Surat Resmi / Foto Memo)
                                </label>
                                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 text-center hover:bg-slate-50 transition-colors">
                                    <input
                                        type="file"
                                        id="proofFileInput"
                                        accept="image/*,application/pdf"
                                        onChange={handleFileChange}
                                        className="hidden"
                                    />
                                    {formData.fileProof ? (
                                        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 p-3 rounded-xl">
                                            <div className="flex items-center gap-2 truncate">
                                                <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
                                                <span className="text-xs font-bold text-blue-900 truncate">
                                                    {formData.fileName || 'Dokumen Terlampir'}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, fileProof: null, fileName: '', fileType: '' }))}
                                                className="text-rose-600 hover:text-rose-800 font-bold text-xs ml-2"
                                            >
                                                Hapus
                                            </button>
                                        </div>
                                    ) : (
                                        <label htmlFor="proofFileInput" className="cursor-pointer block space-y-1">
                                            <Upload className="w-8 h-8 text-slate-400 mx-auto mb-1" />
                                            <div className="text-xs font-bold text-blue-600 hover:underline">
                                                Pilih file PDF atau Gambar
                                            </div>
                                            <div className="text-[10px] text-slate-400">
                                                Maksimal ukuran 5 MB (PDF atau Foto)
                                            </div>
                                        </label>
                                    )}
                                </div>
                            </div>

                            {/* Buttons */}
                            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowFormModal(false)}
                                    className="px-5 py-2.5 rounded-2xl font-bold text-xs text-slate-600 hover:bg-slate-100 transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className={`px-6 py-2.5 rounded-2xl font-bold text-xs text-white shadow-lg transition-all flex items-center gap-2 ${
                                        formMode === 'INSTRUCTION'
                                            ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/30'
                                            : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30'
                                    } ${submitting ? 'opacity-70 cursor-wait' : ''}`}
                                >
                                    <Send className="w-4 h-4" />
                                    {submitting ? 'Menyimpan...' : formMode === 'INSTRUCTION' ? 'Terapkan Instruksi' : 'Ajukan Permohonan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: REJECT DIALOG */}
            {rejectModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-100">
                        <div className="flex items-center gap-3 text-rose-600">
                            <div className="p-2 bg-rose-50 rounded-xl">
                                <XCircle className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900">Tolak Permohonan Pergeseran</h3>
                                <p className="text-xs text-slate-400">{rejectModal.code}</p>
                            </div>
                        </div>

                        <p className="text-xs text-slate-600">
                            Harap berikan catatan alasan mengapa permohonan pergeseran sebesar <strong>{formatRupiah(rejectModal.amount)}</strong> ini ditolak:
                        </p>

                        <textarea
                            rows="3"
                            placeholder="Alasan penolakan resmi dari yayasan..."
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:outline-none focus:border-rose-400"
                        />

                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                                onClick={() => setRejectModal(null)}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleConfirmReject}
                                className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20"
                            >
                                Konfirmasi Tolak
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: PREVIEW DOCUMENT LIGHTBOX */}
            {previewDoc && (
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-white/20">
                        <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
                            <div className="flex items-center gap-2">
                                <FileText className="w-5 h-5 text-blue-400" />
                                <div>
                                    <div className="font-bold text-sm">{previewDoc.title || 'Dokumen Bukti'}</div>
                                    <div className="text-[11px] text-slate-400">
                                        No. Surat: {previewDoc.letterNumber || '-'} ({previewDoc.fileName})
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <a
                                    href={previewDoc.fileProof}
                                    download={previewDoc.fileName || 'dokumen-bukti'}
                                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    Download
                                </a>
                                <button
                                    onClick={() => setPreviewDoc(null)}
                                    className="p-1.5 text-slate-400 hover:text-white rounded-lg"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="p-4 flex-1 overflow-auto bg-slate-100 flex items-center justify-center min-h-[400px]">
                            {previewDoc.fileType === 'pdf' || previewDoc.fileProof.startsWith('data:application/pdf') ? (
                                <iframe
                                    src={previewDoc.fileProof}
                                    className="w-full h-[70vh] rounded-2xl border border-slate-300 bg-white"
                                    title="PDF Document"
                                />
                            ) : (
                                <img
                                    src={previewDoc.fileProof}
                                    alt="Dokumen Bukti"
                                    className="max-h-[70vh] object-contain rounded-2xl shadow-lg border border-slate-200"
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: PRINT VOUCHER SLIP / BERITA ACARA */}
            {printDoc && (
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-8 max-h-[95vh] overflow-y-auto space-y-6">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                            <div className="flex items-center gap-2">
                                <Printer className="w-5 h-5 text-blue-600" />
                                <h3 className="font-bold text-slate-900 text-sm">Lembar Berita Acara Pergeseran Anggaran</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => window.print()}
                                    className="px-4 py-1.5 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 shadow-md flex items-center gap-1.5"
                                >
                                    <Printer className="w-3.5 h-3.5" /> Cetak
                                </button>
                                <button
                                    onClick={() => setPrintDoc(null)}
                                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Printable Content Area */}
                        <div className="space-y-6 text-slate-900 font-sans print:m-0" id="printVoucherSlip">
                            <div className="text-center space-y-1 pb-4 border-b-2 border-slate-900">
                                <h2 className="text-base font-black uppercase tracking-wider">YAYASAN DARELIMAN PADANG</h2>
                                <h3 className="text-sm font-bold uppercase">BERITA ACARA MUTASI & PERGESERAN ANGGARAN</h3>
                                <p className="text-xs text-slate-500">Tahun Ajaran: {selectedYear?.name || '-'}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-xs">
                                <div>
                                    <span className="text-slate-400 font-bold block">NO. REGISTRASI:</span>
                                    <span className="font-black text-sm">{printDoc.code}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-slate-400 font-bold block">TANGGAL TRANSAKSI:</span>
                                    <span className="font-bold">{formatTanggal(printDoc.createdAt)}</span>
                                </div>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Jenis Pergeseran:</span>
                                    <span className="font-bold">{printDoc.type === 'MANAGEMENT_ORDER' ? 'Instruksi Pengurus (Top-Down)' : 'Permohonan Unit (Bottom-Up)'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Dasar Dokumen:</span>
                                    <span className="font-bold">{printDoc.letterNumber || '(Tanpa Surat Resmi)'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Unit Asal:</span>
                                    <span className="font-bold">{getUnitName(printDoc.fromUnitId)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Unit Sasaran:</span>
                                    <span className="font-bold">{getUnitName(printDoc.toUnitId)}</span>
                                </div>
                            </div>

                            <div className="border border-slate-200 rounded-2xl overflow-hidden">
                                <table className="w-full text-xs">
                                    <thead className="bg-slate-100 font-bold text-slate-700">
                                        <tr>
                                            <th className="p-3 text-left">Pos Anggaran Sumber (-)</th>
                                            <th className="p-3 text-left">Pos Anggaran Sasaran (+)</th>
                                            <th className="p-3 text-right">Nominal Mutasi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="border-t border-slate-100">
                                            <td className="p-3 font-semibold text-rose-700">{getExpenseName(printDoc.fromExpenseItemId)}</td>
                                            <td className="p-3 font-semibold text-emerald-700">{getExpenseName(printDoc.toExpenseItemId)}</td>
                                            <td className="p-3 text-right font-black text-sm text-slate-900">{formatRupiah(printDoc.amount)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <div className="space-y-1 text-xs">
                                <span className="font-bold text-slate-500">Alasan & Urgensi Pergeseran:</span>
                                <p className="p-3 bg-slate-50 rounded-xl italic border border-slate-100 text-slate-700">
                                    "{printDoc.reason}"
                                </p>
                            </div>

                            {/* Signatures */}
                            <div className="pt-8 grid grid-cols-2 gap-8 text-center text-xs">
                                <div className="space-y-16">
                                    <p className="font-semibold text-slate-600">Diajukan Oleh,</p>
                                    <div>
                                        <p className="font-bold underline text-slate-900">{printDoc.requestedByName || 'Admin Unit'}</p>
                                        <p className="text-[10px] text-slate-400">Kepala Unit / Pengaju</p>
                                    </div>
                                </div>
                                <div className="space-y-16">
                                    <p className="font-semibold text-slate-600">Disetujui / Ditetapkan Oleh,</p>
                                    <div>
                                        <p className="font-bold underline text-slate-900">{printDoc.approvedByName || 'Pengurus Yayasan'}</p>
                                        <p className="text-[10px] text-slate-400">Ketua / Bendahara Yayasan</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
