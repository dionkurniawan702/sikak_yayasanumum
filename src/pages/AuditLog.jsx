import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
    Activity, Clock, User, ShieldAlert, Database, FileText, Search,
    RefreshCw, ChevronRight, Filter, Calendar, Eye, X, CheckCircle2,
    AlertCircle, LogIn, Trash2, ArrowUpRight, ShieldCheck, Building2,
    Send, BookMarked, Wallet, ChevronLeft
} from 'lucide-react';
import { isRemote } from '../services/api';

export default function AuditLog() {
    const { state } = useApp();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [unitFilter, setUnitFilter] = useState('ALL');
    const [actionFilter, setActionFilter] = useState('ALL');
    const [entityFilter, setEntityFilter] = useState('ALL');
    const [dateRangeFilter, setDateRangeFilter] = useState('ALL'); // 'ALL', 'TODAY', 'WEEK', 'MONTH', 'CUSTOM'
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [selectedLog, setSelectedLog] = useState(null); // Modal detail

    // Pagination (dibatasi 20 per halaman sesuai permintaan)
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 20;

    const fetchLogs = async () => {
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('jwt_token');
            if (!token) throw new Error('Akses diblokir: Sesi tidak valid atau belum login.');

            let apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
            const { hostname, protocol, host } = window.location;
            if (hostname !== 'localhost' && hostname !== '127.0.0.1') apiUrl = `${protocol}//${host}/api`;

            // Always fetch up to 200 recent records for smooth client-side filtering
            const response = await fetch(`${apiUrl}/audit-logs?limit=200`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `Gagal mengambil log: Status ${response.status}`);
            }

            const data = await response.json();
            if (data.success) {
                setLogs(data.data || []);
            } else {
                throw new Error(data.error || 'Terjadi kesalahan sistem.');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    // Daftar Unit & Bidang untuk Filter
    const availableUnits = useMemo(() => {
        const schools = new Set();
        const fields = new Set();

        (state.units || []).forEach(u => { if (u.name) schools.add(u.name); });
        (state.fields || []).forEach(f => { if (f.name) fields.add(f.name); });

        logs.forEach(l => {
            const uName = l.targetUnit || l.operatorUnit;
            if (uName && uName !== '—' && uName !== '-' && uName !== 'Yayasan') {
                if (uName.toLowerCase().includes('bidang')) {
                    fields.add(uName);
                } else {
                    schools.add(uName);
                }
            }
        });

        return {
            schoolUnits: Array.from(schools).sort(),
            fieldUnits: Array.from(fields).sort()
        };
    }, [state.units, state.fields, logs]);

    // Filter Logic
    const filteredLogs = useMemo(() => {
        let result = logs;

        // Unit / Bidang Filter
        if (unitFilter !== 'ALL') {
            result = result.filter(l => {
                const u = (l.targetUnit || l.operatorUnit || '').toLowerCase();
                return u.includes(unitFilter.toLowerCase());
            });
        }

        // Action Filter
        if (actionFilter !== 'ALL') {
            result = result.filter(l => (l.action || '').toUpperCase() === actionFilter);
        }

        // Entity Filter
        if (entityFilter !== 'ALL') {
            result = result.filter(l => (l.entity || '').toLowerCase() === entityFilter.toLowerCase());
        }

        // Date Filter
        if (dateRangeFilter !== 'ALL') {
            const now = new Date();
            if (dateRangeFilter === 'TODAY') {
                const todayStr = now.toISOString().split('T')[0];
                result = result.filter(l => l.timestamp && l.timestamp.startsWith(todayStr));
            } else if (dateRangeFilter === 'WEEK') {
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                result = result.filter(l => l.timestamp && new Date(l.timestamp) >= weekAgo);
            } else if (dateRangeFilter === 'MONTH') {
                const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                result = result.filter(l => l.timestamp && new Date(l.timestamp) >= monthAgo);
            } else if (dateRangeFilter === 'CUSTOM') {
                if (customStartDate) {
                    const start = new Date(customStartDate);
                    result = result.filter(l => l.timestamp && new Date(l.timestamp) >= start);
                }
                if (customEndDate) {
                    const end = new Date(customEndDate);
                    end.setHours(23, 59, 59, 999);
                    result = result.filter(l => l.timestamp && new Date(l.timestamp) <= end);
                }
            }
        }

        // Search Term
        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            result = result.filter(l => {
                const opName = (l.operatorName || '').toLowerCase();
                const opUnit = (l.operatorUnit || '').toLowerCase();
                const tgtUnit = (l.targetUnit || '').toLowerCase();
                const opRole = (l.operatorRole || '').toLowerCase();
                const act = (l.action || '').toLowerCase();
                const ent = (l.entity || '').toLowerCase();
                const entId = (l.entityId || '').toLowerCase();
                const detailsStr = JSON.stringify(l.details || {}).toLowerCase();
                return opName.includes(q) || opUnit.includes(q) || tgtUnit.includes(q) || opRole.includes(q) ||
                    act.includes(q) || ent.includes(q) || entId.includes(q) || detailsStr.includes(q);
            });
        }

        return result;
    }, [logs, unitFilter, actionFilter, entityFilter, dateRangeFilter, customStartDate, customEndDate, searchTerm]);

    // Paginated
    const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
    const paginatedLogs = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredLogs.slice(start, start + pageSize);
    }, [filteredLogs, currentPage, pageSize]);

    // Reset pagination on filter change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, unitFilter, actionFilter, entityFilter, dateRangeFilter, customStartDate, customEndDate]);

    // Quick Stats
    const stats = useMemo(() => {
        const todayStr = new Date().toISOString().split('T')[0];
        const todayCount = logs.filter(l => l.timestamp && l.timestamp.startsWith(todayStr)).length;
        const deleteCount = logs.filter(l => (l.action || '').includes('DELETE')).length;
        const approveCount = logs.filter(l => (l.action || '').includes('APPROVE')).length;
        return {
            total: logs.length,
            today: todayCount,
            delete: deleteCount,
            approve: approveCount
        };
    }, [logs]);

    const getActionBadge = (action) => {
        switch (action) {
            case 'CREATE':
                return <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-lg text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1.5"><CheckCircle2 size={11}/> TAMBAH</span>;
            case 'UPDATE':
                return <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200/60 rounded-lg text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1.5"><RefreshCw size={11}/> UBAH</span>;
            case 'DELETE':
            case 'DELETE_PERMANENT':
                return <span className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200/60 rounded-lg text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1.5"><Trash2 size={11}/> HAPUS</span>;
            case 'APPROVE':
                return <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200/60 rounded-lg text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1.5"><ShieldCheck size={11}/> SETUJU</span>;
            case 'REJECT':
            case 'CANCEL_APPROVE':
                return <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200/60 rounded-lg text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1.5"><AlertCircle size={11}/> BATAL/TOLAK</span>;
            case 'LOGIN':
                return <span className="px-2.5 py-1 bg-violet-50 text-violet-700 border border-violet-200/60 rounded-lg text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1.5"><LogIn size={11}/> MASUK</span>;
            case 'LOGIN_FAILED':
                return <span className="px-2.5 py-1 bg-rose-100 text-rose-800 border border-rose-300 rounded-lg text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1.5"><ShieldAlert size={11}/> GAGAL LOGIN</span>;
            case 'RESTORE':
                return <span className="px-2.5 py-1 bg-teal-50 text-teal-700 border border-teal-200/60 rounded-lg text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1.5"><RefreshCw size={11}/> PULIHKAN</span>;
            default:
                return <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-wider">{action}</span>;
        }
    };

    const getEntityIcon = (entity) => {
        switch (entity) {
            case 'NotaBelanja':
            case 'BudgetReport': return <FileText size={13} className="text-emerald-500" />;
            case 'PermintaanDana':
            case 'BudgetRequest': return <Send size={13} className="text-blue-500" />;
            case 'PengembalianKas': return <Wallet size={13} className="text-teal-500" />;
            case 'Jurnal':
            case 'Journal': return <BookMarked size={13} className="text-indigo-500" />;
            case 'TempatSampah': return <Trash2 size={13} className="text-rose-500" />;
            case 'Auth':
            case 'User': return <User size={13} className="text-violet-500" />;
            default: return <Activity size={13} className="text-slate-400" />;
        }
    };

    const formatRupiah = (val) => {
        if (!val || isNaN(val)) return 'Rp 0';
        return `Rp ${Math.round(val).toLocaleString('id-ID')}`;
    };

    const getUnitBadge = (unitName) => {
        const name = unitName && unitName !== '—' && unitName !== '-' ? unitName : 'Yayasan';
        if (name === 'Yayasan') {
            return (
                <span className="px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200/80 rounded-xl text-[11px] font-bold inline-flex items-center gap-1.5 shadow-xs">
                    <ShieldCheck size={12} className="text-slate-500 shrink-0" />
                    <span>Yayasan</span>
                </span>
            );
        }
        if (name.toLowerCase().includes('bidang')) {
            return (
                <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200/80 rounded-xl text-[11px] font-bold inline-flex items-center gap-1.5 shadow-xs">
                    <Building2 size={12} className="text-amber-600 shrink-0" />
                    <span>{name}</span>
                </span>
            );
        }
        return (
            <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200/80 rounded-xl text-[11px] font-bold inline-flex items-center gap-1.5 shadow-xs">
                <Building2 size={12} className="text-blue-600 shrink-0" />
                <span>{name}</span>
            </span>
        );
    };

    const getFriendlyDescription = (log) => {
        const d = log.details || {};
        const unitName = log.targetUnit || log.operatorUnit;
        const unitTag = (unitName && unitName !== '—' && unitName !== '-' && unitName !== 'Yayasan')
            ? `[${unitName}] `
            : '';

        let desc = '';
        if (d.message) {
            desc = d.message;
        } else if (log.action === 'LOGIN') {
            desc = `Pengguna ${log.operatorName || ''} berhasil login ke sistem`;
        } else if (log.action === 'LOGIN_FAILED') {
            desc = `Percobaan login gagal untuk akun "${d.username || '-'}"`;
        } else if (log.entity === 'NotaBelanja' || log.entity === 'BudgetReport') {
            const nota = d.nomorNota ? `Nota No. ${d.nomorNota}` : 'Nota belanja';
            const itemDesc = d.description || d.desc || '';
            const rp = d.amount ? formatRupiah(d.amount) : '';
            desc = `${log.action === 'DELETE' ? 'Menghapus' : (log.action === 'CREATE' ? 'Menginput' : 'Mengubah')} ${nota} ${itemDesc ? `(${itemDesc})` : ''} ${rp ? `sebesar ${rp}` : ''}`;
        } else if (log.entity === 'PermintaanDana' || log.entity === 'BudgetRequest') {
            const bln = d.month ? `bulan ${d.month}` : '';
            const rp = d.totalAmount ? formatRupiah(d.totalAmount) : '';
            desc = `${log.action === 'APPROVE' ? 'Menyetujui' : (log.action === 'REJECT' ? 'Menolak' : 'Memproses')} pengajuan dana ${bln} ${rp ? `sebesar ${rp}` : ''}`;
        } else if (log.entity === 'PengembalianKas') {
            const rp = d.amount ? formatRupiah(d.amount) : '';
            desc = `Mencatat pengembalian kas sisa dana ${rp ? `sebesar ${rp}` : ''}`;
        } else {
            desc = JSON.stringify(d);
        }

        if (unitTag && !desc.includes(unitName) && !desc.startsWith('[')) {
            return `${unitTag}${desc}`.trim();
        }
        return desc;
    };

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                            <Activity size={22} />
                        </span>
                        <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                            Jejak Aktivitas Sistem <span className="text-blue-600 font-serif italic text-lg md:text-xl font-normal">(Audit Trail)</span>
                        </h2>
                    </div>
                    <p className="text-xs md:text-sm text-slate-500 font-medium">
                        Rekam jejak forensik seluruh operasi: input nota, pengajuan dana, persetujuan, dan penghapusan data
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchLogs}
                        disabled={loading}
                        className="btn btn-secondary text-xs flex items-center gap-2 shadow-sm hover:shadow"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin text-blue-600' : ''} />
                        <span>Refresh Data</span>
                    </button>
                    <div className="p-3 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                        <Clock size={16} className="text-blue-500" />
                        <span className="text-[11px] font-black text-slate-700 font-mono tracking-wider">
                            {new Date().toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                    </div>
                </div>
            </div>

            {/* Quick Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Aktivitas</p>
                        <p className="text-2xl font-black text-slate-900">{stats.total.toLocaleString('id-ID')}</p>
                    </div>
                    <div className="w-11 h-11 bg-slate-50 rounded-xl flex items-center justify-center text-slate-600">
                        <Database size={20} />
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Aktivitas Hari Ini</p>
                        <p className="text-2xl font-black text-blue-600">{stats.today.toLocaleString('id-ID')}</p>
                    </div>
                    <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                        <Calendar size={20} />
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Persetujuan (Approval)</p>
                        <p className="text-2xl font-black text-indigo-600">{stats.approve.toLocaleString('id-ID')}</p>
                    </div>
                    <div className="w-11 h-11 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                        <ShieldCheck size={20} />
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Hapus / Batalkan</p>
                        <p className="text-2xl font-black text-rose-600">{stats.delete.toLocaleString('id-ID')}</p>
                    </div>
                    <div className="w-11 h-11 bg-rose-50 rounded-xl flex items-center justify-center text-rose-600">
                        <Trash2 size={20} />
                    </div>
                </div>
            </div>

            {/* Toolbar Filters & Search */}
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Search bar */}
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                        <input
                            type="text"
                            placeholder="Cari nama operator, unit, nomor nota, deskripsi aksi..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="input pl-11 pr-4 py-2.5 text-xs w-full rounded-2xl bg-slate-50 border-slate-200 focus:bg-white"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Filter Unit / Bidang & Aksi */}
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Filter Unit / Bidang */}
                        <select
                            value={unitFilter}
                            onChange={(e) => setUnitFilter(e.target.value)}
                            className="input py-2.5 px-3 text-xs rounded-xl bg-slate-50 border-slate-200 font-bold text-slate-700"
                        >
                            <option value="ALL">Semua Unit & Bidang</option>
                            {availableUnits.schoolUnits.length > 0 && (
                                <optgroup label="Unit Sekolah / Madrasah">
                                    {availableUnits.schoolUnits.map(u => (
                                        <option key={u} value={u}>{u}</option>
                                    ))}
                                </optgroup>
                            )}
                            {availableUnits.fieldUnits.length > 0 && (
                                <optgroup label="Bidang">
                                    {availableUnits.fieldUnits.map(f => (
                                        <option key={f} value={f}>{f}</option>
                                    ))}
                                </optgroup>
                            )}
                            <option value="Yayasan">Yayasan (Pusat)</option>
                        </select>

                        {/* Filter Action */}
                        <select
                            value={actionFilter}
                            onChange={(e) => setActionFilter(e.target.value)}
                            className="input py-2.5 px-3 text-xs rounded-xl bg-slate-50 border-slate-200 font-bold text-slate-700"
                        >
                            <option value="ALL">Semua Aksi</option>
                            <option value="CREATE">Tambah (CREATE)</option>
                            <option value="UPDATE">Ubah (UPDATE)</option>
                            <option value="DELETE">Hapus (DELETE)</option>
                            <option value="APPROVE">Persetujuan (APPROVE)</option>
                            <option value="REJECT">Tolak / Batal</option>
                            <option value="LOGIN">Login Akun</option>
                        </select>

                        {/* Filter Entity */}
                        <select
                            value={entityFilter}
                            onChange={(e) => setEntityFilter(e.target.value)}
                            className="input py-2.5 px-3 text-xs rounded-xl bg-slate-50 border-slate-200 font-bold text-slate-700"
                        >
                            <option value="ALL">Semua Modul</option>
                            <option value="NotaBelanja">Nota Belanja</option>
                            <option value="PermintaanDana">Permintaan Dana</option>
                            <option value="PengembalianKas">Pengembalian Kas</option>
                            <option value="Jurnal">Jurnal Umum</option>
                            <option value="Auth">Autentikasi (Login)</option>
                            <option value="TempatSampah">Tempat Sampah</option>
                        </select>

                        {/* Filter Date Range */}
                        <select
                            value={dateRangeFilter}
                            onChange={(e) => setDateRangeFilter(e.target.value)}
                            className="input py-2.5 px-3 text-xs rounded-xl bg-slate-50 border-slate-200 font-bold text-slate-700"
                        >
                            <option value="ALL">Semua Waktu</option>
                            <option value="TODAY">Hari Ini</option>
                            <option value="WEEK">7 Hari Terakhir</option>
                            <option value="MONTH">30 Hari Terakhir</option>
                            <option value="CUSTOM">Rentang Kustom...</option>
                        </select>
                    </div>
                </div>

                {/* Custom Date Pickers */}
                {dateRangeFilter === 'CUSTOM' && (
                    <div className="flex items-center gap-3 pt-3 border-t border-slate-100 text-xs">
                        <span className="font-bold text-slate-500">Rentang Tanggal:</span>
                        <input
                            type="date"
                            value={customStartDate}
                            onChange={(e) => setCustomStartDate(e.target.value)}
                            className="input py-1.5 px-3 text-xs rounded-xl bg-slate-50 border-slate-200"
                        />
                        <span className="text-slate-400">s/d</span>
                        <input
                            type="date"
                            value={customEndDate}
                            onChange={(e) => setCustomEndDate(e.target.value)}
                            className="input py-1.5 px-3 text-xs rounded-xl bg-slate-50 border-slate-200"
                        />
                    </div>
                )}
            </div>

            {/* Table Area */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-24 text-center">
                        <RefreshCw className="animate-spin text-blue-600 mx-auto mb-3" size={28} />
                        <p className="text-xs font-bold text-slate-500">Memuat riwayat jejak aktivitas...</p>
                    </div>
                ) : error ? (
                    <div className="p-16 text-center flex flex-col items-center">
                        <div className="w-14 h-14 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mb-3">
                            <ShieldAlert size={28} />
                        </div>
                        <p className="text-sm font-bold text-slate-800">{error}</p>
                        <button onClick={fetchLogs} className="btn btn-secondary text-xs mt-4">Coba Lagi</button>
                    </div>
                ) : paginatedLogs.length === 0 ? (
                    <div className="p-20 text-center flex flex-col items-center justify-center">
                        <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 mb-3">
                            <Activity size={28} />
                        </div>
                        <p className="text-sm font-bold text-slate-700">Tidak ada aktivitas ditemukan</p>
                        <p className="text-xs text-slate-400 mt-1">Coba sesuaikan kata kunci pencarian atau filter yang Anda pilih.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <th className="px-6 py-4">Waktu</th>
                                    <th className="px-6 py-4">Unit / Bidang</th>
                                    <th className="px-6 py-4">Operator / Pengguna</th>
                                    <th className="px-6 py-4">Aksi & Modul</th>
                                    <th className="px-6 py-4">Rincian Aktivitas</th>
                                    <th className="px-6 py-4 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                                {paginatedLogs.map((log) => {
                                    const timeStr = log.timestamp ? new Date(log.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
                                    const dateStr = log.timestamp ? new Date(log.timestamp).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
                                    const unitName = log.targetUnit || log.operatorUnit || 'Yayasan';

                                    // Format nama operator: bila anonymous/Sistem tetapi unitnya diketahui, tampilkan Bendahara [Unit]
                                    const isAnonymous = !log.operatorName || log.operatorName === 'Sistem';
                                    const isYayasan = unitName === 'Yayasan' || unitName === '—' || unitName === '-';
                                    const displayOperator = isAnonymous
                                        ? (isYayasan ? 'Sistem' : `Bendahara ${unitName}`)
                                        : log.operatorName;
                                    const displayRole = log.operatorRole && log.operatorRole !== 'system'
                                        ? log.operatorRole
                                        : (isYayasan ? 'system' : 'admin_unit');

                                    return (
                                        <tr key={log.id} className="hover:bg-blue-50/20 transition-colors">
                                            {/* Waktu */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <p className="font-mono font-black text-slate-800 text-xs">{timeStr} <span className="text-[10px] text-slate-400 font-normal">WIB</span></p>
                                                <p className="text-[10px] text-slate-400 font-semibold">{dateStr}</p>
                                            </td>

                                            {/* Unit / Bidang */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {getUnitBadge(unitName)}
                                            </td>

                                            {/* Operator */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-xl bg-blue-100/70 text-blue-700 font-black text-xs flex items-center justify-center shrink-0">
                                                        {(displayOperator || 'S').charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-800 text-xs leading-tight">{displayOperator}</p>
                                                        <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                                            <Building2 size={10} />
                                                            <span>{unitName}</span>
                                                            <span className="text-slate-300">•</span>
                                                            <span className="uppercase font-semibold text-[9px] text-blue-600">{displayRole}</span>
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Aksi & Modul */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex flex-col gap-1.5 items-start">
                                                    {getActionBadge(log.action)}
                                                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                                                        {getEntityIcon(log.entity)}
                                                        <span>{log.entity}</span>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Rincian Ringkas */}
                                            <td className="px-6 py-4">
                                                <p className="font-medium text-slate-700 line-clamp-2 text-xs leading-relaxed max-w-lg">
                                                    {getFriendlyDescription(log)}
                                                </p>
                                                {log.entityId && (
                                                    <span className="inline-block mt-1 font-mono text-[9px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                                                        ID: {log.entityId}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Tombol Detail */}
                                            <td className="px-6 py-4 text-center whitespace-nowrap">
                                                <button
                                                    onClick={() => setSelectedLog(log)}
                                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                                                    title="Lihat Rincian Forensik"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination Footer */}
                {filteredLogs.length > 0 && (
                    <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-medium bg-slate-50/50">
                        <div>
                            Menampilkan <span className="font-bold text-slate-700">{(currentPage - 1) * pageSize + 1}</span> s/d{' '}
                            <span className="font-bold text-slate-700">{Math.min(currentPage * pageSize, filteredLogs.length)}</span> dari{' '}
                            <span className="font-bold text-slate-700">{filteredLogs.length}</span> aktivitas
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="btn btn-secondary py-1.5 px-3 text-xs flex items-center gap-1 disabled:opacity-40"
                            >
                                <ChevronLeft size={14} /> Sebelumnya
                            </button>
                            <span className="px-3 py-1 font-bold text-slate-700">
                                Hal {currentPage} dari {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="btn btn-secondary py-1.5 px-3 text-xs flex items-center gap-1 disabled:opacity-40"
                            >
                                Berikutnya <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal Detail Forensik */}
            {selectedLog && (
                <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl">
                                    <Activity size={20} />
                                </div>
                                <div>
                                    <h4 className="font-black text-slate-900 text-base">Rincian Jejak Aktivitas</h4>
                                    <p className="text-[11px] text-slate-400 font-mono">Log ID: {selectedLog.id}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 overflow-y-auto space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Waktu Kejadian</p>
                                    <p className="font-black text-slate-800 text-sm font-mono">
                                        {new Date(selectedLog.timestamp).toLocaleTimeString('id-ID')} WIB
                                    </p>
                                    <p className="text-xs text-slate-500 font-semibold">
                                        {new Date(selectedLog.timestamp).toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                                    </p>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Aksi & Modul</p>
                                    <div className="mt-1 flex items-center gap-2">
                                        {getActionBadge(selectedLog.action)}
                                        <span className="font-bold text-slate-700 text-xs">{selectedLog.entity}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Informasi Unit & Operator</p>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                    <div>
                                        <span className="text-slate-400 block text-[10px] mb-1">Unit / Bidang:</span>
                                        <div>
                                            {getUnitBadge(selectedLog.targetUnit || selectedLog.operatorUnit)}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block text-[10px] mb-1">Nama Operator:</span>
                                        <span className="font-bold text-slate-800">
                                            {selectedLog.operatorName && selectedLog.operatorName !== 'Sistem'
                                                ? selectedLog.operatorName
                                                : ((selectedLog.targetUnit && selectedLog.targetUnit !== 'Yayasan' && selectedLog.targetUnit !== '—' && selectedLog.targetUnit !== '-')
                                                    ? `Bendahara ${selectedLog.targetUnit}`
                                                    : 'Sistem')}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block text-[10px] mb-1">Hak Akses (Role):</span>
                                        <span className="font-bold text-blue-600 uppercase text-[11px]">
                                            {selectedLog.operatorRole || 'System'}
                                        </span>
                                    </div>
                                </div>
                                {selectedLog.details?.ipAddress && (
                                    <div className="pt-2 border-t border-slate-200/60 text-xs text-slate-500 font-mono">
                                        IP Address: <span className="font-bold text-slate-700">{selectedLog.details.ipAddress}</span>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ringkasan Aktivitas</p>
                                <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 text-xs font-semibold text-slate-700 leading-relaxed">
                                    {getFriendlyDescription(selectedLog)}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data Teknis (Payload JSON)</p>
                                <div className="p-4 bg-slate-900 rounded-2xl text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-56">
                                    <pre>{JSON.stringify(selectedLog.details || {}, null, 2)}</pre>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50/50">
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="btn btn-secondary text-xs px-6"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
