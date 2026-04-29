import React, { useState, useMemo } from 'react';
import { 
    FileCheck, Receipt, Save, AlertCircle, CheckCircle2, ArrowUpRight, 
    History, Search, ChevronDown, ChevronRight, Download, Package, 
    Layers, Filter, Calendar, Tag, Building2, Loader2, Landmark
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { formatRupiah } from '../../utils/format';

// ─── Badge Kategori Aset (BOS Specialized) ──────────────────────────────────
function AsetBadge({ kategori, umurEkonomis }) {
    if (kategori === 'ASET') {
        return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Package size={10} /> Aset {umurEkonomis ? `• ${umurEkonomis} Thn` : ''}
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 border border-slate-200">
            <Layers size={10} /> Operasional
        </span>
    );
}

// ─── Expandable Row ──────────────────────────────────────────────────────────
function ReportRow({ report, units, isSuperAdmin, idx }) {
    const [open, setOpen] = useState(false);
    const unitName = units.find(u => u.id === report.unitId)?.name;
    const dateStr = report.date ? new Date(report.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

    return (
        <>
            <tr
                className={`border-b border-slate-100 cursor-pointer transition-colors ${open ? 'bg-emerald-50/40' : 'hover:bg-slate-50/80'}`}
                onClick={() => setOpen(o => !o)}
            >
                <td className="px-5 py-4 text-center">
                    <span className="text-[10px] font-black text-slate-400">{idx + 1}</span>
                </td>
                <td className="px-5 py-4">
                    <span className="text-xs font-bold text-slate-500">{dateStr}</span>
                </td>
                <td className="px-5 py-4 font-mono">
                    <span className="text-xs font-black text-emerald-600">{report.nomorNota || '—'}</span>
                </td>
                <td className="px-5 py-4">
                    <span className="text-xs font-bold text-slate-700 line-clamp-1">{report.category || report.description || 'Realisasi BOS'}</span>
                    {isSuperAdmin && unitName && (
                        <div className="flex items-center gap-1 mt-0.5">
                            <Building2 size={9} className="text-slate-300" />
                            <span className="text-[9px] text-slate-400 font-bold">{unitName}</span>
                        </div>
                    )}
                </td>
                <td className="px-5 py-4 text-right font-black text-slate-800">
                    {formatRupiah(parseFloat(report.amount || 0))}
                </td>
                <td className="px-5 py-4 text-center">
                    <AsetBadge kategori={report.kategoriAset} />
                </td>
                <td className="px-5 py-4 text-center">
                    {report.status === 'PENDING' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-black uppercase bg-amber-50 text-amber-600 border border-amber-200">
                            Menunggu
                        </span>
                    ) : report.status === 'REJECTED' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-black uppercase bg-rose-50 text-rose-600 border border-rose-200">
                            Ditolak
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-black uppercase bg-emerald-50 text-emerald-600 border border-emerald-200">
                            ✓ Terverifikasi
                        </span>
                    )}
                </td>
                <td className="px-5 py-4 text-center">
                    {open ? <ChevronDown size={14} className="text-emerald-400 mx-auto" /> : <ChevronRight size={14} className="text-slate-300 mx-auto" />}
                </td>
            </tr>

            {open && (
                <tr className="bg-emerald-50/10 border-b border-slate-100">
                    <td colSpan="8" className="px-10 py-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="space-y-3">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2 italic">Rincian Transaksi</p>
                                <div className="space-y-2 text-xs">
                                    <div className="flex justify-between"><span className="text-slate-400 font-bold">Volume</span><span className="font-black">{parseFloat(report.volume || 0).toLocaleString('id-ID')} {report.satuan}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400 font-bold">Harga Satuan</span><span className="font-black">{formatRupiah(parseFloat(report.harga || 0))}</span></div>
                                    <div className="flex justify-between border-t border-slate-200 pt-2"><span className="text-slate-400 font-bold">Total</span><span className="font-black text-emerald-600 underline underline-offset-4">{formatRupiah(parseFloat(report.amount || 0))}</span></div>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2 italic">Bukti & Keterangan</p>
                                <p className="text-xs text-slate-600 font-medium leading-relaxed italic">"{report.description || 'Tidak ada keterangan'}"</p>
                                {report.buktiTeks && (
                                    <div className="p-3 bg-white rounded-xl border border-emerald-100 shadow-sm">
                                        <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">Referensi Bukti</p>
                                        <p className="text-xs text-slate-700 font-medium">{report.buktiTeks}</p>
                                    </div>
                                )}
                            </div>
                            <div className="space-y-3">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2 italic">Informasi Sistem</p>
                                <div className="space-y-1">
                                    <div className="text-[10px] font-black text-slate-500">ID PELAPORAN:</div>
                                    <div className="text-[10px] font-mono text-slate-400 break-all bg-slate-100 p-2 rounded-lg">{report.id}</div>
                                </div>
                                <div className="text-[9px] text-slate-400 font-bold mt-2 italic">Status Sinkronisasi: ✓ Tersimpan di Server</div>
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}

export default function BOSMonthlyReport() {
    const { state, dispatch } = useApp();
    const { budgetRequests = [], budgetReports = [], units = [], globalAcademicYearId, currentUser } = state;
    
    const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'history'
    const [searchTerm, setSearchTerm] = useState('');
    const [processingId, setProcessingId] = useState(null);

    const isSuperAdmin = currentUser?.role === 'superadmin';
    const myUnitId = currentUser?.unitId;

    // Filter BOS-related requests and reports
    const bosRequests = useMemo(() => {
        return (budgetRequests || []).filter(req => {
            if (req.academicYearId !== globalAcademicYearId) return false;
            if (!isSuperAdmin && req.unitId !== myUnitId) return false;
            // Check if items are from BOS plan
            return (req.items || []).some(item => item.planId?.endsWith('-BOS'));
        });
    }, [budgetRequests, globalAcademicYearId, isSuperAdmin, myUnitId]);

    const reportedAmounts = useMemo(() => {
        const map = {};
        (budgetReports || []).forEach(r => {
            if (r.status !== 'REJECTED') {
                if (!map[r.budgetRequestId]) map[r.budgetRequestId] = 0;
                map[r.budgetRequestId] += parseFloat(r.amount || 0);
            }
        });
        return map;
    }, [budgetReports]);

    const pendingBOSReporting = bosRequests.filter(req => {
        if (req.status !== 'APPROVED') return false;
        const totalReported = reportedAmounts[req.id] || 0;
        return totalReported < parseFloat(req.totalAmount || 0);
    });

    const bosReports = useMemo(() => {
        return (budgetReports || []).filter(r => {
            if (r.academicYearId !== globalAcademicYearId) return false;
            if (!isSuperAdmin && r.unitId !== myUnitId) return false;
            // Link to a BOS request
            const req = budgetRequests.find(br => br.id === r.budgetRequestId);
            return req?.items?.[0]?.planId?.endsWith('-BOS');
        });
    }, [budgetReports, budgetRequests, globalAcademicYearId, isSuperAdmin, myUnitId]);

    const filteredReports = useMemo(() => {
        return bosReports.filter(r => {
            const q = searchTerm.toLowerCase();
            return !q || (r.nomorNota || '').toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q);
        });
    }, [bosReports, searchTerm]);

    const stats = useMemo(() => {
        const totalCair = bosRequests.filter(r => r.status === 'APPROVED').reduce((s, r) => s + parseFloat(r.totalAmount || 0), 0);
        const totalLapor = bosReports.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
        return { totalCair, totalLapor, sisa: totalCair - totalLapor };
    }, [bosRequests, bosReports]);

    // Handle Verification (Superadmin only)
    const handleVerify = async (id, status) => {
        if (!isSuperAdmin) return;
        const reason = status === 'REJECTED' ? window.prompt('Alasan penolakan:') : null;
        if (status === 'REJECTED' && reason === null) return;

        setProcessingId(id);
        try {
            const report = budgetReports.find(r => r.id === id);
            const updated = { ...report, status, rejectionReason: reason, notified: false };
            dispatch({ type: 'EDIT_BUDGET_REPORT', payload: updated });
            await api.pushAction({ type: 'EDIT_BUDGET_REPORT', payload: updated }, state);
            alert(`Laporan berhasil ${status === 'APPROVED' ? 'diverifikasi' : 'ditolak'}`);
        } catch (err) {
            alert('Gagal memproses verifikasi: ' + err.message);
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="p-6 space-y-6 min-h-screen bg-slate-50/50">
            {/* Header */}
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                            <Landmark size={20} className="text-white" />
                        </div>
                        Laporan Realisasi BOS
                    </h1>
                    <p className="text-slate-500 text-sm mt-1 ml-[52px] font-medium italic">
                        Pelaporan penggunaan dana Bantuan Operasional Sekolah yang telah dicairkan
                    </p>
                </div>

                <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
                    <button 
                        onClick={() => setActiveTab('pending')}
                        className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'pending' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Perlu Dilaporkan ({pendingBOSReporting.length})
                    </button>
                    <button 
                        onClick={() => setActiveTab('history')}
                        className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Riwayat & Verifikasi
                    </button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                    { label: 'Total Dana BOS Cair', value: formatRupiah(stats.totalCair), icon: <ArrowUpRight className="text-emerald-500" />, color: 'text-emerald-600' },
                    { label: 'Telah Dilaporkan', value: formatRupiah(stats.totalLapor), icon: <FileCheck className="text-blue-500" />, color: 'text-blue-600' },
                    { label: 'Sisa Belum Dilaporkan', value: formatRupiah(stats.sisa), icon: <Receipt className="text-rose-500" />, color: 'text-rose-600' },
                ].map((s, i) => (
                    <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">{s.label}</p>
                            <h3 className={`text-2xl font-black ${s.color} italic tracking-tighter`}>{s.value}</h3>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                            {s.icon}
                        </div>
                    </div>
                ))}
            </div>

            {activeTab === 'pending' ? (
                <div className="space-y-4">
                    {pendingBOSReporting.length === 0 ? (
                        <div className="bg-white p-20 rounded-[3rem] border border-slate-100 shadow-sm text-center flex flex-col items-center">
                            <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-[2rem] flex items-center justify-center mb-6 animate-bounce">
                                <CheckCircle2 size={40} />
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 italic">Tertib Administrasi</h3>
                            <p className="text-slate-400 font-medium max-w-sm mt-2 leading-relaxed">
                                Semua dana BOS yang telah dicairkan sudah dilaporkan penggunaannya. Terima kasih atas ketertiban Anda.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {pendingBOSReporting.map(req => (
                                <div key={req.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-lg transition-all group border-l-8 border-l-emerald-500">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-widest border border-emerald-100">
                                                DANA BOS • {req.month}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-400 italic">{req.date}</span>
                                        </div>
                                        <h4 className="text-2xl font-black text-slate-800 italic tracking-tight">{req.description}</h4>
                                        <div className="flex items-center gap-2 text-slate-400 font-bold text-xs">
                                            <Building2 size={14} />
                                            {units.find(u => u.id === req.unitId)?.name}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-10">
                                        <div className="text-right">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Dana Belum Dilaporkan</p>
                                            <h4 className="text-3xl font-black text-rose-600 italic tracking-tighter">
                                                {formatRupiah(parseFloat(req.totalAmount) - (reportedAmounts[req.id] || 0))}
                                            </h4>
                                        </div>
                                        <button 
                                            onClick={() => window.location.href = '/pelaporan/bulanan'} 
                                            className="px-8 py-4 bg-emerald-600 text-white rounded-3xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-600/20 hover:scale-105 transition-all flex items-center gap-2"
                                        >
                                            <Save size={16} /> Buat Laporan
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden animate-in fade-in duration-500">
                    <div className="p-8 border-b border-slate-100 flex items-center justify-between flex-wrap gap-4 bg-gradient-to-r from-white to-slate-50/50">
                        <div className="flex items-center gap-6 flex-1 min-w-[300px]">
                            <div className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-2xl shadow-lg shadow-emerald-600/20">
                                <History size={16} />
                                <span className="text-[10px] font-black uppercase tracking-widest">Data Realisasi BOS</span>
                            </div>
                            <div className="flex-1 flex items-center gap-3 bg-slate-100 border border-slate-200 rounded-2xl px-5 py-3 focus-within:ring-2 focus-within:ring-emerald-500 transition-all">
                                <Search size={16} className="text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder="Cari nomor nota atau keterangan..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="bg-transparent border-none outline-none text-sm font-bold text-slate-600 placeholder-slate-400 w-full"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button className="p-3 bg-slate-100 text-slate-500 rounded-2xl hover:bg-emerald-50 hover:text-emerald-600 transition-all shadow-sm">
                                <Filter size={20} />
                            </button>
                            <button className="p-3 bg-slate-100 text-slate-500 rounded-2xl hover:bg-emerald-50 hover:text-emerald-600 transition-all shadow-sm">
                                <Download size={20} />
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-50/50">
                                    <th className="px-5 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-16 italic">No</th>
                                    <th className="px-5 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left italic">Tanggal</th>
                                    <th className="px-5 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left italic">Nomor Nota</th>
                                    <th className="px-5 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left italic">Uraian Belanja BOS</th>
                                    <th className="px-5 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right italic">Jumlah</th>
                                    <th className="px-5 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center italic">Kategori</th>
                                    <th className="px-5 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center italic">Status</th>
                                    <th className="px-5 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-16"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredReports.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="py-20 text-center">
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                                                    <Search size={30} className="text-slate-200" />
                                                </div>
                                                <p className="text-slate-400 font-bold italic">Tidak ada riwayat pelaporan BOS ditemukan</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredReports.map((r, idx) => (
                                        <ReportRow 
                                            key={r.id} 
                                            report={r} 
                                            units={units} 
                                            isSuperAdmin={isSuperAdmin} 
                                            idx={idx} 
                                        />
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
