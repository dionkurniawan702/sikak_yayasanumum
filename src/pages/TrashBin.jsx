import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatRupiah, formatTanggal } from '../utils/format';
import { Trash2, RotateCcw, AlertTriangle, Archive, FileText, BookOpen, HardDrive, List, User, X, Check, Building2, Layers, Coins, Wallet, Users, GraduationCap } from 'lucide-react';
import { api } from '../services/api';

export default function TrashBin() {
    const { state, dispatch } = useApp();

    const deletedJournals = (state.journals || []).filter(j => j.isDeleted);
    const deletedAccounts = (state.accounts || []).filter(a => a.isDeleted);
    const deletedAssets = (state.assets || []).filter(a => a.isDeleted && !a._deletedByJournal);
    const deletedPrograms = (state.programs || []).filter(p => p.isDeleted);
    const deletedExpensePrograms = (state.expensePrograms || []).filter(p => p.isDeleted);
    const deletedUsers = (state.users || []).filter(u => u.isDeleted);
    const deletedUnits = (state.units || []).filter(u => u.isDeleted);
    const deletedFields = (state.fields || []).filter(f => f.isDeleted);
    const deletedIncomeItems = (state.incomeItems || []).filter(i => i.isDeleted);
    const deletedExpenseItems = (state.expenseItems || []).filter(e => e.isDeleted);
    const deletedStudents = (state.students || []).filter(s => s.isDeleted);
    const deletedClasses = (state.classes || []).filter(c => c.isDeleted);
    const deletedClassGroups = (state.classGroups || []).filter(g => g.isDeleted);
    const deletedPositions = (state.positions || []).filter(p => p.isDeleted);
    const deletedStudentStatuses = (state.studentStatuses || []).filter(s => s.isDeleted);
    const deletedParentStatuses = (state.parentStatuses || []).filter(p => p.isDeleted);
    const deletedBosStages = (state.bosStages || []).filter(b => b.isDeleted);
    const deletedBosPos = (state.bosPosList || []).filter(b => b.isDeleted);

    const allDeletedItems = [
        ...deletedJournals.map(j => ({ ...j, _type: 'journal' })),
        ...deletedAccounts.map(a => ({ ...a, _type: 'account' })),
        ...deletedAssets.map(a => ({ ...a, _type: 'asset' })),
        ...deletedPrograms.map(p => ({ ...p, _type: 'program' })),
        ...deletedExpensePrograms.map(p => ({ ...p, _type: 'program' })),
        ...deletedUsers.map(u => ({ ...u, _type: 'user' })),
        ...deletedUnits.map(u => ({ ...u, _type: 'unit' })),
        ...deletedFields.map(f => ({ ...f, _type: 'field' })),
        ...deletedIncomeItems.map(i => ({ ...i, _type: 'income-item' })),
        ...deletedExpenseItems.map(e => ({ ...e, _type: 'expense-item' })),
        ...deletedStudents.map(s => ({ ...s, _type: 'student' })),
        ...deletedClasses.map(c => ({ ...c, _type: 'class' })),
        ...deletedClassGroups.map(g => ({ ...g, _type: 'class-group' })),
        ...deletedPositions.map(p => ({ ...p, _type: 'position' })),
        ...deletedStudentStatuses.map(s => ({ ...s, _type: 'student-status' })),
        ...deletedParentStatuses.map(p => ({ ...p, _type: 'parent-status' })),
        ...deletedBosStages.map(b => ({ ...b, _type: 'bos-stage' })),
        ...deletedBosPos.map(b => ({ ...b, _type: 'bos-pos' })),
    ].sort((a, b) => new Date(b.deletedAt || 0) - new Date(a.deletedAt || 0));

    const totalCount = allDeletedItems.length;

    const filteredItems = allDeletedItems;

    const handleRestore = async (id, type) => {
        dispatch({ type: 'RESTORE_FROM_TRASH', payload: { id, type } });
        await api.pushAction({ type: 'RESTORE_FROM_TRASH', payload: { id, type } }, state);
    };

    const handlePermanentDelete = async (id, type) => {
        if (window.confirm('PERINGATAN: Data yang dihapus permanen tidak bisa dikembalikan. Lanjutkan?')) {
            try {
                dispatch({ type: 'PERMANENT_DELETE', payload: { id, type } });
                await api.pushAction({ type: 'PERMANENT_DELETE', payload: { id, type } }, state);
                window.alert('Data berhasil dihapus permanen dari database.');
            } catch (err) {
                console.error('Delete failed:', err.message);
                window.alert(`Gagal menghapus permanen: ${err.message}. Pastikan data ini tidak memiliki ketergantungan (misal: Unit di dalam Bidang).`);
            }
        }
    };

    const handleEmptyTrash = async () => {
        if (window.confirm('PERINGATAN: Semua data di tempat sampah akan dihapus permanen dan tidak bisa dikembalikan. Lanjutkan?')) {
            dispatch({ type: 'EMPTY_TRASH' });
            await api.pushAction({ type: 'EMPTY_TRASH' }, state);
            window.alert('Tempat sampah berhasil dikosongkan.');
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
                        className="flex items-center gap-3 px-6 py-4 bg-rose-600 text-white rounded-2xl hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 active:scale-95 group font-black text-xs uppercase tracking-widest"
                    >
                        <Trash2 size={18} className="group-hover:rotate-12 transition-transform" />
                        <span>Hapus Semua Permanen</span>
                    </button>
                )}
            </div>


            <div className="animate-in">
                {filteredItems.length === 0 ? (
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

            
            <div className="mt-20 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest italic">
                SIKAK YAYASAN UMUM — INTERNAL DATA RECOVERY CONSOLE
            </div>
        </div>
    );
}
