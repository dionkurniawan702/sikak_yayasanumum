import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, Building2, Gem, Search, CheckCircle, Clock, Archive, FileText, Filter, Download, Package, Layers, FileCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatRupiah } from '../../utils/format';
import * as XLSX from 'xlsx';

function AsetBadge({ kategori, umurEkonomis }) {
    if (kategori === 'ASET') {
        return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Package size={10} /> Aset {umurEkonomis ? `• ${umurEkonomis} Thn` : ''}
            </span>
        );
    }
    if (kategori === 'PENGEMBALIAN') {
        return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-700 border border-indigo-200">
                <FileCheck size={10} /> Pengembalian
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 border border-slate-200">
            <Layers size={10} /> Non Aset
        </span>
    );
}

export default function ArchiveReports() {
    const { state } = useApp();
    const { currentUser, budgetReports = [], budgetRequests = [], units = [], fields = [], academicYears = [], globalAcademicYearId, expenseItems = [] } = state;

    const [sourceMode, setSourceMode] = useState('YAYASAN'); // 'YAYASAN' or 'BOS'
    const [filterMonth, setFilterMonth] = useState('ALL');
    const [filterRequestMonth, setFilterRequestMonth] = useState('ALL');
    const [filterKategori, setFilterKategori] = useState('ALL');
    const [filterUnit, setFilterUnit] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');

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

    // Flatten and filter the components from budget reports
    const archiveData = useMemo(() => {
        if (!currentYear) return [];

        const reports = budgetReports.filter(r => {
            // Tampilkan laporan berstatus APPROVED, PENDING, atau DRAFT
            if (r.status !== 'APPROVED' && r.status !== 'PENDING' && r.status !== 'DRAFT') return false;
            
            // Year filter
            if (r.academicYearId !== globalAcademicYearId) return false;

            // Source filter
            const isBosReport = r.source === 'BOS' || r.planId?.endsWith('-BOS');
            if (sourceMode === 'BOS' && !isBosReport) return false;
            if (sourceMode === 'YAYASAN' && isBosReport) return false;

            // Role access filter
            if (isSuperAdmin) {
                if (filterUnit !== 'ALL') {
                    if (filterUnit.startsWith('FIELD-')) {
                        return r.fieldId === filterUnit.replace('FIELD-', '');
                    }
                    return r.unitId === filterUnit;
                }
                return true;
            } else if (myUnitId) {
                return r.unitId === myUnitId;
            } else if (myFieldId) {
                return r.fieldId === myFieldId;
            }
            return false;
        });

        // Map and filter by month/category/search
        const mapped = reports.map(r => {
            const unitName = r.unitId === 'FOUNDATION' ? 'YAYASAN' : (units.find(u => u.id === r.unitId)?.name || 'Yayasan');
            const fieldName = r.fieldId ? (fields.find(f => f.id === r.fieldId)?.name || 'Unknown Field') : '-';
            const expenseItemName = expenseItems.find(e => e.id === r.expenseItemId)?.name || '—';
            
            const rDate = r.date ? new Date(r.date) : new Date();
            const monthId = `${rDate.getFullYear()}-${String(rDate.getMonth() + 1).padStart(2, '0')}`;
            const monthLabel = yearMonths.find(ym => ym.id === monthId)?.label || monthId;

            // Find associated budget request
            const req = budgetRequests.find(q => q.id === r.budgetRequestId);
            const reqMonthId = req?.month || null;
            const reqMonthLabel = reqMonthId ? (yearMonths.find(ym => ym.id === reqMonthId)?.label || reqMonthId) : '—';

            return {
                ...r,
                unitName,
                fieldName,
                expenseItemName,
                monthId,
                monthLabel,
                reqMonthId,
                reqMonthLabel,
                amountNum: parseFloat(r.amount || 0)
            };
        }).filter(item => {
            if (filterMonth !== 'ALL' && item.monthId !== filterMonth) return false;
            if (filterRequestMonth !== 'ALL' && item.reqMonthId !== filterRequestMonth) return false;
            
            let katFilter = filterKategori;
            if (filterKategori === 'NON_ASET') katFilter = undefined; // Since legacy or empty is non-aset
            if (filterKategori !== 'ALL') {
                if (filterKategori === 'NON_ASET') {
                    if (item.kategoriAset === 'ASET' || item.kategoriAset === 'PENGEMBALIAN') return false;
                } else {
                    if (item.kategoriAset !== filterKategori) return false;
                }
            }

            if (searchTerm) {
                const q = searchTerm.toLowerCase();
                if (
                    !item.nomorNota?.toLowerCase().includes(q) &&
                    !item.description?.toLowerCase().includes(q) &&
                    !item.category?.toLowerCase().includes(q) &&
                    !item.buktiTeks?.toLowerCase().includes(q) &&
                    !item.unitName?.toLowerCase().includes(q)
                ) {
                    return false;
                }
            }

            return true;
        });

        // Sort by date descending
        return mapped.sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [budgetReports, budgetRequests, globalAcademicYearId, sourceMode, isSuperAdmin, filterUnit, myUnitId, myFieldId, filterMonth, filterRequestMonth, filterKategori, searchTerm, yearMonths, units, fields, expenseItems, currentYear]);

    const totalAmount = useMemo(() => {
        return archiveData.reduce((sum, item) => sum + item.amountNum, 0);
    }, [archiveData]);

    const totalAset = useMemo(() => archiveData.filter(r => r.kategoriAset === 'ASET').length, [archiveData]);
    const totalNonAset = archiveData.length - totalAset;

    const exportToExcel = () => {
        if (archiveData.length === 0) return alert("Tidak ada data untuk diekspor");

        const wsData = [
            ["No", "Tanggal Transaksi", "Nomor Nota", "Periode Permintaan", "Unit/Bidang", "Kategori Item", "Keterangan", "Bukti Teks", "Kategori Aset", "Umur Ekonomis", "Jumlah Realisasi"]
        ];

        archiveData.forEach((item, i) => {
            wsData.push([
                i + 1,
                item.date ? new Date(item.date).toLocaleDateString('id-ID') : '-',
                item.nomorNota || '-',
                item.reqMonthLabel || '—',
                item.fieldName !== '-' ? `${item.unitName} - ${item.fieldName}` : item.unitName,
                item.expenseItemName,
                item.category || item.description || '-',
                item.buktiTeks || '-',
                item.kategoriAset || 'NON_ASET',
                item.umurEkonomis ? `${item.umurEkonomis} Tahun` : '-',
                item.amountNum
            ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Arsip Laporan");
        XLSX.writeFile(wb, `Arsip_Laporan_Realisasi_${sourceMode}.xlsx`);
    };

    return (
        <div className="p-4 md:p-8 animate-in text-slate-900 pb-20 bg-slate-50 min-h-screen">
            {/* Header Section */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
                <div className="lg:col-span-3 bg-gradient-to-br from-indigo-800 to-slate-900 rounded-[40px] p-8 md:p-10 text-white shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:scale-110 transition-transform">
                        <Archive size={160} />
                    </div>
                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div>
                            <h1 className="text-3xl font-black mb-1">Arsip Laporan Realisasi</h1>
                            <p className="text-blue-100/70 font-medium mb-6 uppercase text-[10px] tracking-widest italic">
                                RIWAYAT PENGELUARAN FINAL • TA {currentYear?.name || '-'}
                            </p>

                            <div className="flex flex-wrap gap-4 items-center bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/20 inline-flex">
                                <div className="flex bg-slate-900/40 p-1 rounded-xl">
                                    <button 
                                        onClick={() => setSourceMode('YAYASAN')}
                                        className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${sourceMode === 'YAYASAN' ? 'bg-white text-indigo-700 shadow-xl' : 'text-white/60 hover:text-white'}`}
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
                                        placeholder="Cari nota, deskripsi..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="bg-white/10 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-white/50 focus:bg-white/20 focus:outline-none transition-all w-full md:w-48"
                                    />
                                </div>

                                <button
                                    onClick={exportToExcel}
                                    className="px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-lg"
                                >
                                    <Download size={14} className="inline mr-2" /> Export Excel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card p-8 bg-white rounded-[40px] flex flex-col items-center justify-center text-center shadow-xl border-slate-100">
                    <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4">
                        <FileText size={32} />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Realisasi (Filter)</p>
                    <h2 className="text-2xl font-black text-slate-900 italic tracking-tighter">{formatRupiah(totalAmount)}</h2>
                    <p className="text-[10px] font-bold text-slate-400 mt-2">{archiveData.length} Laporan ({totalAset} Aset / {totalNonAset} Non)</p>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><Filter size={18} /></div>
                    <h3 className="font-black text-slate-900 uppercase text-xs tracking-widest">Filter Laporan</h3>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                    {/* Unit Filter - Only for Superadmin */}
                    {isSuperAdmin && (
                        <select
                            value={filterUnit}
                            onChange={(e) => setFilterUnit(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-[10px] font-black text-slate-600 uppercase tracking-widest focus:ring-2 focus:ring-indigo-100 outline-none cursor-pointer"
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

                    {/* Month Filter */}
                    <select
                        value={filterMonth}
                        onChange={(e) => setFilterMonth(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-[10px] font-black text-slate-600 uppercase tracking-widest focus:ring-2 focus:ring-indigo-100 outline-none cursor-pointer"
                    >
                        <option value="ALL">Bulan Transaksi (Semua)</option>
                        {yearMonths.map(m => (
                            <option key={m.id} value={m.id}>{m.label}</option>
                        ))}
                    </select>

                    {/* Request Month Filter */}
                    <select
                        value={filterRequestMonth}
                        onChange={(e) => setFilterRequestMonth(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-[10px] font-black text-slate-600 uppercase tracking-widest focus:ring-2 focus:ring-indigo-100 outline-none cursor-pointer"
                    >
                        <option value="ALL">Periode Permintaan (Semua)</option>
                        {yearMonths.map(m => (
                            <option key={m.id} value={m.id}>{m.label}</option>
                        ))}
                    </select>

                    {/* Kategori Filter */}
                    <select
                        value={filterKategori}
                        onChange={(e) => setFilterKategori(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-[10px] font-black text-slate-600 uppercase tracking-widest focus:ring-2 focus:ring-indigo-100 outline-none cursor-pointer"
                    >
                        <option value="ALL">Semua Kategori</option>
                        <option value="NON_ASET">Non Aset (Operasional)</option>
                        <option value="ASET">Pembelian Aset</option>
                        <option value="PENGEMBALIAN">Pengembalian Sisa Dana</option>
                    </select>
                </div>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead>
                            <tr className="bg-slate-900 text-white">
                                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest w-12 text-center border-b border-slate-800">No</th>
                                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest border-b border-slate-800">Tanggal</th>
                                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest border-b border-slate-800">Nomor Nota</th>
                                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest border-b border-slate-800">Periode Permintaan</th>
                                {isSuperAdmin && (
                                    <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest border-b border-slate-800">Unit / Bidang</th>
                                )}
                                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest border-b border-slate-800">Keterangan Laporan</th>
                                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest border-b border-slate-800 text-center">Info Aset</th>
                                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest border-b border-slate-800 text-right">Realisasi (Rp)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {archiveData.length === 0 ? (
                                <tr>
                                    <td colSpan={isSuperAdmin ? 8 : 7} className="px-6 py-16 text-center">
                                        <div className="flex flex-col items-center justify-center">
                                            <Archive size={48} className="text-slate-200 mb-4" />
                                            <p className="text-sm font-bold text-slate-400 italic">Tidak ada laporan yang sesuai dengan filter.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                archiveData.map((item, index) => (
                                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4 text-xs font-bold text-slate-400 text-center">{index + 1}</td>
                                        
                                        <td className="px-6 py-4">
                                            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">
                                                {item.date ? new Date(item.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                            </span>
                                        </td>
                                        
                                        <td className="px-6 py-4">
                                            <span className="text-xs font-black text-indigo-600 font-mono">{item.nomorNota || '—'}</span>
                                        </td>

                                        <td className="px-6 py-4">
                                            <span className="text-xs font-bold text-slate-700 whitespace-nowrap font-mono">{item.reqMonthLabel}</span>
                                        </td>

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
                                            <div className="flex flex-col space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-black text-slate-900">{item.category || item.description || 'Pengeluaran Umum'}</span>
                                                    {item.status === 'PENDING' ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-amber-50 text-amber-600 border border-amber-200">
                                                            Menunggu
                                                        </span>
                                                    ) : item.status === 'DRAFT' ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 border border-slate-300">
                                                            Draft
                                                        </span>
                                                    ) : null}
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg w-fit">
                                                    {item.expenseItemName}
                                                </span>
                                                {item.buktiTeks && (
                                                    <div className="flex items-center gap-1.5 mt-1 text-[10px] text-amber-600 font-medium">
                                                        <FileText size={10} />
                                                        <span>Bukti: {item.buktiTeks}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        
                                        <td className="px-6 py-4 text-center">
                                            <AsetBadge kategori={item.kategoriAset} umurEkonomis={item.umurEkonomis} />
                                        </td>
                                        
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-sm font-black text-slate-900 italic bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm whitespace-nowrap">
                                                {formatRupiah(item.amountNum)}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                            
                            {/* Total Row */}
                            {archiveData.length > 0 && (
                                <tr className="bg-slate-50">
                                    <td colSpan={isSuperAdmin ? 7 : 6} className="px-6 py-4 text-right text-xs font-black text-slate-800 uppercase tracking-widest border-t-2 border-slate-200">
                                        Total Realisasi Filtered
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
            </div>
        </div>
    );
}
