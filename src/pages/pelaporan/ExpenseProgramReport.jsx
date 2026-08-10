import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { formatRupiah, formatTanggal } from '../../utils/format';
import * as XLSX from 'xlsx';
import {
    FolderKanban, Search, Filter, Download, Printer, TrendingUp, Wallet,
    Building2, Eye, X, ChevronRight, PieChart, Layers, Calendar, Landmark,
    ArrowUpRight, ArrowDownRight, RefreshCw, FileText, CheckCircle2, AlertCircle
} from 'lucide-react';
import CurrencyDisplay from '../../components/CurrencyDisplay';

export default function ExpenseProgramReport() {
    const { state } = useApp();
    const {
        currentUser,
        expensePrograms = [],
        rabPlans = [],
        budgetRequests = [],
        budgetReports = [],
        units = [],
        fields = [],
        academicYears = [],
        globalAcademicYearId
    } = state;

    const isSuperAdmin = currentUser?.role === 'superadmin' || currentUser?.role === 'yayasan';
    const myUnitId = currentUser?.unitId;
    const myFieldId = currentUser?.fieldId;

    // Filters
    const [selectedAcademicYearId, setSelectedAcademicYearId] = useState(globalAcademicYearId || 'ALL');
    const [selectedUnitFilter, setSelectedUnitFilter] = useState(() => {
        if (!isSuperAdmin) {
            if (myUnitId) return myUnitId;
            if (myFieldId) return `FIELD-${myFieldId}`;
        }
        return 'ALL';
    });
    const [selectedSourceMode, setSelectedSourceMode] = useState('ALL'); // 'ALL', 'Yayasan', 'BOS'
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProgramDetail, setSelectedProgramDetail] = useState(null);

    const reportRef = useRef(null);

    // Current Academic Year Label
    const currentYearObj = academicYears.find(y => y.id === selectedAcademicYearId);

    // Active Programs
    const activeExpensePrograms = useMemo(() => {
        return expensePrograms.filter(p => !p.isDeleted);
    }, [expensePrograms]);

    // Calculate aggregated program metrics
    const programMetricsData = useMemo(() => {
        // 1. Filter RAB Plans
        const filteredRabPlans = rabPlans.filter(plan => {
            if (plan.isDeleted) return false;
            if (plan.status !== 'APPROVED') return false; // Only approved RAB counts for budget pagu

            if (selectedAcademicYearId !== 'ALL' && plan.academicYearId !== selectedAcademicYearId) {
                return false;
            }

            const isBos = plan.source === 'BOS' || plan.id?.endsWith('-BOS');
            if (selectedSourceMode === 'BOS' && !isBos) return false;
            if (selectedSourceMode === 'Yayasan' && isBos) return false;

            if (isSuperAdmin) {
                if (selectedUnitFilter !== 'ALL') {
                    if (selectedUnitFilter.startsWith('FIELD-')) {
                        return plan.fieldId === selectedUnitFilter.replace('FIELD-', '');
                    }
                    return plan.unitId === selectedUnitFilter;
                }
                return true;
            } else if (myUnitId) {
                return plan.unitId === myUnitId;
            } else if (myFieldId) {
                return plan.fieldId === myFieldId;
            }
            return false;
        });

        // Extract all components from filtered RAB Plans
        const componentToProgramMap = new Map();
        const allExtractedComponents = [];

        filteredRabPlans.forEach(plan => {
            const uName = plan.unitId === 'FOUNDATION' ? 'Yayasan' : (units.find(u => u.id === plan.unitId)?.name || 'Yayasan');
            Object.entries(plan.expense || {}).forEach(([itemId, rawItemPlans]) => {
                const itemPlans = Array.isArray(rawItemPlans) ? rawItemPlans : (rawItemPlans && typeof rawItemPlans === 'object' ? [rawItemPlans] : []);
                itemPlans.forEach(p => {
                    (p.components || []).forEach(comp => {
                        let pagu = parseFloat(comp.total || comp.totalAmount || 0);
                        if (!pagu && comp.harga) {
                            pagu = parseFloat(comp.harga || 0) * parseFloat(comp.kali || comp.volume || 1);
                        }
                        if (!pagu && comp.months) {
                            pagu = Object.values(comp.months).reduce((sum, m) => sum + (parseFloat(m.jumlah) || 0), 0);
                        }

                        if (comp.programId) {
                            componentToProgramMap.set(comp.id, comp.programId);
                        }

                        allExtractedComponents.push({
                            ...comp,
                            name: comp.name || comp.label || '—',
                            unitName: uName,
                            pagu
                        });
                    });
                });
            });
        });

        // Filter Reports
        const filteredReports = budgetReports.filter(r => {
            if (r.isDeleted || r.status === 'REJECTED') return false;

            if (selectedAcademicYearId !== 'ALL' && r.academicYearId && r.academicYearId !== selectedAcademicYearId) {
                return false;
            }

            const isBos = r.source === 'BOS' || r.planId?.endsWith('-BOS');
            if (selectedSourceMode === 'BOS' && !isBos) return false;
            if (selectedSourceMode === 'Yayasan' && isBos) return false;

            if (isSuperAdmin) {
                if (selectedUnitFilter !== 'ALL') {
                    if (selectedUnitFilter.startsWith('FIELD-')) {
                        return r.fieldId === selectedUnitFilter.replace('FIELD-', '');
                    }
                    return r.unitId === selectedUnitFilter;
                }
                return true;
            } else if (myUnitId) {
                return r.unitId === myUnitId;
            } else if (myFieldId) {
                return r.fieldId === myFieldId;
            }
            return false;
        });

        // Process each program
        return activeExpensePrograms.map(prog => {
            // Find components belonging to this program
            const programComponents = allExtractedComponents.filter(c => c.programId === prog.id);
            const totalPagu = programComponents.reduce((s, c) => s + c.pagu, 0);

            // Find all reports belonging to this program
            const progReports = filteredReports.filter(r => {
                if (r.componentId && componentToProgramMap.get(r.componentId) === prog.id) {
                    return true;
                }
                // Check matching item name
                const repName = (r.category || r.description || '').trim().toLowerCase();
                const hasMatchingComp = programComponents.some(c => (c.name || '').trim().toLowerCase() === repName);
                return hasMatchingComp;
            });

            let totalRealisasi = 0;
            let totalPengembalian = 0;

            const reportListWithDetails = progReports.map(r => {
                const amt = parseFloat(r.amount || 0);
                const isRefund = r.kategoriAset === 'PENGEMBALIAN';
                if (isRefund) {
                    totalPengembalian += amt;
                } else {
                    totalRealisasi += amt;
                }
                const unitName = r.unitId === 'FOUNDATION' ? 'Yayasan' : (units.find(u => u.id === r.unitId)?.name || 'Yayasan');
                return {
                    ...r,
                    amt,
                    isRefund,
                    unitName
                };
            });

            const netRealisasi = Math.max(0, totalRealisasi - totalPengembalian);
            const sisaPagu = totalPagu - netRealisasi;
            const percentage = totalPagu > 0 ? Math.min(100, Math.round((netRealisasi / totalPagu) * 100)) : 0;

            return {
                ...prog,
                totalPagu,
                totalRealisasi,
                totalPengembalian,
                netRealisasi,
                sisaPagu,
                percentage,
                components: programComponents,
                reports: reportListWithDetails
            };
        }).filter(p => {
            // Only include programs that have non-zero amounts (RAB pagu, realisasi, or pengembalian)
            const hasData = p.totalPagu > 0 || p.totalRealisasi > 0 || p.totalPengembalian > 0;
            if (!hasData) return false;

            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                return p.name.toLowerCase().includes(term) || (p.code && p.code.toLowerCase().includes(term));
            }
            return true;
        });
    }, [activeExpensePrograms, rabPlans, budgetReports, selectedAcademicYearId, selectedUnitFilter, selectedSourceMode, searchTerm, isSuperAdmin, myUnitId, myFieldId, units]);

    // Total Overall Metrics
    const overallMetrics = useMemo(() => {
        const totalPagu = programMetricsData.reduce((s, p) => s + p.totalPagu, 0);
        const totalRealisasi = programMetricsData.reduce((s, p) => s + p.totalRealisasi, 0);
        const totalPengembalian = programMetricsData.reduce((s, p) => s + p.totalPengembalian, 0);
        const netRealisasi = Math.max(0, totalRealisasi - totalPengembalian);
        const totalSisa = totalPagu - netRealisasi;
        const avgPercentage = totalPagu > 0 ? Math.min(100, Math.round((netRealisasi / totalPagu) * 100)) : 0;

        return { totalPagu, totalRealisasi, totalPengembalian, netRealisasi, totalSisa, avgPercentage };
    }, [programMetricsData]);

    // Export to Excel
    const handleExportExcel = () => {
        const exportData = programMetricsData.map((p, idx) => ({
            'No': idx + 1,
            'Kode Program': p.code || `-`,
            'Nama Program Belanja': p.name,
            'Total Pagu RAB': p.totalPagu,
            'Total Realisasi Belanja': p.totalRealisasi,
            'Pengembalian Sisa Dana': p.totalPengembalian,
            'Realisasi Bersih': p.netRealisasi,
            'Sisa Anggaran': p.sisaPagu,
            'Penyerapan (%)': `${p.percentage}%`
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);
        XLSX.utils.book_append_sheet(wb, ws, 'Laporan Program Belanja');
        XLSX.writeFile(wb, `Laporan-Program-Belanja-${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    // Print Handler
    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="p-6 md:p-8 space-y-8 bg-slate-50 min-h-screen">
            {/* Header Title Banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl text-white shadow-lg shadow-indigo-500/25">
                        <FolderKanban size={28} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Laporan Program Belanja</h1>
                            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full border border-indigo-200">
                                Realisasi Anggaran
                            </span>
                        </div>
                        <p className="text-slate-500 text-sm font-medium mt-1">
                            Rekapitulasi alokasi Pagu RAB dan realisasi pengeluaran berdasarkan Program Belanja
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleExportExcel}
                        className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-2xl shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                    >
                        <Download size={16} />
                        Export Excel
                    </button>
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm rounded-2xl shadow-lg shadow-slate-800/20 transition-all cursor-pointer"
                    >
                        <Printer size={16} />
                        Cetak Laporan
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Filter Tahun Ajaran */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Calendar size={14} className="text-indigo-500" />
                            Tahun Ajaran
                        </label>
                        <select
                            value={selectedAcademicYearId}
                            onChange={e => setSelectedAcademicYearId(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="ALL">Semua Tahun Ajaran</option>
                            {academicYears.map(y => (
                                <option key={y.id} value={y.id}>{y.name} {y.isActive ? '(Aktif)' : ''}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filter Unit / Bidang */}
                    {isSuperAdmin && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <Building2 size={14} className="text-indigo-500" />
                                Unit / Bidang
                            </label>
                            <select
                                value={selectedUnitFilter}
                                onChange={e => setSelectedUnitFilter(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="ALL">Semua Unit & Bidang</option>
                                <optgroup label="Unit Sekolah">
                                    {units.map(u => (
                                        <option key={u.id} value={u.id}>{u.name}</option>
                                    ))}
                                </optgroup>
                                <optgroup label="Bidang Yayasan">
                                    {fields.map(f => (
                                        <option key={f.id} value={`FIELD-${f.id}`}>{f.name}</option>
                                    ))}
                                </optgroup>
                            </select>
                        </div>
                    )}

                    {/* Filter Sumber Dana */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Landmark size={14} className="text-indigo-500" />
                            Sumber Dana
                        </label>
                        <select
                            value={selectedSourceMode}
                            onChange={e => setSelectedSourceMode(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="ALL">Gabungan (Yayasan & BOS)</option>
                            <option value="Yayasan">Dana Yayasan</option>
                            <option value="BOS">Dana BOS</option>
                        </select>
                    </div>

                    {/* Search Program */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Search size={14} className="text-indigo-500" />
                            Cari Program
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Cari nama / kode program..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Executive Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* Total Pagu */}
                <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-6 rounded-3xl text-white shadow-xl shadow-indigo-500/20 relative overflow-hidden">
                    <div className="absolute right-[-10px] bottom-[-10px] opacity-15">
                        <Wallet size={100} />
                    </div>
                    <p className="text-indigo-100 text-xs font-bold uppercase tracking-wider">Total Pagu RAB Program</p>
                    <h3 className="text-2xl font-black mt-2 tracking-tight">
                        <CurrencyDisplay value={overallMetrics.totalPagu} />
                    </h3>
                    <div className="mt-4 flex items-center gap-2 text-indigo-100 text-xs font-semibold">
                        <span className="px-2 py-0.5 bg-white/20 rounded-full font-bold">
                            {programMetricsData.length} Program
                        </span>
                        <span>{currentYearObj?.name || 'Tahun Ajaran Aktif'}</span>
                    </div>
                </div>

                {/* Total Realisasi */}
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-3xl text-white shadow-xl shadow-blue-500/20 relative overflow-hidden">
                    <div className="absolute right-[-10px] bottom-[-10px] opacity-15">
                        <TrendingUp size={100} />
                    </div>
                    <p className="text-blue-100 text-xs font-bold uppercase tracking-wider">Total Realisasi Belanja</p>
                    <h3 className="text-2xl font-black mt-2 tracking-tight">
                        <CurrencyDisplay value={overallMetrics.totalRealisasi} />
                    </h3>
                    <div className="mt-4 flex items-center gap-2 text-blue-100 text-xs font-semibold">
                        {overallMetrics.totalPengembalian > 0 && (
                            <span className="px-2 py-0.5 bg-emerald-400/30 text-emerald-100 rounded-full font-bold">
                                Retur: {formatRupiah(overallMetrics.totalPengembalian)}
                            </span>
                        )}
                        <span>Nota Pelaporan Unit</span>
                    </div>
                </div>

                {/* Total Sisa */}
                <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-6 rounded-3xl text-white shadow-xl shadow-amber-500/20 relative overflow-hidden">
                    <div className="absolute right-[-10px] bottom-[-10px] opacity-15">
                        <PieChart size={100} />
                    </div>
                    <p className="text-amber-100 text-xs font-bold uppercase tracking-wider">Total Sisa Anggaran</p>
                    <h3 className="text-2xl font-black mt-2 tracking-tight">
                        <CurrencyDisplay value={overallMetrics.totalSisa} />
                    </h3>
                    <div className="mt-4 flex items-center gap-2 text-amber-100 text-xs font-semibold">
                        <span className="px-2 py-0.5 bg-white/20 rounded-full font-bold">
                            Belum Terpakai
                        </span>
                    </div>
                </div>

                {/* Persentase Penyerapan */}
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 rounded-3xl text-white shadow-xl shadow-emerald-500/20 relative overflow-hidden">
                    <div className="absolute right-[-10px] bottom-[-10px] opacity-15">
                        <Layers size={100} />
                    </div>
                    <p className="text-emerald-100 text-xs font-bold uppercase tracking-wider">Rata-Rata Penyerapan</p>
                    <h3 className="text-3xl font-black mt-2 tracking-tight">
                        {overallMetrics.avgPercentage}%
                    </h3>
                    <div className="w-full bg-white/20 rounded-full h-2 mt-4 overflow-hidden">
                        <div
                            className="bg-white h-full rounded-full transition-all duration-500"
                            style={{ width: `${overallMetrics.avgPercentage}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Program Metrics Table */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden" ref={reportRef}>
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 tracking-tight">Rekapitulasi Program Belanja</h2>
                        <p className="text-xs font-medium text-slate-400 mt-0.5">
                            Daftar penyerapan anggaran per Program Belanja (Urut berdasarkan program)
                        </p>
                    </div>
                    <span className="text-xs font-bold px-3 py-1 bg-slate-100 text-slate-600 rounded-full">
                        {programMetricsData.length} Program Ditemukan
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-500 text-xs font-bold uppercase tracking-wider">
                                <th className="py-4 px-6">No</th>
                                <th className="py-4 px-6">Kode & Nama Program</th>
                                <th className="py-4 px-6 text-right">Pagu RAB (Rp)</th>
                                <th className="py-4 px-6 text-right">Realisasi (Rp)</th>
                                <th className="py-4 px-6 text-right">Pengembalian (Rp)</th>
                                <th className="py-4 px-6 text-right">Sisa Pagu (Rp)</th>
                                <th className="py-4 px-6 text-center">Penyerapan (%)</th>
                                <th className="py-4 px-6 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm font-semibold text-slate-700">
                            {programMetricsData.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-slate-400">
                                        <FolderKanban size={40} className="mx-auto mb-3 opacity-30" />
                                        <p className="font-bold">Tidak ada data Program Belanja</p>
                                        <p className="text-xs text-slate-400 mt-1">Coba atur ulang filter atau kata kunci pencarian</p>
                                    </td>
                                </tr>
                            ) : (
                                programMetricsData.map((prog, idx) => (
                                    <tr key={prog.id} className="hover:bg-indigo-50/30 transition-colors">
                                        <td className="py-4 px-6 text-slate-400 font-bold">{idx + 1}</td>
                                        <td className="py-4 px-6">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-800">{prog.name}</span>
                                                {prog.code && (
                                                    <span className="text-xs text-slate-400 font-mono mt-0.5">{prog.code}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-right font-bold text-slate-800">
                                            {formatRupiah(prog.totalPagu)}
                                        </td>
                                        <td className="py-4 px-6 text-right font-bold text-blue-600">
                                            {formatRupiah(prog.totalRealisasi)}
                                        </td>
                                        <td className="py-4 px-6 text-right font-bold text-emerald-600">
                                            {prog.totalPengembalian > 0 ? formatRupiah(prog.totalPengembalian) : '—'}
                                        </td>
                                        <td className={`py-4 px-6 text-right font-bold ${prog.sisaPagu < 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                                            {formatRupiah(prog.sisaPagu)}
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                                                    prog.percentage >= 100
                                                        ? 'bg-emerald-100 text-emerald-700'
                                                        : prog.percentage >= 50
                                                        ? 'bg-blue-100 text-blue-700'
                                                        : 'bg-amber-100 text-amber-700'
                                                }`}>
                                                    {prog.percentage}%
                                                </span>
                                                <div className="w-20 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${
                                                            prog.percentage >= 100 ? 'bg-emerald-500' : prog.percentage >= 50 ? 'bg-blue-500' : 'bg-amber-500'
                                                        }`}
                                                        style={{ width: `${prog.percentage}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <button
                                                onClick={() => setSelectedProgramDetail(prog)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                                            >
                                                <Eye size={14} />
                                                Detail
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        {programMetricsData.length > 0 && (
                            <tfoot>
                                <tr className="bg-slate-100/80 border-t-2 border-slate-200 text-slate-800 font-black text-sm">
                                    <td colSpan={2} className="py-4 px-6">TOTAL KESELURUHAN</td>
                                    <td className="py-4 px-6 text-right">{formatRupiah(overallMetrics.totalPagu)}</td>
                                    <td className="py-4 px-6 text-right text-blue-700">{formatRupiah(overallMetrics.totalRealisasi)}</td>
                                    <td className="py-4 px-6 text-right text-emerald-700">{formatRupiah(overallMetrics.totalPengembalian)}</td>
                                    <td className="py-4 px-6 text-right">{formatRupiah(overallMetrics.totalSisa)}</td>
                                    <td className="py-4 px-6 text-center">{overallMetrics.avgPercentage}%</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            {/* Drill-Down Detail Modal */}
            {selectedProgramDetail && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="p-6 bg-gradient-to-r from-indigo-600 to-blue-600 text-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-white/10 rounded-2xl">
                                    <FolderKanban size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold">{selectedProgramDetail.name}</h3>
                                    <p className="text-xs text-indigo-100 mt-0.5">Rincian Item Anggaran & Realisasi Belanja</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedProgramDetail(null)}
                                className="p-2 hover:bg-white/10 rounded-xl transition-all text-white cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Summary Cards */}
                        <div className="p-6 bg-slate-50 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="bg-white p-4 rounded-2xl border border-slate-200/80">
                                <p className="text-xs font-bold text-slate-400 uppercase">Pagu RAB</p>
                                <p className="text-lg font-black text-slate-800 mt-1">{formatRupiah(selectedProgramDetail.totalPagu)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-slate-200/80">
                                <p className="text-xs font-bold text-slate-400 uppercase">Realisasi</p>
                                <p className="text-lg font-black text-blue-600 mt-1">{formatRupiah(selectedProgramDetail.totalRealisasi)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-slate-200/80">
                                <p className="text-xs font-bold text-slate-400 uppercase">Pengembalian</p>
                                <p className="text-lg font-black text-emerald-600 mt-1">{formatRupiah(selectedProgramDetail.totalPengembalian)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-slate-200/80">
                                <p className="text-xs font-bold text-slate-400 uppercase">Sisa Pagu</p>
                                <p className="text-lg font-black text-indigo-600 mt-1">{formatRupiah(selectedProgramDetail.sisaPagu)}</p>
                            </div>
                        </div>

                        {/* Modal Body (Tabbed Content / Scrollable) */}
                        <div className="p-6 overflow-y-auto space-y-6 flex-1">
                            {/* Section 1: Item Anggaran di bawah program ini */}
                            <div>
                                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Layers size={16} className="text-indigo-600" />
                                    Daftar Component Item RAB ({selectedProgramDetail.components.length})
                                </h4>
                                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-slate-100 text-slate-500 font-bold uppercase">
                                                <th className="py-3 px-4">Nama Item</th>
                                                <th className="py-3 px-4">Unit</th>
                                                <th className="py-3 px-4 text-right">Pagu Anggaran</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                                            {selectedProgramDetail.components.length === 0 ? (
                                                <tr>
                                                    <td colSpan={3} className="py-6 text-center text-slate-400">
                                                        Belum ada item RAB dialokasikan ke program ini
                                                    </td>
                                                </tr>
                                            ) : (
                                                selectedProgramDetail.components.map((comp, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50">
                                                        <td className="py-3 px-4 font-bold text-slate-800">{comp.name}</td>
                                                        <td className="py-3 px-4">{comp.unitName}</td>
                                                        <td className="py-3 px-4 text-right font-bold">{formatRupiah(comp.pagu)}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Section 2: Realisasi Nota / SPJ */}
                            <div>
                                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <FileText size={16} className="text-indigo-600" />
                                    Daftar Realisasi Nota / SPJ ({selectedProgramDetail.reports.length})
                                </h4>
                                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-slate-100 text-slate-500 font-bold uppercase">
                                                <th className="py-3 px-4">Tanggal</th>
                                                <th className="py-3 px-4">No Nota / Uraian</th>
                                                <th className="py-3 px-4">Unit</th>
                                                <th className="py-3 px-4 text-right">Nominal (Rp)</th>
                                                <th className="py-3 px-4 text-center">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                                            {selectedProgramDetail.reports.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="py-6 text-center text-slate-400">
                                                        Belum ada laporan realisasi nota untuk program ini
                                                    </td>
                                                </tr>
                                            ) : (
                                                selectedProgramDetail.reports.map((rep, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50">
                                                        <td className="py-3 px-4 text-slate-500">{rep.date ? formatTanggal(rep.date) : '—'}</td>
                                                        <td className="py-3 px-4">
                                                            <p className="font-bold text-slate-800">{rep.category || rep.description}</p>
                                                            {rep.nomorNota && <p className="text-[10px] text-slate-400 font-mono">Nota: {rep.nomorNota}</p>}
                                                        </td>
                                                        <td className="py-3 px-4">{rep.unitName}</td>
                                                        <td className={`py-3 px-4 text-right font-bold ${rep.isRefund ? 'text-emerald-600' : 'text-slate-800'}`}>
                                                            {rep.isRefund ? `-${formatRupiah(rep.amt)} (Retur)` : formatRupiah(rep.amt)}
                                                        </td>
                                                        <td className="py-3 px-4 text-center">
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                                rep.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                                            }`}>
                                                                {rep.status === 'APPROVED' ? 'Disetujui' : 'Pending/Draft'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                            <button
                                onClick={() => setSelectedProgramDetail(null)}
                                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm rounded-xl transition-all cursor-pointer"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
