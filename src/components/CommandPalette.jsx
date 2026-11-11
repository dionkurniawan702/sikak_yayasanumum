import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Command, CornerDownLeft, Search, X } from 'lucide-react';

/**
 * Command Palette (Ctrl+K) untuk navigasi cepat antar menu SIKAD tanpa mengubah rute maupun hak akses.
 */
export default function CommandPalette({ isOpen, onClose, menuGroups = [], onOpen }) {
    const navigate = useNavigate();
    const location = useLocation();
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef(null);
    const listRef = useRef(null);

    // Flatten role-filtered menu items for quick search
    const allItems = useMemo(() => {
        const list = [];
        (menuGroups || []).forEach((group) => {
            (group.items || []).forEach((item) => {
                list.push({
                    ...item,
                    groupTitle: group.title
                });
            });
        });
        return list;
    }, [menuGroups]);

    const filteredItems = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return allItems;
        return allItems.filter(
            (item) =>
                (item.label || '').toLowerCase().includes(q) ||
                (item.groupTitle || '').toLowerCase().includes(q) ||
                (item.path || '').toLowerCase().includes(q)
        );
    }, [allItems, query]);

    useEffect(() => {
        setActiveIndex(0);
    }, [query, isOpen]);

    useEffect(() => {
        const handleGlobalShortcut = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                if (isOpen) {
                    onClose?.();
                } else {
                    onOpen?.();
                }
            }
        };
        window.addEventListener('keydown', handleGlobalShortcut);
        return () => window.removeEventListener('keydown', handleGlobalShortcut);
    }, [isOpen, onClose, onOpen]);

    useEffect(() => {
        if (!isOpen) return;
        setQuery('');
        const timer = setTimeout(() => {
            inputRef.current?.focus();
        }, 20);
        return () => clearTimeout(timer);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || !listRef.current) return;
        const activeEl = listRef.current.querySelector(`[data-cmd-index="${activeIndex}"]`);
        if (activeEl) {
            activeEl.scrollIntoView({ block: 'nearest' });
        }
    }, [activeIndex, isOpen]);

    const handleSelect = (item) => {
        if (!item?.path) return;
        navigate(item.path);
        onClose?.();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            onClose?.();
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((prev) => (filteredItems.length > 0 ? (prev + 1) % filteredItems.length : 0));
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((prev) =>
                filteredItems.length > 0 ? (prev - 1 + filteredItems.length) % filteredItems.length : 0
            );
            return;
        }
        if (e.key === 'Enter' && filteredItems[activeIndex]) {
            e.preventDefault();
            handleSelect(filteredItems[activeIndex]);
        }
    };

    if (!isOpen) return null;

    const currentFullPath = location.pathname + location.search;

    return createPortal(
        <div
            className="fixed inset-0 z-[9998] flex items-start justify-center pt-[12vh] px-4"
            role="dialog"
            aria-modal="true"
            onKeyDown={handleKeyDown}
        >
            <div
                className="fixed inset-0 bg-slate-900/50 backdrop-blur-[3px] animate-in fade-in duration-150"
                onClick={() => onClose?.()}
            />

            <div
                className="relative z-10 w-full max-w-xl bg-white rounded-2xl border border-slate-200/90 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Search Header */}
                <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 bg-slate-50/50">
                    <Search size={18} className="text-slate-400 shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Cari menu, laporan, RAB, jurnal, atau pengaturan..."
                        className="flex-1 bg-transparent text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none"
                    />
                    {query && (
                        <button
                            type="button"
                            onClick={() => setQuery('')}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                            title="Hapus pencarian"
                        >
                            <X size={15} />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => onClose?.()}
                        className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 bg-white border border-slate-200 rounded-md hover:text-slate-600 transition-colors"
                    >
                        Esc
                    </button>
                </div>

                {/* Results */}
                <div ref={listRef} className="max-h-[55vh] overflow-y-auto p-2 space-y-0.5">
                    {filteredItems.length === 0 ? (
                        <div className="py-10 text-center">
                            <Command size={28} className="mx-auto text-slate-300 mb-2" />
                            <p className="text-xs font-bold text-slate-500">
                                Tidak ada menu yang cocok dengan "{query}"
                            </p>
                        </div>
                    ) : (
                        filteredItems.map((item, idx) => {
                            const Icon = item.icon;
                            const isSelected = idx === activeIndex;
                            const isCurrent = item.path === '/' ? currentFullPath === '/' : currentFullPath === item.path;

                            return (
                                <button
                                    key={`${item.path}-${idx}`}
                                    type="button"
                                    data-cmd-index={idx}
                                    onMouseEnter={() => setActiveIndex(idx)}
                                    onClick={() => handleSelect(item)}
                                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                                        isSelected
                                            ? 'bg-blue-50 text-blue-900'
                                            : 'text-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    <div
                                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                                            isSelected
                                                ? 'bg-blue-600 text-white shadow-xs'
                                                : 'bg-slate-100 text-slate-500'
                                        }`}
                                    >
                                        {Icon ? <Icon size={16} /> : <ArrowRight size={16} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black truncate">{item.label}</span>
                                            {isCurrent && (
                                                <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-black uppercase tracking-wider">
                                                    Aktif
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
                                            {item.groupTitle}
                                        </p>
                                    </div>
                                    {isSelected && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-blue-600 shrink-0">
                                            Buka <CornerDownLeft size={12} />
                                        </span>
                                    )}
                                </button>
                            );
                        })
                    )}
                </div>

                {/* Footer Hints */}
                <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-400">
                    <div className="flex items-center gap-3">
                        <span>↑↓ Pilih menu</span>
                        <span>↵ Buka halaman</span>
                    </div>
                    <span>Ctrl + K untuk buka/tutup</span>
                </div>
            </div>
        </div>,
        document.body
    );
}

