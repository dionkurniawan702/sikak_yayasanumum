import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Wallet, Plus, Clock, CheckCircle, XCircle, FileText, ChevronRight, TrendingUp, AlertCircle, Calendar, Send, Building2, Landmark, Check, Search, Loader2, Gem, RotateCcw, Save } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatRupiah, generateId } from '../../utils/format';
import { api } from '../../services/api';

export default function MonthlyRequest() {
    const { state, dispatch } = useApp();
    const { currentUser, rabPlans, budgetRequests, units, fields, academicYears, globalAcademicYearId } = state;
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [processingId, setProcessingId] = useState(null);
    const [selectedComponents, setSelectedComponents] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [sourceMode, setSourceMode] = useState('YAYASAN'); // 'YAYASAN' or 'BOS'
    const [reviewRequest, setReviewRequest] = useState(null); // { req, accIds: [], tolakIds: [] }
    const [toast, setToast] = useState(null); // { message, type: 'success'|'error'|'warning' }
    
    // NEW FILTERS FOR SUPERADMIN
    const [filterUnit, setFilterUnit] = useState('NONE');
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [modalSearchTerm, setModalSearchTerm] = useState('');

    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type });
    }, []);

    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), 3500);
        return () => clearTimeout(timer);
    }, [toast]);

    // Add month selection for the request
    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const currentYear = academicYears.find(y => y.id === globalAcademicYearId);

    const yearMonths = useMemo(() => {
        if (!currentYear) return [];
        const months = [];

        try {
            // Robust Generation from settings
            if (currentYear.startDate && currentYear.endDate) {
                const start = new Date(currentYear.startDate);
                const end = new Date(currentYear.endDate);
                const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;

                let current = new Date(start);
                let safetyCounter = 0;
                while (current <= end && safetyCounter < 24) {
                    const year = current.getFullYear();
                    const monthIdx = current.getMonth();
                    const monthNum = monthIdx + 1;
                    const shortYear = String(year).slice(-2);

                    months.push({
                        id: `${year}-${String(monthNum).padStart(2, '0')}`,
                        label: `${monthNames[monthIdx]} '${shortYear}`,
                        year,
                        monthNum
                    });
                    current.setMonth(current.getMonth() + 1);
                    safetyCounter++;
                }
            }

            // Fallback to 12-month standard if still empty
            if (months.length === 0) {
                const [startYearStr, endYearStr] = (currentYear.name || '').split((currentYear.name || '').includes('/') ? '/' : '-');
                const startYear = parseInt(startYearStr) || new Date().getFullYear();
                const endYear = parseInt(endYearStr) || (startYear + 1);

                const sequence = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];
                sequence.forEach((monthNum) => {
                    const year = monthNum >= 7 ? startYear : endYear;
                    const monthIdx = monthNum - 1;
                    const shortYear = String(year).slice(-2);
                    months.push({
                        id: `${year}-${String(monthNum).padStart(2, '0')}`,
                        label: `${monthNames[monthIdx]} '${shortYear}`,
                        year,
                        monthNum
                    });
                });
            }
        } catch (err) {
            console.error('Error generating months:', err);
        }
        return months;
    }, [currentYear]);

    // Set default month to current month if in the list, otherwise first month
    const getDefaultMonth = () => {
        const now = new Date();
        const nowId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        return yearMonths.find(m => m.id === nowId)?.id || yearMonths[0]?.id || '';
    };

    const [requestMonth, setRequestMonth] = useState(getDefaultMonth());

    // Filter unit/field
    const isSuperAdmin = currentUser?.role === 'superadmin';
    const myUnitId = currentUser?.unitId;
    const myFieldId = currentUser?.fieldId;

    // Clear notifications for unit admin when they visit
    React.useEffect(() => {
        if (!isSuperAdmin && budgetRequests?.length > 0) {
            const unnotified = budgetRequests.filter(r => {
                const isMine = (myUnitId && r.unitId === myUnitId) || (myFieldId && r.fieldId === myFieldId);
                return isMine && (r.status === 'APPROVED' || r.status === 'REJECTED') && !r.notified;
            });
            if (unnotified.length > 0) {
                unnotified.forEach(r => {
                    const updated = { ...r, notified: true };
                    dispatch({ type: 'EDIT_BUDGET_REQUEST', payload: updated });
                    api.pushAction({ type: 'EDIT_BUDGET_REQUEST', payload: updated }, state);
                });
            }
        }
    }, [budgetRequests, isSuperAdmin, myUnitId, myFieldId, dispatch, state]);

    const filteredRequests = useMemo(() => {
        return (budgetRequests || []).filter(req => {
            // Filter by source (Yayasan vs BOS)
            const isBosRequest = req.source === 'BOS' || req.items?.some(i => i.planId?.endsWith('-BOS'));
            if (sourceMode === 'BOS' && !isBosRequest) return false;
            if (sourceMode === 'YAYASAN' && isBosRequest) return false;

            // Status Filter
            if (filterStatus !== 'ALL' && req.status !== filterStatus) return false;

            if (isSuperAdmin) {
                // Require Superadmin to select a unit first
                if (filterUnit === 'NONE') return false;

                // Unit Filter for Superadmin
                if (filterUnit !== 'ALL') {
                    return req.unitId === filterUnit || req.fieldId === filterUnit;
                }
                return true;
            }
            if (myUnitId) return req.unitId === myUnitId;
            if (myFieldId) return req.fieldId === myFieldId;
            return false;
        }).sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [budgetRequests, isSuperAdmin, myUnitId, myFieldId, sourceMode, filterStatus, filterUnit]);

    // Calculate which units have pending requests for the red dot indicator
    const pendingUnitIds = useMemo(() => {
        const ids = new Set();
        (budgetRequests || []).forEach(req => {
            const isBosRequest = req.source === 'BOS' || req.items?.some(i => i.planId?.endsWith('-BOS'));
            if (sourceMode === 'BOS' && !isBosRequest) return;
            if (sourceMode === 'YAYASAN' && isBosRequest) return;

            if (req.status === 'PENDING') {
                if (req.unitId) ids.add(req.unitId);
                if (req.fieldId) ids.add(req.fieldId);
            }
        });
        return ids;
    }, [budgetRequests, sourceMode]);

    // Aggregate Approved components from RAB Plans that are NOT yet requested
    const approvedComponents = useMemo(() => {
        if (!rabPlans || !requestMonth) return [];

        const myPlans = rabPlans.filter(p => {
            if (isSuperAdmin) return true;
            if (myUnitId) return p.unitId === myUnitId;
            if (myFieldId) return p.fieldId === myFieldId;
            return false;
        }).filter(p => {
            const isBosPlan = p.id?.endsWith('-BOS');
            if (sourceMode === 'BOS' && !isBosPlan) return false;
            if (sourceMode === 'YAYASAN' && isBosPlan) return false;
            return p.academicYearId === globalAcademicYearId;
        });

        const components = [];
        myPlans.forEach(plan => {
            Object.entries(plan.expense || {}).forEach(([itemId, rawItemPlans]) => {
                // Handle legacy single-object format
                const itemPlans = Array.isArray(rawItemPlans) ? rawItemPlans : (rawItemPlans && typeof rawItemPlans === 'object' && Object.keys(rawItemPlans).length > 0 ? [{ id: `P-${itemId}-LEGACY`, itemId: itemId, ...rawItemPlans }] : []);
                
                itemPlans.forEach((p, pIdx) => {
                    (p.components || []).forEach((comp, cIdx) => {
                        const compId = comp.id || `COMP-${plan.id}-${itemId}-${pIdx}-${cIdx}`;
                        
                        // NEW: Filter by selected month's allocation
                        const isScheduledInMonth = comp.months?.[requestMonth]?.m === true;
                        const monthlyAmount = parseFloat(comp.months?.[requestMonth]?.jumlah) || 0;

                        // Legacy support: comp.isApproved, New system: comp.status === 'APPROVED'
                        const isActuallyApproved = comp.status === 'APPROVED' || comp.isApproved === true;

                        if (isActuallyApproved && isScheduledInMonth && monthlyAmount > 0) {
                            // Check if already requested in budgetRequests for THIS month
                            const alreadyRequested = (budgetRequests || []).some(req =>
                                req.month === requestMonth && req.items?.some(reqItem => reqItem.componentId === compId)
                            );

                            if (!alreadyRequested) {
                                components.push({
                                    ...comp,
                                    id: compId,
                                    total: monthlyAmount, // Only request the amount planned for THIS month
                                    planId: plan.id,
                                    itemMasterName: state.expenseItems.find(i => i.id === itemId)?.name || 'Item',
                                    planDescription: p.description,
                                    expenseItemId: itemId
                                });
                            }
                        }
                    });
                });
            });
        });
        return components;
    }, [rabPlans, budgetRequests, globalAcademicYearId, isSuperAdmin, myUnitId, myFieldId, state.expenseItems, requestMonth]);

    const stats = useMemo(() => {
        const approved = approvedComponents.reduce((sum, c) => sum + (parseFloat(c.total) || 0), 0);
        const inProcess = filteredRequests.filter(r => r.status === 'PENDING').reduce((sum, r) => sum + (parseFloat(r.totalAmount) || 0), 0);
        return { approved, inProcess };
    }, [approvedComponents, filteredRequests]);

    const handleCreateRequest = (e) => {
        e.preventDefault();
        if (selectedComponents.length === 0) return alert('Pilih komponen belanja terlebih dahulu');

        const selectedData = approvedComponents.filter(c => selectedComponents.includes(c.id));
        const totalAmount = selectedData.reduce((sum, c) => sum + (parseFloat(c.total) || 0), 0);

        const newRequest = {
            id: generateId('REQ'),
            unitId: myUnitId || 'FOUNDATION',
            fieldId: myFieldId,
            academicYearId: globalAcademicYearId,
            month: requestMonth, // Add target month
            date: new Date().toISOString().split('T')[0],
            status: 'PENDING',
            totalAmount,
            source: sourceMode, // Tag as YAYASAN or BOS
            description: selectedData.map(c => c.label || c.name).join(', '),
            items: selectedData.map(c => ({
                componentId: c.id,
                name: c.label || c.name,
                amount: c.total,
                planId: c.planId,
                expenseItemId: c.expenseItemId
            }))
        };

        dispatch({ type: 'ADD_BUDGET_REQUEST', payload: newRequest });
        api.pushAction({ type: 'ADD_BUDGET_REQUEST', payload: newRequest }, state); // Immediate push
        setShowRequestModal(false);
        setSelectedComponents([]);
        showToast('Permintaan dana berhasil diajukan!');
    };

    const handleSaveReview = async () => {
        setProcessingId('saving-review');
        try {
            const { req, accIds, tolakIds } = reviewRequest;
            
            const accItems = req.items.filter(i => accIds.includes(i.componentId));
            const tolakItems = req.items.filter(i => tolakIds.includes(i.componentId));
            const pendingItems = req.items.filter(i => !accIds.includes(i.componentId) && !tolakIds.includes(i.componentId));
            
            // If all are ACC
            if (accItems.length === req.items.length) {
                const updated = { ...req, status: 'APPROVED', notified: false };
                dispatch({ type: 'EDIT_BUDGET_REQUEST', payload: updated });
                await api.pushAction({ type: 'EDIT_BUDGET_REQUEST', payload: updated }, state);
            } 
            // If all are TOLAK
            else if (tolakItems.length === req.items.length) {
                const reason = window.prompt('Alasan penolakan keseluruhan:');
                const updated = { ...req, status: 'REJECTED', rejectionReason: reason || 'Ditolak Superadmin', notified: false };
                dispatch({ type: 'EDIT_BUDGET_REQUEST', payload: updated });
                await api.pushAction({ type: 'EDIT_BUDGET_REQUEST', payload: updated }, state);
            }
            // Partial Action
            else {
                // 1. Handle ACC Items
                if (accItems.length > 0) {
                    if (pendingItems.length === 0 && tolakItems.length > 0) {
                        // Original request becomes the APPROVED one
                        const accTotal = accItems.reduce((s, i) => s + (parseFloat(i.amount)||0), 0);
                        const updated = { ...req, status: 'APPROVED', items: accItems, totalAmount: accTotal, notified: false };
                        dispatch({ type: 'EDIT_BUDGET_REQUEST', payload: updated });
                        await api.pushAction({ type: 'EDIT_BUDGET_REQUEST', payload: updated }, state);
                    } else {
                        // Create a NEW request for the APPROVED items
                        const accTotal = accItems.reduce((s, i) => s + (parseFloat(i.amount)||0), 0);
                        const newAcc = { ...req, id: generateId('REQ') + '-ACC', status: 'APPROVED', items: accItems, totalAmount: accTotal, notified: false };
                        dispatch({ type: 'ADD_BUDGET_REQUEST', payload: newAcc });
                        await api.pushAction({ type: 'ADD_BUDGET_REQUEST', payload: newAcc }, state);
                    }
                }
                
                // 2. Handle TOLAK Items
                if (tolakItems.length > 0) {
                    const tolakTotal = tolakItems.reduce((s, i) => s + (parseFloat(i.amount)||0), 0);
                    const newRej = { ...req, id: req.id + '-REJ', status: 'REJECTED', items: tolakItems, totalAmount: tolakTotal, rejectionReason: 'Sebagian ditolak', notified: false };
                    dispatch({ type: 'ADD_BUDGET_REQUEST', payload: newRej });
                    await api.pushAction({ type: 'ADD_BUDGET_REQUEST', payload: newRej }, state);
                }
                
                // 3. Handle PENDING Items (Remaining original request)
                if (pendingItems.length > 0) {
                    const pendingTotal = pendingItems.reduce((s, i) => s + (parseFloat(i.amount)||0), 0);
                    const updatedPending = { ...req, items: pendingItems, totalAmount: pendingTotal, status: 'PENDING' };
                    dispatch({ type: 'EDIT_BUDGET_REQUEST', payload: updatedPending });
                    await api.pushAction({ type: 'EDIT_BUDGET_REQUEST', payload: updatedPending }, state);
                }
            }
            
            showToast('Persetujuan berhasil disimpan!');
            setReviewRequest(null);
        } catch (err) {
            console.error(err);
            showToast('Gagal memproses persetujuan.', 'error');
        } finally {
            setProcessingId(null);
        }
    };

    const handlePrint = (req) => {
        const printWindow = window.open('', '_blank');
        const unitName = units.find(u => u.id === req.unitId)?.name || fields.find(f => f.id === req.fieldId)?.name || 'Unit/Bidang';

        const html = `
            <html>
                <head>
                    <title>Surat Pengajuan Dana - ${req.id}</title>
                    <style>
                        body { font-family: 'Times New Roman', serif; padding: 50px; line-height: 1.6; }
                        .header { text-align: center; border-bottom: 3px double #000; padding-bottom: 20px; margin-bottom: 30px; }
                        .header h1 { margin: 0; font-size: 24px; text-transform: uppercase; }
                        .header p { margin: 5px 0; font-size: 14px; }
                        .info { margin-bottom: 30px; }
                        .info table { width: 100%; }
                        .info td { vertical-align: top; }
                        .content { margin-bottom: 40px; }
                        .content table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        .content th, .content td { border: 1px solid #000; padding: 10px; text-align: left; }
                        .content th { background: #f2f2f2; }
                        .footer { margin-top: 50px; display: flex; justify-content: space-between; }
                        .signature { text-align: center; width: 200px; }
                        .signature .space { height: 80px; }
                        @media print { .no-print { display: none; } }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>DARELIMAN</h1>
                        <p>Jl. Raya Utama No. 123, Kota PADANG</p>
                        <p>Tlp: (021) 1234567 • Email: info@dareliman.org</p>
                    </div>

                    <div class="info">
                        <h2 style="text-align: center; text-decoration: underline;">SURAT PERMINTAAN DANA (${req.source || 'YAYASAN'})</h2>
                        <p style="text-align: center;">Nomor: ${req.id}</p>
                        
                        <table style="margin-top: 20px;">
                            <tr>
                                <td width="150">Tanggal</td>
                                <td>: ${req.date}</td>
                            </tr>
                            <tr>
                                <td>Unit / Bidang</td>
                                <td>: ${unitName}</td>
                            </tr>
                        </table>
                    </div>

                    <div class="content">
                        <p>Dengan hormat,</p>
                        <p>Bersama ini kami mengajukan permintaan dana untuk keperluan rencana belanja periode <b>${yearMonths.find(m => m.id === req.month)?.label || '-'}</b> yang telah disetujui (ACC) sebagai berikut:</p>
                        
                        <table>
                            <thead>
                                <tr>
                                    <th width="30">No</th>
                                    <th>Deskripsi Keperluan</th>
                                    <th style="text-align: right;">Total Dana</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${req.items.map((item, idx) => `
                                    <tr>
                                        <td>${idx + 1}</td>
                                        <td>${item.name}</td>
                                        <td style="text-align: right;">${formatRupiah(item.amount)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <th colspan="2" style="text-align: right;">TOTAL PENGAJUAN</th>
                                    <th style="text-align: right;">${formatRupiah(req.totalAmount)}</th>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <div class="footer">
                        <div class="left-side" style="width: 45%;">
                            <div class="signature" style="margin: 0 auto; margin-bottom: 40px;">
                                <p>Menyetujui,</p>
                                <div class="space"></div>
                                <p>____________________</p>
                                <p>( Bendahara Yayasan )</p>
                            </div>
                            <div class="signature" style="margin: 0 auto;">
                                <p>Memeriksa,</p>
                                <div class="space"></div>
                                <p>____________________</p>
                                <p>( Kabid. Keuangan )</p>
                            </div>
                        </div>
                        <div class="right-side" style="width: 45%;">
                            <div class="signature" style="margin: 0 auto; margin-bottom: 40px;">
                                <p>Pemohon,</p>
                                <div class="space"></div>
                                <p>____________________</p>
                                <p>( Kepala Unit / Bidang )</p>
                            </div>
                            <div class="signature" style="margin: 0 auto;">
                                <p>Pemohon,</p>
                                <div class="space"></div>
                                <p>____________________</p>
                                <p>( Bendahara Unit )</p>
                            </div>
                        </div>
                    </div>

                    <div class="no-print" style="margin-top: 50px; text-align: center;">
                        <button onclick="window.print()" style="padding: 10px 30px; background: #4f46e5; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">CETAK SEKARANG</button>
                    </div>
                </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    const getStatusStyles = (status) => {
        switch (status) {
            case 'APPROVED': return 'bg-emerald-500 shadow-emerald-500/20';
            case 'REJECTED': return 'bg-rose-500 shadow-rose-500/20';
            default: return 'bg-amber-500 shadow-amber-500/20';
        }
    };

    return (
        <div className="p-8 animate-in text-slate-900">
            {/* Toast Notification */}
            {toast && (
                <div
                    className={`fixed top-6 right-6 z-[9999] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl text-white font-black text-sm uppercase tracking-widest animate-in slide-in-from-top-4 transition-all ${
                        toast.type === 'success' ? 'bg-emerald-500 shadow-emerald-500/30' :
                        toast.type === 'error'   ? 'bg-rose-500 shadow-rose-500/30' :
                                                   'bg-amber-500 shadow-amber-500/30'
                    }`}
                >
                    {toast.type === 'success' ? <CheckCircle size={18} /> : toast.type === 'error' ? <XCircle size={18} /> : <AlertCircle size={18} />}
                    {toast.message}
                    <button onClick={() => setToast(null)} className="ml-2 opacity-60 hover:opacity-100 transition-opacity">
                        <XCircle size={16} />
                    </button>
                </div>
            )}
            {/* Header */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
                <div className="lg:col-span-2 bg-gradient-to-br from-indigo-700 to-blue-900 rounded-[40px] p-10 text-white shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:scale-110 transition-transform">
                        <Send size={160} />
                    </div>
                    <div className="relative z-10">
                        <h1 className="text-3xl font-black mb-1">Permintaan Dana</h1>
                        <p className="text-blue-100/70 font-medium mb-4 uppercase text-[10px] tracking-widest italic">
                            TA {currentYear?.name || '-'} • {isSuperAdmin ? 'SELURUH YAYASAN' : (units.find(u => u.id === myUnitId)?.name || fields.find(f => f.id === myFieldId)?.name || 'Unit Saya')}
                        </p>

                        <div className="flex bg-white/10 backdrop-blur-md p-1 rounded-2xl border border-white/20 mb-8 inline-flex">
                            <button 
                                onClick={() => setSourceMode('YAYASAN')}
                                className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sourceMode === 'YAYASAN' ? 'bg-white text-indigo-700 shadow-xl' : 'text-white/60 hover:text-white'}`}
                            >
                                <Building2 size={12} className="inline mr-2" />
                                Dana Yayasan
                            </button>
                            {(!myFieldId || isSuperAdmin) && (
                                <button 
                                    onClick={() => setSourceMode('BOS')}
                                    className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sourceMode === 'BOS' ? 'bg-white text-emerald-600 shadow-xl' : 'text-white/60 hover:text-white'}`}
                                >
                                    <Gem size={12} className="inline mr-2" />
                                    Dana BOS
                                </button>
                            )}
                        </div>

                        {!isSuperAdmin ? (
                            <button
                                onClick={() => setShowRequestModal(true)}
                                className="bg-white text-indigo-700 font-black px-8 py-4 rounded-2xl flex items-center gap-3 hover:shadow-2xl hover:scale-105 active:scale-95 transition-all"
                            >
                                <Plus size={20} strokeWidth={3} />
                                <span> BUAT PENGAJUAN DANA</span>
                            </button>
                        ) : (
                            <div className="flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
                                <AlertCircle size={16} />
                                <span className="text-[10px] font-black uppercase tracking-widest">MODE MONITORING SUPERADMIN</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="card p-8 bg-white/40 backdrop-blur-xl border-white rounded-[32px] flex flex-col items-center justify-center text-center group hover:bg-white transition-all shadow-xl">
                    <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <TrendingUp size={24} />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Saldo Tersedia (ACC)</p>
                    <h2 className="text-2xl font-black text-slate-900">{formatRupiah(stats.approved)}</h2>
                </div>

                <div className="card p-8 bg-white/40 backdrop-blur-xl border-white rounded-[32px] flex flex-col items-center justify-center text-center group hover:bg-white transition-all shadow-xl text-slate-900">
                    <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Clock size={24} />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Dalam Pengajuan</p>
                    <h2 className="text-2xl font-black text-amber-600">{formatRupiah(stats.inProcess)}</h2>
                </div>
            </div>

            {/* Request History */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><Calendar size={18} /></div>
                    <h3 className="font-black text-slate-900 uppercase text-xs tracking-widest">Riwayat Permintaan Dana</h3>
                </div>
                
                {/* Filters */}
                <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
                    {isSuperAdmin && (
                        <select 
                            value={filterUnit} 
                            onChange={(e) => setFilterUnit(e.target.value)}
                            className="bg-slate-50 border-0 rounded-xl px-4 py-2 text-[10px] font-black text-slate-600 uppercase tracking-widest focus:ring-2 focus:ring-indigo-100 outline-none cursor-pointer"
                        >
                            <option value="NONE" disabled>Pilih Unit & Bidang</option>
                            <option value="ALL">Semua Unit & Bidang (Tampilkan Semua)</option>
                            <optgroup label="Unit Pendidikan">
                                {units.map(u => <option key={u.id} value={u.id}>{pendingUnitIds.has(u.id) ? '🔴 ' : ''}{u.name}</option>)}
                            </optgroup>
                            <optgroup label="Bidang">
                                {fields.map(f => <option key={f.id} value={f.id}>{pendingUnitIds.has(f.id) ? '🔴 ' : ''}{f.name}</option>)}
                            </optgroup>
                        </select>
                    )}
                    <select 
                        value={filterStatus} 
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="bg-slate-50 border-0 rounded-xl px-4 py-2 text-[10px] font-black text-slate-600 uppercase tracking-widest focus:ring-2 focus:ring-indigo-100 outline-none cursor-pointer"
                    >
                        <option value="ALL">Semua Status</option>
                        <option value="PENDING">Menunggu (Pending)</option>
                        <option value="APPROVED">Disetujui (ACC)</option>
                        <option value="REJECTED">Ditolak</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {filteredRequests.length === 0 ? (
                    <div className="p-20 text-center bg-white/40 backdrop-blur-md rounded-[32px] border-2 border-dashed border-slate-200">
                        {isSuperAdmin && filterUnit === 'NONE' ? (
                            <>
                                <Search size={48} className="mx-auto text-indigo-300 mb-4" />
                                <h3 className="text-xl font-black text-slate-700 mb-2">Silakan Pilih Unit/Bidang Terlebih Dahulu</h3>
                                <p className="font-medium text-slate-500 max-w-md mx-auto">
                                    Pilih unit pendidikan atau bidang pada menu di atas untuk memunculkan riwayat pengajuan dananya.
                                </p>
                            </>
                        ) : (
                            <>
                                <FileText size={48} className="mx-auto text-slate-300 mb-4" />
                                <p className="font-bold text-slate-400 italic">Belum ada riwayat permintaan dana.</p>
                            </>
                        )}
                    </div>
                ) : (
                    filteredRequests.map(req => (
                        <div key={req.id} className="card p-6 bg-white hover:shadow-2xl transition-all border-white group relative overflow-hidden">
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${req.status === 'APPROVED' ? 'bg-emerald-500' : (req.status === 'REJECTED' ? 'bg-rose-500' : 'bg-amber-500')}`} />
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner">
                                        <FileText size={28} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ID: {req.id}</span>
                                            <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                            <span className="text-[10px] font-bold text-slate-400">{req.date}</span>
                                            {req.month && (
                                                <>
                                                    <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                                    <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-widest">
                                                        {yearMonths.find(m => m.id === req.month)?.label || req.month}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-1.5 my-2">
                                            {(req.items || []).map((item, idx) => (
                                                <div key={idx} className="flex items-start md:items-center gap-2 text-sm">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 md:mt-0 flex-shrink-0"></span>
                                                    <span className="font-bold text-slate-800">{item.name}</span>
                                                    <span className="font-black text-slate-400 italic text-[11px] bg-slate-50 px-2 py-0.5 rounded-md ml-auto">{formatRupiah(item.amount)}</span>
                                                </div>
                                            ))}
                                            {(!req.items || req.items.length === 0) && (
                                                <h4 className="font-black text-slate-900 text-lg leading-tight mb-1">{req.description}</h4>
                                            )}
                                        </div>
                                        {isSuperAdmin && (
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-black uppercase tracking-widest border border-slate-200">
                                                    {req.unitId === 'FOUNDATION' ? 'YAYASAN' : (state.units.find(u => u.id === req.unitId)?.name || req.unitId)}
                                                </div>
                                                {req.fieldId && (
                                                    <div className="px-2 py-0.5 bg-indigo-50 text-indigo-500 rounded text-[9px] font-black uppercase tracking-widest border border-indigo-100">
                                                        {state.fields.find(f => f.id === req.fieldId)?.name || req.fieldId}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {isSuperAdmin && (
                                            <div className="flex items-center gap-2 text-indigo-600 text-[10px] font-black uppercase tracking-widest">
                                                <Building2 size={12} />
                                                {units.find(u => u.id === req.unitId)?.name || fields.find(f => f.id === req.fieldId)?.name}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-10">
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Nominal Pengajuan</p>
                                        <h4 className="text-2xl font-black text-slate-900 italic tracking-tighter">{formatRupiah(req.totalAmount)}</h4>
                                    </div>
                                    <div className={`px-6 py-2 rounded-2xl text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg ${getStatusStyles(req.status)}`}>
                                        {req.status === 'APPROVED' ? <CheckCircle size={14} /> : (req.status === 'REJECTED' ? <XCircle size={14} /> : <Clock size={14} />)}
                                        {req.status}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {isSuperAdmin && req.status === 'PENDING' && (
                                            <button
                                                onClick={() => setReviewRequest({ req, accIds: [], tolakIds: [] })}
                                                className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm flex items-center gap-2 font-black text-[10px] uppercase tracking-widest"
                                            >
                                                <Search size={16} strokeWidth={3} />
                                                REVIEW RINCIAN
                                            </button>
                                        )}
                                        {isSuperAdmin && (req.status === 'APPROVED' || req.status === 'REJECTED') && (
                                            <button
                                                onClick={async () => {
                                                    const confirmed = window.confirm(`Batalkan ${req.status === 'APPROVED' ? 'persetujuan' : 'penolakan'} ini dan kembalikan ke status PENDING?`);
                                                    if (confirmed) {
                                                        setProcessingId(req.id);
                                                        try {
                                                            const updated = { ...req, status: 'PENDING', notified: false };
                                                            dispatch({ type: 'EDIT_BUDGET_REQUEST', payload: updated });
                                                            await api.pushAction({ type: 'EDIT_BUDGET_REQUEST', payload: updated }, state);
                                                            showToast('Persetujuan berhasil dibatalkan, status kembali ke PENDING.');
                                                        } catch (err) {
                                                            console.error('[BATAL Error]', err);
                                                            showToast('Gagal sinkron ke server, coba lagi.', 'error');
                                                        } finally {
                                                            setProcessingId(null);
                                                        }
                                                    }
                                                }}
                                                disabled={processingId === req.id}
                                                title="Batalkan persetujuan / penolakan ini"
                                                className="p-3 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-500 hover:text-white transition-all shadow-sm flex items-center gap-2 font-black text-[10px] uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {processingId === req.id ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} strokeWidth={2.5} />}
                                                BATAL
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handlePrint(req)}
                                            className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-all opacity-0 group-hover:opacity-100 italic font-black text-[10px] border border-transparent hover:border-indigo-100 flex items-center gap-2 uppercase tracking-widest"
                                        >
                                            <FileText size={16} />
                                            Cetak Surat
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal Pengajuan Baru */}
            {showRequestModal && (
                <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setShowRequestModal(false)} />
                    <div className="bg-slate-50 rounded-[3rem] w-full max-w-4xl max-h-[90vh] overflow-hidden relative z-10 shadow-2xl flex flex-col animate-in slide-in-from-bottom-8">
                        <div className="p-10 bg-white border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h2 className="text-3xl font-black text-slate-900 mb-1">Rincian Dana {sourceMode === 'BOS' ? 'BOS' : 'Yayasan'}</h2>
                                <p className="text-slate-500 font-medium italic">Hanya menampilkan rincian {sourceMode} yang telah disetujui (ACC) oleh Superadmin.</p>

                                <div className="flex items-center gap-4 mt-6">
                                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl shadow-inner"><Calendar size={20} /></div>
                                    <div className="flex flex-col">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Periode Pencairan Dana</label>
                                        <select
                                            value={requestMonth}
                                            onChange={(e) => {
                                                setRequestMonth(e.target.value);
                                                setSelectedComponents([]);
                                            }}
                                            className="bg-white border-2 border-indigo-100 rounded-xl px-4 py-2 text-sm font-black text-indigo-900 focus:ring-4 focus:ring-indigo-50 outline-none transition-all cursor-pointer shadow-sm"
                                        >
                                            {yearMonths.map(m => (
                                                <option key={m.id} value={m.id}>BULAN: {m.label.toUpperCase()}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    className="bg-slate-50 border-0 rounded-2xl pl-12 pr-6 py-3 w-64 text-sm font-bold focus:ring-2 focus:ring-indigo-100 text-slate-800"
                                    placeholder="Cari rincian..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar text-slate-900">
                            {approvedComponents.length === 0 ? (
                                <div className="p-20 text-center border-2 border-dashed border-slate-200 rounded-[2.5rem]">
                                    <AlertCircle size={48} className="mx-auto text-amber-400 mb-4" />
                                    <h4 className="font-black text-slate-800 text-xl mb-1">Tidak Ada Rincian ACC</h4>
                                    <p className="text-slate-400 font-medium italic">Tidak ditemukan rincian belanja berstatus ACC yang tersedia untuk ditarik dananya.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-4">
                                    {(searchTerm ? approvedComponents.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())) : approvedComponents).map(comp => (
                                        <div
                                            key={comp.id}
                                            onClick={() => {
                                                setSelectedComponents(prev =>
                                                    prev.includes(comp.id) ? prev.filter(id => id !== comp.id) : [...prev, comp.id]
                                                );
                                            }}
                                            className={`p-6 rounded-[2rem] border-2 transition-all cursor-pointer flex items-center justify-between group ${selectedComponents.includes(comp.id)
                                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-600/20'
                                                : 'bg-white border-white hover:border-indigo-100 shadow-sm'
                                                }`}
                                        >
                                            <div className="flex items-center gap-6">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${selectedComponents.includes(comp.id) ? 'bg-white/20' : 'bg-slate-50 text-slate-400'
                                                    }`}>
                                                    {selectedComponents.includes(comp.id) ? <Check size={24} strokeWidth={4} /> : <Plus size={20} />}
                                                </div>
                                                <div>
                                                    <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${selectedComponents.includes(comp.id) ? 'text-indigo-100' : 'text-slate-400'}`}>
                                                        {comp.itemMasterName} • {comp.planDescription}
                                                    </p>
                                                    <h4 className="font-black text-lg tracking-tight leading-tight">{comp.label || comp.name}</h4>
                                                    <p className={`text-[10px] font-bold ${selectedComponents.includes(comp.id) ? 'text-indigo-200' : 'text-slate-400'}`}>
                                                        {comp.volume} {comp.satuan || comp.unit} x {formatRupiah(comp.harga || comp.price)}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className={`text-[10px] font-black uppercase tracking-widest mb-1 italic ${selectedComponents.includes(comp.id) ? 'text-indigo-100' : 'text-slate-400'}`}>Nominal Rincian</p>
                                                <h4 className="text-xl font-black italic tracking-tighter">{formatRupiah(comp.total)}</h4>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-10 bg-white border-t border-slate-100 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Terpilih</p>
                                <h3 className="text-3xl font-black text-indigo-700 italic tracking-tighter">
                                    {formatRupiah(approvedComponents.filter(c => selectedComponents.includes(c.id)).reduce((s, c) => s + (parseFloat(c.total) || 0), 0))}
                                </h3>
                            </div>
                            <div className="flex gap-4">
                                <button onClick={() => setShowRequestModal(false)} className="btn bg-slate-100 text-slate-600 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">Batal</button>
                                <button
                                    onClick={handleCreateRequest}
                                    disabled={selectedComponents.length === 0}
                                    className={`btn ${sourceMode === 'BOS' ? 'bg-emerald-600' : 'bg-indigo-600'} text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-slate-900 transition-all disabled:opacity-50 active:scale-95 flex items-center gap-3`}
                                >
                                    <Send size={18} />
                                    AJUKAN PENCAIRAN {sourceMode}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal Review Permintaan (Superadmin) */}
            {reviewRequest && (
                <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setReviewRequest(null)} />
                    <div className="bg-slate-50 rounded-[3rem] w-full max-w-4xl max-h-[90vh] overflow-hidden relative z-10 shadow-2xl flex flex-col animate-in slide-in-from-bottom-8">
                        <div className="p-10 bg-white border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div>
                                <h2 className="text-3xl font-black text-slate-900 mb-1">Review Rincian Dana</h2>
                                <p className="text-slate-500 font-medium italic">Anda dapat menyetujui (ACC) atau Menolak per-rincian. ID: <span className="font-bold text-indigo-600">{reviewRequest.req.id}</span></p>
                            </div>
                            <div className="flex flex-col gap-3">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input 
                                        type="text" 
                                        placeholder="Cari rincian..." 
                                        value={modalSearchTerm}
                                        onChange={(e) => setModalSearchTerm(e.target.value)}
                                        className="w-full bg-slate-50 border-0 rounded-xl pl-10 pr-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-100 outline-none"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => {
                                        setReviewRequest(prev => ({ ...prev, accIds: prev.req.items.map(i => i.componentId), tolakIds: [] }));
                                    }} className="flex-1 px-4 py-3 bg-emerald-50 text-emerald-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all shadow-sm flex items-center justify-center gap-2"><Check size={16}/> ACC SEMUA</button>
                                    <button onClick={() => {
                                        setReviewRequest(prev => ({ ...prev, tolakIds: prev.req.items.map(i => i.componentId), accIds: [] }));
                                    }} className="flex-1 px-4 py-3 bg-rose-50 text-rose-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all shadow-sm flex items-center justify-center gap-2"><XCircle size={16}/> TOLAK SEMUA</button>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar text-slate-900 bg-slate-50/50">
                            <div className="grid grid-cols-1 gap-4">
                                {(modalSearchTerm ? reviewRequest.req.items.filter(i => i.name.toLowerCase().includes(modalSearchTerm.toLowerCase())) : reviewRequest.req.items).map(item => {
                                    const isAcc = reviewRequest.accIds.includes(item.componentId);
                                    const isTolak = reviewRequest.tolakIds.includes(item.componentId);
                                    
                                    return (
                                        <div key={item.componentId} className={`p-6 rounded-[2rem] border-2 transition-all flex items-center justify-between group bg-white ${isAcc ? 'border-emerald-500 shadow-xl shadow-emerald-500/20' : isTolak ? 'border-rose-500 shadow-xl shadow-rose-500/20' : 'border-slate-200 hover:border-indigo-200 shadow-sm'}`}>
                                            <div className="flex items-center gap-6">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${isAcc ? 'bg-emerald-50 text-emerald-600' : isTolak ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-400'}`}>
                                                    {isAcc ? <Check size={24} strokeWidth={3} /> : isTolak ? <XCircle size={24} strokeWidth={3} /> : <FileText size={20} />}
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-lg tracking-tight leading-tight mb-1">{item.name}</h4>
                                                    <p className={`text-[12px] font-bold ${isAcc ? 'text-emerald-600' : isTolak ? 'text-rose-600' : 'text-slate-500'}`}>{formatRupiah(item.amount)}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-3">
                                                <button onClick={() => {
                                                    setReviewRequest(prev => ({
                                                        ...prev,
                                                        accIds: isAcc ? prev.accIds.filter(id => id !== item.componentId) : [...prev.accIds, item.componentId],
                                                        tolakIds: prev.tolakIds.filter(id => id !== item.componentId)
                                                    }));
                                                }} className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border-2 ${isAcc ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-transparent border-slate-200 text-slate-400 hover:border-emerald-500 hover:text-emerald-500'}`}>
                                                    <Check size={16} className="inline mr-2" /> ACC
                                                </button>
                                                <button onClick={() => {
                                                    setReviewRequest(prev => ({
                                                        ...prev,
                                                        tolakIds: isTolak ? prev.tolakIds.filter(id => id !== item.componentId) : [...prev.tolakIds, item.componentId],
                                                        accIds: prev.accIds.filter(id => id !== item.componentId)
                                                    }));
                                                }} className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border-2 ${isTolak ? 'bg-rose-500 border-rose-500 text-white' : 'bg-transparent border-slate-200 text-slate-400 hover:border-rose-500 hover:text-rose-500'}`}>
                                                    <XCircle size={16} className="inline mr-2" /> TOLAK
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="p-10 bg-white border-t border-slate-100 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Di-ACC</p>
                                <h3 className="text-3xl font-black text-emerald-600 italic tracking-tighter">
                                    {formatRupiah(reviewRequest.req.items.filter(i => reviewRequest.accIds.includes(i.componentId)).reduce((s, i) => s + (parseFloat(i.amount)||0), 0))}
                                </h3>
                            </div>
                            <div className="flex gap-4">
                                <button onClick={() => setReviewRequest(null)} className="btn bg-slate-100 text-slate-600 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">Batal</button>
                                <button
                                    onClick={handleSaveReview}
                                    disabled={processingId === 'saving-review' || (reviewRequest.accIds.length === 0 && reviewRequest.tolakIds.length === 0)}
                                    className="btn bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 shadow-xl hover:bg-indigo-700 disabled:opacity-50 disabled:scale-100 transition-all"
                                >
                                    {processingId === 'saving-review' ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                    SIMPAN PERSETUJUAN
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
