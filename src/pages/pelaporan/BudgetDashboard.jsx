import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Building2, Layers, Download, FileSpreadsheet } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatRupiah } from '../../utils/format';
import * as XLSX from 'xlsx';

export default function BudgetDashboard() {
    const { state } = useApp();
    const { 
        currentUser, 
        students = [], 
        units = [], 
        fields = [], 
        expenseItems = [], 
        distributionSettings = [], 
        studentStatuses = [],
        budgets = [],
        academicYears = []
    } = state;

    // Academic year selector using Database
    const currentDbAy = academicYears.find(a => a.isCurrent && !a.isDeleted);
    const fallbackYear = `${new Date().getFullYear() - 1}/${new Date().getFullYear()}`;
    const [selectedAcademicYear, setSelectedAcademicYear] = useState(currentDbAy ? currentDbAy.name : fallbackYear);
    
    const yearOptions = academicYears.filter(a => !a.isDeleted).map(a => a.name)
        .sort((a, b) => b.localeCompare(a));
    if (!yearOptions.includes(selectedAcademicYear)) {
        yearOptions.push(selectedAcademicYear);
    }

    const activeAcademicYear = useMemo(() => {
        return academicYears.find(y => y.name === selectedAcademicYear && !y.isDeleted);
    }, [academicYears, selectedAcademicYear]);

    const [expandedUnits, setExpandedUnits] = useState({});
    const [expandedFields, setExpandedFields] = useState({});

    const toggleUnit = (id) => {
        setExpandedUnits(prev => ({ ...prev, [id]: !prev[id] }));
    };
    const toggleField = (id) => {
        setExpandedFields(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // ========== ENGINE: RAP (Rencana Anggaran Pendapatan) ==========
    // RAP = Projected income from student distribution settings
    const { unitRAP, fieldRAP } = useMemo(() => {
        const uRAP = {}; // unitId -> { total, items: { expenseItemId: amount } }
        const fRAP = {}; // fieldId -> { total, items: { expenseItemId: { total, sources: { unitId: amount } } } }

        units.filter(u => !u.isDeleted).forEach(u => {
            if (currentUser?.role === 'admin_unit' && u.id !== currentUser.unitId) return;
            uRAP[u.id] = { total: 0, items: {} };
        });

        fields.filter(f => !f.isDeleted).forEach(f => {
            if (currentUser?.role === 'admin_bidang' && f.id !== currentUser.fieldId) return;
            fRAP[f.id] = { total: 0, items: {} };
        });

        const nonActiveStatusNames = ['alumni', 'pindah', 'dikeluarkan', 'cuti', 'non aktif'];
        const activeStudents = students.filter(s => {
            if (s.isDeleted) return false;
            
            // Check status name (case-insensitive)
            const statusName = (s.status?.name || '').toLowerCase();
            if (nonActiveStatusNames.includes(statusName)) return false;

            // Matching Academic Year
            return (activeAcademicYear ? s.academicYearId === activeAcademicYear.id : true);
        });

        activeStudents.forEach(student => {
            if (!student.unitId || !uRAP[student.unitId]) return;

            if (student.incomeDetails && student.incomeDetails.length > 0) {
                student.incomeDetails.forEach(detail => {
                    const amount = parseFloat(detail.amount) || 0;
                    if (amount <= 0) return;

                    const rules = distributionSettings.filter(
                        s => s.unitId === student.unitId && s.incomeItemId === detail.incomeItemId
                    );

                    if (rules.length === 0) {
                        // No distribution rule -> all stays at unit
                        uRAP[student.unitId].total += amount;
                        const exId = 'unallocated';
                        uRAP[student.unitId].items[exId] = (uRAP[student.unitId].items[exId] || 0) + amount;
                    } else {
                        rules.forEach(rule => {
                            const percent = parseFloat(rule.percentage) || 0;
                            const share = amount * (percent / 100);
                            if (share <= 0) return;

                            if (rule.destType === 'unit') {
                                uRAP[student.unitId].total += share;
                                const exId = rule.expenseItemId || 'unallocated';
                                uRAP[student.unitId].items[exId] = (uRAP[student.unitId].items[exId] || 0) + share;
                            } else if (rule.destType === 'field') {
                                const targetFieldId = rule.destId;
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
            }
        });

        return { unitRAP: uRAP, fieldRAP: fRAP };
    }, [students, units, fields, distributionSettings, studentStatuses, currentUser, activeAcademicYear]);

    // ========== ENGINE: RAB (Rencana Anggaran Belanja) ==========
    // RAB = Budgeted expenses set by users in the Budgeting module
    const { unitRAB, fieldRAB } = useMemo(() => {
        const uRAB = {}; // unitId -> { total, items: { expenseItemId: amount } }
        const fRAB = {}; // fieldId -> { total, items: { expenseItemId: amount } }

        // Initialize
        units.filter(u => !u.isDeleted).forEach(u => {
            if (currentUser?.role === 'admin_unit' && u.id !== currentUser.unitId) return;
            uRAB[u.id] = { total: 0, items: {} };
        });
        fields.filter(f => !f.isDeleted).forEach(f => {
            if (currentUser?.role === 'admin_bidang' && f.id !== currentUser.fieldId) return;
            fRAB[f.id] = { total: 0, items: {} };
        });

        // Aggregate from budgetRequests that are APPROVED, filtered by Academic Year (July - June)
        const startYear = parseInt(selectedAcademicYear.split('/')[0]);
        const endYear = parseInt(selectedAcademicYear.split('/')[1]);

        const approvedRequests = (state.budgetRequests || []).filter(r => {
            if (r.status !== 'APPROVED') return false;
            
            const reqYear = parseInt(r.year);
            const reqMonth = parseInt(r.month);
            
            if (reqYear === startYear && reqMonth >= 7) return true;
            if (reqYear === endYear && reqMonth <= 6) return true;
            return false;
        });

        approvedRequests.forEach(req => {
            const amount = parseFloat(req.amount) || 0;
            if (amount <= 0) return;

            // Check if this belongs to a unit
            if (req.unitId && uRAB[req.unitId]) {
                uRAB[req.unitId].total += amount;
                const exId = req.expenseItemId || 'other';
                uRAB[req.unitId].items[exId] = (uRAB[req.unitId].items[exId] || 0) + amount;
            }

            // Check if this belongs to a field
            if (req.fieldId && fRAB[req.fieldId]) {
                fRAB[req.fieldId].total += amount;
                const exId = req.expenseItemId || 'other';
                fRAB[req.fieldId].items[exId] = (fRAB[req.fieldId].items[exId] || 0) + amount;
            }
        });

        return { unitRAB: uRAB, fieldRAB: fRAB };
    }, [state.budgetRequests, units, fields, currentUser, selectedAcademicYear]);

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
        return `Rp. ${num.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // ========== Build Bidang Data ==========
    const bidangData = useMemo(() => {
        return fields.filter(f => !f.isDeleted).map(f => {
            if (currentUser?.role === 'admin_bidang' && f.id !== currentUser.fieldId) return null;
            const rap = fieldRAP[f.id]?.total || 0;
            const rab = fieldRAB[f.id]?.total || 0;
            const sisa = rap - rab;
            const items = fieldRAP[f.id]?.items || {};
            const rabItems = fieldRAB[f.id]?.items || {};
            
            // Merge all expense item keys
            const allKeys = new Set([...Object.keys(items), ...Object.keys(rabItems)]);
            const breakdown = [];
            allKeys.forEach(exId => {
                const itemRAP = typeof items[exId] === 'object' ? items[exId].total : (items[exId] || 0);
                const itemRAB = rabItems[exId] || 0;
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
    }, [fields, fieldRAP, fieldRAB, currentUser]);

    // ========== Build Unit Data ==========
    const unitData = useMemo(() => {
        return units.filter(u => !u.isDeleted).map(u => {
            if (currentUser?.role === 'admin_unit' && u.id !== currentUser.unitId) return null;
            
            const rawItems = unitRAP[u.id]?.items || {};
            const rawRabItems = unitRAB[u.id]?.items || {};
            const allKeys = new Set([...Object.keys(rawItems), ...Object.keys(rawRabItems)]);
            
            const breakdown = [];
            allKeys.forEach(exId => {
                const exItem = expenseItems.find(e => e.id === exId);
                const itemName = (exItem?.name || getExpenseName(exId) || '').toLowerCase();
                
                // FILTER: Hide Field-only items from Unit view
                // We specifically hide 'Penggajian' and 'Pengembangan (umum)' as per user request
                const isFieldOnlyItem = (
                    (exItem && exItem.fieldId && !exItem.unitId) ||
                    itemName.includes('penggajian') || 
                    itemName === 'pengembangan (umum)'
                );
                
                if (isFieldOnlyItem) return;

                const itemRAP = rawItems[exId] || 0;
                const itemRAB = rawRabItems[exId] || 0;
                
                breakdown.push({
                    id: exId,
                    name: getExpenseName(exId),
                    rap: itemRAP,
                    rab: itemRAB,
                    sisa: itemRAP - itemRAB
                });
            });

            // Calculate Unit Totals based only on visible (unit-specific) items
            const rap = breakdown.reduce((sum, item) => sum + item.rap, 0);
            const rab = breakdown.reduce((sum, item) => sum + item.rab, 0);
            const sisa = rap - rab;

            return { id: u.id, name: u.name, rap, rab, sisa, breakdown };
        }).filter(Boolean).sort((a, b) => b.rap - a.rap);
    }, [units, unitRAP, unitRAB, currentUser, expenseItems]);

    // ========== Totals ==========
    const totalBidangRAP = bidangData.reduce((s, d) => s + d.rap, 0);
    const totalBidangRAB = bidangData.reduce((s, d) => s + d.rab, 0);
    const totalBidangSisa = totalBidangRAP - totalBidangRAB;

    const totalUnitRAP = unitData.reduce((s, d) => s + d.rap, 0);
    const totalUnitRAB = unitData.reduce((s, d) => s + d.rab, 0);
    const totalUnitSisa = totalUnitRAP - totalUnitRAB;

    // ========== Export to Excel ==========
    const exportToExcel = () => {
        const wb = XLSX.utils.book_new();

        // Bidang Sheet
        if (currentUser?.role !== 'admin_unit') {
            const bidangRows = [];
            bidangData.forEach(b => {
                bidangRows.push({ Nama: b.name, RAP: b.rap, RAB: b.rab, 'Sisa Anggaran': b.sisa });
                b.breakdown.forEach(item => {
                    bidangRows.push({ Nama: `  └ ${item.name}`, RAP: item.rap, RAB: item.rab, 'Sisa Anggaran': item.sisa });
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

        XLSX.writeFile(wb, `Dashboard-Anggaran-${selectedAcademicYear.replace('/', '-')}.xlsx`);
    };

    // ========== Table Row Component ==========
    const BudgetRow = ({ data, isExpanded, onToggle }) => (
        <>
            <tr 
                className="budget-row cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={onToggle}
            >
                <td className="budget-cell budget-cell-name">
                    <div className="flex items-center gap-2">
                        <span className="expand-icon">
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </span>
                        <span className="font-semibold text-slate-800">{data.name}</span>
                    </div>
                </td>
                <td className="budget-cell budget-cell-number">
                    <span className="font-bold text-slate-900">{formatCurrency(data.rap)}</span>
                </td>
                <td className="budget-cell budget-cell-number">
                    <span className="font-bold text-slate-600">{formatCurrency(data.rab)}</span>
                </td>
                <td className="budget-cell budget-cell-number budget-cell-sisa">
                    <span className={`font-bold ${data.sisa < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                        {formatCurrency(data.sisa)}
                    </span>
                </td>
            </tr>
            {isExpanded && data.breakdown.map(item => (
                <tr key={item.id} className="budget-row-detail">
                    <td className="budget-cell budget-cell-name" style={{ paddingLeft: '48px' }}>
                        <span className="text-slate-500 text-[13px]">└ {item.name}</span>
                    </td>
                    <td className="budget-cell budget-cell-number">
                        <span className="text-slate-500 text-[13px]">{formatCurrency(item.rap)}</span>
                    </td>
                    <td className="budget-cell budget-cell-number">
                        <span className="text-slate-500 text-[13px]">{formatCurrency(item.rab)}</span>
                    </td>
                    <td className="budget-cell budget-cell-number budget-cell-sisa">
                        <span className={`text-[13px] ${item.sisa < 0 ? 'text-rose-500' : 'text-slate-500'}`}>
                            {formatCurrency(item.sisa)}
                        </span>
                    </td>
                </tr>
            ))}
        </>
    );

    return (
        <div className="p-8 animate-in pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight font-display">Dashboard</h1>
                    <p className="text-slate-500 font-medium text-sm mt-1">Ringkasan Rencana Anggaran Pendapatan (RAP) vs Rencana Anggaran Belanja (RAB)</p>
                </div>
                <div className="flex items-center gap-4">
                    <select
                        className="budget-select"
                        value={selectedAcademicYear}
                        onChange={e => setSelectedAcademicYear(e.target.value)}
                    >
                        {yearOptions.map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                    <button
                        onClick={exportToExcel}
                        className="budget-export-btn"
                    >
                        <FileSpreadsheet size={16} />
                        <span>Export Excel</span>
                    </button>
                </div>
            </div>

            {/* ===== BIDANG TABLE ===== */}
            {currentUser?.role !== 'admin_unit' && (
                <div className="budget-table-wrapper mb-10">
                    <div className="budget-table-title">
                        <Layers size={20} className="text-slate-600" />
                        <span>Bidang</span>
                    </div>
                    <div className="budget-table-scroll">
                        <table className="budget-table">
                            <thead>
                                <tr>
                                    <th className="budget-th budget-th-name">Nama</th>
                                    <th className="budget-th budget-th-number">RAP</th>
                                    <th className="budget-th budget-th-number">RAB</th>
                                    <th className="budget-th budget-th-number">Sisa Anggaran</th>
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
                                        <tr className="budget-row-total">
                                            <td className="budget-cell budget-cell-name font-black text-sm text-slate-700 uppercase tracking-wider">Total Bidang</td>
                                            <td className="budget-cell budget-cell-number font-black text-slate-900">{formatCurrency(totalBidangRAP)}</td>
                                            <td className="budget-cell budget-cell-number font-black text-slate-900">{formatCurrency(totalBidangRAB)}</td>
                                            <td className="budget-cell budget-cell-number budget-cell-sisa font-black text-slate-900">{formatCurrency(totalBidangSisa)}</td>
                                        </tr>
                                    </>
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="text-center py-12 text-slate-400 italic text-sm">
                                            Belum ada data bidang. Silakan tambahkan bidang terlebih dahulu.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ===== UNIT TABLE ===== */}
            {currentUser?.role !== 'admin_bidang' && (
                <div className="budget-table-wrapper">
                    <div className="budget-table-title">
                        <Building2 size={20} className="text-slate-600" />
                        <span>Unit</span>
                    </div>
                    <div className="budget-table-scroll">
                        <table className="budget-table">
                            <thead>
                                <tr>
                                    <th className="budget-th budget-th-name">Nama</th>
                                    <th className="budget-th budget-th-number">RAP</th>
                                    <th className="budget-th budget-th-number">RAB</th>
                                    <th className="budget-th budget-th-number">Sisa Anggaran</th>
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
                                        <tr className="budget-row-total">
                                            <td className="budget-cell budget-cell-name font-black text-sm text-slate-700 uppercase tracking-wider">Total Unit</td>
                                            <td className="budget-cell budget-cell-number font-black text-slate-900">{formatCurrency(totalUnitRAP)}</td>
                                            <td className="budget-cell budget-cell-number font-black text-slate-900">{formatCurrency(totalUnitRAB)}</td>
                                            <td className="budget-cell budget-cell-number budget-cell-sisa font-black text-slate-900">{formatCurrency(totalUnitSisa)}</td>
                                        </tr>
                                    </>
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="text-center py-12 text-slate-400 italic text-sm">
                                            Belum ada data unit. Silakan tambahkan unit terlebih dahulu.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className="mt-12 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">
                Data Dashboard Anggaran — SIKAK Yayasan Umum
            </div>
        </div>
    );
}
