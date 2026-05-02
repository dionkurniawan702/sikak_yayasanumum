import { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { hitungSaldoAkun } from '../utils/accounting';
import { formatRupiah, formatTanggal } from '../utils/format';
import {
    Filter, Download, Printer, LayoutGrid, List, Wallet,
    ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, FileText, X, Search, Calendar
} from 'lucide-react';
import CurrencyDisplay from '../components/CurrencyDisplay';

export default function ProgramReport() {
    const { state } = useApp();
    const journals = state.journals.filter(j => !j.isDeleted);
    const accounts = state.accounts.filter(a => !a.isDeleted);
    const programs = state.programs.filter(p => !p.isDeleted);
    const assets = state.assets.filter(a => !a.isDeleted);
    const reportRef = useRef(null);

    const curYear = new Date().getFullYear();
    const defaultStart = `${curYear}-01-01`;
    const defaultEnd = new Date().toISOString().split('T')[0];

    const [programFilters, setProgramFilters] = useState(
        programs.reduce((acc, p) => ({
            ...acc,
            [p.id]: { start: defaultStart, end: defaultEnd }
        }), {})
    );

    const [viewMode, setViewMode] = useState('grid');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProgramLedger, setSelectedProgramLedger] = useState(null);

    const updateFilter = (id, field, value) => {
        setProgramFilters(prev => ({
            ...prev,
            [id]: { ...prev[id], [field]: value }
        }));
    };

    const programSummary = programs.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).map(program => {
        const filter = programFilters[program.id] || { start: defaultStart, end: defaultEnd };

        const aggregate = (type, codes, normal) => {
            const matchingIds = accounts
                .filter(a => a.type === type && codes.some(c => a.code.startsWith(c)))
                .map(a => a.id);

            let total = 0;
            journals.forEach(journal => {
                const jDateOnly = journal.date ? journal.date.substring(0, 10) : '';
                if (filter.start && jDateOnly < filter.start) return;
                if (filter.end && jDateOnly > filter.end) return;
                if (journal.programId !== program.id) return;

                journal.entries.forEach(entry => {
                    if (matchingIds.includes(entry.accountId)) {
                        if (normal === 'kredit') {
                            total += (entry.credit || 0) - (entry.debit || 0);
                        } else {
                            total += (entry.debit || 0) - (entry.credit || 0);
                        }
                    }
                });
            });
            return total;
        };

        const donasiMasuk = aggregate('Pendapatan', ['4-1', '4-2'], 'kredit');
        const penyaluranSosial = aggregate('Beban', ['5-1'], 'debit');
        const bebanOperasional = aggregate('Beban', ['6-1'], 'debit');
        const bebanLainnya = aggregate('Beban', ['5-2', '5-8'], 'debit'); // Reserve for future categories

        const totalDonasi = (program.initialDonationBalance || 0) + donasiMasuk;
        const totalNetoProgram = totalDonasi - (penyaluranSosial + bebanOperasional + bebanLainnya);

        return {
            ...program,
            donasiMasuk,
            penyaluranSosial,
            bebanOperasional,
            bebanLainnya,
            totalSaldo: totalNetoProgram
        };
    });

    const getProgramLedger = (programId) => {
        return journals
            .filter(j => j.programId === programId)
            .sort((a, b) => new Date(a.date) - new Date(b.date));
    };

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-8 print:hidden">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Laporan Per Program</h2>
                    <p className="text-slate-500 font-medium tracking-tight">Analisis performa dan penggunaan dana per kegiatan yayasan</p>
                </div>
                <div className="flex gap-4">
                    <div className="flex bg-slate-100 p-1 rounded-2xl">
                        <button onClick={() => setViewMode('grid')} className={`p-2 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}><LayoutGrid size={18}/></button>
                        <button onClick={() => setViewMode('table')} className={`p-2 rounded-xl transition-all ${viewMode === 'table' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}><List size={18}/></button>
                    </div>
                    <button onClick={() => window.print()} className="btn btn-primary px-8 py-3 rounded-2xl shadow-xl shadow-blue-500/20 font-black">
                        <Printer size={18} /> Cetak Laporan
                    </button>
                </div>
            </div>

            <div className="mb-8 print:hidden flex gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 flex-1">
                    <Search size={18} className="text-slate-400 ml-2" />
                    <input className="flex-1 bg-transparent border-none outline-none text-sm font-medium" placeholder="Cari program untuk dianalisis..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
            </div>

            <div className="animate-in" ref={reportRef}>
                <div className="hidden print:block text-center mb-12">
                    <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">SIKAD DARELIMAN</h1>
                    <h2 className="text-xl font-bold text-slate-600">LAPORAN REALISASI PROGRAM</h2>
                    <p className="text-xs font-black text-slate-300 tracking-[0.3em] uppercase mt-2">Periode Konsolidasi Program Tahun {curYear}</p>
                </div>

                {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {programSummary.map(p => (
                            <div key={p.id} className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-xl overflow-hidden group hover:border-blue-200 transition-all flex flex-col">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="space-y-1">
                                        <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[9px] font-black uppercase tracking-widest">{p.category}</span>
                                        <h3 className="text-2xl font-black text-slate-900 group-hover:text-blue-600 transition-colors uppercase leading-tight italic">{p.name}</h3>
                                        <p className="text-[10px] font-bold text-slate-300 tracking-widest uppercase">{p.id}</p>
                                    </div>
                                    <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner">
                                        <Wallet size={28} />
                                    </div>
                                </div>

                                {/* Filter Per Program */}
                                <div className="flex gap-4 p-4 bg-slate-50 rounded-2xl mb-8 print:hidden">
                                     <div className="flex-1 space-y-1">
                                         <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block pl-1">Dari</label>
                                         <input type="date" className="w-full bg-white border-none rounded-xl text-[11px] font-bold p-2 text-slate-600" value={programFilters[p.id]?.start} onChange={e => updateFilter(p.id, 'start', e.target.value)} />
                                     </div>
                                     <div className="flex-1 space-y-1">
                                         <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block pl-1">Sampai</label>
                                         <input type="date" className="w-full bg-white border-none rounded-xl text-[11px] font-bold p-2 text-slate-600" value={programFilters[p.id]?.end} onChange={e => updateFilter(p.id, 'end', e.target.value)} />
                                     </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-8">
                                    <div className="p-5 bg-white border border-slate-100 rounded-3xl space-y-1">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <ArrowUpRight size={12} className="text-emerald-500" /> Penerimaan
                                        </p>
                                        <p className="text-lg font-black text-slate-900 tracking-tighter"><CurrencyDisplay value={p.donasiMasuk + (p.initialDonationBalance || 0)} /></p>
                                    </div>
                                    <div className="p-5 bg-white border border-slate-100 rounded-3xl space-y-1">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <ArrowDownRight size={12} className="text-rose-500" /> Penyaluran
                                        </p>
                                        <p className="text-lg font-black text-slate-900 tracking-tighter"><CurrencyDisplay value={p.penyaluranSosial + p.bebanLainnya} /></p>
                                    </div>
                                </div>

                                <div className="mt-auto space-y-4">
                                     <div className="flex justify-between items-end border-t border-slate-100 pt-6">
                                         <div className="space-y-1">
                                             <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Netto Dana Program</p>
                                             <h4 className="text-3xl font-black text-slate-900 tracking-tighter"><CurrencyDisplay value={p.totalSaldo} useColor={p.totalSaldo < 0} /></h4>
                                         </div>
                                         <button onClick={() => setSelectedProgramLedger(p.id)} className="p-4 bg-slate-900 text-white rounded-2xl hover:bg-blue-600 transition-all print:hidden">
                                             <List size={20} />
                                         </button>
                                     </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-white rounded-[32px] border border-slate-100 shadow-xl overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                <tr>
                                    <th className="px-8 py-6">Nama Program</th>
                                    <th className="px-8 py-6 text-right">Saldo Awal</th>
                                    <th className="px-8 py-6 text-right">Donasi Masuk</th>
                                    <th className="px-8 py-6 text-right">Penyaluran</th>
                                    <th className="px-8 py-6 text-right">Saldo Akhir</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {programSummary.map(p => (
                                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-8 py-4 font-black text-slate-900 italic text-sm">{p.name}</td>
                                        <td className="px-8 py-4 text-right font-bold text-slate-400 text-sm"><CurrencyDisplay value={p.initialDonationBalance || 0} /></td>
                                        <td className="px-8 py-4 text-right font-black text-emerald-600 text-sm"><CurrencyDisplay value={p.donasiMasuk} /></td>
                                        <td className="px-8 py-4 text-right font-black text-rose-600 text-sm"><CurrencyDisplay value={p.penyaluranSosial + p.bebanLainnya} /></td>
                                        <td className="px-8 py-4 text-right font-black text-slate-900 border-l border-slate-50 text-sm"><CurrencyDisplay value={p.totalSaldo} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Ledger Modal */}
            {selectedProgramLedger && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl z-[100] flex items-center justify-center p-8" onClick={() => setSelectedProgramLedger(null)}>
                    <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[40px] shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight italic">RINCIAN AKTIVITAS PROGRAM</h3>
                                <p className="text-sm font-medium text-slate-400 tracking-tight">{programs.find(p => p.id === selectedProgramLedger)?.name}</p>
                            </div>
                            <button onClick={() => setSelectedProgramLedger(null)} className="p-3 bg-white rounded-2xl shadow-sm text-slate-400 hover:text-rose-500 transition-all"><X size={24}/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8">
                            <table className="w-full text-left">
                                <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                    <tr>
                                        <th className="px-4 py-4">Tanggal</th>
                                        <th className="px-4 py-4">Uraian Transaksi</th>
                                        <th className="px-4 py-4 text-right">Debit</th>
                                        <th className="px-4 py-4 text-right">Kredit</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {getProgramLedger(selectedProgramLedger).map(j => (
                                        <tr key={j.id} className="hover:bg-slate-50/30 transition-colors">
                                            <td className="px-4 py-4 text-xs font-bold text-slate-400">{j.date}</td>
                                            <td className="px-4 py-4 text-sm font-medium text-slate-700">{j.description}</td>
                                            <td className="px-4 py-4 text-right font-bold text-slate-800"><CurrencyDisplay value={j.entries.reduce((s, e) => s + (e.debit || 0), 0)} useColor={false} /></td>
                                            <td className="px-4 py-4 text-right font-bold text-slate-800"><CurrencyDisplay value={j.entries.reduce((s, e) => s + (e.credit || 0), 0)} useColor={false} /></td>
                                        </tr>
                                    ))}
                                    {getProgramLedger(selectedProgramLedger).length === 0 && (
                                        <tr><td colSpan={4} className="py-20 text-center font-bold text-slate-300 italic">Belum ada aktivitas terekam untuk program ini</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
