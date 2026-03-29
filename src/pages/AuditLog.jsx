import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Activity, Clock, User, ShieldAlert, Database, FileText, Search, RefreshCw, ChevronRight } from 'lucide-react';
import { isRemote } from '../services/api';

export default function AuditLog() {
    const { state } = useApp();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchLogs = async () => {
            if (!isRemote) {
                setError('Audit Log hanya tersedia dalam Mode Server (Remote).');
                setLoading(false);
                return;
            }

            try {
                const token = localStorage.getItem('jwt_token');
                if (!token) throw new Error('Akses diblokir: Sesi tidak valid.');

                let apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
                const { hostname, protocol, host } = window.location;
                if (hostname !== 'localhost' && hostname !== '127.0.0.1') apiUrl = `${protocol}//${host}/api`;

                const response = await fetch(`${apiUrl}/audit-logs`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!response.ok) throw new Error('Kegagalan sinkronisasi dengan server audit.');

                const data = await response.json();
                if (data.success) {
                    setLogs(data.data);
                } else {
                    throw new Error(data.error || 'Terjadi kesalahan sistem.');
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchLogs();
    }, []);

    const getActionBadge = (action) => {
        switch (action) {
            case 'CREATE': return <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black uppercase tracking-widest">BUAT</span>;
            case 'UPDATE': return <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[9px] font-black uppercase tracking-widest">UBAH</span>;
            case 'DELETE': return <span className="px-3 py-1 bg-rose-50 text-rose-600 rounded-full text-[9px] font-black uppercase tracking-widest">HAPUS</span>;
            case 'CLOSING_PERIOD': return <span className="px-3 py-1 bg-slate-900 text-white rounded-full text-[9px] font-black uppercase tracking-widest">TUTUP BUKU</span>;
            default: return <span className="px-3 py-1 bg-slate-100 text-slate-400 rounded-full text-[9px] font-black uppercase tracking-widest">{action}</span>;
        }
    };

    const getEntityIcon = (entity) => {
        switch (entity) {
            case 'Account': return <Database size={14} />;
            case 'Journal': return <FileText size={14} />;
            case 'User': return <User size={14} />;
            default: return <Activity size={14} />;
        }
    };

    if (!isRemote) {
        return (
            <div className="p-20 text-center flex flex-col items-center justify-center animate-in">
                <div className="p-8 bg-slate-50 text-slate-300 rounded-[40px] shadow-inner mb-6">
                    <ShieldAlert size={64} />
                </div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">FITUR OFFLINE</h3>
                <p className="text-slate-400 font-medium max-w-sm mt-2 leading-relaxed">Audit Log memerlukan koneksi database real-time (Mode Server) untuk mencatat riwayat aktivitas pengguna secara aman.</p>
            </div>
        );
    }

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-12">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight italic">Audit Log Sistem</h2>
                    <p className="text-slate-500 font-medium">Jejak digital dan riwayat aktivitas operasional yayasan</p>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <Clock size={20} className="text-blue-500" />
                    <span className="text-xs font-black text-slate-900 uppercase tracking-widest italic font-mono">{new Date().toLocaleDateString('id-ID')}</span>
                </div>
            </div>

            <div className="bg-white rounded-[40px] border border-slate-100 shadow-2xl overflow-hidden animate-in">
                {loading ? (
                    <div className="p-24 text-center">
                        <RefreshCw className="animate-spin text-blue-600 mx-auto mb-4" size={32} />
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Sinkronisasi data riwayat...</p>
                    </div>
                ) : error ? (
                    <div className="p-20 text-center flex flex-col items-center">
                        <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mb-4"><ShieldAlert size={32}/></div>
                        <p className="text-sm font-black text-slate-900 uppercase tracking-tight italic">{error}</p>
                    </div>
                ) : (
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                            <tr>
                                <th className="px-10 py-6">Stempel Waktu</th>
                                <th className="px-10 py-6">Operator</th>
                                <th className="px-10 py-6">Aktivitas</th>
                                <th className="px-10 py-6">Detail Perubahan</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {logs.map(log => (
                                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-10 py-6 whitespace-nowrap">
                                        <p className="font-black text-slate-900 text-xs italic">{new Date(log.timestamp).toLocaleTimeString('id-ID')}</p>
                                        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{new Date(log.timestamp).toLocaleDateString('id-ID')}</p>
                                    </td>
                                    <td className="px-10 py-6 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-black text-[10px] italic shadow-inner">
                                                {state.users.find(u => u.id === log.userId)?.name?.charAt(0) || 'S'}
                                            </div>
                                            <span className="font-bold text-slate-700 text-sm">{state.users.find(u => u.id === log.userId)?.name || 'Sistem'}</span>
                                        </div>
                                    </td>
                                    <td className="px-10 py-6 whitespace-nowrap">
                                        <div className="flex flex-col gap-2">
                                            {getActionBadge(log.action)}
                                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                {getEntityIcon(log.entity)} {log.entity}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-10 py-6">
                                        <div className="p-4 bg-slate-900 rounded-2xl text-[10px] font-mono text-emerald-400 max-w-md overflow-x-auto shadow-inner whitespace-pre-wrap">
                                            {JSON.stringify(log.details, null, 2)}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {logs.length === 0 && (
                                <tr><td colSpan={4} className="p-20 text-center font-black text-slate-300 italic">Belum ada aktivitas terekam dalam log audit</td></tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="mt-12 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">
                Data audit log tidak dapat dimanipulasi atau dihapus untuk menjaga integritas sistem
            </div>
        </div>
    );
}
