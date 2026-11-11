import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { hitungSaldoAkun } from '../utils/accounting';
import { formatRupiah, generateId, formatTanggal } from '../utils/format';
import { Lock, AlertTriangle, CheckCircle, Save, RefreshCw, X } from 'lucide-react';
import { isRemote } from '../services/api';
import CurrencyDisplay from '../components/CurrencyDisplay';

export default function PeriodClosing() {
    const { state, dispatch } = useApp();
    const journals = state.journals.filter(j => !j.isDeleted);
    const accounts = state.accounts.filter(a => !a.isDeleted);
    const assets = state.assets.filter(a => !a.isDeleted);

    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
    const [isClosing, setIsClosing] = useState(false);
    const [statusFilter, setStatusFilter] = useState('');

    let pendDebit = 0, pendKredit = 0;
    let bebnDebit = 0, bebnKredit = 0;

    journals.forEach(journal => {
        const jYear = journal.date.substring(0, 4);
        if (jYear !== selectedYear) return;

        journal.entries.forEach(entry => {
            const acc = accounts.find(a => a.id === entry.accountId);
            if (!acc) return;
            if (acc.type === 'Pendapatan') {
                pendDebit += (entry.debit || 0);
                pendKredit += (entry.credit || 0);
            } else if (acc.type === 'Beban') {
                bebnDebit += (entry.debit || 0);
                bebnKredit += (entry.credit || 0);
            }
        });
    });

    const netPendapatan = pendKredit - pendDebit;
    const netBeban = bebnDebit - bebnKredit;
    const surplusDefisit = netPendapatan - netBeban;

    const isAlreadyClosed = journals.some(j => 
        j.date.startsWith(`${selectedYear}-12-31`) && 
        (j.description.includes('Tutup Buku') || j.description.includes('Closing'))
    );

    const handleTutupBuku = async () => {
        if (isAlreadyClosed) return alert('Tahun ini sudah ditutup!');
        if (surplusDefisit === 0) return alert('Tidak ada surplus/defisit untuk ditutup (Saldo 0).');
        
        const confirmMsg = `Peringatan Keamanan!\n\nProses Tutup Buku akan memindahkan Surplus/Defisit sebesar Rp ${Number(Math.abs(surplusDefisit)).toLocaleString('id-ID')} ke akun Aset Neto yayasan.\n\nApakah Anda yakin ingin mengunci dan menutup buku tahun ${selectedYear}?`;
        if (!window.confirm(confirmMsg)) return;

        setIsClosing(true);
        setStatusFilter('Menyiapkan jurnal penutup...');

        let surplusAccountId = accounts.find(a => a.type === 'Aset Neto' && a.category === 'detail')?.id;
        
        if (!surplusAccountId) {
            setIsClosing(false);
            return alert('Error: Akun penampung (Aset Neto) tidak ditemukan.');
        }

        const closingJournalId = generateId('JRN');

        if (isRemote) {
            try {
                const token = localStorage.getItem('jwt_token');
                let API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
                const { hostname, protocol, host } = window.location;
                if (hostname !== 'localhost' && hostname !== '127.0.0.1') API_URL = `${protocol}//${host}/api`;

                setStatusFilter('Sinkronisasi database pusat...');
                const res = await fetch(`${API_URL}/closing`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({
                        year: selectedYear,
                        surplus: surplusDefisit,
                        closingJournalId: closingJournalId,
                        surplusAccountId: surplusAccountId
                    })
                });

                if (!res.ok) throw new Error('API Rejection: Failed to process closing.');
                const result = await res.json();
                dispatch({ type: 'ADD_JOURNAL', payload: result.data });
                setStatusFilter('Berhasil!');

            } catch (err) {
                alert('Kegagalan Sistem: ' + err.message);
                setIsClosing(false);
                return;
            }
        } else {
            setTimeout(() => {
                const entry = {
                    id: closingJournalId,
                    date: `${selectedYear}-12-31`,
                    description: `Tutup Buku Tahun ${selectedYear} - Surplus/Defisit Aktivitas`,
                    entries: [
                        {
                            accountId: surplusAccountId,
                            debit: surplusDefisit < 0 ? Math.abs(surplusDefisit) : 0,
                            credit: surplusDefisit >= 0 ? surplusDefisit : 0
                        }
                    ],
                    programId: 'PRG-GEN',
                    reference: `CLS-${selectedYear}`
                };
                dispatch({ type: 'ADD_JOURNAL', payload: entry });
                setStatusFilter('Sukses LOKAL!');
            }, 1500);
        }

        setTimeout(() => setIsClosing(false), 2500);
    };

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-12">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight italic">Tutup Buku Periode</h2>
                    <p className="text-slate-500 font-medium">Finalisasi laporan keuangan dan jurnal penutup tahunan</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 animate-in">
                {/* CONFIGURATION */}
                <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-2xl flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-4 mb-10">
                            <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
                                <Lock size={28} />
                            </div>
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-widest leading-none">Otoritas Penutupan</h3>
                        </div>

                        <div className="space-y-8">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-3 pl-1">Pilih Tahun Yang Akan Ditutup</label>
                                <select 
                                    className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-lg font-black text-slate-900 focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
                                    value={selectedYear}
                                    onChange={e => setSelectedYear(e.target.value)}
                                    disabled={isClosing}
                                >
                                    <option value="2026">2026</option>
                                    <option value="2025">2025</option>
                                </select>
                            </div>

                            {isAlreadyClosed ? (
                                <div className="p-8 bg-emerald-50 border border-emerald-100 rounded-[32px] flex items-center gap-6 shadow-sm">
                                    <div className="p-4 bg-white rounded-2xl text-emerald-500 shadow-sm">
                                        <CheckCircle size={32} />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-emerald-900 uppercase text-sm">Periode Terkunci</h4>
                                        <p className="text-xs text-emerald-700 font-medium leading-relaxed mt-1">Tahun buku {selectedYear} telah berhasil ditutup dan jurnal penutup telah diterbitkan.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-8 bg-rose-50 border border-rose-100 rounded-[32px] flex items-center gap-6 shadow-sm">
                                    <div className="p-4 bg-white rounded-2xl text-rose-500 shadow-sm">
                                        <AlertTriangle size={32} />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-rose-900 uppercase text-sm">Validasi Diperlukan</h4>
                                        <p className="text-xs text-rose-700 font-medium leading-relaxed mt-1 italic">Pastikan seluruh jurnal penyesuaian (adj. entries) telah diinput sebelum melakukan penutupan.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {!isAlreadyClosed && (
                        <button 
                            className={`mt-12 w-full py-5 rounded-3xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-xl ${isClosing ? 'bg-slate-100 text-slate-400' : 'bg-blue-600 text-white shadow-blue-200 hover:scale-[1.02]'}`}
                            onClick={handleTutupBuku}
                            disabled={isClosing || surplusDefisit === 0}
                        >
                            {isClosing ? <RefreshCw className="animate-spin" size={20} /> : <Lock size={20} />}
                            {isClosing ? statusFilter : `KONFIRMASI PENUTUPAN BUKU ${selectedYear}`}
                        </button>
                    )}
                </div>

                {/* SUMMARY DATA */}
                <div className="bg-gradient-to-br from-[#1C375B] via-[#22517A] to-[#157A66] p-9 rounded-3xl text-white shadow-md border border-[#2D6794]/35 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-4 mb-10">
                             <div className="w-13 h-13 bg-white/15 rounded-2xl flex items-center justify-center border border-white/20">
                                 <Save size={24} className="text-sky-100" />
                             </div>
                             <h3 className="text-lg font-bold text-white uppercase tracking-wider leading-none">Status Nominal {selectedYear}</h3>
                        </div>

                        <div className="space-y-6">
                            <div className="flex justify-between items-center p-6 bg-white/5 rounded-3xl border border-white/10">
                                <div>
                                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Akumulasi Pendapatan</p>
                                    <p className="text-xl font-black text-emerald-400"><CurrencyDisplay value={netPendapatan} useColor={false} /></p>
                                </div>
                                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-[9px] font-black uppercase italic">Kredit</span>
                            </div>

                            <div className="flex justify-between items-center p-6 bg-white/5 rounded-3xl border border-white/10">
                                <div>
                                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Total Beban & Biaya</p>
                                    <p className="text-xl font-black text-rose-400"><CurrencyDisplay value={netBeban} useColor={false} /></p>
                                </div>
                                <span className="px-3 py-1 bg-rose-500/20 text-rose-400 rounded-full text-[9px] font-black uppercase italic">Debit</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-12 p-8 bg-blue-600 rounded-[32px] shadow-2xl relative overflow-hidden group">
                        <div className="relative z-10">
                            <p className="text-[10px] font-black text-white/60 uppercase tracking-[0.3em] mb-3">Estimasi Hasil Aktivitas</p>
                            <h2 className="text-4xl font-black tracking-tighter leading-none mb-4">
                                <CurrencyDisplay value={surplusDefisit} useColor={false} />
                            </h2>
                            <p className="text-xs font-bold text-white/40 italic uppercase tracking-widest">
                                {surplusDefisit >= 0 ? 'Surplus Operasional' : 'Defisit Operasional'}
                            </p>
                        </div>
                        <RefreshCw size={120} className="absolute -bottom-8 -right-8 text-white/10 group-hover:rotate-180 transition-all duration-1000" />
                    </div>
                </div>
            </div>
            
            <div className="mt-20 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">
                SIKAD DARELIMAN — INTERNAL ACCOUNTANT CONTROL SYSTEM
            </div>
        </div>
    );
}
