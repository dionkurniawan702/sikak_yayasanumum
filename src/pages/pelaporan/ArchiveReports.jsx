import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, Building2, Gem, Search, CheckCircle, Clock, Archive, FileText, Filter, Download, Package, Layers, FileCheck, Receipt, RotateCcw, ExternalLink } from 'lucide-react';
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

function resolveReportRequest(report, budgetRequests, globalAcademicYearId) {
    if (!report || !budgetRequests || budgetRequests.length === 0) return null;

    // 1. Check exact matching componentId FIRST in approved budgetRequests
    if (report.componentId) {
        const found = budgetRequests.find(r => 
            r.status === 'APPROVED' && 
            (report.unitId ? (r.unitId === report.unitId || r.fieldId === report.unitId) : true) &&
            r.items && 
            r.items.some(i => i.componentId === report.componentId)
        );
        if (found) return found;
    }

    const rReqId = report.budgetRequestId || report.requestId;
    const reportItemName = (report.category || report.description || '').trim().toLowerCase();

    // 2. Check exact budgetRequestId if it exists AND its items contain the report item name/category
    if (rReqId) {
        const found = budgetRequests.find(r => r.id === rReqId);
        if (found) {
            if (report.kategoriAset === 'PENGEMBALIAN') return found;
            if (!reportItemName || !found.items || found.items.length === 0) {
                return found;
            } else {
                const hasItem = found.items.some(i => (i.name || '').trim().toLowerCase() === reportItemName);
                if (hasItem) return found;
            }
        }
    }

    // 3. Search for approved budgetRequest by category / name
    if (reportItemName) {
        const found = budgetRequests.find(r => 
            r.status === 'APPROVED' &&
            (report.unitId ? (r.unitId === report.unitId || r.fieldId === report.unitId) : true) &&
            r.items &&
            r.items.some(i => (i.name || '').trim().toLowerCase() === reportItemName)
        );
        if (found) return found;
    }

    // 4. Special handling for PENGEMBALIAN (Refund) reports:
    if (report.kategoriAset === 'PENGEMBALIAN' && report.date) {
        if (rReqId) {
            const found = budgetRequests.find(r => r.id === rReqId);
            if (found) return found;
        }

        const reportMonth = report.date.substring(0, 7);
        const approvedReqs = budgetRequests.filter(r => {
            const isSameUnit = (r.unitId && (r.unitId === report.unitId || r.unitId === report.fieldId)) ||
                               (r.fieldId && (r.fieldId === report.unitId || r.fieldId === report.fieldId));
            return isSameUnit && r.status === 'APPROVED' && (!globalAcademicYearId || r.academicYearId === globalAcademicYearId);
        }).sort((a, b) => (b.month || '').localeCompare(a.month || ''));

        const prevMonthReq = approvedReqs.find(r => r.month < reportMonth);
        if (prevMonthReq) return prevMonthReq;
    }

    // 5. Fallback: return budgetRequestId if matched
    if (rReqId) {
        const found = budgetRequests.find(r => r.id === rReqId);
        if (found) return found;
    }

    // 6. Fallback: match by date month and unit
    if (report.date) {
        const reportMonth = report.date.substring(0, 7);
        const foundByDate = budgetRequests.find(r => {
            const isSameUnit = (r.unitId && (r.unitId === report.unitId || r.unitId === report.fieldId)) ||
                               (r.fieldId && (r.fieldId === report.unitId || r.fieldId === report.fieldId));
            return isSameUnit && r.status === 'APPROVED' && r.month === reportMonth;
        });
        if (foundByDate) return foundByDate;
    }

    return null;
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
            const req = resolveReportRequest(r, budgetRequests, globalAcademicYearId);
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
                } else if (filterKategori === 'EXPENSE_ONLY') {
                    if (item.kategoriAset === 'PENGEMBALIAN') return false;
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

    const totalPengeluaranNota = useMemo(() => {
        return archiveData
            .filter(r => r.kategoriAset !== 'PENGEMBALIAN')
            .reduce((sum, item) => sum + item.amountNum, 0);
    }, [archiveData]);

    const totalPengembalian = useMemo(() => {
        return archiveData
            .filter(r => r.kategoriAset === 'PENGEMBALIAN')
            .reduce((sum, item) => sum + item.amountNum, 0);
    }, [archiveData]);

    const countPengeluaranNota = useMemo(() => {
        return archiveData.filter(r => r.kategoriAset !== 'PENGEMBALIAN').length;
    }, [archiveData]);

    const countPengembalian = useMemo(() => {
        return archiveData.filter(r => r.kategoriAset === 'PENGEMBALIAN').length;
    }, [archiveData]);

    const totalAset = useMemo(() => archiveData.filter(r => r.kategoriAset === 'ASET').length, [archiveData]);
    const totalNonAset = useMemo(() => archiveData.filter(r => r.kategoriAset !== 'ASET' && r.kategoriAset !== 'PENGEMBALIAN').length, [archiveData]);

    const exportToExcel = () => {
        if (archiveData.length === 0) return alert("Tidak ada data untuk diekspor");

        const wsData = [
            [
                "No",
                "Tanggal Pelaporan",
                "Nomor Urut Nota",
                "Periode Permintaan",
                "Unit/Bidang",
                "Mata Anggaran",
                "Keterangan Detail",
                "Bukti Transaksi (Teks)",
                "Kategori Penggunaan",
                "Umur Ekonomis (Tahun)",
                "Potongan / Diskon (Rp)",
                "Jumlah Realisasi (Rp)"
            ]
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
                parseFloat(item.diskon || 0),
                item.amountNum
            ]);
        });

        // Add summary rows
        const totalDiskon = archiveData.reduce((sum, item) => sum + parseFloat(item.diskon || 0), 0);
        const totalAmount = archiveData.reduce((sum, item) => sum + item.amountNum, 0);

        const rowNota = Array(12).fill("");
        rowNota[0] = "TOTAL PENGELUARAN (NOTA BELANJA)";
        rowNota[10] = totalDiskon;
        rowNota[11] = totalPengeluaranNota;
        wsData.push(rowNota);

        if (totalPengembalian > 0) {
            const rowRefund = Array(12).fill("");
            rowRefund[0] = "TOTAL PENGEMBALIAN SISA DANA";
            rowRefund[11] = totalPengembalian;
            wsData.push(rowRefund);
        }

        const totalRow = Array(12).fill("");
        totalRow[0] = "TOTAL REALISASI KESELURUHAN";
        totalRow[11] = totalAmount;
        wsData.push(totalRow);

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        ws['!cols'] = [
            { wch: 5 },  // No
            { wch: 18 }, // Tanggal Pelaporan
            { wch: 18 }, // Nomor Urut Nota
            { wch: 20 }, // Periode Permintaan
            { wch: 20 }, // Unit/Bidang
            { wch: 25 }, // Mata Anggaran
            { wch: 30 }, // Keterangan Detail
            { wch: 30 }, // Bukti Transaksi (Teks)
            { wch: 20 }, // Kategori Penggunaan
            { wch: 22 }, // Umur Ekonomis (Tahun)
            { wch: 22 }, // Potongan / Diskon (Rp)
            { wch: 22 }  // Jumlah Realisasi (Rp)
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Arsip Laporan");
        XLSX.writeFile(wb, `Arsip_Laporan_Realisasi_${sourceMode}.xlsx`);
    };

    return (
        <div className="p-4 md:p-8 animate-in text-slate-900 pb-20 bg-slate-50 min-h-screen">
            {/* Header Section */}
            <div className="bg-gradient-to-br from-indigo-800 to-slate-900 rounded-[36px] p-6 md:p-8 text-white shadow-2xl relative overflow-hidden group mb-6">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                    <Archive size={140} />
                </div>
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black mb-1">Arsip Laporan Realisasi</h1>
                        <p className="text-blue-100/70 font-medium uppercase text-[10px] tracking-widest italic">
                            RIWAYAT PENGELUARAN FINAL • TA {currentYear?.name || '-'}
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-3 items-center bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/20">
                        <div className="flex bg-slate-900/40 p-1 rounded-xl">
                            <button 
                                onClick={() => setSourceMode('YAYASAN')}
                                className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${sourceMode === 'YAYASAN' ? 'bg-white text-indigo-700 shadow-xl' : 'text-white/60 hover:text-white'}`}
                            >
                                <Building2 size={12} className="inline mr-2" />
                                Yayasan
                            </button>
                            {(!myFieldId || isSuperAdmin) && (
                                <button 
                                    onClick={() => setSourceMode('BOS')}
                                    className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${sourceMode === 'BOS' ? 'bg-emerald-500 text-white shadow-xl' : 'text-white/60 hover:text-white'}`}
                                >
                                    <Gem size={12} className="inline mr-2" />
                                    BOS
                                </button>
                            )}
                        </div>
                        
                        <div className="w-px h-8 bg-white/20 mx-1 hidden md:block"></div>

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
                            className="px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-lg"
                        >
                            <Download size={14} className="inline mr-2" /> Export Excel
                        </button>
                    </div>
                </div>
            </div>

            {/* Statistic Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                {/* Card 1: Pengeluaran Sesuai Nota */}
                <div className="card p-6 bg-white rounded-[32px] shadow-xl border border-slate-100 flex flex-col justify-between relative overflow-hidden group hover:border-indigo-200 transition-all">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
                            <Receipt size={24} />
                        </div>
                        <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Sesuai Nota Belanja
                        </span>
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Pengeluaran (Nota)</p>
                        <h2 className="text-2xl font-black text-indigo-600 italic tracking-tight">{formatRupiah(totalPengeluaranNota)}</h2>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 mt-3 pt-3 border-t border-slate-100">
                        {countPengeluaranNota} Nota Belanja ({totalAset} Aset • {totalNonAset} Non-Aset)
                    </p>
                </div>

                {/* Card 2: Pengembalian Sisa Kas */}
                <div className="card p-6 bg-white rounded-[32px] shadow-xl border border-slate-100 flex flex-col justify-between relative overflow-hidden group hover:border-violet-200 transition-all">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-12 h-12 bg-violet-50 text-violet-600 rounded-2xl flex items-center justify-center shadow-inner">
                            <RotateCcw size={24} />
                        </div>
                        <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-violet-50 text-violet-700 border border-violet-200">
                            Setor Kas Yayasan
                        </span>
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pengembalian Sisa Dana</p>
                        <h2 className="text-2xl font-black text-violet-600 italic tracking-tight">{formatRupiah(totalPengembalian)}</h2>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 mt-3 pt-3 border-t border-slate-100">
                        {countPengembalian} Bukti Pengembalian Kas
                    </p>
                </div>

                {/* Card 3: Total Realisasi (Filter) */}
                <div className="card p-6 bg-white rounded-[32px] shadow-xl border border-slate-100 flex flex-col justify-between relative overflow-hidden group hover:border-slate-300 transition-all">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-12 h-12 bg-slate-100 text-slate-700 rounded-2xl flex items-center justify-center shadow-inner">
                            <Archive size={24} />
                        </div>
                        <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 border border-slate-200">
                            Total Filter
                        </span>
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Realisasi (Filter)</p>
                        <h2 className="text-2xl font-black text-slate-900 italic tracking-tight">{formatRupiah(totalAmount)}</h2>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 mt-3 pt-3 border-t border-slate-100">
                        {archiveData.length} Total Data Transaksi Terfilter
                    </p>
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
                        <option value="ALL">Semua Kategori (Belanja + Sisa Kas)</option>
                        <option value="EXPENSE_ONLY">Khusus Nota Pengeluaran (Belanja Saja)</option>
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
                                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest border-b border-slate-800 text-right text-rose-400">Diskon (Rp)</th>
                                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest border-b border-slate-800 text-right">Realisasi (Rp)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {archiveData.length === 0 ? (
                                <tr>
                                    <td colSpan={isSuperAdmin ? 9 : 8} className="px-6 py-16 text-center">
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
                                                    ) : item.status === 'APPROVED' ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-200">
                                                            Terverifikasi
                                                        </span>
                                                    ) : null}
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg w-fit">
                                                    {item.expenseItemName}
                                                </span>
                                                {item.buktiTeks && (
                                                    <div className="flex items-center gap-1.5 mt-1 text-[10px]">
                                                        <FileText size={11} className="text-amber-600 shrink-0" />
                                                        {item.buktiTeks.trim().startsWith('http://') || item.buktiTeks.trim().startsWith('https://') ? (
                                                            <a
                                                                href={item.buktiTeks.trim()}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-900 border border-indigo-200 transition-all font-bold shadow-xs hover:shadow"
                                                                title={item.buktiTeks}
                                                            >
                                                                <ExternalLink size={10} className="shrink-0" />
                                                                <span>{item.buktiTeks.includes('drive.google.com') ? 'Buka Bukti Google Drive' : 'Buka Bukti Tautan'} ↗</span>
                                                            </a>
                                                        ) : (
                                                            <span className="text-amber-600 font-medium">Bukti: {item.buktiTeks}</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        
                                        <td className="px-6 py-4 text-center">
                                            <AsetBadge kategori={item.kategoriAset} umurEkonomis={item.umurEkonomis} />
                                        </td>
                                        
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-xs font-bold text-rose-500 font-mono whitespace-nowrap">
                                                {parseFloat(item.diskon || 0) > 0 ? `-${formatRupiah(parseFloat(item.diskon))}` : '—'}
                                            </span>
                                        </td>

                                        <td className="px-6 py-4 text-right">
                                            <span className="text-sm font-black text-slate-900 italic bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm whitespace-nowrap">
                                                {formatRupiah(item.amountNum)}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                            
                            {/* Total Rows Breakdown */}
                            {archiveData.length > 0 && (
                                <>
                                    <tr className="bg-slate-50/80 border-t-2 border-slate-200">
                                        <td colSpan={isSuperAdmin ? 8 : 7} className="px-6 py-3 text-right text-[11px] font-black text-indigo-700 uppercase tracking-widest">
                                            Jumlah Pengeluaran (Sesuai Nota Belanja):
                                        </td>
                                        <td className="px-6 py-3 text-right border-l border-l-slate-200">
                                            <span className="text-sm font-black text-indigo-700 italic font-mono">
                                                {formatRupiah(totalPengeluaranNota)}
                                            </span>
                                        </td>
                                    </tr>
                                    {totalPengembalian > 0 && (
                                        <tr className="bg-slate-50/80 border-t border-slate-200">
                                            <td colSpan={isSuperAdmin ? 8 : 7} className="px-6 py-3 text-right text-[11px] font-black text-violet-700 uppercase tracking-widest">
                                                Jumlah Pengembalian Sisa Dana (Setor Kas):
                                            </td>
                                            <td className="px-6 py-3 text-right border-l border-l-slate-200">
                                                <span className="text-sm font-black text-violet-700 italic font-mono">
                                                    {formatRupiah(totalPengembalian)}
                                                </span>
                                            </td>
                                        </tr>
                                    )}
                                    <tr className="bg-slate-100 border-t-2 border-slate-300">
                                        <td colSpan={isSuperAdmin ? 8 : 7} className="px-6 py-4 text-right text-xs font-black text-slate-900 uppercase tracking-widest">
                                            Total Realisasi Keseluruhan (Filter):
                                        </td>
                                        <td className="px-6 py-4 text-right border-l border-l-slate-300">
                                            <span className="text-base font-black text-slate-900 italic font-mono">
                                                {formatRupiah(totalAmount)}
                                            </span>
                                        </td>
                                    </tr>
                                </>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
