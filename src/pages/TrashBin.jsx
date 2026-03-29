import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatRupiah, formatTanggal } from '../utils/format';
import { Trash2, RotateCcw, AlertTriangle, Archive, FileText, BookOpen, HardDrive, List, User, X, Check } from 'lucide-react';

export default function TrashBin() {
    const { state, dispatch } = useApp();
    const [activeTab, setActiveTab] = useState('all');

    const deletedJournals = state.journals.filter(j => j.isDeleted);
    const deletedAccounts = state.accounts.filter(a => a.isDeleted);
    const deletedAssets = state.assets.filter(a => a.isDeleted && !a._deletedByJournal);
    const deletedPrograms = state.programs.filter(p => p.isDeleted);
    const deletedUsers = state.users.filter(u => u.isDeleted);

    const allDeletedItems = [
        ...deletedJournals.map(j => ({ ...j, _type: 'journal' })),
        ...deletedAccounts.map(a => ({ ...a, _type: 'account' })),
        ...deletedAssets.map(a => ({ ...a, _type: 'asset' })),
        ...deletedPrograms.map(p => ({ ...p, _type: 'program' })),
        ...deletedUsers.map(u => ({ ...u, _type: 'user' })),
    ].sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));

    const totalCount = allDeletedItems.length;

    const filteredItems = activeTab === 'all'
        ? allDeletedItems
        : allDeletedItems.filter(item => item._type === activeTab);

    const handleRestore = (id, type) => {
        dispatch({ type: 'RESTORE_FROM_TRASH', payload: { id, type } });
    };

    const handlePermanentDelete = (id, type) => {
        if (window.confirm('PERINGATAN: Data yang dihapus permanen tidak bisa dikembalikan. Lanjutkan?')) {
            dispatch({ type: 'PERMANENT_DELETE', payload: { id, type } });
        }
    };

    const handleEmptyTrash = () => {
        if (window.confirm('PERINGATAN: Semua data di tempat sampah akan dihapus permanen dan tidak bisa dikembalikan. Lanjutkan?')) {
            dispatch({ type: 'EMPTY_TRASH' });
        }
    };

    const getItemLabel = (type) => {
        const labels = { journal: 'Jurnal', account: 'Akun', asset: 'Aset', program: 'Program', user: 'User' };
        return labels[type] || type;
    };

    const getItemIcon = (type) => {
        const icons = { journal: FileText, account: BookOpen, asset: HardDrive, program: List, user: User };
        return icons[type] || Archive;
    };

    const getItemName = (item) => {
        switch (item._type) {
            case 'journal':
                return `${item.description || 'Jurnal'} — ${formatTanggal(item.date)}`;
            case 'account':
                return `${item.code} — ${item.name}`;
            case 'asset':
                return item.name;
            case 'program':
                return item.name;
            case 'user':
                return `${item.name} (${item.username})`;
            default:
                return item.id;
        }
    };

    const getItemDetail = (item) => {
        switch (item._type) {
            case 'journal': {
                const totalDebit = item.entries?.reduce((s, e) => s + (e.debit || 0), 0) || 0;
                return `Total Transaksi: ${formatRupiah(totalDebit)}`;
            }
            case 'account':
                return `Klasifikasi: ${item.type} | Dana: ${item.fund}`;
            case 'asset':
                return `Kategori: ${item.category} | Nilai: ${formatRupiah(item.cost)}`;
            case 'program':
                return item.description || 'Tanpa Deskripsi';
            case 'user':
                return `Hak Akses: ${item.role}`;
            default:
                return '';
        }
    };

    const tabs = [
        { key: 'all', label: 'Semua', count: totalCount },
        { key: 'journal', label: 'Jurnal', count: deletedJournals.length, icon: FileText },
        { key: 'account', label: 'Akun', count: deletedAccounts.length, icon: BookOpen },
        { key: 'asset', label: 'Aset', count: deletedAssets.length, icon: HardDrive },
        { key: 'program', label: 'Program', count: deletedPrograms.length, icon: List },
        { key: 'user', label: 'User', count: deletedUsers.length, icon: User },
    ];

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-12">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight italic">Tempat Sampah</h2>
                    <p className="text-slate-500 font-medium">Data yang baru saja dihapus dapat dipulihkan di sini</p>
                </div>
                {totalCount > 0 && (
                    <button onClick={handleEmptyTrash} className="btn-icon p-4 bg-rose-50 text-rose-500 rounded-2xl hover:bg-rose-500 hover:text-white transition-all shadow-sm">
                        <Trash2 size={24} />
                    </button>
                )}
            </div>

            <div className="flex gap-4 p-2 bg-slate-100 rounded-[24px] mb-8 overflow-x-auto print:hidden no-scrollbar">
                {tabs.map(tab => (
                    <button 
                        key={tab.key} 
                        onClick={() => setActiveTab(tab.key)} 
                        className={`flex items-center gap-3 px-6 py-3 rounded-[20px] font-black text-xs uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab.key ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        {tab.icon && <tab.icon size={16} />}
                        {tab.label}
                        <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] ${activeTab === tab.key ? 'bg-blue-50 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>{tab.count}</span>
                    </button>
                ))}
            </div>

            <div className="animate-in">
                {filteredItems.length === 0 ? (
                    <div className="p-24 text-center bg-white rounded-[40px] border border-slate-100 shadow-xl flex flex-col items-center">
                        <div className="w-24 h-24 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center mb-6 shadow-inner">
                            <Archive size={48} />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic">Tempat Sampah Kosong</h3>
                        <p className="text-sm font-medium text-slate-400 max-w-xs mt-2 italic">Belum ada data yang dihapus untuk kategori ini.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {filteredItems.map(item => {
                            const Icon = getItemIcon(item._type);
                            return (
                                <div key={`${item._type}-${item.id}`} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl hover:border-blue-200 transition-all flex flex-col justify-between group">
                                    <div className="flex items-start gap-4 mb-6">
                                        <div className="w-14 h-14 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner">
                                            <Icon size={28} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="px-2 py-0.5 bg-slate-100 text-slate-400 rounded-lg text-[8px] font-black uppercase tracking-widest">{getItemLabel(item._type)}</span>
                                                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{formatTanggal(item.deletedAt)}</span>
                                            </div>
                                            <h4 className="font-black text-slate-900 italic text-lg leading-tight uppercase truncate">{getItemName(item)}</h4>
                                            <p className="text-xs font-medium text-slate-400 italic truncate mt-1">{getItemDetail(item)}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3 justify-end pt-5 border-t border-slate-50">
                                        <button onClick={() => handleRestore(item.id, item._type)} className="flex-1 py-3 bg-emerald-50 text-emerald-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all shadow-sm flex items-center justify-center gap-2">
                                            <RotateCcw size={14} /> Pulihkan
                                        </button>
                                        <button onClick={() => handlePermanentDelete(item.id, item._type)} className="flex-1 py-3 bg-rose-50 text-rose-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all shadow-sm flex items-center justify-center gap-2">
                                            <Trash2 size={14} /> Hapus Permanen
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="mt-12 p-8 bg-blue-50 rounded-[32px] border border-blue-100 flex items-center gap-6 shadow-inner animate-in">
                <div className="p-4 bg-white rounded-2xl text-blue-600 shadow-sm">
                    <AlertTriangle size={24} />
                </div>
                <div>
                    <h4 className="font-black text-blue-900 uppercase text-xs tracking-widest">Manajemen Penyimpanan Internal</h4>
                    <p className="text-[10px] text-blue-700 font-bold leading-relaxed mt-1 uppercase italic tracking-wider">Data di tempat sampah masih memakan ruang memori. Hapus permanen secara berkala untuk optimalisasi performa basis data yayasan.</p>
                </div>
            </div>
            
            <div className="mt-20 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest italic">
                SIKAK YAYASAN UMUM — INTERNAL DATA RECOVERY CONSOLE
            </div>
        </div>
    );
}
