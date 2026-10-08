import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, ChevronDown, Check, Folder, Layers, AlertCircle } from 'lucide-react';

/**
 * Helper to identify whether an account is a Header (Induk) account.
 * Headers are structural/grouping accounts and cannot be posted to (non-detail).
 */
export function isHeaderAccount(a) {
    if (!a) return false;
    if (a.category === 'header' || a.isParent === true) return true;
    if (a.category === 'detail') return false;
    // Fallback detection based on standard Chart of Accounts code structure
    if (a.code && (a.code.endsWith('0000') || a.code.endsWith('000'))) return true;
    return false;
}

/**
 * PSAK 35 weight for grouping and sorting types strictly matching Daftar Akun
 */
const getTypeWeight = (type = '', code = '') => {
    const firstDigit = code?.charAt(0);
    if (firstDigit >= '1' && firstDigit <= '5') return parseInt(firstDigit, 10);
    const t = (type || '').toLowerCase();
    if (t.includes('aset lancar') || t.includes('aset')) return 1;
    if (t.includes('kewajiban') || t.includes('liabilitas') || t.includes('utang')) return 2;
    if (t.includes('aset neto') || t.includes('saldo dana') || t.includes('ekuitas')) return 3;
    if (t.includes('pendapatan') || t.includes('penghasilan') || t.includes('penerimaan')) return 4;
    if (t.includes('beban') || t.includes('biaya')) return 5;
    return 9;
};

