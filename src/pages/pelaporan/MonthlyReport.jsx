import React, { useState, useMemo } from 'react';
import { FileCheck, Receipt, Upload, Save, AlertCircle, CheckCircle2, ArrowUpRight, History, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';

export default function MonthlyReport() {
    const { state, dispatch } = useApp();
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [showReportForm, setShowReportForm] = useState(false);

    // Mock approved requests waiting for report
    const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'history'

    const { budgetRequests = [], budgetReports = [], expenseItems = [], units = [], fields = [], globalAcademicYearId, currentUser } = state;

    const isSuperAdmin = state.currentUser?.role === 'superadmin';
    const myUnitId = state.currentUser?.unitId;
    const myFieldId = state.currentUser?.fieldId;

    // Filter requests that are approved but NOT YET reported
    const reportedRequestIds = new Set(budgetReports.map(r => r.budgetRequestId));

    const filteredRequests = useMemo(() => {
        return (budgetRequests || []).filter(req => {
            const isYear = req.academicYearId === globalAcademicYearId;
            if (!isYear) return false;
            if (isSuperAdmin) return true;
            if (myUnitId) return req.unitId === myUnitId;
            if (myFieldId) return req.fieldId === myFieldId;
            return false;
        });
    }, [budgetRequests, isSuperAdmin, myUnitId, myFieldId, globalAcademicYearId]);

    const pendingReports = filteredRequests.filter(req =>
        req.status === 'APPROVED' && !reportedRequestIds.has(req.id)
    );

    const filteredReports = React.useMemo(() => {
        return (budgetReports || []).filter(rel => {
            const isYear = rel.academicYearId === globalAcademicYearId;
            if (!isYear) return false;
            if (isSuperAdmin) return true;
            if (myUnitId) return rel.unitId === myUnitId;
            if (myFieldId) return rel.fieldId === myFieldId;
            return false;
        });
    }, [budgetReports, isSuperAdmin, myUnitId, myFieldId, globalAcademicYearId]);

    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        amount: 0,
        description: '',
        attachment: ''
    });

    const handleOpenReportForm = (req) => {
        setSelectedRequest(req);
        setFormData({
            date: new Date().toISOString().split('T')[0],
            amount: req.amount,
            description: req.description || '',
            attachment: ''
        });
        setShowReportForm(true);
    };

    const handleReportSubmit = (e) => {
        e.preventDefault();

        const reportData = {
            id: `REL-${Date.now()}`,
            requestId: selectedRequest.id,
            unitId: selectedRequest.unitId,
            fieldId: selectedRequest.fieldId,
            academicYearId: globalAcademicYearId,
            amount: parseFloat(formData.amount),
            date: formData.date,
            description: formData.description,
            category: selectedRequest.items?.[0]?.name || 'General',
            status: 'VERIFIED'
        };

        dispatch({
            type: 'ADD_BUDGET_REPORT',
            payload: reportData
        });
        api.pushAction({ type: 'ADD_BUDGET_REPORT', payload: reportData }, state); // Immediate push

        setShowReportForm(false);
    };

    return (
        <div className="p-8 animate-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-1 font-display">Laporan Pengeluaran</h1>
                    <p className="text-slate-500 font-medium italic">Laporkan realisasi penggunaan dana yang telah dicairkan.</p>
                </div>
                <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl">
                    <button
                        onClick={() => setActiveTab('pending')}
                        className={`px-6 py-2 rounded-xl font-black text-xs transition-all ${activeTab === 'pending' ? 'bg-white text-blue-600 shadow-sm shadow-blue-500/5' : 'text-slate-500'}`}
                    >
                        Perlu Dilaporkan
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`px-6 py-2 rounded-xl font-black text-xs transition-all ${activeTab === 'history' ? 'bg-white text-blue-600 shadow-sm shadow-blue-500/5' : 'text-slate-500'}`}
                    >
                        Riwayat Laporan
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* List of pending reports or history */}
                <div className="lg:col-span-2 space-y-4">
                    {activeTab === 'pending' ? (
                        <>
                            <div className="flex items-center gap-2 mb-2 px-2">
                                <AlertCircle size={16} className="text-amber-500" />
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dana yang sudah dicairkan & Menunggu Laporan</span>
                            </div>

                            {pendingReports.length > 0 ? pendingReports.map(req => (
                                <div key={req.id} className="card p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-blue-200 transition-all border-l-8 border-l-blue-600">
                                    <div>
                                        <h4 className="font-black text-slate-900 text-xl mb-1">{expenseItems.find(i => i.id === req.expenseItemId)?.name || 'Pengeluaran'}</h4>
                                        <div className="flex items-center gap-4 text-slate-400 text-xs font-bold">
                                            <span className="flex items-center gap-1"><History size={14} /> {req.date}</span>
                                            <span className="flex items-center gap-1 font-black text-blue-600 italic">#{req.id.slice(0, 8)}</span>
                                        </div>
                                        <p className="mt-4 text-sm text-slate-500 font-medium">{req.description}</p>
                                    </div>

                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Dana Cair</p>
                                        <h4 className="text-2xl font-black text-blue-700 mb-6">Rp {parseFloat(req.totalAmount || 0).toLocaleString('id-ID')}</h4>
                                        <button
                                            onClick={() => handleOpenReportForm(req)}
                                            className="btn btn-primary !rounded-xl !py-2 !text-xs !w-full"
                                        >
                                            <FileCheck size={16} />
                                            <span>Buat Laporan</span>
                                        </button>
                                    </div>
                                </div>
                            )) : (
                                <div className="card p-20 text-center text-slate-400 italic font-medium">
                                    Tidak ada dana yang menunggu laporan.
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <div className="flex items-center gap-2 mb-2 px-2">
                                <History size={16} className="text-blue-500" />
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Riwayat Laporan Realisasi Penggunaan Dana</span>
                            </div>

                            {filteredReports.length > 0 ? filteredReports.map(report => (
                                <div key={report.id} className="card p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-emerald-200 transition-all border-l-8 border-l-emerald-500">
                                    <div>
                                        <h4 className="font-black text-slate-900 text-lg mb-1 italic uppercase tracking-tight">{report.category || 'Laporan Pengeluaran'}</h4>
                                        <div className="flex items-center gap-4 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                                            <span>{report.date}</span>
                                            {isSuperAdmin && (
                                                <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                                                    {report.unitId === 'FOUNDATION' ? 'YAYASAN' : (units.find(u => u.id === report.unitId)?.name || report.unitId)}
                                                </span>
                                            )}
                                            <span className="text-emerald-600">Terverifikasi Sistem</span>
                                        </div>
                                        <p className="mt-3 text-xs text-slate-500 font-medium line-clamp-1">{report.description}</p>
                                    </div>

                                    <div className="text-right">
                                        <h4 className="text-xl font-black text-slate-900">Rp {parseFloat(report.amount || 0).toLocaleString('id-ID')}</h4>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dana Terpakai</p>
                                    </div>
                                </div>
                            )) : (
                                <div className="card p-20 text-center text-slate-400 italic font-medium">
                                    Belum ada laporan yang dibuat.
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Sidebar summary / Stats */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="card p-8 bg-emerald-50 border-emerald-100 text-center">
                        <div className="w-16 h-16 bg-white text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                            <CheckCircle2 size={32} />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 mb-2">Tertib Administrasi</h3>
                        <p className="text-sm text-slate-600 font-medium leading-relaxed">Pastikan semua pengeluaran dilaporkan tepat waktu untuk menjaga transparansi keuangan Yayasan.</p>
                    </div>

                    <div className="card p-8">
                        <h4 className="font-black text-slate-900 uppercase text-[10px] tracking-widest mb-6 border-b border-slate-100 pb-4 flex items-center justify-between">
                            <span>Statistik Laporan</span>
                            <ArrowUpRight size={14} />
                        </h4>
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-400">Total Cair</span>
                                <span className="text-sm font-black text-slate-700">Rp {filteredRequests.filter(r => r.status === 'APPROVED').reduce((s, r) => s + parseFloat(r.totalAmount || 0), 0).toLocaleString('id-ID')}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-400">Total Lapor</span>
                                <span className="text-sm font-black text-emerald-600">Rp {filteredReports.reduce((s, r) => s + parseFloat(r.amount || 0), 0).toLocaleString('id-ID')}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Report Form Modal */}
            {showReportForm && (
                <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowReportForm(false)} />
                    <div className="bg-white rounded-[40px] w-full max-w-2xl relative z-10 shadow-2xl overflow-hidden animate-in">
                        <div className="p-10">
                            <div className="flex justify-between items-center mb-10">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 font-display">Laporan Penggunaan Dana</h2>
                                    <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-1">Ref: {expenseItems.find(i => i.id === selectedRequest.expenseItemId)?.name}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Maksimal Lapor</p>
                                    <span className="text-lg font-black text-blue-700">Rp {parseFloat(selectedRequest?.totalAmount || 0).toLocaleString('id-ID')}</span>
                                </div>
                            </div>

                            <form onSubmit={handleReportSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div>
                                        <label className="form-label">Tanggal Pelaporan</label>
                                        <input
                                            type="date"
                                            className="form-input"
                                            value={formData.date}
                                            onChange={e => setFormData({ ...formData, date: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="form-label">Jumlah Realisasi (Rp)</label>
                                        <input
                                            type="number"
                                            className="form-input font-black text-blue-600"
                                            value={formData.amount}
                                            onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="form-label">Bukti Transaksi (Pilihan)</label>
                                        <div className="border-2 border-dashed border-slate-100 rounded-2xl p-6 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-all cursor-pointer">
                                            <Upload className="text-slate-300 mb-2" size={24} />
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Simulasi Upload</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div>
                                        <label className="form-label">Keterangan Detail</label>
                                        <textarea
                                            className="form-input h-[120px] !py-3"
                                            placeholder="Jelaskan penggunaan dana secara spesifik..."
                                            value={formData.description}
                                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                                            required
                                        ></textarea>
                                    </div>

                                    <div className="p-6 bg-blue-50/50 rounded-3xl border border-blue-100">
                                        <h5 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <Receipt size={14} /> Sinkronisasi Jurnal
                                        </h5>
                                        <p className="text-xs text-slate-600 leading-relaxed font-medium">
                                            Sistem akan otomatis membuat entri di **Jurnal Umum** dan memperbarui **Buku Besar** setelah laporan ini dikonfirmasi.
                                        </p>
                                    </div>
                                </div>

                                <div className="md:col-span-2 flex gap-4 pt-6 border-t border-slate-100">
                                    <button type="button" onClick={() => setShowReportForm(false)} className="btn btn-secondary flex-1">Batal</button>
                                    <button type="submit" className="btn btn-primary flex-1 shadow-blue-500/20 group">
                                        <Save size={18} />
                                        <span>Konfirmasi & Kirim Laporan</span>
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
