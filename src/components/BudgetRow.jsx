import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

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
    selectedComponents = new Set(),
    onComponentToggle
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
                className="budget-row cursor-pointer hover:bg-slate-50 transition-colors group"
                onClick={onToggle}
            >
                <td className="budget-cell budget-cell-name">
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
                            className={`budget-row-detail group ${hasSubLevel ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                            onClick={() => hasSubLevel && onToggleDetailItem && onToggleDetailItem(data.id, item.id)}
                        >
                            <td className="budget-cell budget-cell-name" style={{ paddingLeft: '44px' }}>
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
                            <td className={`budget-cell budget-cell-number budget-cell-sisa text-[10px] font-black italic ${item.sisa < 0 ? 'text-rose-500' : 'text-blue-400'}`}>
                                {formatRupiahShort(item.sisa, formatCurrency)}
                            </td>
                        </tr>

                        {/* Level 3: Components (Granular Review) */}
                        {isDetailExpanded && item.components && item.components.map((comp, cIdx) => {
                            const compId = `${data.id}|${item.id}|${cIdx}`;
                            const isSelected = selectedComponents.has(compId);

                            return (
                                <tr key={compId} className={`budget-row-source animate-in slide-in-from-left-2 duration-300 ${isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50/70'}`}>
                                    <td className="budget-cell budget-cell-name" style={{ paddingLeft: '80px' }}>
                                        <div className="flex items-center gap-3 py-1.5">
                                            {selectable && (
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
                                                    {/* Status ACC */}
                                                    {comp.isApproved && (
                                                        <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500 text-white whitespace-nowrap">
                                                            ✓ ACC
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="budget-cell budget-cell-number">
                                        <span className="text-[10px] font-black text-slate-400 italic">
                                            @{formatCurrency(comp.harga)}
                                        </span>
                                    </td>
                                    <td className="budget-cell budget-cell-number">
                                        <span className="text-[11px] font-black text-slate-800 italic">
                                            {formatCurrency(comp.total)}
                                        </span>
                                    </td>
                                    <td className="budget-cell" />
                                </tr>
                            );
                        })}

                        {/* Traditional Source Breakdown (if no components) */}
                        {isDetailExpanded && !item.components && item.sources && Object.entries(item.sources).map(([unitId, amount]) => (
                            <tr key={unitId} className="budget-row-source animate-in slide-in-from-left-2 duration-300">
                                <td className="budget-cell budget-cell-name" style={{ paddingLeft: '80px' }}>
                                    <div className="flex items-center gap-1.5 py-0.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                            {getUnitName ? getUnitName(unitId) : unitId}
                                        </span>
                                    </div>
                                </td>
                                <td className="budget-cell budget-cell-number">
                                    <span className="text-[9px] font-black text-indigo-400 italic">
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
}

// Helper to keep the table clean if values are very large
function formatRupiahShort(val, fallback) {
    if (Math.abs(val) > 1000000000) {
        return `Rp ${(val / 1000000000).toFixed(1)}M`;
    }
    return fallback(val);
}
