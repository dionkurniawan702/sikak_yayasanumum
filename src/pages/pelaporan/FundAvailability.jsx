import React, { useMemo, useState } from 'react';
import { Landmark, TrendingUp, Info, ShieldCheck, HelpCircle, Layers, Wallet, Clock, CheckCircle, Building2, ChevronDown, ChevronRight, Users, HandCoins, X, UploadCloud, Save, Loader2, FileCheck, Eye } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatRupiah } from '../../utils/format';
import { api } from '../../services/api';

// ────────────────────────────────────────────────────────────
// Helper: hitung saldo satu entitas (unit atau bidang)
// ────────────────────────────────────────────────────────────
function calcEntityBalance(requests, reports) {
    const approved = requests.filter(r => r.status === 'APPROVED').reduce((s, r) => s + (parseFloat(r.totalAmount) || 0), 0);
    const used = reports.filter(r => r.kategoriAset !== 'PENGEMBALIAN').reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const returned = reports.filter(r => r.kategoriAset === 'PENGEMBALIAN' && r.status === 'APPROVED').reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const pending = requests.filter(r => r.status === 'PENDING').reduce((s, r) => s + (parseFloat(r.totalAmount) || 0), 0);
    return { approved, used, returned, balance: approved - used - returned, pending };
}

// ────────────────────────────────────────────────────────────
// Baris entitas (unit / bidang) yang bisa di-expand
// ────────────────────────────────────────────────────────────
function EntityRow({ name, type, requests, reports }) {
    const [open, setOpen] = useState(false);
    const { approved, used, returned, balance, pending } = calcEntityBalance(requests, reports);

    // Rincian per kategori (item)
    const positions = useMemo(() => {
        const pos = {};
        requests.filter(r => r.status === 'APPROVED').forEach(req => {
            (req.items || []).forEach(item => {
                const cat = item.name || 'General';
                if (!pos[cat]) pos[cat] = { category: cat, totalApproved: 0, totalUsed: 0, totalReturned: 0 };
                pos[cat].totalApproved += (parseFloat(item.amount) || 0);
            });
        });
        reports.forEach(rel => {
            if (rel.kategoriAset === 'PENGEMBALIAN') return; // Skip returns from category breakdown
            const cat = rel.category || 'General';
            if (!pos[cat]) pos[cat] = { category: cat, totalApproved: 0, totalUsed: 0 };
            pos[cat].totalUsed += (parseFloat(rel.amount) || 0);
        });
        return Object.values(pos).filter(p => p.totalApproved > 0 || p.totalUsed > 0);
    }, [requests, reports]);

    const hasData = approved > 0 || pending > 0;
    const balanceColor = balance < 0 ? 'text-rose-600' : balance > 0 ? 'text-emerald-600' : 'text-slate-400';

    return (
        <>
            <tr
                className={`border-b border-slate-100 cursor-pointer transition-colors ${open ? 'bg-indigo-50/60' : 'hover:bg-slate-50'}`}
                onClick={() => setOpen(o => !o)}
            >
                <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${type === 'unit' ? 'bg-indigo-50 text-indigo-600' : 'bg-violet-50 text-violet-600'}`}>
                            {type === 'unit' ? <Building2 size={16} /> : <Users size={16} />}
                        </div>
                        <div>
                            <div className="font-black text-slate-800 text-sm">{name}</div>
                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{type === 'unit' ? 'Unit' : 'Bidang'}</div>
                        </div>
                    </div>
                </td>
                <td className="px-6 py-5 font-bold text-emerald-700 text-sm">{formatRupiah(approved)}</td>
                <td className="px-6 py-5 font-bold text-rose-600 text-sm">{formatRupiah(used)}</td>
                <td className="px-6 py-5">
                    <span className={`font-black text-base ${balanceColor}`}>{formatRupiah(balance)}</span>
                </td>
                <td className="px-6 py-5 font-bold text-indigo-600 text-sm">{formatRupiah(returned)}</td>
                <td className="px-6 py-5 text-center">
                    {positions.length > 0 ? (
                        open
                            ? <ChevronDown size={16} className="text-indigo-500 mx-auto" />
                            : <ChevronRight size={16} className="text-slate-300 mx-auto" />
                    ) : <span className="text-[10px] text-slate-300 italic">—</span>}
                </td>
            </tr>

            {/* Sub-rows: rincian per item */}
            {open && positions.map((pos, idx) => {
                const avail = pos.totalApproved - pos.totalUsed;
                const pct = pos.totalApproved > 0 ? (pos.totalUsed / pos.totalApproved) * 100 : 0;
                return (
                    <tr key={idx} className="bg-slate-50/80 border-b border-slate-100/60">
                        <td className="pl-20 pr-6 py-4">
                            <div className="flex items-center gap-3">
                                <div className="w-1.5 h-8 rounded-full bg-indigo-300" />
                                <span className="text-xs font-bold text-slate-600 italic">{pos.category}</span>
                            </div>
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-500">{formatRupiah(pos.totalApproved)}</td>
                        <td className="px-6 py-4 text-xs font-bold text-rose-500">{formatRupiah(pos.totalUsed)}</td>
                        <td className="px-6 py-4">
                            <span className={`text-xs font-black ${avail < 0 ? 'text-rose-600' : 'text-indigo-600'}`}>{formatRupiah(avail)}</span>
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-400 italic text-center">—</td>
                        <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                                <div className="flex-1 bg-slate-200 h-2 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${Math.min(100, pct)}%` }} />
                                </div>
                                <span className="text-[10px] font-black text-slate-400">{pct.toFixed(0)}%</span>
                            </div>
                        </td>
                    </tr>
                );
            })}
        </>
    );
}

