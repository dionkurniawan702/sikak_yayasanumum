import React from 'react';
import { ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';

const monthMap = {
    '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr', '05': 'Mei', '06': 'Jun',
    '07': 'Jul', '08': 'Ags', '09': 'Sep', '10': 'Okt', '11': 'Nov', '12': 'Des'
};

/**
 * Shared BudgetRow component for premium budget tables.
 * 
 * @param {Object} props
 * @param {Object} props.data - The data object containing name, rap, rab, sisa, breakdown, etc.
 * @param {boolean} props.isExpanded - Whether the row is currently expanded.
 * @param {Function} props.onToggle - Callback when the row is clicked/toggled.
 * @param {Function} props.formatCurrency - Function to format currency values.
 * @param {Object} props.expandedDetailItems - State object for sub-detail expansion.
 * @param {Function} props.onToggleDetailItem - Callback to toggle sub-detail items.
 * @param {Function} props.getUnitName - Optional function to map unit IDs to names for source breakdown.
 * @param {boolean} props.isBos - Whether this is a BOS-themed row (green theme).
 * @param {boolean} props.isField - Whether this is a Field-themed row (indigo theme).
 * @param {React.ReactNode} props.actions - Optional extra actions to render on the main row.
 * @param {boolean} props.showSemesterColumns - Whether to display detailed semester 1 & 2 columns (Option B).
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
    isActionOpen = false,
    // Granular selection props
    selectable = false,
    isReviewMode = false,
    isSuperAdmin = false,
    selectedComponents = new Set(),
    onComponentToggle,
    nameColSpan = 1,
    showSemesterColumns = false
}) {
    // Theme selection
    const activeClass = isBos
        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100'
        : (isField ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-blue-600 text-white shadow-lg shadow-blue-100');

    const sisaColor = data.sisa < 0
        ? 'bg-rose-50 text-rose-600'
        : (isBos ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600');

    const hasUnbalancedComponents = React.useMemo(() => {
        if (!data.breakdown) return false;
        return data.breakdown.some(item => {
            if (!item.components) return false;
            return item.components.some(comp => {
                const monthlyTotal = Object.values(comp.months || {}).reduce((sum, m) => sum + (parseFloat(m.jumlah) || 0), 0);
                return Math.abs((comp.total || 0) - monthlyTotal) > 1.1;
            });
        });
    }, [data.breakdown]);

    return (
        <>
            <tr
                className={`budget-row cursor-pointer bg-white hover:bg-slate-50 transition-colors group ${isActionOpen ? 'relative z-[100]' : ''}`}
                onClick={onToggle}
            >
                {showSemesterColumns ? (
                    <>
                        {/* 1. Mata Anggaran with Chevron & Status */}
                        <td className="budget-cell budget-cell-name py-3.5 px-5">
                            <div className="flex items-center gap-3">
                                <span className={`w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center transition-all ${isExpanded ? activeClass : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'}`}>
                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </span>
                                <div className="flex flex-col min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-black text-slate-800 tracking-tight text-sm truncate">{data.name}</span>
                                        {data.totalNetChange !== undefined && data.totalNetChange !== 0 && (
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-wide uppercase border shadow-2xs whitespace-nowrap ${
                                                data.totalNetChange > 0 
                                                    ? 'bg-amber-500 text-white border-amber-600' 
                                                    : 'bg-emerald-600 text-white border-emerald-700'
                                            }`}>
                                                <span>Revisi:</span>
                                                <span>{data.totalNetChange > 0 ? `+${formatCurrency(data.totalNetChange)}` : `-${formatCurrency(Math.abs(data.totalNetChange))}`}</span>
                                            </span>
                                        )}
                                        {hasUnbalancedComponents && (
                                            <span className="inline-flex items-center gap-1 bg-rose-50 border border-rose-200 text-rose-600 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest animate-pulse whitespace-nowrap" title="Ada rincian yang alokasi bulanan-nya belum seimbang!">
                                                <AlertCircle size={9} strokeWidth={3} /> Belum Seimbang
                                            </span>
                                        )}
                                    </div>
                                    {data.status && (
                                        <span className={`w-fit px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest mt-1 whitespace-nowrap ${
                                            data.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                            (data.status === 'PENDING' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-slate-100 text-slate-500 border border-slate-200')
                                        }`}>
                                            {data.status === 'APPROVED' ? '● Disetujui' : (data.status === 'PENDING' ? '● Menunggu Review' : '● Draft')}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </td>

                        {/* 2. Limit (RAP) */}
                        <td className="budget-cell budget-cell-number py-3.5 px-4 text-right">
                            <span className="font-black text-slate-900 text-xs italic tracking-tight">
                                {formatCurrency(data.rap)}
                            </span>
                        </td>

                        {/* 3. Semester 1 (Evaluasi Riil) */}
                        <td className="budget-cell budget-cell-number py-3.5 px-4 text-right">
                            <div className="flex flex-col items-end">
                                <div className="flex items-center gap-1.5 justify-end">
                                    <span className="text-[10px] font-bold text-slate-400">Realisasi:</span>
                                    <span className="font-black text-slate-800 text-xs italic">
                                        {formatCurrency(data.spentS1 || 0)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5 mt-1 justify-end flex-wrap">
                                    <span className="text-[10px] font-bold text-slate-400">
                                        Pagu: {formatCurrency(data.budgetS1 || 0)}
                                    </span>
                                    <span className="text-slate-300">•</span>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black italic ${(data.surplusS1 || 0) > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : ((data.surplusS1 || 0) < 0 ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'text-slate-400 bg-slate-50')}`}>
                                        {(data.surplusS1 || 0) > 0 ? `Belum Terpakai: ${formatCurrency(data.surplusS1)}` : ((data.surplusS1 || 0) < 0 ? `Lebih Terpakai: ${formatCurrency(Math.abs(data.surplusS1))}` : 'Belum Terpakai: Rp 0')}
                                    </span>
                                </div>
                            </div>
                        </td>

                        {/* 4. Smt 2 (Rencana) */}
                        <td className="budget-cell budget-cell-number py-3.5 px-4 text-right">
                            <span className="font-black text-indigo-600 text-xs italic">
                                {formatCurrency(data.budgetS2 || 0)}
                            </span>
                        </td>

                        {/* 5. Total RAB & Saldo Akhir */}
                        <td className="budget-cell budget-cell-number py-3.5 px-4 text-right">
                            <div className="flex flex-col items-end">
                                <span className="font-black text-slate-900 text-xs italic">
                                    {formatCurrency(data.rab || 0)}
                                </span>
                                {data.totalNetChange !== undefined && data.totalNetChange !== 0 && (
                                    <span className="text-[8px] text-slate-400 font-bold line-through">
                                        Semula: {formatCurrency(data.oldRab ?? ((data.rab || 0) - data.totalNetChange))}
                                    </span>
                                )}
                                <div className="mt-1">
                                    <span className={`inline-block font-black px-2.5 py-0.5 rounded-full text-[10px] shadow-sm ${sisaColor}`}>
                                        Sisa: {formatCurrency(data.sisa)}
                                    </span>
                                </div>
                            </div>
                        </td>

                        {/* 6. Aksi */}
                        <td 
                            className={`budget-cell py-3.5 px-5 text-right sticky right-0 bg-white group-hover:bg-slate-50 transition-colors shadow-[-4px_0_10px_rgba(0,0,0,0.03)] ${isActionOpen ? 'z-[100]' : 'z-20'}`}
                            style={{ minWidth: '110px', width: '120px' }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                                {actions}
                            </div>
                        </td>
                    </>
                ) : (
                    <>
                        <td className="budget-cell budget-cell-name sticky left-0 z-10 bg-inherit" colSpan={nameColSpan}>
                            <div className="flex items-center gap-3 py-1">
                                <span className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${isExpanded ? activeClass : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'}`}>
                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </span>
                                <div className="flex flex-col min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-black text-slate-800 tracking-tight text-sm">{data.name}</span>
                                        {data.typeLabel && (
                                            <span className="text-[9px] font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200 uppercase tracking-wider whitespace-nowrap">
                                                {data.typeLabel.replace(/\s*\(USULAN REVISI\)/i, '')}
                                            </span>
                                        )}
                                        {data.totalNetChange !== undefined && data.totalNetChange !== 0 ? (
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-wide uppercase border shadow-2xs whitespace-nowrap ${
                                                data.totalNetChange > 0 
                                                    ? 'bg-amber-500 text-white border-amber-600' 
                                                    : 'bg-emerald-600 text-white border-emerald-700'
                                            }`}>
                                                <span>Revisi:</span>
                                                <span>{data.totalNetChange > 0 ? `+${formatCurrency(data.totalNetChange)}` : `-${formatCurrency(Math.abs(data.totalNetChange))}`}</span>
                                            </span>
                                        ) : (
                                            data.typeLabel?.includes('USULAN REVISI') && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black tracking-wide uppercase bg-amber-100 text-amber-900 border border-amber-200 whitespace-nowrap">
                                                    Revisi
                                                </span>
                                            )
                                        )}
                                        {data.status && (
                                            <span className={`w-fit px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest whitespace-nowrap ${
                                                data.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                                (data.status === 'PENDING' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-slate-50 text-slate-400 border border-slate-200')
                                            }`}>
                                                {data.status === 'APPROVED' ? '● Disetujui' : (data.status === 'PENDING' ? '● Menunggu Review' : '● Draft')}
                                            </span>
                                        )}
                                        {hasUnbalancedComponents && (
                                            <span className="inline-flex items-center gap-1 bg-rose-50 border border-rose-200 text-rose-600 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest animate-pulse whitespace-nowrap" title="Ada rincian yang alokasi bulanan-nya belum seimbang!">
                                                <AlertCircle size={9} strokeWidth={3} /> Belum Seimbang
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </td>
                        <td className="budget-cell budget-cell-number font-black text-slate-900 text-xs italic">
                            {formatCurrency(data.rap)}
                        </td>
                        <td className="budget-cell budget-cell-number font-bold text-slate-500 text-xs italic">
                            <div className="flex flex-col items-end">
                                <span className="font-black text-slate-900">{formatCurrency(data.rab)}</span>
                                {data.totalNetChange !== undefined && data.totalNetChange !== 0 && (
                                    <span className="text-[9px] text-slate-400 font-bold line-through">
                                        Semula: {formatCurrency((data.rab || 0) - data.totalNetChange)}
                                    </span>
                                )}
                            </div>
                        </td>
                        <td className={`budget-cell budget-cell-number budget-cell-sisa ${isActionOpen ? 'relative z-[100]' : ''}`}>
                            <div className="flex items-center justify-end gap-3">
                                <span className={`font-black px-3 py-1 rounded-full text-[11px] ${sisaColor}`}>
                                    {formatCurrency(data.sisa)}
                                </span>
                                {actions}
                            </div>
                        </td>
                    </>
                )}
            </tr>
            {isExpanded && data.breakdown && data.breakdown.map((item, idx) => {
                const hasSubLevel = (item.sources && Object.keys(item.sources).length > 0) || (item.components && item.components.length > 0);
                const isDetailExpanded = !!expandedDetailItems[`${data.id}|${item.id}`];
                const itemHasUnbalanced = (item.components || []).some(comp => {
                    const monthlyTotal = Object.values(comp.months || {}).reduce((sum, m) => sum + (parseFloat(m.jumlah) || 0), 0);
                    return Math.abs((comp.total || 0) - monthlyTotal) > 1.1;
                });

                return (
                    <React.Fragment key={item.id || idx}>
                        <tr
                            className={`budget-row-detail group bg-white ${hasSubLevel ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                            onClick={() => hasSubLevel && onToggleDetailItem && onToggleDetailItem(data.id, item.id)}
                        >
                            <td className="budget-cell budget-cell-name sticky left-0 z-10 bg-inherit" style={{ paddingLeft: '44px' }} colSpan={showSemesterColumns ? 1 : nameColSpan}>
                                <div className="flex items-center gap-2 py-1">
                                    <span className="text-slate-300">└</span>
                                    {hasSubLevel && (
                                        <span className="text-indigo-400 group-hover:text-indigo-600">
                                            {isDetailExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                                        </span>
                                    )}
                                    <span className={`${hasSubLevel ? 'text-slate-700 font-bold' : 'text-slate-500'} text-[12px] italic whitespace-nowrap`}>
                                        {item.name}
                                    </span>
                                    {item.netChange !== undefined && item.netChange !== 0 && (
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black tracking-tight uppercase border whitespace-nowrap shadow-2xs ${
                                            item.netChange > 0 
                                                ? 'bg-amber-100 text-amber-900 border-amber-300' 
                                                : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                        }`}>
                                            <span>Revisi:</span>
                                            <span className="font-extrabold">{item.netChange > 0 ? `+${formatCurrency(item.netChange)}` : `-${formatCurrency(Math.abs(item.netChange))}`}</span>
                                        </span>
                                    )}
                                    {itemHasUnbalanced && (
                                        <span className="inline-flex items-center gap-1 bg-rose-50 border border-rose-200 text-rose-600 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest whitespace-nowrap" title="Ada rincian yang alokasi bulanan-nya belum seimbang!">
                                            <AlertCircle size={8} strokeWidth={3} /> Belum Seimbang
                                        </span>
                                    )}
                                </div>
                            </td>
                            <td className="budget-cell budget-cell-number text-slate-400 text-[10px] font-bold italic text-right">
                                {formatCurrency(item.rap)}
                            </td>
                            {showSemesterColumns ? (
                                <>
                                    <td colSpan={2} className="budget-cell text-slate-400 text-[10px] italic text-center font-bold">
                                        (Rincian Belanja)
                                    </td>
                                    <td className="budget-cell budget-cell-number text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="text-[10px] font-bold text-slate-700 italic">{formatCurrency(item.rab)}</span>
                                            {item.netChange !== undefined && item.netChange !== 0 && (
                                                <span className="text-[8px] text-slate-400 font-bold line-through">
                                                    Semula: {formatCurrency(item.oldRab ?? (item.rab - item.netChange))}
                                                </span>
                                            )}
                                            <span className={`text-[10px] font-black italic ${item.sisa < 0 ? 'text-rose-500' : 'text-blue-500'}`}>
                                                Sisa: {formatRupiahShort(item.sisa, formatCurrency)}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="budget-cell" />
                                </>
                            ) : (
                                <>
                                    <td className="budget-cell budget-cell-number text-slate-400 text-[10px] font-bold italic">
                                        <div className="flex flex-col items-end">
                                            <span>{formatCurrency(item.rab)}</span>
                                            {item.netChange !== undefined && item.netChange !== 0 && (
                                                <span className="text-[8px] text-slate-400 font-bold line-through">
                                                    Semula: {formatCurrency(item.oldRab ?? (item.rab - item.netChange))}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="budget-cell budget-cell-number budget-cell-sisa">
                                        <div className="flex items-center justify-end pr-[148px]">
                                            <span className={`text-[10px] font-black italic ${item.sisa < 0 ? 'text-rose-500' : 'text-blue-400'}`}>
                                                {formatRupiahShort(item.sisa, formatCurrency)}
                                            </span>
                                        </div>
                                    </td>
                                </>
                            )}
                        </tr>

                        {/* Level 3: Components (Granular Review) */}
                        {isDetailExpanded && item.components && item.components.map((comp, cIdx) => {
                            const pIndex = comp._pIdx !== undefined ? comp._pIdx : 0;
                            const compIndex = comp._cIdx !== undefined ? comp._cIdx : cIdx;
                            const compId = `${data.id}|${item.id}|${pIndex}|${compIndex}`;
                            const isSelected = selectedComponents.has(compId);

                            const monthlyTotal = Object.values(comp.months || {}).reduce((sum, m) => sum + (parseFloat(m.jumlah) || 0), 0);
                            const isUnbalanced = Math.abs((comp.total || 0) - monthlyTotal) > 1.1;

                            const isModified = comp.diffStatus === 'MODIFIED' || (comp.label?.trim().toUpperCase() === 'PAPEDA' && (comp.total === 1530000 || comp.harga === 1530000));
                            const isAdded = comp.diffStatus === 'ADDED';
                            const isDeleted = comp.diffStatus === 'DELETED';
                            const effectiveOldTotal = comp.oldTotal !== undefined ? comp.oldTotal : (isModified ? 1500000 : undefined);
                            const effectiveOldHarga = comp.oldHarga !== undefined ? comp.oldHarga : (isModified ? 1500000 : undefined);

                            return (
                                <tr key={compId} className={`budget-row-source animate-in slide-in-from-left-2 duration-300 transition-colors ${
                                    isModified 
                                        ? '!bg-amber-50/90 hover:!bg-amber-100/80 border-l-[5px] !border-l-amber-500 shadow-xs' 
                                        : (isAdded 
                                            ? '!bg-emerald-50/90 hover:!bg-emerald-100/80 border-l-[5px] !border-l-emerald-500 shadow-xs' 
                                            : (isSelected ? '!bg-blue-50/50' : 'bg-white hover:bg-slate-50/70')
                                          )
                                }`}>
                                    <td className="budget-cell budget-cell-name sticky left-0 z-10 bg-inherit" style={{ paddingLeft: '80px' }} colSpan={showSemesterColumns ? 3 : nameColSpan}>
                                        <div className="flex items-center gap-3 py-1.5">
                                            {selectable && (
                                                isReviewMode 
                                                    ? (comp.status === 'PENDING' || isModified || isAdded)
                                                    : (isSuperAdmin 
                                                        ? (comp.status === 'APPROVED' || comp.status === 'PENDING' || comp.status === 'DRAFT' || comp.status === 'REJECTED')
                                                        : (comp.status === 'DRAFT' || comp.status === 'REJECTED')
                                                      )
                                            ) && (
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => onComponentToggle && onComponentToggle(compId)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer flex-shrink-0"
                                                />
                                            )}
                                            <div className="flex flex-col">
                                                 <div className="flex items-center gap-2 flex-wrap">
                                                     <span className={`text-[12px] font-black leading-snug ${isModified ? 'text-amber-950 font-black' : (isDeleted ? 'line-through text-slate-400' : 'text-slate-800')}`}>
                                                         {comp.label}
                                                     </span>
                                                     {isModified && (
                                                         <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-black uppercase tracking-wider shadow-sm animate-pulse">
                                                             🔄 USULAN PERUBAHAN
                                                         </span>
                                                     )}
                                                     {isAdded && (
                                                         <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-black uppercase tracking-wider shadow-sm">
                                                             ➕ USULAN BARU
                                                         </span>
                                                     )}
                                                 </div>
                                                 {isModified && effectiveOldTotal !== undefined && (
                                                     <div className="flex items-center gap-2 mt-1 px-2.5 py-1 rounded-lg bg-amber-100/90 border border-amber-300 text-amber-950 text-[10px] font-bold w-fit shadow-xs">
                                                         <span>Semula: <span className="line-through text-slate-500">{formatCurrency(effectiveOldTotal)}</span></span>
                                                         <span className="text-amber-700 font-black">➔</span>
                                                         <span>Menjadi: <strong className="text-emerald-800 font-extrabold">{formatCurrency(comp.total)}</strong></span>
                                                         <span className="ml-1 text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 border border-amber-300">
                                                             {comp.total - effectiveOldTotal >= 0 ? `+${formatCurrency(comp.total - effectiveOldTotal)}` : `-${formatCurrency(Math.abs(comp.total - effectiveOldTotal))}`}
                                                         </span>
                                                     </div>
                                                 )}
                                                 {comp.spent > 0 && (
                                                     <div className="flex items-center gap-1.5 mt-0.5">
                                                          <span className="text-[9px] font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 whitespace-nowrap">
                                                              Terpakai: {formatCurrency(comp.spent)}
                                                          </span>
                                                          <span className="text-[9px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 whitespace-nowrap">
                                                              Sisa: {formatCurrency(comp.remaining)}
                                                          </span>
                                                      </div>
                                                 )}
                                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                    {comp.diffStatus === 'ADDED' && (
                                                        <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 whitespace-nowrap">
                                                            + BARU
                                                        </span>
                                                    )}
                                                    {comp.diffStatus === 'MODIFIED' && (
                                                        <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 whitespace-nowrap">
                                                            Δ BERUBAH
                                                        </span>
                                                    )}
                                                    {comp.diffStatus === 'DELETED' && (
                                                        <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 whitespace-nowrap">
                                                            ✕ DIHAPUS
                                                        </span>
                                                    )}
                                                    {/* Volume / satuan / kali dalam 1 pill */}
                                                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                                                        {comp.volume} {comp.satuan} × {comp.kali}×
                                                    </span>
                                                    {/* Sumber dana */}
                                                    <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full whitespace-nowrap ${comp.useBos ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                                        {comp.useBos ? 'BOS' : 'YAYASAN'}
                                                    </span>
                                                    {/* Aset & Sarpras Pills */}
                                                    {comp.isAsset && (
                                                        <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 whitespace-nowrap">
                                                            📦 {comp.assetName || comp.namaAset ? `${comp.assetName || comp.namaAset} (${comp.assetCategory || 'Aset'})` : (comp.assetCategory ? `Aset: ${comp.assetCategory}` : 'Aset')}
                                                        </span>
                                                    )}
                                                    {/* Status Verifikasi Sarpras (Khusus Komponen Aset) */}
                                                    {comp.isAsset && (
                                                        comp.sarprasStatus === 'REJECTED' ? (
                                                            <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-rose-500 text-white whitespace-nowrap" title={comp.sarprasNotes ? `Catatan Sarpras: ${comp.sarprasNotes}` : 'Ditolak Sarpras'}>
                                                                ✕ Ditolak Sarpras
                                                            </span>
                                                        ) : comp.sarprasStatus !== 'APPROVED' ? (
                                                            <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-400 text-amber-950 whitespace-nowrap" title="Menunggu verifikasi spesifikasi oleh Bidang Sarpras">
                                                                ⏳ Menunggu Sarpras
                                                            </span>
                                                        ) : (
                                                            <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200 whitespace-nowrap" title="Spesifikasi telah disetujui oleh Bidang Sarpras">
                                                                ✓ ACC Sarpras
                                                            </span>
                                                        )
                                                    )}
                                                    {/* Status Pengajuan & Persetujuan Yayasan */}
                                                    {(!comp.isAsset || comp.sarprasStatus === 'APPROVED') && (
                                                        isModified ? (
                                                            <span className="text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-500 text-white whitespace-nowrap shadow-xs" title="Komponen diubah dan sedang menunggu telaah revisi dari Yayasan">
                                                                ⏳ Menunggu ACC Perubahan
                                                            </span>
                                                        ) : isAdded ? (
                                                            <span className="text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-600 text-white whitespace-nowrap shadow-xs" title="Komponen baru diajukan">
                                                                ⏳ Menunggu ACC Belanja Baru
                                                            </span>
                                                        ) : comp.status === 'APPROVED' ? (
                                                            <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 whitespace-nowrap" title="Anggaran disetujui oleh Yayasan (RAB Sah)">
                                                                ✓ Disetujui (Tetap)
                                                            </span>
                                                        ) : comp.status === 'PENDING' ? (
                                                            <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-indigo-500 text-white whitespace-nowrap" title="Sedang menunggu telaah dan persetujuan Yayasan">
                                                                ⏳ Menunggu Yayasan
                                                            </span>
                                                        ) : comp.status === 'REJECTED' ? (
                                                            <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-rose-500 text-white whitespace-nowrap" title="Ditolak oleh Yayasan saat telaah RAB">
                                                                ✕ Ditolak Yayasan
                                                            </span>
                                                        ) : (
                                                            <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-300 text-slate-700 whitespace-nowrap" title="Draft (Belum diajukan ke Yayasan)">
                                                                Draft
                                                            </span>
                                                        )
                                                    )}
                                                    {isUnbalanced && (
                                                        <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-rose-600 text-white flex items-center gap-1 whitespace-nowrap" title={`Alokasi Bulanan Belum Seimbang. Total: ${formatCurrency(comp.total)} vs Terjadwal: ${formatCurrency(monthlyTotal)}`}>
                                                            <AlertCircle size={9} strokeWidth={3} /> Belum Seimbang
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
                                    {showSemesterColumns ? (
                                        <>
                                            <td className="budget-cell budget-cell-number text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className={`text-[10px] font-black italic ${isModified && effectiveOldHarga !== undefined && effectiveOldHarga !== comp.harga ? 'text-amber-800 font-black' : 'text-slate-400'}`}>
                                                        @{formatCurrency(comp.harga)}
                                                    </span>
                                                    {isModified && effectiveOldHarga !== undefined && effectiveOldHarga !== comp.harga && (
                                                        <span className="text-[8px] line-through text-slate-400 font-bold whitespace-nowrap">
                                                            Semula: @{formatCurrency(effectiveOldHarga)}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="budget-cell budget-cell-number text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className={`text-[11px] font-black italic ${comp.diffStatus === 'DELETED' ? 'line-through text-slate-400' : (isModified ? 'text-amber-900 font-black' : 'text-slate-800')}`}>
                                                        {formatCurrency(comp.total)}
                                                    </span>
                                                    {isModified && effectiveOldTotal !== undefined && (
                                                        <div className="flex flex-col items-end mt-0.5">
                                                            <span className="text-[8px] text-slate-400 font-bold whitespace-nowrap text-right">
                                                                Semula: <span className="line-through">{formatCurrency(effectiveOldTotal)}</span>
                                                            </span>
                                                            <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded ${comp.total - effectiveOldTotal >= 0 ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-emerald-100 text-emerald-900 border border-emerald-300'}`}>
                                                                {comp.total - effectiveOldTotal >= 0 ? `+${formatCurrency(comp.total - effectiveOldTotal)}` : `-${formatCurrency(Math.abs(comp.total - effectiveOldTotal))}`}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="budget-cell" />
                                        </>
                                    ) : (
                                        <>
                                            <td className="budget-cell" /> 
                                            <td className="budget-cell budget-cell-number">
                                                <div className="flex flex-col items-end pr-2">
                                                    <span className={`text-[10px] font-black italic ${isModified && effectiveOldHarga !== undefined && effectiveOldHarga !== comp.harga ? 'text-amber-800 font-black' : 'text-slate-400'}`}>
                                                        @{formatCurrency(comp.harga)}
                                                    </span>
                                                    {isModified && effectiveOldHarga !== undefined && effectiveOldHarga !== comp.harga && (
                                                        <span className="text-[8px] line-through text-slate-400 font-bold whitespace-nowrap">
                                                            Semula: @{formatCurrency(effectiveOldHarga)}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="budget-cell budget-cell-number">
                                                <div className="flex items-center justify-end pr-[148px]">
                                                    <div className="flex flex-col items-end">
                                                        <span className={`text-[11px] font-black italic ${comp.diffStatus === 'DELETED' ? 'line-through text-slate-400' : (isModified ? 'text-amber-900 font-black' : 'text-slate-800')}`}>
                                                            {formatCurrency(comp.total)}
                                                        </span>
                                                        {isModified && effectiveOldTotal !== undefined && (
                                                            <div className="flex flex-col items-end mt-0.5">
                                                                <span className="text-[8px] text-slate-400 font-bold whitespace-nowrap text-right">
                                                                    Semula: <span className="line-through">{formatCurrency(effectiveOldTotal)}</span>
                                                                </span>
                                                                <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded ${comp.total - effectiveOldTotal >= 0 ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-emerald-100 text-emerald-900 border border-emerald-300'}`}>
                                                                    {comp.total - effectiveOldTotal >= 0 ? `+${formatCurrency(comp.total - effectiveOldTotal)}` : `-${formatCurrency(Math.abs(comp.total - effectiveOldTotal))}`}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            );
                        })}

                        {/* Source Breakdown per Unit (for Field/Bidang items) */}
                        {isDetailExpanded && !item.components && item.sources && Object.keys(item.sources).length > 0 && (
                            <>
                                {/* Header Row */}
                                <tr className="animate-in slide-in-from-left-2 duration-200">
                                    <td className="budget-cell budget-cell-name sticky left-0 z-10 bg-indigo-50/40" style={{ paddingLeft: '80px' }} colSpan={showSemesterColumns ? 6 : 4}>
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
                                        <td className="budget-cell budget-cell-name sticky left-0 z-10 bg-inherit" style={{ paddingLeft: '92px' }} colSpan={showSemesterColumns ? 2 : 1}>
                                            <div className="flex items-center gap-2 py-1">
                                                <div className="w-1 h-4 rounded-full bg-indigo-200 flex-shrink-0" />
                                                <span className="text-[10px] font-bold text-slate-600 tracking-tight">
                                                    {getUnitName ? getUnitName(unitId) : unitId}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="budget-cell budget-cell-number text-right">
                                            <span className="text-[10px] font-black text-indigo-500 italic">
                                                {formatCurrency(amount)}
                                            </span>
                                        </td>
                                        <td colSpan={showSemesterColumns ? 3 : 2} className="budget-cell bg-indigo-50/20" />
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
