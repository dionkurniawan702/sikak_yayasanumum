import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, Building2, Gem, Search, CheckCircle, Clock, Archive, FileText, Filter } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatRupiah } from '../../utils/format';

export default function ArchiveRAB() {
    const { state } = useApp();
    const { currentUser, rabPlans = [], units = [], fields = [], academicYears = [], globalAcademicYearId, expenseItems = [], expensePrograms = [] } = state;

    const [sourceMode, setSourceMode] = useState('YAYASAN'); // 'YAYASAN' or 'BOS'
    const [filterMonth, setFilterMonth] = useState('ALL');
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [filterUnit, setFilterUnit] = useState('ALL');
    const [filterProgram, setFilterProgram] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    // Reset page on filter change
    useEffect(() => {
        setCurrentPage(1);
    }, [sourceMode, filterMonth, filterStatus, filterUnit, filterProgram, searchTerm]);

    const isSuperAdmin = currentUser?.role === 'superadmin' || currentUser?.role === 'yayasan';
    const myUnitId = currentUser?.unitId;
    const myFieldId = currentUser?.fieldId;

    const currentYear = academicYears.find(y => y.id === globalAcademicYearId);
    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    // Generate month options based on the academic year
    const yearMonths = useMemo(() => {
        if (!currentYear) return [];
        const months = [];
        try {
            if (currentYear.startDate && currentYear.endDate) {
                const start = new Date(currentYear.startDate);
                const end = new Date(currentYear.endDate);
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
                    });
                    current.setMonth(current.getMonth() + 1);
                    safetyCounter++;
                }
            }
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
                    });
                });
            }
        } catch (err) {
            console.error('Error generating months:', err);
        }
        return months;
    }, [currentYear]);

    // Set initial unit filter for non-superadmins
    useEffect(() => {
        if (!isSuperAdmin) {
            if (myUnitId) setFilterUnit(myUnitId);
            else if (myFieldId) setFilterUnit(`FIELD-${myFieldId}`);
        }
    }, [isSuperAdmin, myUnitId, myFieldId]);

    // Flatten and filter the components from RAB plans
    const archiveData = useMemo(() => {
        const data = [];
        if (!currentYear) return data;

        // 1. Filter relevant plans based on access right and academic year
        const accessiblePlans = rabPlans.filter(p => {
            if (p.id?.includes('-REVISION-')) return false;
            if (p.academicYearId !== globalAcademicYearId) return false;
            
            // Source mode filter
            const isBosPlan = p.id?.endsWith('-BOS');
            if (sourceMode === 'BOS' && !isBosPlan) return false;
            if (sourceMode === 'YAYASAN' && isBosPlan) return false;

            // Role access filter
            if (isSuperAdmin) {
                if (filterUnit !== 'ALL') {
                    if (filterUnit.startsWith('FIELD-')) {
                        return p.fieldId === filterUnit.replace('FIELD-', '');
                    }
                    return p.unitId === filterUnit;
                }
                return true;
            } else if (myUnitId) {
                return p.unitId === myUnitId;
            } else if (myFieldId) {
                return p.fieldId === myFieldId;
            }
            return false;
        });

        // 2. Extract components
        accessiblePlans.forEach(plan => {
            const unitName = plan.unitId === 'FOUNDATION' ? 'YAYASAN' : (units.find(u => u.id === plan.unitId)?.name || 'Unknown Unit');
            const fieldName = plan.fieldId ? (fields.find(f => f.id === plan.fieldId)?.name || 'Unknown Field') : '-';
            
            Object.entries(plan.expense || {}).forEach(([itemId, rawItemPlans]) => {
                const itemMasterName = expenseItems.find(ei => ei.id === itemId)?.name || 'Unknown Item';
                const itemPlans = Array.isArray(rawItemPlans) ? rawItemPlans : (rawItemPlans && typeof rawItemPlans === 'object' && Object.keys(rawItemPlans).length > 0 ? [rawItemPlans] : []);
                
                itemPlans.forEach((p, pIdx) => {
                    (p.components || []).forEach((comp, cIdx) => {
                        // Check component status: either APPROVED or PENDING (some legacy data might use isApproved)
                        const compStatus = comp.status || (comp.isApproved ? 'APPROVED' : 'PENDING');
                        
                        // Status filter
                        if (filterStatus !== 'ALL' && compStatus !== filterStatus) return;
                        
                        // Only include if it has status PENDING or APPROVED (Ignore DRAFT/REJECTED)
                        if (compStatus !== 'PENDING' && compStatus !== 'APPROVED') return;

                        // Program filter
                        if (filterProgram !== 'ALL' && comp.programId !== filterProgram) return;

                        // Check month allocation
                        const targetMonthIds = filterMonth === 'ALL' ? yearMonths.map(m => m.id) : [filterMonth];
                        
                        targetMonthIds.forEach(mId => {
                            const isAllocated = comp.months?.[mId]?.m === true;
                            const amount = parseFloat(comp.months?.[mId]?.jumlah) || 0;
                            
                            if (isAllocated && amount > 0) {
                                const programName = expensePrograms.find(p => p.id === comp.programId)?.name || '-';

                                // Search term filter
                                const searchStr = `${itemMasterName} ${comp.name || comp.label} ${compStatus} ${unitName} ${fieldName} ${programName}`.toLowerCase();
                                if (searchTerm && !searchStr.includes(searchTerm.toLowerCase())) return;

                                const origTotal = comp.originalTotal ? parseFloat(comp.originalTotal) : null;
                                const curTotal = parseFloat(comp.total) || 1;
                                const isAdjusted = Boolean(comp.isAdjustedToRealization || (origTotal && origTotal !== curTotal));
                                const originalAmount = isAdjusted && origTotal ? Math.round(amount * (origTotal / curTotal)) : null;

                                data.push({
                                    id: `${comp.id || `${plan.id}-${itemId}-${pIdx}-${cIdx}`}-${mId}`,
                                    planId: plan.id,
                                    itemId: itemId,
                                    itemMasterName,
                                    componentName: comp.name || comp.label,
                                    originalAmount,
                                    isAdjusted,
                                    programName,
                                    status: compStatus,
                                    unitName,
                                    fieldName,
                                    monthId: mId,
                                    monthLabel: yearMonths.find(ym => ym.id === mId)?.label || mId,
                                    amount: amount
                                });
                            }
                        });
                    });
                });
            });
        });

        // Sort by unit name, then item name
        return data.sort((a, b) => {
            if (a.unitName !== b.unitName) return a.unitName.localeCompare(b.unitName);
            return a.itemMasterName.localeCompare(b.itemMasterName);
        });
    }, [rabPlans, globalAcademicYearId, sourceMode, isSuperAdmin, filterUnit, myUnitId, myFieldId, filterStatus, filterMonth, filterProgram, searchTerm, yearMonths, units, fields, expenseItems, expensePrograms, currentYear]);

    const totalAmount = useMemo(() => {
        return archiveData.reduce((sum, item) => sum + item.amount, 0);
    }, [archiveData]);

    const totalPages = Math.ceil(archiveData.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;

    const paginatedData = useMemo(() => {
        return archiveData.slice(startIndex, endIndex);
    }, [archiveData, startIndex, endIndex]);

    return (
        <div className="p-4 md:p-8 animate-in text-[#13261E] pb-20">
            {/* Header Section */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
                <div className="lg:col-span-3 bg-gradient-to-br from-[#1C375B] via-[#265187] to-[#1B7678] rounded-3xl p-8 md:p-9 text-white shadow-md border border-[#2D6794]/35 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-10 opacity-15 group-hover:scale-110 transition-transform text-sky-100">
                        <Archive size={150} />
                    </div>
                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold mb-1 tracking-tight">Arsip RAB</h1>
                            <p className="text-sky-100/80 font-semibold mb-6 uppercase text-[10px] tracking-wider">
                                RINCIAN ANGGARAN RAB (ACC &amp; MENUNGGU) • TA {currentYear?.name || '-'}
                            </p>

                            <div className="flex flex-wrap gap-4 items-center bg-black/15 backdrop-blur-md p-1.5 rounded-2xl border border-white/20 inline-flex">
                                <div className="flex bg-black/15 p-1 rounded-xl">
                                    <button 
                                        onClick={() => setSourceMode('YAYASAN')}
                                        className={`px-5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${sourceMode === 'YAYASAN' ? 'bg-white text-[#244E82] shadow-sm' : 'text-white/75 hover:text-white'}`}
                                    >
                                        <Building2 size={12} className="inline mr-2" />
                                        Yayasan
                                    </button>
                                    {(!myFieldId || isSuperAdmin) && (
                                        <button 
                                            onClick={() => setSourceMode('BOS')}
                                            className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${sourceMode === 'BOS' ? 'bg-emerald-500 text-white shadow-xl' : 'text-white/60 hover:text-white'}`}
                                        >
                                            <Gem size={12} className="inline mr-2" />
                                            BOS
                                        </button>
                                    )}
                                </div>
                                
                                <div className="w-px h-8 bg-white/20 mx-2 hidden md:block"></div>

                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50" size={14} />
                                    <input
                                        type="text"
                                        placeholder="Cari rincian..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="bg-white/10 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-white/50 focus:bg-white/20 focus:outline-none transition-all w-full md:w-48"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card p-8 bg-white rounded-[40px] flex flex-col items-center justify-center text-center shadow-xl border-slate-100">
                    <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4">
                        <FileText size={32} />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Nilai (Filter)</p>
                    <h2 className="text-2xl font-black text-slate-900 italic tracking-tighter">{formatRupiah(totalAmount)}</h2>
                    <p className="text-[10px] font-bold text-slate-400 mt-2">{archiveData.length} Rincian Ditemukan</p>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><Filter size={18} /></div>
                    <h3 className="font-black text-slate-900 uppercase text-xs tracking-widest">Filter Data</h3>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                    {/* Unit Filter - Only for Superadmin */}
                    {isSuperAdmin && (
                        <select
                            value={filterUnit}
                            onChange={(e) => setFilterUnit(e.target.value)}
                            className="bg-slate-50 border-0 rounded-xl px-4 py-2 text-[10px] font-black text-slate-600 uppercase tracking-widest focus:ring-2 focus:ring-indigo-100 outline-none cursor-pointer"
                        >
                            <option value="ALL">Semua Unit & Bidang</option>
                            <option value="FOUNDATION">Yayasan</option>
                            <optgroup label="Unit Pendidikan">
                                {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </optgroup>
                            <optgroup label="Bidang">
                                {fields.map(f => <option key={`FIELD-${f.id}`} value={`FIELD-${f.id}`}>{f.name}</option>)}
                            </optgroup>
                        </select>
                    )}

                    {/* Program Filter */}
                    <select
                        value={filterProgram}
                        onChange={(e) => setFilterProgram(e.target.value)}
                        className="bg-slate-50 border-0 rounded-xl px-4 py-2 text-[10px] font-black text-slate-600 uppercase tracking-widest focus:ring-2 focus:ring-indigo-100 outline-none cursor-pointer"
                    >
                        <option value="ALL">Semua Program</option>
                        {expensePrograms.filter(p => !p.isDeleted).map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>

                    {/* Month Filter */}
                    <select
                        value={filterMonth}
                        onChange={(e) => setFilterMonth(e.target.value)}
                        className="bg-slate-50 border-0 rounded-xl px-4 py-2 text-[10px] font-black text-slate-600 uppercase tracking-widest focus:ring-2 focus:ring-indigo-100 outline-none cursor-pointer"
                    >
                        <option value="ALL">Semua Bulan</option>
                        {yearMonths.map(m => (
                            <option key={m.id} value={m.id}>{m.label}</option>
                        ))}
                    </select>

                    {/* Status Filter */}
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="bg-slate-50 border-0 rounded-xl px-4 py-2 text-[10px] font-black text-slate-600 uppercase tracking-widest focus:ring-2 focus:ring-indigo-100 outline-none cursor-pointer"
                    >
                        <option value="ALL">Semua Status</option>
                        <option value="APPROVED">Disetujui (ACC)</option>
                        <option value="PENDING">Menunggu (Pending)</option>
                    </select>
                </div>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-gradient-to-r from-[#1C375B] via-[#265187] to-[#1B7678] text-white">
                                <th className="px-6 py-4 font-bold text-[10px] uppercase tracking-wider w-12 text-center border-b border-emerald-900/20">No</th>
                                {isSuperAdmin && (
                                    <th className="px-6 py-4 font-bold text-[10px] uppercase tracking-wider border-b border-emerald-900/20">Unit / Bidang</th>
                                )}
                                <th className="px-6 py-4 font-bold text-[10px] uppercase tracking-wider border-b border-emerald-900/20">Program Belanja</th>
                                <th className="px-6 py-4 font-bold text-[10px] uppercase tracking-wider border-b border-emerald-900/20">Kategori (Item)</th>
                                <th className="px-6 py-4 font-bold text-[10px] uppercase tracking-wider border-b border-emerald-900/20">Rincian Pengeluaran</th>
                                <th className="px-6 py-4 font-bold text-[10px] uppercase tracking-wider border-b border-emerald-900/20 text-center">Bulan</th>
                                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest border-b border-slate-800 text-center">Status</th>
                                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest border-b border-slate-800 text-right">Alokasi Dana</th>
                            </tr>
                        </thead>
                        <tbody>
                            {archiveData.length === 0 ? (
                                <tr>
                                    <td colSpan={isSuperAdmin ? 8 : 7} className="px-6 py-16 text-center">
                                        <div className="flex flex-col items-center justify-center">
                                            <Archive size={48} className="text-slate-200 mb-4" />
                                            <p className="text-sm font-bold text-slate-400 italic">Tidak ada data RAB yang sesuai dengan filter.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedData.map((item, index) => (
                                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4 text-xs font-bold text-slate-400 text-center">{startIndex + index + 1}</td>
                                        
                                        {isSuperAdmin && (
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-slate-900">{item.unitName}</span>
                                                    {item.fieldName !== '-' && (
                                                        <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{item.fieldName}</span>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                        
                                        <td className="px-6 py-4">
                                            {item.programName !== '-' ? (
                                                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md line-clamp-2">{item.programName}</span>
                                            ) : (
                                                <span className="text-[10px] font-bold text-slate-400">-</span>
                                            )}
                                        </td>
                                        
                                        <td className="px-6 py-4">
                                            <span className="text-xs font-bold text-slate-700">{item.itemMasterName}</span>
                                        </td>
                                        
                                        <td className="px-6 py-4">
                                            <span className="text-sm font-black text-slate-900">{item.componentName}</span>
                                        </td>
                                        
                                        <td className="px-6 py-4 text-center">
                                            <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-widest whitespace-nowrap border border-blue-100">
                                                {item.monthLabel}
                                            </span>
                                        </td>
                                        
                                        <td className="px-6 py-4 text-center">
                                            {item.status === 'APPROVED' ? (
                                                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
                                                    <CheckCircle size={12} strokeWidth={3} />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">ACC</span>
                                                </div>
                                            ) : (
                                                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 rounded-lg border border-amber-100">
                                                    <Clock size={12} strokeWidth={3} />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">MENUNGGU</span>
                                                </div>
                                            )}
                                        </td>
                                        
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex flex-col items-end">
                                                {item.isAdjusted && item.originalAmount && item.originalAmount !== item.amount && (
                                                    <span className="text-[9px] font-black text-slate-400 line-through tracking-wider mb-0.5" title="Alokasi rencana awal sebelum disesuaikan ke realisasi">
                                                        Awal: {formatRupiah(item.originalAmount)}
                                                    </span>
                                                )}
                                                <span className="text-sm font-black text-slate-900 italic bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm whitespace-nowrap">
                                                    {formatRupiah(item.amount)}
                                                </span>
                                                {item.isAdjusted && (
                                                    <span className="text-[8px] font-black text-teal-700 uppercase tracking-wider mt-0.5 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded">
                                                        Disesuaikan Realisasi
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                            
                            {/* Total Row */}
                            {archiveData.length > 0 && (
                                <tr className="bg-slate-50">
                                    <td colSpan={isSuperAdmin ? 7 : 6} className="px-6 py-4 text-right text-xs font-black text-slate-800 uppercase tracking-widest border-t-2 border-slate-200">
                                        Total Keseluruhan Filtered
                                    </td>
                                    <td className="px-6 py-4 text-right border-t-2 border-slate-200 border-l border-l-slate-200">
                                        <span className="text-lg font-black text-indigo-700 italic">
                                            {formatRupiah(totalAmount)}
                                        </span>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                        <div className="text-xs font-bold text-slate-400">
                            Menampilkan <span className="text-slate-700 font-black">{startIndex + 1}</span> - <span className="text-slate-700 font-black">{Math.min(endIndex, archiveData.length)}</span> dari <span className="text-slate-700 font-black">{archiveData.length}</span> rincian
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                Sebelumnya
                            </button>
                            <div className="flex items-center gap-1">
                                {[...Array(totalPages)].map((_, i) => {
                                    const pageNum = i + 1;
                                    if (
                                        pageNum === 1 || 
                                        pageNum === totalPages || 
                                        Math.abs(pageNum - currentPage) <= 1
                                    ) {
                                        return (
                                            <button
                                                key={pageNum}
                                                onClick={() => setCurrentPage(pageNum)}
                                                className={`w-8 h-8 rounded-xl text-xs font-black transition-all ${currentPage === pageNum ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                            >
                                                {pageNum}
                                            </button>
                                        );
                                    }
                                    if (
                                        (pageNum === 2 && currentPage > 3) || 
                                        (pageNum === totalPages - 1 && currentPage < totalPages - 2)
                                    ) {
                                        return <span key={pageNum} className="text-slate-400 text-xs px-1">...</span>;
                                    }
                                    return null;
                                })}
                            </div>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                Selanjutnya
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