// ────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────
export default function FundAvailability() {
    const { state, dispatch } = useApp();
    const { currentUser, budgetRequests, budgetReports, units, fields, globalAcademicYearId } = state;

    const [showReturnModal, setShowReturnModal] = useState(false);
    const [returnForm, setReturnForm] = useState({ amount: '', buktiTeks: '', description: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [processingId, setProcessingId] = useState(null);
    const [reviewData, setReviewData] = useState(null);

    const isSuperAdmin = currentUser?.role === 'superadmin';
    const myUnitId = currentUser?.unitId;
    const myFieldId = currentUser?.fieldId;

    // ── Filter by tahun ajaran aktif
    const yearRequests = useMemo(() =>
        (budgetRequests || []).filter(r => r.academicYearId === globalAcademicYearId),
        [budgetRequests, globalAcademicYearId]);

    const yearReports = useMemo(() =>
        (budgetReports || []).filter(r => r.academicYearId === globalAcademicYearId),
        [budgetReports, globalAcademicYearId]);

    // ── Data untuk user biasa (non-superadmin)
    const myRequests = useMemo(() => yearRequests.filter(r =>
        myUnitId ? r.unitId === myUnitId : myFieldId ? r.fieldId === myFieldId : false
    ), [yearRequests, myUnitId, myFieldId]);

    const myReports = useMemo(() => yearReports.filter(r =>
        myUnitId ? r.unitId === myUnitId : myFieldId ? r.fieldId === myFieldId : false
    ), [yearReports, myUnitId, myFieldId]);

    // ── Aggregate superadmin (total keseluruhan)
    const totalApproved = yearRequests.filter(r => r.status === 'APPROVED').reduce((s, r) => s + (parseFloat(r.totalAmount) || 0), 0);
    const totalUsed = yearReports.filter(r => r.kategoriAset !== 'PENGEMBALIAN').reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const totalReturned = yearReports.filter(r => r.kategoriAset === 'PENGEMBALIAN' && r.status === 'APPROVED').reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const totalBalance = totalApproved - totalUsed - totalReturned;
    const totalPending = yearRequests.filter(r => r.status === 'PENDING').reduce((s, r) => s + (parseFloat(r.totalAmount) || 0), 0) + 
                         yearReports.filter(r => r.status === 'PENDING' && r.kategoriAset === 'PENGEMBALIAN').reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

    // ── Aggregate user biasa
    const myApproved = myRequests.filter(r => r.status === 'APPROVED').reduce((s, r) => s + (parseFloat(r.totalAmount) || 0), 0);
    const myUsed = myReports.filter(r => r.kategoriAset !== 'PENGEMBALIAN').reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const myReturned = myReports.filter(r => r.kategoriAset === 'PENGEMBALIAN' && r.status === 'APPROVED').reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const myBalance = myApproved - myUsed - myReturned;
    const myPending = myRequests.filter(r => r.status === 'PENDING').reduce((s, r) => s + (parseFloat(r.totalAmount) || 0), 0) + 
                      myReports.filter(r => r.status === 'PENDING' && r.kategoriAset === 'PENGEMBALIAN').reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

    const handleSubmitReturn = async (e) => {
        e.preventDefault();
        const amt = parseFloat(returnForm.amount);
        const myPendingReturns = myReports.filter(r => r.status === 'PENDING' && r.kategoriAset === 'PENGEMBALIAN').reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
        
        if (isNaN(amt) || amt <= 0) return alert('Nominal tidak valid!');
        if (amt > (myBalance - myPendingReturns)) return alert('Nominal melebihi sisa saldo Anda (termasuk yang sedang diproses)!');
        if (!returnForm.buktiTeks) return alert('Bukti transfer wajib dilampirkan!');

        setIsSubmitting(true);
        const newReturn = {
            id: 'RET-' + Date.now().toString(36).toUpperCase(),
            unitId: myUnitId,
            fieldId: myFieldId,
            academicYearId: globalAcademicYearId,
            date: new Date().toISOString().split('T')[0],
            amount: amt,
            description: returnForm.description || 'Pengembalian Sisa Dana Kas',
            buktiTeks: returnForm.buktiTeks,
            kategoriAset: 'PENGEMBALIAN',
            status: 'PENDING',
            notified: false
        };

        dispatch({ type: 'ADD_BUDGET_REPORT', payload: newReturn });
        await api.pushAction({ type: 'ADD_BUDGET_REPORT', payload: newReturn }, state);
        
        setIsSubmitting(false);
        setShowReturnModal(false);
        setReturnForm({ amount: '', buktiTeks: '', description: '' });
        alert('Pengajuan pengembalian dana berhasil dikirim dan menunggu ACC Superadmin.');
    };

    const handleApproveReturn = async (ret) => {
        setProcessingId(ret.id);
        const updated = { ...ret, status: 'APPROVED', notified: false };
        dispatch({ type: 'EDIT_BUDGET_REPORT', payload: updated });
        await api.pushAction({ type: 'EDIT_BUDGET_REPORT', payload: updated }, state);
        setProcessingId(null);
        setReviewData(null);
        alert('Pengembalian dana berhasil di-ACC!');
    };

    const handleRejectReturn = async (ret) => {
        const reason = window.prompt('Alasan penolakan pengembalian dana:');
        if (reason !== null) {
            setProcessingId(ret.id);
            const updated = { ...ret, status: 'REJECTED', description: `${ret.description} (Ditolak: ${reason})`, notified: false };
            dispatch({ type: 'EDIT_BUDGET_REPORT', payload: updated });
            await api.pushAction({ type: 'EDIT_BUDGET_REPORT', payload: updated }, state);
            setProcessingId(null);
            setReviewData(null);
            alert('Pengembalian dana ditolak.');
        }
    };

    const pendingReturns = yearReports.filter(r => r.kategoriAset === 'PENGEMBALIAN' && r.status === 'PENDING');

    // ── Daftar unit & bidang yang punya data (untuk superadmin)
    const activeUnits = useMemo(() => (units || []).filter(u => !u.isDeleted), [units]);
    const activeFields = useMemo(() => (fields || []).filter(f => !f.isDeleted), [fields]);

    // Stat cards
    const statApproved = isSuperAdmin ? totalApproved : myApproved;
    const statUsed = isSuperAdmin ? totalUsed : myUsed;
    const statBalance = isSuperAdmin ? totalBalance : myBalance;
    const statPending = isSuperAdmin ? totalPending : myPending;

    const unitName = units?.find(u => u.id === myUnitId)?.name || fields?.find(f => f.id === myFieldId)?.name || 'Yayasan';

    return (
        <div className="p-8 animate-in fade-in duration-500">

            {/* ── Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Ketersediaan Dana & Saldo</h1>
                    <p className="text-slate-500 font-medium italic">
                        {isSuperAdmin ? 'Monitoring saldo kas seluruh unit kerja & bidang.' : `Status saldo kas ${unitName}.`}
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    {!isSuperAdmin && statBalance > 0 && (
                        <button 
                            onClick={() => {
                                setReturnForm(prev => ({ ...prev, amount: statBalance }));
                                setShowReturnModal(true);
                            }}
                            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-lg shadow-indigo-200 transition-all active:scale-95 font-bold text-xs"
                        >
                            <HandCoins size={18} />
                            <span>KEMBALIKAN SISA DANA</span>
                        </button>
                    )}
                    <div className="flex items-center gap-3 px-6 py-3 bg-indigo-50 text-indigo-700 rounded-2xl border border-indigo-100 shadow-sm hidden md:flex">
                        <ShieldCheck size={20} />
                        <span className="text-xs font-black uppercase tracking-widest">Saldo Real-Time</span>
                    </div>
                </div>
            </div>

            {/* ── Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
                <div className="card p-8 bg-white border-b-4 border-emerald-500 shadow-lg hover:translate-y-[-4px] transition-all">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4"><CheckCircle size={24} /></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Dana ACC (Masuk)</p>
                    <h2 className="text-2xl font-black text-slate-900">{formatRupiah(statApproved)}</h2>
                </div>
                <div className="card p-8 bg-white border-b-4 border-rose-500 shadow-lg hover:translate-y-[-4px] transition-all">
                    <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center mb-4"><TrendingUp size={24} /></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Realisasi (Keluar)</p>
                    <h2 className="text-2xl font-black text-slate-900">{formatRupiah(statUsed)}</h2>
                </div>
                <div className="card p-8 bg-white border-b-4 border-indigo-500 shadow-lg hover:translate-y-[-4px] transition-all">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4"><Wallet size={24} /></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Sisa Dana (Saldo)</p>
                    <h2 className="text-2xl font-black text-slate-900">{formatRupiah(statBalance)}</h2>
                </div>
                <div className="card p-8 bg-white border-b-4 border-amber-500 shadow-lg hover:translate-y-[-4px] transition-all">
                    <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-4"><Clock size={24} /></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Menunggu ACC (Proses)</p>
                    <h2 className="text-2xl font-black text-amber-600">{formatRupiah(statPending)}</h2>
                </div>
            </div>

            {/* ── SUPERADMIN: Tabel per Unit & Bidang */}
            {isSuperAdmin ? (
                <div className="card overflow-hidden shadow-2xl mb-10 rounded-[2rem] bg-white border-0">
                    <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
                        <h3 className="font-black uppercase text-xs tracking-widest flex items-center gap-2">
                            <Layers className="text-indigo-400" size={16} /> Saldo per Unit & Bidang
                        </h3>
                        <span className="text-[10px] text-slate-400 font-bold italic">Klik baris untuk lihat rincian kategori</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit / Bidang</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Dana ACC</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Realisasi</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sisa Saldo</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Dikembalikan</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Detail</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* Units */}
                                {activeUnits.map(unit => (
                                    <EntityRow
                                        key={unit.id}
                                        name={unit.name}
                                        type="unit"
                                        requests={yearRequests.filter(r => r.unitId === unit.id)}
                                        reports={yearReports.filter(r => r.unitId === unit.id)}
                                    />
                                ))}
                                {/* Fields (bidang) */}
                                {activeFields.map(field => (
                                    <EntityRow
                                        key={field.id}
                                        name={field.name}
                                        type="field"
                                        requests={yearRequests.filter(r => r.fieldId === field.id && !r.unitId)}
                                        reports={yearReports.filter(r => r.fieldId === field.id && !r.unitId)}
                                    />
                                ))}
                                {activeUnits.length === 0 && activeFields.length === 0 && (
                                    <tr>
                                        <td colSpan="6" className="px-8 py-20 text-center text-slate-400 font-medium italic">
                                            Belum ada unit atau bidang yang terdaftar.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                /* ── USER BIASA: Tabel per Kategori (tampilan lama) */
                <div className="card overflow-hidden shadow-2xl mb-10 rounded-[2rem] bg-white border-0">
                    <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
                        <h3 className="font-black uppercase text-xs tracking-widest flex items-center gap-2">
                            <Layers className="text-indigo-400" size={16} /> Rincian Saldo per Kategori
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Kategori Pengeluaran</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Dana Cair (ACC)</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Realisasi</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sisa Saldo</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Dikembalikan</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Penyerapan</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {(() => {
                                    const positions = {};
                                    myRequests.filter(r => r.status === 'APPROVED').forEach(req => {
                                        (req.items || []).forEach(item => {
                                            const cat = item.name || 'General';
                                            if (!positions[cat]) positions[cat] = { category: cat, totalApproved: 0, totalUsed: 0 };
                                            positions[cat].totalApproved += (parseFloat(item.amount) || 0);
                                        });
                                    });
                                    myReports.forEach(rel => {
                                        if (rel.kategoriAset === 'PENGEMBALIAN') return; // Skip returns from category breakdown
                                        const cat = rel.category || 'General';
                                        if (!positions[cat]) positions[cat] = { category: cat, totalApproved: 0, totalUsed: 0 };
                                        positions[cat].totalUsed += (parseFloat(rel.amount) || 0);
                                    });
                                    const list = Object.values(positions).filter(p => p.totalApproved > 0 || p.totalUsed > 0);
                                    if (list.length === 0) return (
                                        <tr><td colSpan="6" className="px-8 py-20 text-center text-slate-400 font-medium italic">
                                            Belum ada data saldo kas. Lakukan pengajuan dana terlebih dahulu.
                                        </td></tr>
                                    );
                                    return list.map((item, idx) => {
                                        const available = item.totalApproved - item.totalUsed;
                                        const pct = item.totalApproved > 0 ? (item.totalUsed / item.totalApproved) * 100 : 0;
                                        return (
                                            <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-2 h-10 rounded-full bg-indigo-600 group-hover:scale-y-125 transition-transform" />
                                                        <span className="font-black text-slate-700">{item.category}</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 font-bold text-slate-500">{formatRupiah(item.totalApproved)}</td>
                                                <td className="px-8 py-6 font-black text-rose-600">{formatRupiah(item.totalUsed)}</td>
                                                <td className="px-8 py-6">
                                                    <span className={`text-lg font-black ${available < 0 ? 'text-rose-600' : 'text-indigo-600'}`}>{formatRupiah(available)}</span>
                                                </td>
                                                <td className="px-8 py-6 text-center text-slate-300 italic font-bold">—</td>
                                                <td className="px-8 py-6 text-right w-64">
                                                    <div className="flex flex-col gap-2">
                                                        <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                            <span>Terpakai</span><span>{pct.toFixed(1)}%</span>
                                                        </div>
                                                        <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-200">
                                                            <div className="h-full bg-indigo-600 shadow-sm" style={{ width: `${Math.min(100, pct)}%` }} />
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    });
                                })()}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── SUPERADMIN: Verifikasi Pengembalian Dana */}
            {isSuperAdmin && pendingReturns.length > 0 && (
                <div className="card overflow-hidden shadow-2xl mb-10 rounded-[2rem] border-2 border-indigo-100">
                    <div className="p-6 bg-indigo-600 text-white flex items-center justify-between">
                        <h3 className="font-black uppercase text-xs tracking-widest flex items-center gap-2">
                            <HandCoins className="text-indigo-200" size={16} /> Antrean Pengembalian Sisa Dana
                        </h3>
                        <span className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black">{pendingReturns.length} Antrean</span>
                    </div>
                    <div className="p-6">
                        <div className="space-y-4">
                            {pendingReturns.map(ret => {
                                const unitLabel = units.find(u => u.id === ret.unitId)?.name || fields.find(f => f.id === ret.fieldId)?.name || 'Unknown';
                                return (
                                    <div key={ret.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-100">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-black text-slate-800">{unitLabel}</span>
                                                <span className="text-[10px] font-bold text-slate-400">• {ret.date}</span>
                                            </div>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">{ret.description}</p>
                                            {ret.buktiTeks && (
                                                <div className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg inline-flex items-center gap-2">
                                                    <UploadCloud size={14} /> Bukti: {ret.buktiTeks}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-lg font-black text-emerald-600">{formatRupiah(parseFloat(ret.amount || 0))}</span>
                                            <div className="flex items-center gap-2">
                                                <button 
                                                    onClick={() => setReviewData(ret)}
                                                    className="p-2 bg-indigo-100 text-indigo-700 hover:bg-indigo-600 hover:text-white rounded-xl transition-colors"
                                                    title="Review Detail"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                                <button 
                                                    onClick={() => handleApproveReturn(ret)}
                                                    disabled={processingId === ret.id}
                                                    className="p-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-xl transition-colors disabled:opacity-50"
                                                    title="Terima (ACC)"
                                                >
                                                    {processingId === ret.id ? <Loader2 size={18} className="animate-spin" /> : <FileCheck size={18} />}
                                                </button>
                                                <button 
                                                    onClick={() => handleRejectReturn(ret)}
                                                    disabled={processingId === ret.id}
                                                    className="p-2 bg-rose-100 text-rose-700 hover:bg-rose-600 hover:text-white rounded-xl transition-colors disabled:opacity-50"
                                                    title="Tolak Pengembalian"
                                                >
                                                    {processingId === ret.id ? <Loader2 size={18} className="animate-spin" /> : <X size={18} />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-8 bg-indigo-50 rounded-[2.5rem] border border-indigo-100 flex items-start gap-4">
                    <div className="p-3 bg-white text-indigo-600 rounded-2xl shadow-sm"><Info size={24} /></div>
                    <div>
                        <h4 className="font-black text-slate-900 uppercase text-xs tracking-widest mb-2">Informasi Saldo</h4>
                        <p className="text-sm text-slate-600 leading-relaxed font-semibold">
                            "Saldo Kas di Tangan" adalah dana yang sudah diajukan dan telah disetujui (ACC) oleh Superadmin, dikurangi dengan laporan realisasi pengeluaran yang dicatat.
                        </p>
                    </div>
                </div>
                <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 flex items-start gap-4">
                    <div className="p-3 bg-white text-slate-400 rounded-2xl shadow-sm"><HelpCircle size={24} /></div>
                    <div>
                        <h4 className="font-black text-slate-900 uppercase text-xs tracking-widest mb-2">Pencatatan Realisasi</h4>
                        <p className="text-sm text-slate-500 leading-relaxed font-semibold">
                            Pastikan segera mencatat pengeluaran di menu Laporan Realisasi agar sisa saldo kas selalu akurat dan up-to-date.
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Modal Pengajuan Pengembalian Dana */}
            {showReturnModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="font-black text-slate-800 flex items-center gap-2">
                                <HandCoins className="text-indigo-600" size={20} /> Ajukan Pengembalian Saldo
                            </h3>
                            <button onClick={() => setShowReturnModal(false)} className="text-slate-400 hover:bg-slate-200 p-2 rounded-xl transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-6">
                            <form onSubmit={handleSubmitReturn} className="space-y-5">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Nominal Dikembalikan</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">Rp</span>
                                        <input 
                                            type="number" 
                                            value={returnForm.amount}
                                            onChange={e => setReturnForm({...returnForm, amount: e.target.value})}
                                            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-black text-slate-700 outline-none transition-all"
                                            placeholder="Contoh: 50000"
                                            required
                                            max={myBalance}
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-500 font-bold mt-2 px-1">Sisa Saldo Maksimal: <span className="text-indigo-600">{formatRupiah(myBalance)}</span></p>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Link / Teks Bukti Transfer</label>
                                    <input 
                                        type="text" 
                                        value={returnForm.buktiTeks}
                                        onChange={e => setReturnForm({...returnForm, buktiTeks: e.target.value})}
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-bold text-slate-700 outline-none transition-all"
                                        placeholder="Misal: Nomor Ref. Transfer / Link GDrive"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Keterangan Tambahan</label>
                                    <textarea 
                                        value={returnForm.description}
                                        onChange={e => setReturnForm({...returnForm, description: e.target.value})}
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-bold text-slate-700 outline-none transition-all resize-none h-24"
                                        placeholder="Penjelasan pengembalian dana..."
                                    />
                                </div>
                                <button 
                                    type="submit" 
                                    disabled={isSubmitting}
                                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-indigo-200 active:scale-95 flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                    <span>KIRIM PENGAJUAN</span>
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal Review Pengembalian (Superadmin) */}
            {reviewData && isSuperAdmin && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="font-black text-slate-800 flex items-center gap-2">
                                <Eye className="text-indigo-600" size={20} /> Review Pengembalian Dana
                            </h3>
                            <button onClick={() => setReviewData(null)} className="text-slate-400 hover:bg-slate-200 p-2 rounded-xl transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 text-center">
                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Nominal Dikembalikan</p>
                                <p className="text-4xl font-black text-indigo-700">{formatRupiah(parseFloat(reviewData.amount || 0))}</p>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Unit / Bidang</p>
                                    <p className="font-bold text-slate-700">
                                        {units.find(u => u.id === reviewData.unitId)?.name || fields.find(f => f.id === reviewData.fieldId)?.name || 'Unknown'}
                                    </p>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tanggal</p>
                                    <p className="font-bold text-slate-700">{reviewData.date}</p>
                                </div>
                            </div>

                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Keterangan</p>
                                <p className="font-bold text-slate-700">{reviewData.description || '-'}</p>
                            </div>

                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Bukti Transfer (Referensi / Link)</p>
                                {reviewData.buktiTeks ? (
                                    <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200">
                                        <UploadCloud size={20} className="text-indigo-500" />
                                        <span className="font-bold text-sm text-slate-600 break-all">{reviewData.buktiTeks}</span>
                                    </div>
                                ) : (
                                    <p className="font-bold text-slate-400 italic text-sm">Tidak ada bukti yang dilampirkan.</p>
                                )}
                            </div>

                            <div className="flex items-center gap-4 pt-4 border-t border-slate-100">
                                <button 
                                    onClick={() => handleRejectReturn(reviewData)}
                                    disabled={processingId === reviewData.id}
                                    className="flex-1 py-4 bg-rose-100 text-rose-700 hover:bg-rose-600 hover:text-white rounded-2xl font-black transition-all flex items-center justify-center gap-2"
                                >
                                    {processingId === reviewData.id ? <Loader2 size={18} className="animate-spin" /> : <X size={18} />} TOLAK
                                </button>
                                <button 
                                    onClick={() => handleApproveReturn(reviewData)}
                                    disabled={processingId === reviewData.id}
                                    className="flex-1 py-4 bg-emerald-500 text-white hover:bg-emerald-600 rounded-2xl font-black transition-all shadow-lg shadow-emerald-200 active:scale-95 flex items-center justify-center gap-2"
                                >
                                    {processingId === reviewData.id ? <Loader2 size={18} className="animate-spin" /> : <FileCheck size={18} />} SETUJUI (ACC)
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
