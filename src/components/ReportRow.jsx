import React from 'react';
import { ChevronRight, ChevronDown, FileText, Folder } from 'lucide-react';
import CurrencyDisplay from './CurrencyDisplay';

export default function ReportRow({ 
    id,
    name, 
    valCurr, 
    valPrev, 
    level = 0, 
    isParent = false, 
    isExpanded = false, 
    onToggle, 
    type = 'default', // 'category', 'header', 'detail', 'total'
    indentSize = 24
}) {
    // Styling based on type
    const isCategory = type === 'category';
    const isHeader = type === 'header';
    const isTotal = type === 'total';
    const isDetail = type === 'detail';

    const rowStyles = {
        category: "bg-slate-50/80 border-l-4 border-blue-600",
        header: "bg-white",
        total: "bg-slate-900 text-white",
        detail: "bg-white hover:bg-slate-50/50"
    };

    const textStyles = {
        category: "font-black text-[10px] text-slate-400 uppercase tracking-[0.2em] italic",
        header: "font-black text-slate-700 text-sm tracking-tight",
        total: "font-black text-sm uppercase tracking-widest",
        detail: "font-medium text-slate-600 text-sm"
    };

    const handleClick = () => {
        if (isParent && onToggle) {
            onToggle(id);
        }
    };

    return (
        <tr 
            className={`group transition-all duration-300 ${rowStyles[type] || rowStyles.detail} ${isParent ? 'cursor-pointer' : ''}`}
            onClick={handleClick}
        >
            <td className="px-6 py-4">
                <div 
                    className="flex items-center gap-3" 
                    style={{ paddingLeft: `${level * indentSize}px` }}
                >
                    {isParent ? (
                        <div className={`p-1.5 rounded-lg transition-all ${isExpanded ? 'bg-blue-600 text-white rotate-90' : 'bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600'}`}>
                            <ChevronRight size={14} />
                        </div>
                    ) : (
                        <div className="w-7 h-7 flex items-center justify-center">
                            {isDetail ? <div className="w-1.5 h-1.5 rounded-full bg-slate-200" /> : null}
                        </div>
                    )}
                    
                    <div>
                        <p className={textStyles[type] || textStyles.detail}>
                            {name}
                        </p>
                        {isCategory && !isExpanded && (
                            <p className="text-[8px] font-bold text-slate-400 mt-0.5">KLIK UNTUK RINCIAN</p>
                        )}
                    </div>
                </div>
            </td>
            
            <td className={`px-6 py-4 text-right ${isTotal ? 'text-white' : (isCategory ? 'text-slate-900' : 'text-slate-800')} font-black text-sm tabular-nums`}>
                <CurrencyDisplay value={valCurr} useColor={false} />
            </td>
            
            <td className={`px-6 py-4 text-right ${isTotal ? 'text-white/60' : 'text-slate-300'} font-bold text-sm tabular-nums`}>
                <CurrencyDisplay value={valPrev} useColor={false} />
            </td>
        </tr>
    );
}
