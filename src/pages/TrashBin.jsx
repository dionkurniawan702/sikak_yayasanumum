import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { formatRupiah, formatTanggal } from '../utils/format';
import { Trash2, RotateCcw, AlertTriangle, Archive, FileText, BookOpen, HardDrive, List, User, X, Check, Building2, Layers, Coins, Wallet, Users, GraduationCap, Briefcase, UserCheck, UserCircle, Calendar } from 'lucide-react';
import { api } from '../services/api';

export default function TrashBin() {
    const { state, dispatch } = useApp();
    const [trashItems, setTrashItems] = useState([]);
    const [isLoadingData, setIsLoadingData] = useState(true);

    const fetchTrash = async () => {
        setIsLoadingData(true);
        try {
            const data = await api.getTrashItems();
            setTrashItems(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to fetch trash:', err.message);
        } finally {
            setIsLoadingData(false);
        }
    };

    useEffect(() => {
        fetchTrash();
    }, []);

    // Combine server-fetched trash with local state isDeleted items 
    // (though server items are now primary as we filter them out of main sync)
    const allDeletedItems = [
        ...trashItems
    ].sort((a, b) => new Date(b.deletedAt || 0) - new Date(a.deletedAt || 0));

    const totalCount = allDeletedItems.length;

    const filteredItems = allDeletedItems;

    const [loadingId, setLoadingId] = useState(null);
    const [isEmptying, setIsEmptying] = useState(false);

    const handleRestore = async (id, type) => {
        try {
            await api.pushAction({ type: 'RESTORE_FROM_TRASH', payload: { id, type } }, state);
            dispatch({ type: 'RESTORE_FROM_TRASH', payload: { id, type } });
            await fetchTrash();
        } catch (err) {
            console.error('Restore failed:', err.message);
            window.alert(`Gagal memulihkan: ${err.message}`);
        }
    };

    const handlePermanentDelete = async (id, type) => {
        if (window.confirm('PERINGATAN: Data yang dihapus permanen tidak bisa dikembalikan. Lanjutkan?')) {
            setLoadingId(id);
            try {
                // Ensure server deletion succeeds BEFORE removing from local state
                await api.pushAction({ type: 'PERMANENT_DELETE', payload: { id, type } }, state);
                dispatch({ type: 'PERMANENT_DELETE', payload: { id, type } });
                await fetchTrash();
                window.alert('Data berhasil dihapus permanen dari database.');
            } catch (err) {
                console.error('Delete failed:', err.message);
                window.alert(`Gagal menghapus permanen: ${err.message}. Pastikan data ini tidak memiliki ketergantungan (misal: Unit di dalam Bidang atau Tahap BOS yang masih memiliki Rencana Anggaran).`);
            } finally {
                setLoadingId(null);
            }
        }
    };

    const handleEmptyTrash = async () => {
        if (window.confirm('PERINGATAN: Semua data di tempat sampah akan dihapus permanen dan tidak bisa dikembalikan. Lanjutkan?')) {
            setIsEmptying(true);
            try {
                await api.pushAction({ type: 'EMPTY_TRASH' }, state);
                dispatch({ type: 'EMPTY_TRASH' });
                await fetchTrash();
                window.alert('Tempat sampah berhasil dikosongkan.');
            } catch (err) {
                window.alert('Gagal mengosongkan tempat sampah: ' + err.message);
            } finally {
                setIsEmptying(false);
            }
        }
    };

    const getItemLabel = (type) => {
        const labels = { 
            journal: 'Jurnal', 
            account: 'Akun', 
            asset: 'Aset', 
            program: 'Program', 
            user: 'User',
            unit: 'Unit',
            field: 'Bidang',
            student: 'Siswa',
            class: 'Kelas',
            'income-item': 'Pendapatan',
            'expense-item': 'Beban',
            'class-group': 'Grup Kelas',
            'position': 'Jabatan',
            'student-status': 'Status Siswa',
            'parent-status': 'Status Ortu',
            'bos-stage': 'Tahap BOS',
            'bos-pos': 'Pos BOS'
        };
        return labels[type] || type;
    };

    const getItemIcon = (type) => {
        const icons = { 
            journal: FileText, 
            account: BookOpen, 
            asset: HardDrive, 
            program: List, 
            user: User,
            unit: Building2,
            field: Layers,
            student: GraduationCap,
            class: Users,
            'income-item': Coins,
            'expense-item': Wallet,
            'class-group': Layers,
            'position': Briefcase,
            'student-status': UserCheck,
            'parent-status': UserCircle,
            'bos-stage': Calendar,
            'bos-pos': List
        };
        return icons[type] || Archive;
    };

    const getItemName = (item) => {
        switch (item._type) {
            case 'journal':
                return `${item.description || 'Jurnal'} — ${formatTanggal(item.date)}`;
            case 'account':
                return `${item.code} — ${item.name}`;
            case 'asset':
            case 'program':
            case 'user':
            case 'unit':
            case 'field':
            case 'student':
            case 'class':
            case 'income-item':
            case 'expense-item':
            case 'class-group':
            case 'position':
            case 'student-status':
            case 'parent-status':
            case 'bos-stage':
            case 'bos-pos':
                return item.name;
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
            case 'unit':
                return `Unit ID: ${item.id}`;
            case 'field':
                return `Bidang ID: ${item.id}`;
            case 'student':
                return `NISN: ${item.nisn} | Kelas: ${item.classId}`;
            case 'class':
                return `Unit: ${item.unitId}`;
            default:
                return '';
        }
    };


    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-12">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight italic">Tempat Sampah</h2>
                    <p className="text-slate-500 font-medium">Data yang baru saja dihapus dapat dipulihkan di sini</p>
                </div>
                {totalCount > 0 && (
                    <button 
                        onClick={handleEmptyTrash} 
                        disabled={isEmptying}
                        className={`flex items-center gap-3 px-6 py-4 rounded-2xl transition-all shadow-lg shadow-rose-200 group font-black text-xs uppercase tracking-widest ${isEmptying ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-rose-600 text-white hover:bg-rose-700 active:scale-95'}`}
                    >
                        {isEmptying ? (
                            <div className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <Trash2 size={18} className="group-hover:rotate-12 transition-transform" />
                        )}
                        <span>{isEmptying ? 'Menghapus...' : 'Hapus Semua Permanen'}</span>
                    </button>
                )}
            </div>


            <div className="animate-in">
                {isLoadingData ? (
                    <div className="p-24 text-center bg-white rounded-[40px] border border-slate-100 shadow-xl flex flex-col items-center">
                        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest italic animate-pulse">Memuat data sampah...</p>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="p-24 text-center bg-white rounded-[40px] border border-slate-100 shadow-xl flex flex-col items-center">
                        <div className="w-24 h-24 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center mb-6 shadow-inner">
                            <Archive size={48} />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic">Tempat Sampah Kosong</h3>
                        <p className="text-sm font-medium text-slate-400 max-w-xs mt-2 italic">Data yang Anda hapus akan muncul di sini.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {filteredItems.map(item => {
                            const Icon = getItemIcon(item._type);
                            const isLoading = loadingId === item.id;
                            return (
                                <div key={`${item._type}-${item.id}`} className={`bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl transition-all flex flex-col justify-between group ${isLoading ? 'opacity-50' : 'hover:border-blue-200'}`}>
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
                                        <button disabled={isLoading} onClick={() => handleRestore(item.id, item._type)} className="flex-1 py-3 bg-emerald-50 text-emerald-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                                            <RotateCcw size={14} /> Pulihkan
                                        </button>
                                        <button disabled={isLoading} onClick={() => handlePermanentDelete(item.id, item._type)} className="flex-1 py-3 bg-rose-50 text-rose-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                                            {isLoading ? (
                                                <div className="w-3 h-3 border-2 border-rose-600 border-t-transparent rounded-full animate-spin"></div>
                                            ) : (
                                                <Trash2 size={14} /> 
                                            )}
                                            {isLoading ? 'Menghapus...' : 'Hapus Permanen'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            
            <div className="mt-20 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest italic">
                SIKAD DARELIMAN — INTERNAL DATA RECOVERY CONSOLE
            </div>
        </div>
    );
}
