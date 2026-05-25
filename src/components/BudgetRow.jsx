import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

const monthMap = {
    '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr', '05': 'Mei', '06': 'Jun',
    '07': 'Jul', '08': 'Ags', '09': 'Sep', '10': 'Okt', '11': 'Nov', '12': 'Des'
};

/**
 * Shared BudgetRow component for premium budget tables.
 * 
 * @param {Object} props
 * @param {Object} props.data - The data object containing name, rap, rab, sisa, and breakdown.
 * @param {boolean} props.isExpanded - Whether the row is currently expanded.
 * @param {Function} props.onToggle - Callback when the row is clicked/toggled.
 * @param {Function} props.formatCurrency - Function to format currency values.
 * @param {Object} props.expandedDetailItems - State object for sub-detail expansion.
 * @param {Function} props.onToggleDetailItem - Callback to toggle sub-detail items.
 * @param {Function} props.getUnitName - Optional function to map unit IDs to names for source breakdown.
 * @param {boolean} props.isBos - Whether this is a BOS-themed row (green theme).
 * @param {boolean} props.isField - Whether this is a Field-themed row (indigo theme).
 * @param {React.ReactNode} props.actions - Optional extra actions to render on the main row.
 */
export default function BudgetRow({
    data,
    isExpanded,
    onToggle,
    formatCurrency,
    expandedDetailItems = {},
    onToggleDetailItem,
    getUnitName,
    isBos = false,
    isField = false,
    actions = null,
    // Granular selection props
    selectable = false,
    isReviewMode = false,
    selectedComponents = new Set(),
    onComponentToggle,
    nameColSpan = 1
}) {
    // Theme selection
    const activeClass = isBos
        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100'
        : (isField ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-blue-600 text-white shadow-lg shadow-blue-100');

    const sisaColor = data.sisa < 0
        ? 'bg-rose-50 text-rose-600'
        : (isBos ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600');

    return (
        <>
            <tr
                className="budget-row cursor-pointer bg-white hover:bg-slate-50 transition-colors group"
                onClick={onToggle}
            >
                <td className="budget-cell budget-cell-name sticky left-0 z-10 bg-inherit" colSpan={nameColSpan}>
                    <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${isExpanded ? activeClass : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'}`}>
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </span>
                        <div className="flex flex-col">
                            <span className="font-black text-slate-800 tracking-tight">{data.name}</span>
                            {data.status && (
                                <span className={`w-fit px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest mt-0.5 ${data.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600' :
                                    (data.status === 'PENDING' ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400')
                                    }`}>
                                    {data.status === 'APPROVED' ? 'Disetujui' : (data.status === 'PENDING' ? 'Menunggu Review' : 'Draft')}
                                </span>
                            )}
                        </div>
                    </div>
                </td>
                <td className="budget-cell budget-cell-number font-black text-slate-900 text-xs italic">
                    {formatCurrency(data.rap)}
                </td>
                <td className="budget-cell budget-cell-number font-bold text-slate-500 text-xs italic">
                    {formatCurrency(data.rab)}
                </td>
                <td className="budget-cell budget-cell-number budget-cell-sisa">
                    <div className="flex items-center justify-end gap-3">
                        <span className={`font-black px-3 py-1 rounded-full text-[11px] ${sisaColor}`}>
                            {formatCurrency(data.sisa)}
                        </span>
                        {actions}
                    </div>
                </td>
            </tr>
            {isExpanded && data.breakdown && data.breakdown.map((item, idx) => {
                const hasSubLevel = (item.sources && Object.keys(item.sources).length > 0) || (item.components && item.components.length > 0);
                const isDetailExpanded = !!expandedDetailItems[`${data.id}|${item.id}`];

                return (
                    <React.Fragment key={item.id || idx}>
                        <tr
                            className={`budget-row-detail group bg-white ${hasSubLevel ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                            onClick={() => hasSubLevel && onToggleDetailItem && onToggleDetailItem(data.id, item.id)}
                        >
                            <td className="budget-cell budget-cell-name sticky left-0 z-10 bg-inherit" style={{ paddingLeft: '44px' }} colSpan={nameColSpan}>
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-300">└</span>
                                    {hasSubLevel && (
                                        <span className="text-indigo-400 group-hover:text-indigo-600">
                                            {isDetailExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                                        </span>
                                    )}
                                    <span className={`${hasSubLevel ? 'text-slate-700 font-bold' : 'text-slate-500'} text-[12px] italic`}>
                                        {item.name}
                                    </span>
                                </div>
                            </td>
                            <td className="budget-cell budget-cell-number text-slate-400 text-[10px] font-bold italic">
                                {formatCurrency(item.rap)}
                            </td>
                            <td className="budget-cell budget-cell-number text-slate-400 text-[10px] font-bold italic">
                                {formatCurrency(item.rab)}
                            </td>
                            <td className="budget-cell budget-cell-number budget-cell-sisa">
                                        <div className="flex items-center justify-end pr-[148px]">
                                    <span className={`text-[10px] font-black italic ${item.sisa < 0 ? 'text-rose-500' : 'text-blue-400'}`}>
                                        {formatRupiahShort(item.sisa, formatCurrency)}
                                    </span>
                                </div>
                            </td>
                        </tr>

                        {/* Level 3: Components (Granular Review) */}
                        {isDetailExpanded && item.components && item.components.map((comp, cIdx) => {
                            const pIndex = comp._pIdx !== undefined ? comp._pIdx : 0;
                            const compIndex = comp._cIdx !== undefined ? comp._cIdx : cIdx;
                            const compId = `${data.id}|${item.id}|${pIndex}|${compIndex}`;
                            const isSelected = selectedComponents.has(compId);

                            return (
                                <tr key={compId} className={`budget-row-source animate-in slide-in-from-left-2 duration-300 bg-white ${isSelected ? '!bg-blue-50/50' : 'hover:bg-slate-50/70'}`}>
                                    <td className="budget-cell budget-cell-name sticky left-0 z-10 bg-inherit" style={{ paddingLeft: '80px' }} colSpan={nameColSpan}>
                                        <div className="flex items-center gap-3 py-1.5">
                                            {selectable && (isReviewMode ? comp.status === 'PENDING' : (comp.status === 'DRAFT' || comp.status === 'REJECTED')) && (
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => onComponentToggle && onComponentToggle(compId)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer flex-shrink-0"
                                                />
                                            )}
                                            <div className="flex flex-col">
                                                <span className="text-[11px] font-bold text-slate-700 leading-snug">
                                                    {comp.label}
                                                </span>
                                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                    {/* Volume / satuan / kali dalam 1 pill */}
                                                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                                                        {comp.volume} {comp.satuan} × {comp.kali}×
                                                    </span>
                                                    {/* Sumber dana */}
                                                    <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full whitespace-nowrap ${comp.useBos ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                                        {comp.useBos ? 'BOS' : 'YAYASAN'}
                                                    </span>
                                                    {/* Status Dinamis */}
                                                    {comp.status === 'APPROVED' && (
                                                        <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500 text-white whitespace-nowrap">
                                                            ✓ ACC
                                                        </span>
                                                    )}
                                                    {comp.status === 'PENDING' && (
                                                        <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-indigo-500 text-white whitespace-nowrap">
                                                            ⏳ Menunggu
                                                        </span>
                                                    )}
                                                    {comp.status === 'REJECTED' && (
                                                        <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-rose-500 text-white whitespace-nowrap">
                                                            ✕ Ditolak
                                                        </span>
                                                    )}
                                                    {comp.status === 'DRAFT' && (
                                                        <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-300 text-slate-700 whitespace-nowrap">
                                                            Draft
                                                        </span>
                                                    )}
                                                    {(() => {
                                                        const selectedMonths = Object.keys(comp.months || {}).filter(mId => comp.months[mId]?.m === true || comp.months[mId]?.jumlah > 0);
                                                        if (selectedMonths.length === 12) {
                                                            return (
                                                                <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-widest border border-emerald-100 whitespace-nowrap">
                                                                    12 Bulan
                                                                </span>
                                                            );
                                                        } else if (selectedMonths.length > 0) {
                                                            return selectedMonths.sort().map(mId => {
                                                                const parts = mId.split('-');
                                                                const mName = parts[1] ? monthMap[parts[1]] : mId;
                                                                return (
                                                                    <span key={mId} className="text-[8px] font-black text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full uppercase tracking-widest border border-slate-200 whitespace-nowrap">
                                                                        {mName}
                                                                    </span>
                                                                );
                                                            });
                                                        }
                                                        return null;
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    {/* Alignment Fix: Shift numbers to the right to align with Sisa (blue) column */}
                                    <td className="budget-cell" /> 
                                    <td className="budget-cell budget-cell-number">
                                        <span className="text-[10px] font-black text-slate-400 italic">
                                            @{formatCurrency(comp.harga)}
                                        </span>
                                    </td>
                                    <td className="budget-cell budget-cell-number">
                                        <div className="flex items-center justify-end pr-[148px]">
                                            <span className="text-[11px] font-black text-slate-800 italic">
                                                {formatCurrency(comp.total)}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}

                        {/* Source Breakdown per Unit (for Field/Bidang items) */}
                        {isDetailExpanded && !item.components && item.sources && Object.keys(item.sources).length > 0 && (
                            <>
                                {/* Header Row */}
                                <tr className="animate-in slide-in-from-left-2 duration-200">
                                    <td className="budget-cell budget-cell-name sticky left-0 z-10 bg-indigo-50/40" style={{ paddingLeft: '80px' }} colSpan={4}>
                                        <span className="text-[8px] font-black text-indigo-400 uppercase tracking-[0.2em]">
                                            📌 Kontribusi Per Unit
                                        </span>
                                    </td>
                                </tr>
                                {/* Unit rows */}
                                {Object.entries(item.sources)
                                    .sort(([, a], [, b]) => b - a)
                                    .map(([unitId, amount]) => (
                                    <tr key={unitId} className="budget-row-source animate-in slide-in-from-left-2 duration-300 bg-white hover:bg-indigo-50/30 transition-colors">
                                        <td className="budget-cell budget-cell-name sticky left-0 z-10 bg-inherit" style={{ paddingLeft: '92px' }}>
                                            <div className="flex items-center gap-2 py-1">
                                                <div className="w-1 h-4 rounded-full bg-indigo-200 flex-shrink-0" />
                                                <span className="text-[10px] font-bold text-slate-600 tracking-tight">
                                                    {getUnitName ? getUnitName(unitId) : unitId}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="budget-cell budget-cell-number">
                                            <span className="text-[10px] font-black text-indigo-500 italic">
                                                {formatCurrency(amount)}
                                            </span>
                                        </td>
                                        <td colSpan="2" className="budget-cell bg-indigo-50/20" />
                                    </tr>
                                ))}
                            </>
                        )}
                    </React.Fragment>
                );
            })}
        </>
    );
}

// Helper to keep the table clean if values are very large
function formatRupiahShort(val, fallback) {
    if (Math.abs(val) > 1000000000) {
        return `Rp ${(val / 1000000000).toFixed(1)}M`;
    }
    return fallback(val);
}
