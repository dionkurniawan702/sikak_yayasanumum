import React, { useState } from 'react';
import { Wallet, Plus, Clock, CheckCircle, XCircle, FileText, ChevronRight, TrendingUp, AlertCircle, Calendar } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function MonthlyRequest() {
    const { state, dispatch } = useApp();
    const { currentUser } = state;
    const [showRequestModal, setShowRequestModal] = useState(false);
    
    // In real app, these would be fetched from API and filtered by user's unit/field
    const requests = state.budgetRequests || [
        { id: 1, expenseName: 'Gaji Pegawai SDIT', amount: 45000000, date: '2026-03-01', status: 'APPROVED', description: 'Gaji Maret 2026' },
        { id: 2, expenseName: 'Operasional Bulanan', amount: 5000000, date: '2026-03-05', status: 'PENDING', description: 'Listrik & Air' },
    ];

    const getStatusColor = (status) => {
        switch (status) {
            case 'APPROVED': return 'bg-emerald-500 shadow-emerald-500/20';
            case 'REJECTED': return 'bg-rose-500 shadow-rose-500/20';
            default: return 'bg-amber-500 shadow-amber-500/20';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'APPROVED': return <CheckCircle size={14} />;
            case 'REJECTED': return <XCircle size={14} />;
            default: return <Clock size={14} />;
        }
    };

    return (
        <div className="p-8 animate-in">
            {/* Header with quick stats */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
                <div className="lg:col-span-2 bg-gradient-to-br from-blue-700 to-indigo-800 rounded-[40px] p-10 text-white shadow-2xl relative overflow-hidden">
                    <div className="relative z-10">
                        <h1 className="text-3xl font-black font-display mb-1">Permintaan Dana</h1>
                        <p className="text-blue-100/70 font-medium mb-8 uppercase text-[10px] tracking-widest">Maret 2026 • Unit {currentUser?.unitId || 'Yayasan'}</p>
                        <button 
                            onClick={() => setShowRequestModal(true)}
                            className="bg-white text-blue-700 font-black px-8 py-4 rounded-2xl flex items-center gap-3 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-blue-900/20"
                        >
                            <Plus size={20} />
                            <span>Buat Permintaan Baru</span>
                        </button>
                    </div>
                    <div className="absolute -bottom-4 -right-4 opacity-10">
                        <Wallet size={160} />
                    </div>
                </div>

                <div className="card p-8 flex flex-col items-center justify-center text-center">
                    <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-4">
                        <TrendingUp size={24} />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Dana Tersedia</p>
                    <h2 className="text-2xl font-black text-slate-900 font-display">Rp 52.400.000</h2>
                </div>

                <div className="card p-8 flex flex-col items-center justify-center text-center">
                    <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-4">
                        <Clock size={24} />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Dalam Proses</p>
                    <h2 className="text-2xl font-black text-slate-900 font-display">Rp 5.000.000</h2>
                </div>
            </div>

            {/* Request History */}
            <div className="flex items-center gap-3 mb-6">
                <Calendar className="text-blue-600" size={20} />
                <h3 className="font-black text-slate-900 uppercase text-xs tracking-widest leading-none">Riwayat Permintaan Bulan Ini</h3>
            </div>

            <div className="space-y-4">
                {requests.map(request => (
                    <div key={request.id} className="card p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-xl hover:translate-x-2 transition-all group">
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 rounded-[20px] bg-slate-50 text-slate-400 flex items-center justify-center font-black group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner">
                                <FileText size={24} />
                            </div>
                            <div>
                                <h4 className="font-black text-slate-900 text-lg mb-1">{request.expenseName}</h4>
                                <p className="text-xs font-bold text-slate-400 capitalize">{request.description}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-12">
                            <div className="text-right">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Jumlah Dana</p>
                                <h4 className="text-xl font-black text-slate-900">Rp {request.amount.toLocaleString('id-ID')}</h4>
                            </div>
                            
                            <div className="flex flex-col items-end gap-2 pr-4">
                                <span className={`px-4 py-1.5 rounded-full text-white text-[10px] font-black flex items-center gap-2 shadow-lg ${getStatusColor(request.status)}`}>
                                    {getStatusIcon(request.status)}
                                    {request.status}
                                </span>
                                <p className="text-[10px] font-bold text-slate-400">{request.date}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Request Modal */}
            {showRequestModal && (
                <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm shadow-xl" onClick={() => setShowRequestModal(false)} />
                    <div className="bg-white rounded-[40px] w-full max-w-lg relative z-10 shadow-2xl overflow-hidden animate-in">
                        <div className="p-10">
                            <h2 className="text-2xl font-black text-slate-900 mb-2 font-display">Permintaan Dana Baru</h2>
                            <p className="text-slate-500 mb-8 font-medium italic">Pastikan jumlah dana tidak melebihi saldo tersedia.</p>

                            <form className="space-y-6">
                                <div>
                                    <label className="form-label">Kategori Pengeluaran</label>
                                    <select className="form-select">
                                        <option>Pilih Pos Pengeluaran</option>
                                        <option>Gaji & Tunjangan</option>
                                        <option>Operasional Bulanan</option>
                                        <option>Pemeliharaan & Aset</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="form-label">Jumlah Dana (Rp)</label>
                                    <input type="number" className="form-input text-xl font-black text-blue-600" placeholder="0" />
                                </div>

                                <div>
                                    <label className="form-label">Keterangan / Alasan</label>
                                    <textarea className="form-input min-h-[100px] !py-3" placeholder="Jelaskan kebutuhan dana secara mendetail..."></textarea>
                                </div>

                                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3 text-xs text-amber-700 font-medium">
                                    <AlertCircle size={18} className="shrink-0" />
                                    <p>Permintaan akan diverifikasi oleh Bidang Keuangan sebelum dana dapat dicairkan.</p>
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <button type="button" onClick={() => setShowRequestModal(false)} className="btn btn-secondary flex-1">Batal</button>
                                    <button type="submit" className="btn btn-primary flex-1 shadow-blue-500/20">Kirim Permintaan</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
