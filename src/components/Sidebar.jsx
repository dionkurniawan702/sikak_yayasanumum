import { NavLink, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, BookOpen, FileText, BookMarked,
    Scale, Building2, TrendingUp, Banknote, Landmark, HardDrive, RotateCcw, List, Wallet, Target, Lock,
    User, ShieldCheck, LogOut, Settings, Database, Trash2, Activity, Wifi, WifiOff, AlertCircle, Share2
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
            { path: '/daftar-akun', label: 'Bagan Akun (COA)', icon: BookOpen },
            { path: '/aset-tetap', label: 'Database Aset', icon: HardDrive },
            { path: '/manajemen-program', label: 'Manajemen Program', icon: List },
            { path: '/manajemen-anggaran', label: 'Manajemen Anggaran', icon: Target },
            { section: 'ANGGARAN & PELAPORAN' },
            { path: '/anggaran/unit-bidang', label: 'Unit & Bidang', icon: Building2 },
            { path: '/anggaran/siswa', label: 'Database Siswa', icon: User },
            { path: '/anggaran/distribusi', label: 'Setting Distribusi', icon: Share2 },
            { path: '/pelaporan/permintaan', label: 'Permintaan Dana', icon: Wallet },
            { path: '/pelaporan/bulanan', label: 'Laporan Bulanan', icon: FileText },
            { section: 'TRANSAKSI' },
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
            { section: 'PENGATURAN' },
            { path: '/pengaturan/backup-restore', label: 'Backup & Restore', icon: Database },
            { path: '/pengaturan/audit-log', label: 'Audit Log Sistem', icon: Activity },
            { path: '/pengaturan/tempat-sampah', label: 'Tempat Sampah', icon: Trash2 },
            { path: '/manajemen-user', label: 'Manajemen User', icon: ShieldCheck }
        ];
    } else if (isAdminField || isAdminUnit) {
        menuItems = [
            { section: 'ANGGARAN & PELAPORAN' },
            { path: '/', label: 'Dashboard', icon: LayoutDashboard },
            { path: '/anggaran/siswa', label: 'Database Siswa', icon: User },
            { path: '/pelaporan/permintaan', label: 'Permintaan Dana', icon: Wallet },
            { path: '/pelaporan/bulanan', label: 'Laporan Bulanan', icon: FileText },
            { path: '/pelaporan/ketersediaan', label: 'Ketersediaan Dana', icon: Landmark }
        ];
    }

    const handleLogout = () => {
        if (window.confirm('Keluar dari sistem?')) {
            dispatch({ type: 'LOGOUT' });
            navigate('/login');
        }
    };

    return (
        <aside className={`sidebar fixed bg-slate-900 h-screen w-72 z-[1000] lg:translate-x-0 transition-transform duration-300 flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="sidebar-brand p-8 border-b border-slate-800 shrink-0">
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">✦ SIKAK YAYASAN</h1>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Sistem Informasi Keuangan</p>

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

            <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1 custom-scrollbar">
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
                            <Icon size={18} />
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
                <button
                    className="w-full flex items-center gap-3 px-4 py-2 text-slate-600 hover:text-slate-400 rounded-xl text-[10px] font-bold tracking-widest uppercase"
                    onClick={() => { if (window.confirm('Reset semua data?')) dispatch({ type: 'RESET_DATA' }); }}
                >
                    <RotateCcw size={14} />
                    <span>Reset Database</span>
                </button>
            </div>
        </aside>
    );
}
