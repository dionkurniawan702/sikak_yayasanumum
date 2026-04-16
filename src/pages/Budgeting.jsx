import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { formatRupiah } from '../utils/format';
import { Target, Search, Save, Info, RefreshCw, X } from 'lucide-react';

export default function Budgeting() {
    const { state, dispatch } = useApp();
    const accounts = state.accounts.filter(a => !a.isDeleted);
    const budgets = state.budgets || [];
    
    const sortedYearsCurrent = [...(state.academicYears || [])].filter(ay => !ay.isDeleted).sort((a, b) => b.name.localeCompare(a.name));
    const initialYear = sortedYearsCurrent[0]?.name || new Date().getFullYear().toString();
    
    const [selectedYear, setSelectedYear] = useState(initialYear);
    const [showAllYears, setShowAllYears] = useState(false);
    const [search, setSearch] = useState('');
    const [budgetData, setBudgetData] = useState({});
    const [isSaving, setIsSaving] = useState(false);

    const budgetableAccounts = accounts.filter(a => 
        (a.type === 'Pendapatan' || a.type === 'Beban') && a.category === 'detail'
    ).sort((a, b) => a.code.localeCompare(b.code));

    const filteredAccounts = budgetableAccounts.filter(a => 
        !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.code.includes(search)
    );

    useEffect(() => {
        const yearBudgets = budgets.filter(b => b.year === selectedYear && !b.isDeleted);
        const newDict = {};
        yearBudgets.forEach(b => {
            newDict[b.accountId] = b.amount;
        });
        setBudgetData(newDict);
    }, [selectedYear, budgets]);

    const handleAmountChange = (accountId, value) => {
        setBudgetData(prev => ({
            ...prev,
            [accountId]: parseFloat(value) || 0
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        const newBudgets = Object.keys(budgetData).map(accountId => ({
            accountId,
            year: selectedYear,
            amount: budgetData[accountId]
        }));
        
        dispatch({
            type: 'SET_BUDGETS',
            payload: newBudgets
        });

        setTimeout(() => setIsSaving(false), 800);
    };

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight italic">Manajemen Anggaran</h2>
                    <p className="text-slate-500 font-medium">Pengendalian Pendapatan & Beban Yayasan</p>
                </div>
                <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="btn btn-primary px-10 py-3 rounded-2xl shadow-xl shadow-blue-500/20 font-black tracking-tight"
                >
                    {isSaving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />} {isSaving ? 'Menyimpan...' : 'SIMPAN ANGGARAN'}
                </button>
            </div>

            <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl mb-8 flex flex-wrap items-center gap-6 animate-in">
                <div className="flex-1 min-w-[300px] relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={20} />
                    <input className="w-full bg-slate-50 border-none pl-12 pr-4 py-3 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-blue-500 transition-all" placeholder="Cari akun rekening..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="flex items-center gap-4 bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100 italic font-black text-xs text-slate-400">
                    TAHUN ANGGARAN:
                    <div className="flex flex-col gap-1">
                        <select 
                            className="bg-transparent border-none text-blue-600 font-black focus:ring-0 cursor-pointer" 
                            value={selectedYear} 
                            onChange={e => setSelectedYear(e.target.value)}
                        >
                            {state.academicYears?.filter(y => y.isActive || y.name === selectedYear || showAllYears).map(y => (
                                <option key={y.id} value={y.name}>{y.name}</option>
                            ))}
                        </select>
                        <button 
                            onClick={() => setShowAllYears(!showAllYears)}
                            className="text-[8px] font-black text-blue-600 uppercase tracking-widest text-right hover:underline"
                        >
                            {showAllYears ? 'Sembunyikan' : 'Tampilkan Semua'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-blue-50 p-6 rounded-[32px] border border-blue-100 mb-8 flex gap-4 items-start shadow-inner animate-in">
                <div className="p-3 bg-white rounded-2xl text-blue-600 shadow-sm">
                    <Info size={20} />
                </div>
                <p className="text-[11px] text-blue-800 font-bold leading-relaxed uppercase tracking-wider">
                    Nilai anggaran yang diinput akan menjadi pembanding terhadap realisasi kas/bank di <strong>Laporan Budget vs Realisasi</strong>. Kosongkan jika tidak ada target spesifik.
                </p>
            </div>

            <div className="bg-white rounded-[40px] border border-slate-100 shadow-2xl overflow-hidden animate-in">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                        <tr>
                            <th className="px-10 py-6">Kode Akun</th>
                            <th className="px-10 py-6">Nama Akun</th>
                            <th className="px-10 py-6">Klasifikasi</th>
                            <th className="px-10 py-6 text-right">Nilai Anggaran (Rp)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredAccounts.map(acc => {
                            const amount = budgetData[acc.id] || 0;
                            return (
                                <tr key={acc.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-10 py-4 font-mono font-bold text-xs text-slate-400 italic">{acc.code}</td>
                                    <td className="px-10 py-4">
                                        <p className="font-black text-slate-900 text-sm leading-tight italic uppercase">{acc.name}</p>
                                    </td>
                                    <td className="px-10 py-4">
                                        <div className="flex gap-2">
                                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${acc.type === 'Pendapatan' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{acc.type}</span>
                                            <span className="px-3 py-1 bg-slate-100 text-slate-400 rounded-full text-[9px] font-black uppercase tracking-widest">{acc.fund}</span>
                                        </div>
                                    </td>
                                    <td className="px-10 py-4">
                                        <div className="flex justify-end items-center relative gap-3 group">
                                            <span className="text-[10px] font-black text-slate-300 opacity-0 group-focus-within:opacity-100 transition-opacity italic">RP</span>
                                            <input 
                                                type="number" 
                                                className="w-48 bg-slate-50 border-none text-right font-black text-slate-900 rounded-xl py-3 px-4 focus:ring-2 focus:ring-blue-500 transition-all italic text-sm"
                                                value={amount === 0 ? '' : amount}
                                                onChange={e => handleAmountChange(acc.id, e.target.value)}
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="mt-12 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">
                Data anggaran disimpan secara permanen di basis data yayasan
            </div>
        </div>
    );
}
