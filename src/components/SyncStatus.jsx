import React from 'react';
import { useApp } from '../context/AppContext';
import { Cloud, CloudCheck, CloudOff, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { formatTanggal } from '../utils/format';

export default function SyncStatus() {
    const { state } = useApp();
    const { isSyncing, lastSyncedAt, syncResults } = state;

    // Determine status
    let status = 'idle';
    if (isSyncing) status = 'syncing';
    else if (!lastSyncedAt) status = 'never';
    else if (syncResults && Object.values(syncResults).some(r => r.status === 'error')) status = 'partial';
    else status = 'success';

    const getStatusContent = () => {
        switch (status) {
            case 'syncing':
                return {
                    icon: <RefreshCw className="animate-spin text-blue-500" size={16} />,
                    label: 'Menyinkronkan...',
                    color: 'text-blue-500',
                    bg: 'bg-blue-50'
                };
            case 'partial':
                return {
                    icon: <AlertCircle className="text-amber-500" size={16} />,
                    label: 'Sync Parsial',
                    color: 'text-amber-600',
                    bg: 'bg-amber-50'
                };
            case 'never':
                return {
                    icon: <CloudOff className="text-slate-400" size={16} />,
                    label: 'Belum Terhubung',
                    color: 'text-slate-400',
                    bg: 'bg-slate-50'
                };
            case 'success':
            default:
                return {
                    icon: <CloudCheck className="text-emerald-500" size={16} />,
                    label: 'Cloud Terhubung',
                    color: 'text-emerald-600',
                    bg: 'bg-emerald-50'
                };
        }
    };

    const content = getStatusContent();

    return (
        <div className={`mt-6 mx-4 p-4 rounded-2xl border border-white/50 shadow-sm transition-all duration-500 ${content.bg}`}>
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl bg-white shadow-sm flex items-center justify-center`}>
                    {content.icon}
                </div>
                <div className="flex-1 min-w-0">
                    <div className={`text-[10px] font-black uppercase tracking-widest ${content.color}`}>
                        Status Cloud
                    </div>
                    <div className="text-[11px] font-bold text-slate-900 truncate">
                        {content.label}
                    </div>
                </div>
            </div>
            
            {lastSyncedAt && (
                <div className="mt-3 pt-3 border-t border-black/5 flex items-center justify-between">
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Update Terakhir</span>
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-tighter italic">
                        {new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>
            )}

            {status === 'partial' && syncResults && (
                <div className="mt-2 space-y-1">
                    {Object.entries(syncResults).filter(([_, r]) => r.status === 'error').map(([type, r]) => (
                        <div key={type} className="flex items-center gap-1.5 text-[8px] text-rose-500 font-bold uppercase tracking-tight">
                            <AlertCircle size={8} /> {type} Error
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
