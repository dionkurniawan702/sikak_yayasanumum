import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Building2, Layers, Download, FileSpreadsheet } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatRupiah } from '../../utils/format';
import * as XLSX from 'xlsx';

export default function BudgetDashboard() {
    const { state, dispatch } = useApp();
    const { 
        currentUser, 
        students = [], 
        units = [], 
        fields = [], 
        expenseItems = [], 
        distributionSettings = [], 
        studentStatuses = [],
        budgets = [],
        academicYears = [],
        rabPlans = []
    } = state;

    // Global Academic Year Persistence (ID-based)
    const selectedAcademicYearId = state.globalAcademicYearId || '';
    const setSelectedAcademicYearId = (id) => dispatch({ type: 'SET_GLOBAL_YEAR', payload: id });
    
    const activeAcademicYear = useMemo(() => {
        return academicYears.find(y => y.id === selectedAcademicYearId && !y.isDeleted);
    }, [academicYears, selectedAcademicYearId]);
    
    // For display/logic compatibility
    const selectedAcademicYearName = activeAcademicYear?.name || '';

    const [expandedUnits, setExpandedUnits] = useState({});
    const [expandedFields, setExpandedFields] = useState({});

    const toggleUnit = (id) => {
        setExpandedUnits(prev => ({ ...prev, [id]: !prev[id] }));
    };
    const toggleField = (id) => {
        setExpandedFields(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const [expandedDetailItems, setExpandedDetailItems] = useState({}); // Stores fieldId-exId
    const toggleDetailItem = (parentId, itemId) => {
        const key = `${parentId}-${itemId}`;
        setExpandedDetailItems(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // ========== ENGINE: RAP (Rencana Anggaran Pendapatan) ==========
    const { unitRAP, fieldRAP } = useMemo(() => {
        const uRAP = {};
        const fRAP = {};
        units.filter(u => !u.isDeleted).forEach(u => uRAP[u.id] = { total: 0, items: {} });
        fields.filter(f => !f.isDeleted).forEach(f => fRAP[f.id] = { total: 0, items: {} });

        const nonActiveStatusNames = ['alumni', 'pindah', 'dikeluarkan', 'cuti', 'non aktif'];
        const activeStudents = students.filter(s => {
            if (s.isDeleted) return false;
            const statusName = (s.status?.name || '').toLowerCase();
            if (nonActiveStatusNames.includes(statusName)) return false;
            return (activeAcademicYear ? s.academicYearId === activeAcademicYear.id : true);
        });

        activeStudents.forEach(student => {
            if (!student.unitId || !uRAP[student.unitId]) return;
            
            student.incomeDetails?.forEach(detail => {
                const amount = parseFloat(detail.amount) || 0;
                if (amount <= 0) return;

                const rules = distributionSettings.filter(
                    s => s.unitId === student.unitId && s.incomeItemId === detail.incomeItemId
                );

                if (rules.length === 0) {
                    uRAP[student.unitId].total += amount;
                    const exId = 'unallocated';
                    uRAP[student.unitId].items[exId] = (uRAP[student.unitId].items[exId] || 0) + amount;
                } else {
                    rules.forEach(rule => {
                        const percent = parseFloat(rule.percentage) || 0;
                        const share = amount * (percent / 100);
                        if (share <= 0) return;

                        const exItem = expenseItems.find(e => e.id === rule.expenseItemId);
                        const itemName = (exItem?.name || getExpenseName(rule.expenseItemId) || '').toLowerCase().trim();
                        
                        // SMART GUARD: Exclude Field-only keywords and explicit Field ownership
                        const isFieldItem = (exItem && exItem.fieldId && !exItem.unitId) || 
                                           itemName.includes('penggajian') || 
                                           itemName.includes('pengembangan (umum)') ||
                                           itemName.includes('honor') ||
                                           itemName.includes('yayasan');
                                           
                        const effectiveDestType = isFieldItem ? 'field' : rule.destType;
                        // Use item's fieldId if it's a field item and rule.destId is not a field
                        const targetFieldId = isFieldItem ? (exItem?.fieldId || (rule.destType === 'field' ? rule.destId : fields[0]?.id)) : rule.destId;

                        if (effectiveDestType === 'unit') {
                            uRAP[student.unitId].total += share;
                            const exId = rule.expenseItemId || 'unallocated';
                            uRAP[student.unitId].items[exId] = (uRAP[student.unitId].items[exId] || 0) + share;
                        } else if (effectiveDestType === 'field') {
                            if (targetFieldId && fRAP[targetFieldId]) {
                                fRAP[targetFieldId].total += share;
                                const exId = rule.expenseItemId || 'unallocated';
                                if (!fRAP[targetFieldId].items[exId]) {
                                    fRAP[targetFieldId].items[exId] = { total: 0, sources: {} };
                                }
                                fRAP[targetFieldId].items[exId].total += share;
                                fRAP[targetFieldId].items[exId].sources[student.unitId] = 
                                    (fRAP[targetFieldId].items[exId].sources[student.unitId] || 0) + share;
                            }
                        }
                    });
                }
            });
        });

        return { unitRAP: uRAP, fieldRAP: fRAP };
    }, [students, units, fields, distributionSettings, studentStatuses, currentUser, activeAcademicYear, expenseItems]);

    // ========== ENGINE: RAB (Rencana Anggaran Belanja) ==========
    const { unitRAB, fieldRAB } = useMemo(() => {
        const uRAB = {};
        const fRAB = {};
        units.filter(u => !u.isDeleted).forEach(u => uRAB[u.id] = { total: 0, items: {} });
        fields.filter(f => !f.isDeleted).forEach(f => fRAB[f.id] = { total: 0, items: {} });

        // 1. Process Consolidated RAB Plans (The Master Budget Source)
        // BUG FIX: Only use this as the single source for RAB to avoid double counting with requests
        rabPlans.filter(p => p.status === 'APPROVED' && p.academicYearId === selectedAcademicYearId).forEach(plan => {
            Object.entries(plan.expense || {}).forEach(([exId, detail]) => {
                const amount = parseFloat(detail.total) || 0;
                if (amount <= 0) return;

                const exItem = expenseItems.find(e => e.id === exId);
                const itemName = (exItem?.name || getExpenseName(exId) || '').toLowerCase().trim();

                const isFieldItem = (exItem && exItem.fieldId && !exItem.unitId) || 
                                   itemName.includes('penggajian') || 
                                   itemName.includes('pengembangan (umum)') ||
                                   itemName.includes('honor') ||
                                   itemName.includes('yayasan');

                const targetFieldId = isFieldItem ? (exItem?.fieldId || plan.fieldId || fields[0]?.id) : plan.fieldId;

                if (!isFieldItem && plan.unitId && uRAB[plan.unitId]) {
                    uRAB[plan.unitId].total += amount;
                    uRAB[plan.unitId].items[exId] = (uRAB[plan.unitId].items[exId] || 0) + amount;
                } else if (targetFieldId && fRAB[targetFieldId]) {
                    fRAB[targetFieldId].total += amount;
                    if (!fRAB[targetFieldId].items[exId]) {
                        fRAB[targetFieldId].items[exId] = { total: 0, sources: {} };
                    }
                    const fItem = fRAB[targetFieldId].items[exId];
                    if (typeof fItem === 'number') {
                        fRAB[targetFieldId].items[exId] = { total: fItem + amount, sources: {} };
                    } else {
                        fItem.total += amount;
                        if (plan.unitId) {
                            fItem.sources[plan.unitId] = (fItem.sources[plan.unitId] || 0) + amount;
                        }
                    }
                }
            });
        });

        // NOTE: Budget Requests removed from RAB total to avoid duplicate info as requested.
        // If needed for "Realisasi", a separate engine/column should be added later.

        return { unitRAB: uRAB, fieldRAB: fRAB };
    }, [rabPlans, units, fields, currentUser, selectedAcademicYearId, expenseItems, selectedAcademicYearName]);

    // ========== Helpers ==========
    const getExpenseName = (id) => {
        if (id === 'unallocated') return 'Belum Dialokasikan';
        if (id === 'other') return 'Lainnya';
        const ex = expenseItems.find(e => e.id === id);
        return ex ? ex.name : 'Pos Tidak Ditemukan';
    };

    const getUnitName = (id) => {
        const u = units.find(u => u.id === id);
        return u ? u.name : 'Unknown';
    };

    const formatCurrency = (val) => {
        const num = parseFloat(val) || 0;
        return `Rp. ${num.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    };

    // ========== Build Display Data ==========
    const bidangData = useMemo(() => {
        return fields.filter(f => !f.isDeleted).map(f => {
            if (currentUser?.role === 'admin_bidang' && f.id !== currentUser.fieldId) return null;
            const rap = fieldRAP[f.id]?.total || 0;
            const rab = fieldRAB[f.id]?.total || 0;
            const sisa = rap - rab;
            const items = fieldRAP[f.id]?.items || {};
            const rabItems = fieldRAB[f.id]?.items || {};
            
            const allKeys = new Set([...Object.keys(items), ...Object.keys(rabItems)]);
            const breakdown = [];
            allKeys.forEach(exId => {
                const itemRAP = typeof items[exId] === 'object' ? items[exId].total : (items[exId] || 0);
                const itemRAB = typeof rabItems[exId] === 'object' ? rabItems[exId].total : (rabItems[exId] || 0);
                if (itemRAP === 0 && itemRAB === 0) return;

                breakdown.push({
                    id: exId,
                    name: getExpenseName(exId),
                    rap: itemRAP,
                    rab: itemRAB,
                    sisa: itemRAP - itemRAB,
                    sources: typeof items[exId] === 'object' ? items[exId].sources : {}
                });
            });

            return { id: f.id, name: f.name, rap, rab, sisa, breakdown };
        }).filter(Boolean).sort((a, b) => b.rap - a.rap);
    }, [fields, fieldRAP, fieldRAB, currentUser, expenseItems]);

    const unitData = useMemo(() => {
        return units.filter(u => !u.isDeleted).map(u => {
            if (currentUser?.role === 'admin_unit' && u.id !== currentUser.unitId) return null;
            
            const rawItems = unitRAP[u.id]?.items || {};
            const rawRabItems = unitRAB[u.id]?.items || {};
            const allKeys = new Set([...Object.keys(rawItems), ...Object.keys(rawRabItems)]);
            
            const breakdown = [];
            allKeys.forEach(exId => {
                const exItem = expenseItems.find(e => e.id === exId);
                const itemName = (exItem?.name || getExpenseName(exId) || '').toLowerCase().trim();
                
                // ULTIMATE FILTER: Strictly block Field items from Unit breakdown
                const isFieldItem = (exItem && exItem.fieldId && !exItem.unitId) || 
                                   itemName.includes('penggajian') || 
                                   itemName.includes('pengembangan (umum)') ||
                                   itemName.includes('honor') ||
                                   itemName.includes('yayasan');
                
                if (isFieldItem) return;

                const itemRAP = rawItems[exId] || 0;
                const itemRAB = rawRabItems[exId] || 0;
                if (itemRAP === 0 && itemRAB === 0) return;

                breakdown.push({
                    id: exId,
                    name: getExpenseName(exId),
                    rap: itemRAP,
                    rab: itemRAB,
                    sisa: itemRAP - itemRAB
                });
            });

            // Recalculate Totals based ONLY on visible breakdown items for consistency
            const totalRAP = breakdown.reduce((sum, item) => sum + item.rap, 0);
            const totalRAB = breakdown.reduce((sum, item) => sum + item.rab, 0);

            return { 
                id: u.id, 
                name: u.name, 
                rap: totalRAP, 
                rab: totalRAB, 
                sisa: totalRAP - totalRAB, 
                breakdown 
            };
        }).filter(Boolean).sort((a, b) => b.rap - a.rap);
    }, [units, unitRAP, unitRAB, currentUser, expenseItems, fields]);

    // ========== Totals ==========
    const totalBidangRAP = bidangData.reduce((s, d) => s + d.rap, 0);
    const totalBidangRAB = bidangData.reduce((s, d) => s + d.rab, 0);
    const totalBidangSisa = totalBidangRAP - totalBidangRAB;

    const totalUnitRAP = unitData.reduce((s, d) => s + d.rap, 0);
    const totalUnitRAB = unitData.reduce((s, d) => s + d.rab, 0);
    const totalUnitSisa = totalUnitRAP - totalUnitRAB;

    // ========== Export to Excel (Bahasa Indonesia) ==========
    const exportToExcel = () => {
        const wb = XLSX.utils.book_new();

        // Bidang Sheet
        if (currentUser?.role !== 'admin_unit') {
            const bidangRows = [];
            bidangData.forEach(b => {
                bidangRows.push({ Nama: b.name, RAP: b.rap, RAB: b.rab, 'Sisa Anggaran': b.sisa });
                b.breakdown.forEach(item => {
                    bidangRows.push({ Nama: `  └ ${item.name}`, RAP: item.rap, RAB: item.rab, 'Sisa Anggaran': item.sisa });
                    if (item.sources && Object.keys(item.sources).length > 0) {
                        Object.entries(item.sources).forEach(([unitId, amount]) => {
                            bidangRows.push({ 
                                Nama: `    • ${getUnitName(unitId)}`, 
                                RAP: amount, 
                                RAB: '', 
                                'Sisa Anggaran': '' 
                            });
                        });
                    }
                });
            });
            bidangRows.push({ Nama: 'TOTAL', RAP: totalBidangRAP, RAB: totalBidangRAB, 'Sisa Anggaran': totalBidangSisa });
            const ws1 = XLSX.utils.json_to_sheet(bidangRows);
            XLSX.utils.book_append_sheet(wb, ws1, 'Bidang');
        }

        // Unit Sheet
        if (currentUser?.role !== 'admin_bidang') {
            const unitRows = [];
            unitData.forEach(u => {
                unitRows.push({ Nama: u.name, RAP: u.rap, RAB: u.rab, 'Sisa Anggaran': u.sisa });
                u.breakdown.forEach(item => {
                    unitRows.push({ Nama: `  └ ${item.name}`, RAP: item.rap, RAB: item.rab, 'Sisa Anggaran': item.sisa });
                });
            });
            unitRows.push({ Nama: 'TOTAL', RAP: totalUnitRAP, RAB: totalUnitRAB, 'Sisa Anggaran': totalUnitSisa });
            const ws2 = XLSX.utils.json_to_sheet(unitRows);
            XLSX.utils.book_append_sheet(wb, ws2, 'Unit');
        }

        XLSX.writeFile(wb, `Dasbor-Anggaran-${selectedAcademicYearName}.xlsx`);
    };

    // ========== Table Row Component (Premium Look) ==========
    const BudgetRow = ({ data, isExpanded, onToggle }) => (
        <>
            <tr 
                className="budget-row cursor-pointer hover:bg-slate-50 transition-colors group"
                onClick={onToggle}
            >
                <td className="budget-cell budget-cell-name">
                    <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${isExpanded ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'}`}>
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </span>
                        <span className="font-black text-slate-800 tracking-tight">{data.name}</span>
                    </div>
                </td>
                <td className="budget-cell budget-cell-number font-black text-slate-900">
                    {formatCurrency(data.rap)}
                </td>
                <td className="budget-cell budget-cell-number font-bold text-slate-500">
                    {formatCurrency(data.rab)}
                </td>
                <td className="budget-cell budget-cell-number budget-cell-sisa">
                    <span className={`font-black px-3 py-1 rounded-full text-[12px] ${data.sisa < 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {formatCurrency(data.sisa)}
                    </span>
                </td>
            </tr>
            {isExpanded && data.breakdown.map(item => {
                const hasSources = item.sources && Object.keys(item.sources).length > 0;
                const isDetailExpanded = !!expandedDetailItems[`${data.id}-${item.id}`];

                return (
                    <React.Fragment key={item.id}>
                        <tr 
                            className={`budget-row-detail group ${hasSources ? 'cursor-pointer hover:bg-indigo-50/50' : ''}`}
                            onClick={() => hasSources && toggleDetailItem(data.id, item.id)}
                        >
                            <td className="budget-cell budget-cell-name" style={{ paddingLeft: '44px' }}>
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-300">└</span>
                                    {hasSources && (
                                        <span className="text-indigo-400 group-hover:text-indigo-600">
                                            {isDetailExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                                        </span>
                                    )}
                                    <span className={`${hasSources ? 'text-slate-700 font-bold' : 'text-slate-500'} text-[12px]`}>
                                        {item.name}
                                    </span>
                                </div>
                            </td>
                            <td className="budget-cell budget-cell-number text-slate-400 text-[11px] font-bold">
                                {formatCurrency(item.rap)}
                            </td>
                            <td className="budget-cell budget-cell-number text-slate-400 text-[11px] font-bold">
                                {formatCurrency(item.rab)}
                            </td>
                            <td className={`budget-cell budget-cell-number budget-cell-sisa text-[11px] font-black ${item.sisa < 0 ? 'text-rose-500' : 'text-blue-400'}`}>
                                {formatCurrency(item.sisa)}
                            </td>
                        </tr>
                        {isDetailExpanded && hasSources && Object.entries(item.sources).map(([unitId, amount]) => (
                            <tr key={unitId} className="budget-row-source animate-in slide-in-from-left-2 duration-300">
                                <td className="budget-cell budget-cell-name" style={{ paddingLeft: '80px' }}>
                                    <div className="flex items-center gap-1.5 py-0.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            {getUnitName(unitId)}
                                        </span>
                                    </div>
                                </td>
                                <td className="budget-cell budget-cell-number">
                                    <span className="text-[10px] font-black text-indigo-400">
                                        {formatCurrency(amount)}
                                    </span>
                                </td>
                                <td colSpan="2" className="budget-cell" />
                            </tr>
                        ))}
                    </React.Fragment>
                );
            })}
        </>
    );

    return (
        <div className="p-8 animate-in pb-20">
            {/* Header (Indonesian) */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight font-display">Dasbor Anggaran</h1>
                    <p className="text-slate-400 font-bold text-xs mt-2 uppercase tracking-widest">Ringkasan Rencana Anggaran Pendapatan (RAP) vs Belanja (RAB)</p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        className="budget-select shadow-sm"
                        value={selectedAcademicYearId}
                        onChange={e => setSelectedAcademicYearId(e.target.value)}
                    >
                        {academicYears.filter(a => !a.isDeleted && (a.isActive || a.id === selectedAcademicYearId))
                            .sort((a, b) => b.name.localeCompare(a.name))
                            .map(y => (
                                <option key={y.id} value={y.id}>{y.name}</option>
                            ))}
                    </select>
                    <button
                        onClick={exportToExcel}
                        className="budget-export-btn shadow-sm"
                    >
                        <FileSpreadsheet size={16} />
                        <span>Cetak Laporan Excel</span>
                    </button>
                </div>
            </div>

            {/* ===== BIDANG TABLE (Indigo Theme) ===== */}
            {currentUser?.role !== 'admin_unit' && (
                <div className="budget-table-wrapper mb-12 border-none shadow-xl shadow-slate-200/50">
                    <div className="budget-table-title bg-slate-900 text-white">
                        <Layers size={20} className="text-indigo-400" />
                        <span className="uppercase tracking-widest text-sm italic">Ringkasan Per Bidang</span>
                    </div>
                    <div className="budget-table-scroll">
                        <table className="budget-table">
                            <thead>
                                <tr>
                                    <th className="budget-th budget-th-name">NAMA BIDANG</th>
                                    <th className="budget-th budget-th-number">RAP (PENDAPATAN)</th>
                                    <th className="budget-th budget-th-number">RAB (BELANJA)</th>
                                    <th className="budget-th budget-th-number">SISA ANGGARAN</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bidangData.length > 0 ? (
                                    <>
                                        {bidangData.map(b => (
                                            <BudgetRow 
                                                key={b.id} 
                                                data={b} 
                                                isExpanded={!!expandedFields[b.id]} 
                                                onToggle={() => toggleField(b.id)} 
                                            />
                                        ))}
                                        <tr className="budget-row-total bg-slate-50">
                                            <td className="budget-cell budget-cell-name font-black text-xs text-slate-800 uppercase tracking-widest">Total Konsolidasi Bidang</td>
                                            <td className="budget-cell budget-cell-number font-black text-slate-900 border-l-2 border-indigo-100">{formatCurrency(totalBidangRAP)}</td>
                                            <td className="budget-cell budget-cell-number font-black text-slate-900">{formatCurrency(totalBidangRAB)}</td>
                                            <td className="budget-cell budget-cell-number budget-cell-sisa bg-indigo-50/30 text-indigo-700 font-black">{formatCurrency(totalBidangSisa)}</td>
                                        </tr>
                                    </>
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="text-center py-20 text-slate-300 font-bold uppercase tracking-widest text-[10px] italic">
                                            Belum ada data bidang untuk periode ini.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ===== UNIT TABLE (Indigo Theme) ===== */}
            {currentUser?.role !== 'admin_bidang' && (
                <div className="budget-table-wrapper border-none shadow-xl shadow-slate-200/50">
                    <div className="budget-table-title bg-slate-900 text-white">
                        <Building2 size={20} className="text-blue-400" />
                        <span className="uppercase tracking-widest text-sm italic">Ringkasan Per Unit</span>
                    </div>
                    <div className="budget-table-scroll">
                        <table className="budget-table">
                            <thead>
                                <tr>
                                    <th className="budget-th budget-th-name">NAMA UNIT</th>
                                    <th className="budget-th budget-th-number">RAP (PENDAPATAN)</th>
                                    <th className="budget-th budget-th-number">RAB (BELANJA)</th>
                                    <th className="budget-th budget-th-number">SISA ANGGARAN</th>
                                </tr>
                            </thead>
                            <tbody>
                                {unitData.length > 0 ? (
                                    <>
                                        {unitData.map(u => (
                                            <BudgetRow 
                                                key={u.id} 
                                                data={u} 
                                                isExpanded={!!expandedUnits[u.id]} 
                                                onToggle={() => toggleUnit(u.id)} 
                                            />
                                        ))}
                                        <tr className="budget-row-total bg-slate-50">
                                            <td className="budget-cell budget-cell-name font-black text-xs text-slate-800 uppercase tracking-widest">Total Konsolidasi Unit</td>
                                            <td className="budget-cell budget-cell-number font-black text-slate-900 border-l-2 border-blue-100">{formatCurrency(totalUnitRAP)}</td>
                                            <td className="budget-cell budget-cell-number font-black text-slate-900">{formatCurrency(totalUnitRAB)}</td>
                                            <td className="budget-cell budget-cell-number budget-cell-sisa bg-blue-50/30 text-blue-700 font-black">{formatCurrency(totalUnitSisa)}</td>
                                        </tr>
                                    </>
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="text-center py-20 text-slate-300 font-bold uppercase tracking-widest text-[10px] italic">
                                            Belum ada data unit untuk periode ini.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className="mt-20 text-center">
                <div className="inline-block px-10 py-3 bg-white border border-slate-100 rounded-full shadow-sm">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">
                        Sistem Akuntansi Keuangan Yayasan Umum — SIKAK
                    </p>
                </div>
            </div>
        </div>
    );
}
