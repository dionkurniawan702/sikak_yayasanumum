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
        buktiTeks: '',
        nomorNota: '',
        volume: '',
        satuan: '',
        harga: '',
        kategoriAset: 'NON_ASET',
        umurEkonomis: ''
    });

    const handleOpenReportForm = (req) => {
        setSelectedRequest(req);
        setFormData({
            date: new Date().toISOString().split('T')[0],
            amount: req.totalAmount || req.amount || 0,
            description: req.description || '',
            buktiTeks: '',
            nomorNota: '',
            volume: '',
            satuan: '',
            harga: '',
            kategoriAset: 'NON_ASET',
            umurEkonomis: ''
        });
        setShowReportForm(true);
    };

    const handleReportSubmit = (e) => {
        e.preventDefault();
        if (formData.kategoriAset === 'ASET' && !formData.umurEkonomis) {
            return alert('Pilih umur ekonomis untuk kategori Aset.');
        }

        const reportData = {
            id: `REL-${Date.now()}`,
            requestId: selectedRequest.id,
            budgetRequestId: selectedRequest.id,
            unitId: selectedRequest.unitId,
            fieldId: selectedRequest.fieldId,
            academicYearId: globalAcademicYearId,
            amount: parseFloat(formData.amount),
            date: formData.date,
            description: formData.description,
            category: selectedRequest.items?.[0]?.name || 'General',
            // Field baru
            buktiTeks: formData.buktiTeks,
            nomorNota: formData.nomorNota,
            volume: formData.volume,
            satuan: formData.satuan,
            harga: formData.harga,
            kategoriAset: formData.kategoriAset,
            umurEkonomis: formData.kategoriAset === 'ASET' ? formData.umurEkonomis : null,
            status: 'VERIFIED'
        };

        dispatch({ type: 'ADD_BUDGET_REPORT', payload: reportData });
        api.pushAction({ type: 'ADD_BUDGET_REPORT', payload: reportData }, state);

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
                    <div className="bg-white rounded-[40px] w-full max-w-3xl relative z-10 shadow-2xl overflow-hidden animate-in max-h-[92vh] flex flex-col">
                        {/* Modal Header */}
                        <div className="p-8 border-b border-slate-100 flex justify-between items-start flex-shrink-0">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900">Laporan Penggunaan Dana</h2>
                                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">Ref: {selectedRequest?.description}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Maksimal Lapor</p>
                                <span className="text-lg font-black text-blue-700">Rp {parseFloat(selectedRequest?.totalAmount || 0).toLocaleString('id-ID')}</span>
                            </div>
                        </div>

                        {/* Scrollable body */}
                        <div className="overflow-y-auto flex-1 custom-scrollbar">
                            <form id="report-form" onSubmit={handleReportSubmit} className="p-8 space-y-6">

                                {/* Row 1: Tanggal + Nomor Nota */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="form-label">Tanggal Pelaporan <span className="text-rose-500">*</span></label>
                                        <input type="date" className="form-input" value={formData.date}
                                            onChange={e => setFormData({ ...formData, date: e.target.value })} required />
                                    </div>
                                    <div>
                                        <label className="form-label">Nomor Urut Nota <span className="text-rose-500">*</span></label>
                                        <input type="text" className="form-input" placeholder="Contoh: 001/IV/2026"
                                            value={formData.nomorNota}
                                            onChange={e => setFormData({ ...formData, nomorNota: e.target.value })} required />
                                    </div>
                                </div>

                                {/* Row 2: Volume + Satuan + Harga → auto Jumlah */}
                                <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rincian Pembelian</p>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="form-label">Volume</label>
                                            <input type="number" min="0" step="any" className="form-input" placeholder="Qty"
                                                value={formData.volume}
                                                onChange={e => {
                                                    const vol = e.target.value;
                                                    const total = parseFloat(vol || 0) * parseFloat(formData.harga || 0);
                                                    setFormData({ ...formData, volume: vol, amount: total || formData.amount });
                                                }} />
                                        </div>
                                        <div>
                                            <label className="form-label">Satuan</label>
                                            <input type="text" className="form-input" placeholder="Buah / Rim / Kg"
                                                value={formData.satuan}
                                                onChange={e => setFormData({ ...formData, satuan: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="form-label">Harga Satuan (Rp)</label>
                                            <input type="number" min="0" className="form-input" placeholder="0"
                                                value={formData.harga}
                                                onChange={e => {
                                                    const hrg = e.target.value;
                                                    const total = parseFloat(formData.volume || 0) * parseFloat(hrg || 0);
                                                    setFormData({ ...formData, harga: hrg, amount: total || formData.amount });
                                                }} />
                                        </div>
                                    </div>
                                    {/* Auto total */}
                                    <div className="flex items-center justify-between px-4 py-3 bg-indigo-50 rounded-2xl border border-indigo-100">
                                        <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Total Otomatis</span>
                                        <span className="font-black text-indigo-700 text-base">
                                            Rp {(parseFloat(formData.volume || 0) * parseFloat(formData.harga || 0)).toLocaleString('id-ID')}
                                        </span>
                                    </div>
                                </div>

                                {/* Row 3: Jumlah Realisasi (editable override) */}
                                <div>
                                    <label className="form-label">Jumlah Realisasi (Rp) <span className="text-rose-500">*</span></label>
                                    <input type="number" className="form-input font-black text-blue-600" placeholder="0"
                                        value={formData.amount}
                                        onChange={e => setFormData({ ...formData, amount: e.target.value })} required />
                                    <p className="text-[10px] text-slate-400 mt-1 italic">*Otomatis terisi dari volume × harga. Bisa diubah manual.</p>
                                </div>

                                {/* Row 4: Keterangan Detail */}
                                <div>
                                    <label className="form-label">Keterangan Detail <span className="text-rose-500">*</span></label>
                                    <textarea className="form-input h-[90px] !py-3" placeholder="Jelaskan penggunaan dana secara spesifik..."
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })} required />
                                </div>

                                {/* Row 5: Bukti Transaksi – teks */}
                                <div>
                                    <label className="form-label">Bukti Transaksi (Teks)</label>
                                    <textarea className="form-input h-[80px] !py-3"
                                        placeholder="Nomor kwitansi, nama toko, atau keterangan bukti transaksi lainnya..."
                                        value={formData.buktiTeks}
                                        onChange={e => setFormData({ ...formData, buktiTeks: e.target.value })} />
                                </div>

                                {/* Row 6: Kategori Aset */}
                                <div className="p-5 rounded-3xl border-2 border-slate-100 space-y-4">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kategori Penggunaan</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        {[{ val: 'NON_ASET', label: 'Non Aset', sub: 'Habis pakai / Jasa' },
                                        { val: 'ASET', label: 'Aset', sub: 'Barang inventaris / Tetap' }].map(opt => (
                                            <div
                                                key={opt.val}
                                                onClick={() => setFormData({ ...formData, kategoriAset: opt.val, umurEkonomis: '' })}
                                                className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${formData.kategoriAset === opt.val
                                                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                                        : 'border-slate-100 hover:border-slate-200 text-slate-600'
                                                    }`}
                                            >
                                                <p className="font-black text-sm">{opt.label}</p>
                                                <p className="text-[10px] font-bold opacity-60 mt-0.5">{opt.sub}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Umur Ekonomis – muncul hanya jika ASET */}
                                    {formData.kategoriAset === 'ASET' && (
                                        <div>
                                            <label className="form-label">Umur Ekonomis <span className="text-rose-500">*</span></label>
                                            <div className="grid grid-cols-4 gap-3">
                                                {['4', '8', '10', '20'].map(yr => (
                                                    <button
                                                        type="button"
                                                        key={yr}
                                                        onClick={() => setFormData({ ...formData, umurEkonomis: yr })}
                                                        className={`py-3 rounded-2xl font-black text-sm border-2 transition-all ${formData.umurEkonomis === yr
                                                                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                                                : 'border-slate-100 hover:border-slate-200 text-slate-500'
                                                            }`}
                                                    >
                                                        {yr} Thn
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Sinkronisasi Jurnal Info */}
                                <div className="p-5 bg-blue-50/60 rounded-3xl border border-blue-100">
                                    <h5 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <Receipt size={14} /> Sinkronisasi Jurnal
                                    </h5>
                                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                                        Sistem akan otomatis membuat entri di <b>Jurnal Umum</b> dan memperbarui <b>Buku Besar</b> setelah laporan ini dikonfirmasi.
                                        {formData.kategoriAset === 'ASET' && <span className="block mt-1 text-emerald-600 font-bold">✓ Aset baru akan tercatat dengan umur ekonomis {formData.umurEkonomis} tahun.</span>}
                                    </p>
                                </div>

                            </form>
                        </div>

                        {/* Fixed Footer */}
                        <div className="p-8 border-t border-slate-100 flex gap-4 flex-shrink-0 bg-white">
                            <button type="button" onClick={() => setShowReportForm(false)} className="btn btn-secondary flex-1">Batal</button>
                            <button type="submit" form="report-form" className="btn btn-primary flex-1 shadow-blue-500/20">
                                <Save size={18} />
                                <span>Konfirmasi &amp; Kirim Laporan</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
