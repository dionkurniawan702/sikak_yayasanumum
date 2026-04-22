import React, { useState, useMemo } from 'react';
import { Wallet, Plus, Clock, CheckCircle, XCircle, FileText, ChevronRight, TrendingUp, AlertCircle, Calendar, Send, Building2, Landmark, Check, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatRupiah, generateId } from '../../utils/format';
import { api } from '../../services/api';

export default function MonthlyRequest() {
    const { state, dispatch } = useApp();
    const { currentUser, rabPlans, budgetRequests, units, fields, academicYears, globalAcademicYearId } = state;
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [selectedComponents, setSelectedComponents] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

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

    const filteredRequests = useMemo(() => {
        return (budgetRequests || []).filter(req => {
            if (isSuperAdmin) return true;
            if (myUnitId) return req.unitId === myUnitId;
            if (myFieldId) return req.fieldId === myFieldId;
            return false;
        }).sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [budgetRequests, isSuperAdmin, myUnitId, myFieldId]);

    // Aggregate Approved components from RAB Plans that are NOT yet requested
    const approvedComponents = useMemo(() => {
        if (!rabPlans || !requestMonth) return [];

        const myPlans = rabPlans.filter(p => {
            if (isSuperAdmin) return true;
            if (myUnitId) return p.unitId === myUnitId;
            if (myFieldId) return p.fieldId === myFieldId;
            return false;
        }).filter(p => p.academicYearId === globalAcademicYearId);

        const components = [];
        myPlans.forEach(plan => {
            Object.entries(plan.expense || {}).forEach(([itemId, itemPlans]) => {
                itemPlans.forEach(p => {
                    (p.components || []).forEach(comp => {
                        // NEW: Filter by selected month's allocation
                        const isScheduledInMonth = comp.months?.[requestMonth]?.m === true;
                        const monthlyAmount = parseFloat(comp.months?.[requestMonth]?.jumlah) || 0;

                        if (comp.isApproved && isScheduledInMonth && monthlyAmount > 0) {
                            // Check if already requested in budgetRequests for THIS month
                            const alreadyRequested = (budgetRequests || []).some(req =>
                                req.month === requestMonth && req.items?.some(reqItem => reqItem.componentId === comp.id)
                            );

                            if (!alreadyRequested) {
                                components.push({
                                    ...comp,
                                    total: monthlyAmount, // Only request the amount planned for THIS month
                                    planId: plan.id,
                                    itemMasterName: state.expenseItems.find(i => i.id === itemId)?.name || 'Item',
                                    planDescription: p.description
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
            description: selectedData.map(c => c.label || c.name).join(', '),
            items: selectedData.map(c => ({
                componentId: c.id,
                name: c.label || c.name,
                amount: c.total,
                planId: c.planId
            }))
        };

        dispatch({ type: 'ADD_BUDGET_REQUEST', payload: newRequest });
        api.pushAction({ type: 'ADD_BUDGET_REQUEST', payload: newRequest }, state); // Immediate push
        setShowRequestModal(false);
        setSelectedComponents([]);
        alert('Permintaan dana berhasil diajukan');
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
                        <h1>YAYASAN UMUM</h1>
                        <p>Jl. Raya Utama No. 123, Kota SIKAK</p>
                        <p>Tlp: (021) 1234567 • Email: info@yayasanumum.org</p>
                    </div>

                    <div class="info">
                        <h2 style="text-align: center; text-decoration: underline;">SURAT PERMINTAAN DANA</h2>
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
                        <div class="signature">
                            <p>Diajukan oleh,</p>
                            <div class="space"></div>
                            <p>____________________</p>
                            <p>( Kepala Unit / Bidang )</p>
                        </div>
                        <div class="signature">
                            <p>Mengetahui,</p>
                            <div class="space"></div>
                            <p>____________________</p>
                            <p>( Bendahara Yayasan )</p>
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
            {/* Header */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
                <div className="lg:col-span-2 bg-gradient-to-br from-indigo-700 to-blue-900 rounded-[40px] p-10 text-white shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:scale-110 transition-transform">
                        <Send size={160} />
                    </div>
                    <div className="relative z-10">
                        <h1 className="text-3xl font-black mb-1">Permintaan Dana</h1>
                        <p className="text-blue-100/70 font-medium mb-8 uppercase text-[10px] tracking-widest italic">
                            TA {currentYear?.name || '-'} • {isSuperAdmin ? 'SELURUH YAYASAN' : (units.find(u => u.id === myUnitId)?.name || fields.find(f => f.id === myFieldId)?.name || 'Unit Saya')}
                        </p>
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
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><Calendar size={18} /></div>
                <h3 className="font-black text-slate-900 uppercase text-xs tracking-widest">Riwayat Permintaan Dana</h3>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {filteredRequests.length === 0 ? (
                    <div className="p-20 text-center bg-white/40 backdrop-blur-md rounded-[32px] border-2 border-dashed border-slate-200">
                        <FileText size={48} className="mx-auto text-slate-300 mb-4" />
                        <p className="font-bold text-slate-400 italic">Belum ada riwayat permintaan dana.</p>
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
                                        <h4 className="font-black text-slate-900 text-lg leading-tight mb-1">{req.description}</h4>
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
                                            <>
                                                <button
                                                    onClick={() => dispatch({ type: 'EDIT_BUDGET_REQUEST', payload: { ...req, status: 'APPROVED' } })}
                                                    className="p-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm flex items-center gap-2 font-black text-[10px] uppercase tracking-widest"
                                                >
                                                    <Check size={16} strokeWidth={3} />
                                                    ACC
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        const reason = window.prompt('Alasan penolakan:');
                                                        if (reason !== null) dispatch({ type: 'EDIT_BUDGET_REQUEST', payload: { ...req, status: 'REJECTED', rejectionReason: reason } });
                                                    }}
                                                    className="p-3 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm flex items-center gap-2 font-black text-[10px] uppercase tracking-widest"
                                                >
                                                    <XCircle size={16} strokeWidth={3} />
                                                    TOLAK
                                                </button>
                                            </>
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
                                <h2 className="text-3xl font-black text-slate-900 mb-1">Pilih Rincian Dana</h2>
                                <p className="text-slate-500 font-medium italic">Hanya menampilkan rincian yang telah disetujui (ACC) oleh Superadmin.</p>

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
                                    className="btn bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-slate-900 transition-all disabled:opacity-50 active:scale-95 flex items-center gap-3"
                                >
                                    <Send size={18} />
                                    AJUKAN PENCAIRAN
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
