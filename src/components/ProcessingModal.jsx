import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function ProcessingModal() {
    const { state: appContextState } = useApp();
    
    const [modalState, setModalState] = useState({
        isOpen: false,
        title: 'Sedang proses...',
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
                title: detail.title || 'Sedang proses...',
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
                const detail = e?.detail || {};
                return {
                    isOpen: true,
                    title: detail.title || 'Sedang proses...',
                    type: detail.type || 'general'
                };
            });
        };

        const handleLoadingEnd = () => {
            activeFetchCount = Math.max(0, activeFetchCount - 1);
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
    const isVisible = modalState.isOpen || isSyncing;

    if (!isVisible) return null;

    const getGradient = () => {
        switch (modalState.type) {
            case 'approving':
                return 'from-emerald-500 to-teal-600 shadow-emerald-500/25';
            case 'rejecting':
                return 'from-rose-500 to-red-600 shadow-rose-500/25';
            default:
                return 'from-blue-600 via-indigo-600 to-violet-600 shadow-indigo-500/25';
        }
    };

    // User requested: cukup 'Sedang proses...' saja tulisannya
    const titleToShow = (modalState.title && 
        !modalState.title.toLowerCase().includes('pengajuan') && 
        !modalState.title.toLowerCase().includes('memproses') &&
        modalState.title !== 'Menyelaraskan Data Server...') 
        ? modalState.title 
        : 'Sedang proses...';

    return (
        <div className="fixed inset-0 z-[999999] bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 px-6 py-5 rounded-2xl shadow-2xl flex flex-col items-center text-center min-w-[170px] max-w-[210px] animate-in zoom-in-95 duration-150">
                <div className={`w-12 h-12 bg-gradient-to-tr ${getGradient()} rounded-xl flex items-center justify-center shadow-md mb-3`}>
                    <RefreshCw className="w-5 h-5 text-white animate-spin" />
                </div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 tracking-wide select-none whitespace-nowrap">
                    {titleToShow}
                </p>
            </div>
        </div>
    );
}