export default function SearchableCoaDropdown({
    value,
    onChange,
    accounts = [],
    placeholder = '-- Pilih Akun COA --',
    disabled = false,
    className = '',
    triggerClassName = '',
    badgeColor = 'indigo',
    showCategoryTabs = true,
    initialTab = 'ALL',
    filterPredicate = null,
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState(initialTab);
    const [openUpward, setOpenUpward] = useState(false);
    const containerRef = useRef(null);
    const searchInputRef = useRef(null);
    const listRef = useRef(null);

    // Selected account object
    const selectedAccount = useMemo(() => {
        if (!value) return null;
        return (accounts || []).find(a => a.id === value || a.code === value) || null;
    }, [value, accounts]);

    // Process, sort and link hierarchy of accounts strictly matching Daftar Akun
    const { processedList } = useMemo(() => {
        let baseList = (accounts || []).filter(a => !a.isDeleted);
        if (typeof filterPredicate === 'function') {
            baseList = baseList.filter(filterPredicate);
        }

        // Sort strictly by standard Chart of Accounts (Daftar Akun) order
        const sorted = [...baseList].sort((a, b) => {
            const weightA = getTypeWeight(a.type, a.code);
            const weightB = getTypeWeight(b.type, b.code);
            if (weightA !== weightB) return weightA - weightB;
            return (a.code || '').localeCompare(b.code || '', undefined, { numeric: true, sensitivity: 'base' });
        });

        // Identify headers and details
        const headers = sorted.filter(isHeaderAccount);
        const details = sorted.filter(a => !isHeaderAccount(a));

        // Map details to their most specific parent header
        const detailToHeader = {};
        details.forEach(child => {
            let bestHeader = null;
            let longestMatch = 0;
            headers.forEach(header => {
                const cleanPrefix = header.code ? header.code.replace(/0+$/, '') : '';
                if (cleanPrefix && child.code?.startsWith(cleanPrefix) && cleanPrefix.length > longestMatch) {
                    longestMatch = cleanPrefix.length;
                    bestHeader = header;
                }
            });
            detailToHeader[child.id] = bestHeader ? bestHeader.id : null;
        });

        return {
            processedList: sorted.map(a => ({
                ...a,
                isHeader: isHeaderAccount(a),
                parentHeaderId: detailToHeader[a.id] || null
            }))
        };
    }, [accounts, filterPredicate]);

    // Filter accounts based on Search Query and Category Tabs
    const displayedAccounts = useMemo(() => {
        let list = processedList;

        // 1. Tab Filter
        if (activeTab === 'BEBAN') {
            list = list.filter(a => a.code?.startsWith('5') || (a.type || '').toLowerCase().includes('beban'));
        } else if (activeTab === 'ASET') {
            list = list.filter(a => a.code?.startsWith('1') || (a.type || '').toLowerCase().includes('aset'));
        } else if (activeTab === 'KAS') {
            list = list.filter(a => {
                const isExpense = a.code?.startsWith('5') || (a.type || '').toLowerCase().includes('beban');
                if (isExpense) return false;
                return (
                    a.code?.startsWith('1-11') ||
                    /\bkas\b/i.test(a.name || '') ||
                    /\bbank\b/i.test(a.name || '')
                );
            });
        }

        // 2. Search Query Filter
        const query = searchQuery.trim().toLowerCase();
        if (!query) {
            return list;
        }

        const matchesQuery = (acc) => {
            return (
                (acc.code && acc.code.toLowerCase().includes(query)) ||
                (acc.name && acc.name.toLowerCase().includes(query)) ||
                (acc.subType && acc.subType.toLowerCase().includes(query))
            );
        };

        const directlyMatchingHeaders = new Set(list.filter(a => a.isHeader && matchesQuery(a)).map(h => h.id));
        const matchingDetails = list.filter(a => !a.isHeader && (matchesQuery(a) || (a.parentHeaderId && directlyMatchingHeaders.has(a.parentHeaderId))));
        const matchingHeaderIds = new Set(matchingDetails.map(d => d.parentHeaderId).filter(Boolean));

        return list.filter(a => {
            if (a.isHeader) {
                return matchesQuery(a) || matchingHeaderIds.has(a.id);
            }
            return matchesQuery(a) || (a.parentHeaderId && directlyMatchingHeaders.has(a.parentHeaderId));
        });
    }, [processedList, searchQuery, activeTab]);

    // Focus search input when dropdown opens & calculate upward positioning
    useEffect(() => {
        if (isOpen) {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const spaceBelow = window.innerHeight - rect.bottom;
                setOpenUpward(spaceBelow < 320 && rect.top > 320);
            }
            const timer = setTimeout(() => {
                searchInputRef.current?.focus();
            }, 60);
            return () => clearTimeout(timer);
        } else {
            setSearchQuery('');
        }
    }, [isOpen]);

    // Close on click outside or escape key
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    const handleSelect = (account) => {
        if (!account || account.isHeader) return;
        onChange?.(account.id, account);
        setIsOpen(false);
    };

    const handleClear = (e) => {
        e.stopPropagation();
        onChange?.('', null);
    };

    return (
        <div ref={containerRef} className={`relative ${isOpen ? 'z-40' : 'z-10'} ${className}`}>
            {/* Trigger Button */}
            <div
                role="button"
                tabIndex={disabled ? -1 : 0}
                onClick={() => !disabled && setIsOpen(prev => !prev)}
                onKeyDown={(e) => {
                    if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        setIsOpen(prev => !prev);
                    }
                }}
                className={`w-full bg-white border rounded-xl px-3 py-2 text-xs transition-all cursor-pointer flex items-center justify-between gap-2 shadow-sm ${
                    disabled
                        ? 'opacity-60 cursor-not-allowed bg-slate-100 border-slate-200'
                        : isOpen
                        ? 'border-indigo-500 ring-2 ring-indigo-100 bg-white shadow-md'
                        : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50/50'
                } ${triggerClassName}`}
            >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    {selectedAccount ? (
                        <div className="flex items-center gap-2 truncate">
                            <span className="font-mono text-[11px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-lg shrink-0">
                                {selectedAccount.code}
                            </span>
                            <span className="font-bold text-slate-800 text-xs truncate">
                                {selectedAccount.name}
                            </span>
                        </div>
                    ) : (
                        <span className="text-slate-400 font-medium text-xs truncate italic">
                            {placeholder}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1 shrink-0 text-slate-400">
                    {selectedAccount && !disabled && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="p-1 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-colors"
                            title="Hapus pilihan COA"
                        >
                            <X size={12} strokeWidth={2.5} />
                        </button>
                    )}
                    <ChevronDown
                        size={14}
                        strokeWidth={2.5}
                        className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-600' : 'text-slate-400'}`}
                    />
                </div>
            </div>

            {/* Dropdown Popover */}
            {isOpen && (
                <div
                    className={`absolute left-0 right-0 z-50 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 min-w-[320px] ${
                        openUpward ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                    }`}
                >
                    {/* Search Input Bar */}
                    <div className="p-2.5 border-b border-slate-100 bg-slate-50/70">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Cari kode akun atau nama akun..."
                                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 shadow-inner"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                                >
                                    <X size={13} />
                                </button>
                            )}
                        </div>

                        {/* Quick Category Filter Chips */}
                        {showCategoryTabs && (
                            <div className="flex items-center gap-1 mt-2 overflow-x-auto no-scrollbar pt-0.5">
                                {[
                                    { id: 'ALL', label: 'Semua (Daftar Akun)' },
                                    { id: 'BEBAN', label: 'Beban (5-xxx)' },
                                    { id: 'ASET', label: 'Aset (1-xxx)' },
                                    { id: 'KAS', label: 'Kas & Bank' },
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                                            activeTab === tab.id
                                                ? 'bg-indigo-600 text-white shadow-sm'
                                                : 'bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-800 border border-slate-200/60'
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Accounts List */}
                    <div
                        ref={listRef}
                        className="max-h-64 overflow-y-auto custom-scrollbar divide-y divide-slate-100/80 bg-white"
                    >
                        {displayedAccounts.length === 0 ? (
                            <div className="py-8 px-4 text-center">
                                <AlertCircle size={24} className="mx-auto text-slate-300 mb-2" />
                                <p className="text-xs font-bold text-slate-600">Tidak ada akun ditemukan</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                    {searchQuery ? `Tidak ada hasil untuk "${searchQuery}"` : 'Tidak ada data akun'}
                                </p>
                            </div>
                        ) : (
                            displayedAccounts.map((acc) => {
                                const isSelected = selectedAccount?.id === acc.id || selectedAccount?.code === acc.code;

                                if (acc.isHeader) {
                                    // Header account row (NON-SELECTABLE / DISABLED)
                                    return (
                                        <div
                                            key={acc.id}
                                            className="bg-slate-100/90 text-slate-700 px-3 py-2 flex items-center justify-between select-none pointer-events-none sticky top-0 z-10 border-y border-slate-200/80"
                                            title="Akun Header (Hanya untuk pengelompokan struktur, bukan COA detail)"
                                        >
                                            <div className="flex items-center gap-2 truncate">
                                                <Folder size={12} className="text-indigo-600 shrink-0" />
                                                <span className="font-mono text-[11px] font-black text-slate-600 shrink-0">
                                                    {acc.code}
                                                </span>
                                                <span className="text-[11px] font-black tracking-tight uppercase truncate text-slate-800">
                                                    {acc.name}
                                                </span>
                                            </div>
                                            <span className="text-[9px] font-black uppercase tracking-widest bg-slate-200/90 text-slate-600 px-2 py-0.5 rounded-md shrink-0 border border-slate-300/60 ml-2">
                                                HEADER (TIDAK BISA DIPILIH)
                                            </span>
                                        </div>
                                    );
                                }

                                // Detail account row (SELECTABLE)
                                return (
                                    <div
                                        key={acc.id}
                                        role="option"
                                        aria-selected={isSelected}
                                        onClick={() => handleSelect(acc)}
                                        className={`px-3 py-2.5 pl-6 flex items-center justify-between gap-3 cursor-pointer transition-all group ${
                                            isSelected
                                                ? 'bg-indigo-50/80 text-indigo-950 font-black border-l-4 border-indigo-600'
                                                : 'hover:bg-indigo-50/50 text-slate-700 hover:text-slate-900 border-l-4 border-transparent'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5 truncate flex-1 min-w-0">
                                            <span
                                                className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-md border shrink-0 transition-colors ${
                                                    isSelected
                                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                                        : 'bg-slate-100 text-slate-600 border-slate-200 group-hover:bg-indigo-100 group-hover:text-indigo-800 group-hover:border-indigo-200'
                                                }`}
                                            >
                                                {acc.code}
                                            </span>
                                            <span
                                                className={`text-xs truncate ${
                                                    isSelected ? 'font-black text-indigo-950' : 'font-semibold text-slate-700 group-hover:text-slate-950'
                                                }`}
                                            >
                                                {acc.name}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            {acc.fund && acc.fund !== 'Dana Umum' && (
                                                <span className="text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">
                                                    {acc.fund}
                                                </span>
                                            )}
                                            {isSelected && (
                                                <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                                                    <Check size={12} strokeWidth={3} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Dropdown Footer Status Info */}
                    <div className="py-2 px-3 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-500 flex items-center justify-between font-semibold">
                        <span className="flex items-center gap-1.5">
                            <Layers size={11} className="text-slate-400" />
                            Urutan sesuai Daftar Akun PSAK 35
                        </span>
                        <span>
                            {displayedAccounts.filter(a => !a.isHeader).length} akun detail tersedia
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
