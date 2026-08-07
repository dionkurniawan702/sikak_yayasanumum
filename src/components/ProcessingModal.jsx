import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle2, Send, AlertTriangle, ShieldCheck, Database } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function ProcessingModal() {
    const { state: appContextState } = useApp();
    
    const [modalState, setModalState] = useState({
        isOpen: false,
        title: '',
        message: '',
        type: 'general'
    });

    useEffect(() => {
        let isCustomLocked = false;
        let activeFetchCount = 0;

        const handleProcessingStart = (e) => {
            isCustomLocked = true;
            const detail = e.detail || {};
            setModalState({
                isOpen: true,
                title: detail.title || 'Sedang Memproses Pengajuan...',
                message: detail.message || 'Mohon tunggu sebentar, data transaksi dan ACC sedang dicatat ke server...',
                type: detail.type || 'general'
            });
        };

        const handleProcessingEnd = () => {
            isCustomLocked = false;
            if (activeFetchCount <= 0) {
                setModalState(prev => ({ ...prev, isOpen: false }));
            }
        };

        const handleLoadingStart = (e) => {
            activeFetchCount++;
            setModalState(prev => {
                if (prev.isOpen) return prev;
                const detail = e.detail || {};
                return {
                    isOpen: true,
                    title: detail.title || 'Sedang Memproses Pengajuan...',
                    message: detail.message || 'Mohon tunggu sebentar, data sedang diproses dengan server...',
                    type: detail.type || 'general'
                };
            });
        };

        const handleLoadingEnd = () => {
            activeFetchCount = Math.max(0, activeFetchCount - 1);
            // ONLY close if not locked by custom processing!
            if (!isCustomLocked && activeFetchCount <= 0) {
                setModalState(prev => ({ ...prev, isOpen: false }));
            }
        };

        window.addEventListener('app-processing-start', handleProcessingStart);
        window.addEventListener('app-processing-end', handleProcessingEnd);
        window.addEventListener('app-loading-start', handleLoadingStart);
        window.addEventListener('app-loading-end', handleLoadingEnd);

        return () => {
            window.removeEventListener('app-processing-start', handleProcessingStart);
            window.removeEventListener('app-processing-end', handleProcessingEnd);
            window.removeEventListener('app-loading-start', handleLoadingStart);
            window.removeEventListener('app-loading-end', handleLoadingEnd);
        };
    }, []);

    const isSyncing = appContextState?.isSyncing || false;
    const syncMessage = appContextState?.syncMessage || '';
    const isVisible = modalState.isOpen || isSyncing;

    if (!isVisible) return null;

    // Theme variations based on action type
    const getTheme = () => {
        switch (modalState.type) {
            case 'approving':
                return {
                    gradient: 'from-emerald-500 via-teal-600 to-cyan-600',
                    glow: 'from-emerald-500/30 to-teal-500/30',
                    badgeBg: 'bg-emerald-500',
                    BadgeIcon: ShieldCheck,
                    defaultTitle: 'Memproses ACC Superadmin...',
                    defaultMessage: 'Persetujuan pengajuan sedang diverifikasi dan dicatat ke server...'
                };
            case 'rejecting':
                return {
                    gradient: 'from-rose-500 via-red-600 to-amber-600',
                    glow: 'from-rose-500/30 to-amber-500/30',
                    badgeBg: 'bg-rose-500',
                    BadgeIcon: AlertTriangle,
                    defaultTitle: 'Memproses Penolakan...',
                    defaultMessage: 'Status penolakan sedang dikirim dan diperbarui ke server...'
                };
            case 'submitting':
                return {
                    gradient: 'from-blue-600 via-indigo-600 to-violet-600',
                    glow: 'from-blue-500/30 to-indigo-500/30',
                    badgeBg: 'bg-blue-500',
                    BadgeIcon: Send,
                    defaultTitle: 'Mengirim Pengajuan Unit...',
                    defaultMessage: 'Berkas pengajuan sedang diunggah dan dikirim ke server pusat...'
                };
            default:
                return {
                    gradient: 'from-blue-600 via-indigo-600 to-violet-600',
                    glow: 'from-blue-500/30 to-indigo-500/30',
                    badgeBg: 'bg-emerald-500',
                    BadgeIcon: CheckCircle2,
                    defaultTitle: 'Sedang Memproses Pengajuan...',
                    defaultMessage: 'Mohon tunggu sebentar, data transaksi dan persetujuan sedang diproses...'
                };
        }
    };

    const theme = getTheme();
    const BadgeIcon = theme.BadgeIcon;

    const titleToShow = modalState.title || (isSyncing ? 'Menyelaraskan Data Server...' : theme.defaultTitle);
    const messageToShow = syncMessage || modalState.message || theme.defaultMessage;

    return (
        <div className="fixed inset-0 z-[999999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-8 md:p-12 rounded-[2.5rem] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] flex flex-col items-center text-center max-w-lg w-full relative overflow-hidden animate-in zoom-in-95 duration-300">
                
                {/* Background Ambient Glow */}
                <div className={`absolute -top-32 -left-32 w-64 h-64 bg-gradient-to-br ${theme.glow} rounded-full blur-3xl`} />
                <div className={`absolute -bottom-32 -right-32 w-64 h-64 bg-gradient-to-br ${theme.glow} rounded-full blur-3xl`} />

                {/* Central Icon Block */}
                <div className="relative mb-6">
                    <div className={`absolute -inset-4 bg-gradient-to-tr ${theme.gradient} rounded-full blur-xl opacity-60 animate-pulse`} />
                    <div className={`relative w-28 h-28 bg-gradient-to-tr ${theme.gradient} rounded-3xl flex items-center justify-center shadow-2xl shadow-indigo-500/40`}>
                        <RefreshCw className="text-white animate-spin" size={52} />
                    </div>
                    <div className={`absolute -bottom-2 -right-2 w-11 h-11 ${theme.badgeBg} rounded-2xl flex items-center justify-center shadow-xl border-4 border-white dark:border-slate-900`}>
                        <BadgeIcon className="text-white" size={22} />
                    </div>
                </div>

                {/* Title & Message */}
                <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mb-3 tracking-tight">
                    {titleToShow}
                </h3>
                <p className="text-slate-600 dark:text-slate-300 font-medium text-base md:text-lg leading-relaxed max-w-sm">
                    {messageToShow}
                </p>

                {/* Progress Bar & Bouncing Dots */}
                <div className="w-full bg-slate-100 dark:bg-slate-800/80 h-2.5 rounded-full overflow-hidden mt-8 mb-4">
                    <div className={`h-full bg-gradient-to-r ${theme.gradient} animate-pulse w-full`} style={{ animationDuration: '1.2s' }} />
                </div>

                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase">
                    <Database size={14} className="animate-pulse text-blue-500" />
                    <span>Sinkronisasi Server SIKAD</span>
                    <div className="flex gap-1 ml-1">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping" style={{ animationDelay: '0s' }} />
                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping" style={{ animationDelay: '0.2s' }} />
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" style={{ animationDelay: '0.4s' }} />
                    </div>
                </div>

            </div>
        </div>
    );
}
