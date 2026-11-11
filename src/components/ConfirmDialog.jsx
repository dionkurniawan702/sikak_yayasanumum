import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, HelpCircle, Trash2, X } from 'lucide-react';

/**
 * Dialog konfirmasi kustom sebagai pengganti window.confirm / window.prompt standar browser.
 * Dirancang tetap ringan dengan dukungan tombol Escape dan klik backdrop.
 */
export default function ConfirmDialog({
    isOpen,
    title = 'Konfirmasi Tindakan',
    message = '',
    confirmText = 'Ya, Lanjutkan',
    cancelText = 'Batal',
    variant = 'primary', // 'primary' | 'warning' | 'danger'
    withInput = false,
    defaultInputValue = '',
    inputPlaceholder = 'Tuliskan catatan di sini...',
    onConfirm,
    onCancel
}) {
    const [inputValue, setInputValue] = useState(defaultInputValue || '');

    useEffect(() => {
        if (isOpen) {
            setInputValue(defaultInputValue || '');
        }
    }, [isOpen, defaultInputValue]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onCancel?.();
            }
        };
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [isOpen, onCancel]);

    if (!isOpen) return null;

    const variantStyles = {
        danger: {
            iconBg: 'bg-rose-50 text-rose-600 border-rose-100',
            Icon: Trash2,
            confirmBtn: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200'
        },
        warning: {
            iconBg: 'bg-amber-50 text-amber-600 border-amber-100',
            Icon: AlertTriangle,
            confirmBtn: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-200'
        },
        primary: {
            iconBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            Icon: HelpCircle,
            confirmBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200'
        }
    };

    const currentStyle = variantStyles[variant] || variantStyles.primary;
    const IconComponent = currentStyle.Icon;

    const handleSubmit = (e) => {
        e?.preventDefault();
        if (withInput) {
            onConfirm?.(inputValue);
        } else {
            onConfirm?.(true);
        }
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
        >
            <div
                className="fixed inset-0 bg-[#142920]/40 backdrop-blur-[2px] animate-in fade-in duration-150"
                onClick={() => onCancel?.()}
            />

            <form
                onSubmit={handleSubmit}
                className="relative z-10 w-full max-w-md bg-white rounded-2xl border border-[#E4EAE6] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${currentStyle.iconBg}`}>
                            <IconComponent size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                                <h3 className="text-base font-black text-[#0f2347] tracking-tight leading-snug">
                                    {title}
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => onCancel?.()}
                                    className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0 -mt-1 -mr-1"
                                    aria-label="Tutup"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                            {message && (
                                <p className="mt-1.5 text-xs font-medium text-slate-600 leading-relaxed whitespace-pre-line">
                                    {message}
                                </p>
                            )}
                            {withInput && (
                                <textarea
                                    autoFocus
                                    rows={3}
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder={inputPlaceholder}
                                    className="mt-3 w-full px-3.5 py-2.5 text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all resize-none"
                                />
                            )}
                        </div>
                    </div>
                </div>

                <div className="px-6 py-3.5 bg-slate-50/90 border-t border-slate-100 flex items-center justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={() => onCancel?.()}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                        {cancelText}
                    </button>
                    <button
                        type="submit"
                        autoFocus={!withInput}
                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all shadow-sm active:scale-95 cursor-pointer ${currentStyle.confirmBtn}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </form>
        </div>,
        document.body
    );
}

