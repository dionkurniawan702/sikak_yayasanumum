import { NavLink, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, BookOpen, FileText, BookMarked,
    Scale, Building2, TrendingUp, Banknote, Landmark, HardDrive, RotateCcw, List, Wallet, Target, Lock,
    User, ShieldCheck, LogOut, Settings, Database, Trash2, Activity, Wifi, WifiOff, AlertCircle, Share2,
    History, Send, Users, Calendar, Layers, Briefcase, UserCheck, Heart, Receipt, Coins, HandCoins, CreditCard, Settings2, Archive
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { isRemote } from '../services/api';

export default function Sidebar({ isOpen, onClose }) {
    const { state, dispatch } = useApp();
    const { currentUser } = state;
    const navigate = useNavigate();

    let menuItems = [];

    const isSuperAdmin = currentUser?.role === 'superadmin';
    const isAdminField = currentUser?.role === 'admin_bidang';
    const isAdminUnit = currentUser?.role === 'admin_unit';

    if (isSuperAdmin) {
        menuItems = [
            { section: 'UTAMA' },
            { path: '/', label: 'Dashboard', icon: LayoutDashboard },
            { path: '/daftar-akun', label: 'Daftar Akun', icon: BookOpen },
            { path: '/aset-tetap', label: 'Database Aset', icon: HardDrive },
            { path: '/manajemen-program', label: 'Manajemen Program', icon: List },
            { path: '/manajemen-anggaran', label: 'Manajemen Anggaran', icon: Target },

            { section: 'ANGGARAN & PELAPORAN' },
            { path: '/pelaporan/dashboard', label: 'Dashboard Anggaran', icon: LayoutDashboard },
            { path: '/pelaporan/realisasi', label: 'Dashboard Realisasi', icon: TrendingUp },
            { path: '/pelaporan/bos', label: 'BOS', icon: Landmark },
            { path: '/pelaporan/saldo', label: 'Saldo', icon: Wallet },
            
            { section: 'PERENCANAAN (RAB)' },
            { path: '/anggaran/rab', label: 'RAB', icon: Target },
            { path: '/anggaran/arsip-rab', label: 'Arsip RAB', icon: Archive },
            { path: '/anggaran/distribusi', label: 'Setting Distribusi', icon: Share2 },

            { section: 'OPERASIONAL DANA' },
            { path: '/pelaporan/permintaan', label: 'Permintaan Dana', icon: Send },
            { path: '/pelaporan/arsip-permintaan', label: 'Arsip Permintaan', icon: History },
            { path: '/pelaporan/bulanan', label: 'Laporan Realisasi', icon: FileText },
            { path: '/pelaporan/arsip-laporan', label: 'Arsip Laporan', icon: BookMarked },
            { path: '/pelaporan/ketersediaan', label: 'Ketersediaan Dana', icon: Landmark },

            { section: 'DATABASE ANGGARAN' },
            { path: '/anggaran/siswa', label: 'Siswa / Pendapatan', icon: User },
            { path: '/anggaran/kelas', label: 'Kelas', icon: Users },


            { section: 'PENGATURAN ANGGARAN' },
            { path: '/anggaran/unit-bidang', label: 'Unit & Bidang', icon: Building2 },
            { path: '/anggaran/tahun-ajaran', label: 'Tahun Ajaran', icon: Calendar },
            { path: '/anggaran/set-jabatan', label: 'Set Jabatan', icon: Briefcase },
            { path: '/anggaran/status-siswa', label: 'Status Siswa', icon: UserCheck },
            { path: '/anggaran/status-ortu', label: 'Status Orang Tua', icon: Heart },
            { path: '/anggaran/item-penerimaan', label: 'Item Penerimaan', icon: Coins },
            { path: '/anggaran/item-pengeluaran', label: 'Item Pengeluaran', icon: Receipt },
            { path: '/anggaran/item-pengeluaran-bos', label: 'Item Pengeluaran BOS', icon: CreditCard },
            { path: '/anggaran/sumber-dana', label: 'Sumber Dana', icon: HandCoins },

            { section: 'TRANSAKSI AKUNTANSI' },
            { path: '/jurnal', label: 'Jurnal Umum', icon: FileText },
            { path: '/buku-besar', label: 'Buku Besar', icon: BookMarked },
            { path: '/tutup-buku', label: 'Tutup Buku (Closing)', icon: Lock },
            { section: 'LAPORAN KEUANGAN' },
            { path: '/neraca-saldo', label: 'Neraca Saldo', icon: Scale },
            { path: '/neraca', label: 'Posisi Keuangan', icon: Building2 },
            { path: '/laporan-aktivitas', label: 'Laporan Aktivitas', icon: TrendingUp },
            { path: '/realisasi-anggaran', label: 'Realisasi Anggaran', icon: Target },
            { path: '/arus-kas', label: 'Arus Kas', icon: Banknote },
            { path: '/perubahan-dana', label: 'Perubahan Aset Neto', icon: TrendingUp },
            { path: '/laporan-program', label: 'Laporan Per Program', icon: List },
            { path: '/calk', label: 'Catatan Laporan (CALK)', icon: FileText },
            { section: 'ADMINISTRASI SISTEM' },
            { path: '/pengaturan/backup-restore', label: 'Backup & Restore', icon: Database },
            { path: '/pengaturan/audit-log', label: 'Audit Log Sistem', icon: Activity },
            { path: '/pengaturan/tempat-sampah', label: 'Tempat Sampah', icon: Trash2 },
            { path: '/manajemen-user', label: 'Manajemen User', icon: ShieldCheck }
        ];
    } else if (isAdminField || isAdminUnit) {
        let isPendidikanKeuangan = false;
        if (isAdminField && state.fields) {
            const fieldName = state.fields.find(f => f.id === currentUser.fieldId)?.name?.toLowerCase() || '';
            isPendidikanKeuangan = fieldName.includes('pendidikan') || fieldName.includes('keuangan');
        }

        const showDatabaseItems = isAdminUnit || isPendidikanKeuangan;

        menuItems = [
            { section: 'ANGGARAN & PELAPORAN' },
            { path: '/pelaporan/dashboard', label: 'Dashboard Anggaran', icon: LayoutDashboard },
            { path: '/pelaporan/realisasi', label: 'Dashboard Realisasi', icon: TrendingUp },
            { path: '/pelaporan/bos', label: 'BOS', icon: Landmark },
            { path: '/pelaporan/saldo', label: 'Saldo', icon: Wallet },
            
            { section: 'PERENCANAAN (RAB)' },
            { path: '/anggaran/rab', label: 'RAB', icon: Target },
            { path: '/anggaran/arsip-rab', label: 'Arsip RAB', icon: Archive },

            { section: 'OPERASIONAL DANA' },
            { path: '/pelaporan/permintaan', label: 'Permintaan Dana', icon: Send },
            { path: '/pelaporan/arsip-permintaan', label: 'Arsip Permintaan', icon: History },
            { path: '/pelaporan/bulanan', label: 'Laporan Realisasi', icon: FileText },
            { path: '/pelaporan/arsip-laporan', label: 'Arsip Laporan', icon: BookMarked },
            { path: '/pelaporan/ketersediaan', label: 'Ketersediaan Dana', icon: Landmark }
        ];

        if (showDatabaseItems) {
            menuItems.push(
                { section: 'DATABASE ANGGARAN' },
                { path: '/anggaran/siswa', label: 'Siswa / Pendapatan', icon: User },
                { path: '/anggaran/kelas', label: 'Kelas', icon: Users }

            );
        }
    }

    const handleLogout = () => {
        if (window.confirm('Keluar dari sistem?')) {
            dispatch({ type: 'LOGOUT' });
            navigate('/login');
        }
    };

    return (
        <aside className={`sidebar fixed inset-y-0 bg-slate-900 w-72 z-[1000] lg:translate-x-0 transition-transform duration-300 flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="sidebar-brand p-8 border-b border-slate-800 shrink-0">
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">✦ SIKAK YAYASAN</h1>
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/10 rounded-xl shadow-inner backdrop-blur-sm border border-white/5">
                        <Landmark className="text-blue-200" size={24} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xl font-black text-white tracking-tight">SIKAK</span>
                        <span className="text-[10px] text-blue-200/60 font-bold uppercase tracking-[0.2em] -mt-1 line-clamp-1 italic">
                            YAYASAN UMUM
                        </span>
                    </div>
                </div>

                {/* Status Sinkronisasi */}
                <div className="mt-4 p-2 bg-slate-800/50 rounded-xl flex items-center gap-2">
                    {isRemote ? (
                        state.isOnline ? (
                            <>
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                <span className="text-[9px] font-bold text-emerald-500">SERVER CONNECTED</span>
                            </>
                        ) : (
                            <>
                                <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                                <span className="text-[9px] font-bold text-rose-500">SERVER DISCONNECTED</span>
                            </>
                        )
                    ) : (
                        <>
                            <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                            <span className="text-[9px] font-bold text-amber-500">LOCAL MODE</span>
                        </>
                    )}
                </div>
            </div>

            <div className="p-6 border-b border-slate-800 flex items-center gap-4 shrink-0">
                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-lg">👤</div>
                <div>
                    <p className="text-sm font-bold text-white">{currentUser?.name}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{currentUser?.role}</p>
                </div>
            </div>

            <nav className="flex-1 overflow-y-auto min-h-0 px-4 py-6 space-y-1 custom-scrollbar">
                {menuItems.map((item, idx) => {
                    if (item.section) {
                        return (
                            <div key={idx} className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-4 py-4 mt-2">
                                {item.section}
                            </div>
                        );
                    }
                    const Icon = item.icon;
                    return (
                        <NavLink
                            key={idx}
                            to={item.path}
                            className={({ isActive }) => `
                                flex items-center gap-3 px-4 py-3 rounded-xl transition-all
                                ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}
                            `}
                            end={item.path === '/'}
                        >
                            {Icon ? <Icon size={18} /> : <div className="w-[18px] h-[18px] bg-slate-800 rounded" />}
                            <span className="text-sm font-medium">{item.label}</span>
                        </NavLink>
                    );
                })}
            </nav>

            <div className="p-6 border-t border-slate-800 space-y-2 shrink-0">
                <button
                    className="w-full flex items-center gap-3 px-4 py-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all text-sm font-medium"
                    onClick={handleLogout}
                >
                    <LogOut size={16} />
                    <span>Keluar</span>
                </button>
                {isSuperAdmin && (
                    <button
                        className="w-full flex items-center gap-3 px-4 py-2 text-slate-600 hover:text-slate-400 rounded-xl text-[10px] font-bold tracking-widest uppercase"
                        onClick={() => { if (window.confirm('Reset semua data?')) dispatch({ type: 'RESET_DATA' }); }}
                    >
                        <RotateCcw size={14} />
                        <span>Reset Database</span>
                    </button>
                )}
            </div>
        </aside>
    );
}
