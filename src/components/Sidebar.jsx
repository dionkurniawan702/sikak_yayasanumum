import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, BookOpen, FileText, BookMarked,
    Scale, Building2, TrendingUp, Banknote, Landmark, HardDrive, RotateCcw, List, Wallet, Target, Lock,
    User, ShieldCheck, LogOut, Settings, Database, Trash2, Activity, Wifi, WifiOff, AlertCircle, Share2,
    History, Send, Users, Calendar, Layers, Briefcase, UserCheck, Heart, Receipt, Coins, HandCoins, CreditCard, Settings2, Archive, CloudUpload, CloudDownload, RefreshCw, Layout,
    ChevronDown, ChevronRight
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { isRemote, api } from '../services/api';
import SyncStatus from './SyncStatus';

export default function Sidebar({ isOpen, onClose }) {
    const { state, dispatch } = useApp();
    const { currentUser } = state;
    const navigate = useNavigate();
    const location = useLocation();

    const [expandedGroups, setExpandedGroups] = useState({});

    const isSuperAdmin = currentUser?.role === 'superadmin';
    const isAdminField = currentUser?.role === 'admin_bidang';
    const isAdminUnit = currentUser?.role === 'admin_unit';

    const currentUserUnit = React.useMemo(() =>
        state.units?.find(u => u.id === currentUser?.unitId)
        , [state.units, currentUser]);

    const hasBos = isSuperAdmin || (currentUserUnit && currentUserUnit.receivesBos);

    // Calculate Notifications for RAB Yayasan
    const pendingRabYayasanCount = React.useMemo(() => {
        if (!state.rabPlans) return 0;
        if (isSuperAdmin) {
            return state.rabPlans.filter(p => p.status === 'PENDING' && p.id.endsWith('-YAYASAN')).length;
        }
        if (isAdminUnit || isAdminField) {
            return state.rabPlans.filter(p => {
                const isMine = (isAdminUnit && p.unitId === currentUser.unitId) ||
                    (isAdminField && p.fieldId === currentUser.fieldId);
                return isMine && (p.status === 'APPROVED' || p.status === 'REJECTED') && !p.notified && p.id.endsWith('-YAYASAN');
            }).length;
        }
        return 0;
    }, [state.rabPlans, isSuperAdmin, isAdminUnit, isAdminField, currentUser]);

    // Calculate Notifications for RAB BOS
    const pendingRabBosCount = React.useMemo(() => {
        if (!state.rabPlans) return 0;
        if (isSuperAdmin) {
            return state.rabPlans.filter(p => p.status === 'PENDING' && p.id.endsWith('-BOS')).length;
        }
        if (isAdminUnit || isAdminField) {
            return state.rabPlans.filter(p => {
                const isMine = (isAdminUnit && p.unitId === currentUser.unitId) ||
                    (isAdminField && p.fieldId === currentUser.fieldId);
                return isMine && (p.status === 'APPROVED' || p.status === 'REJECTED') && !p.notified && p.id.endsWith('-BOS');
            }).length;
        }
        return 0;
    }, [state.rabPlans, isSuperAdmin, isAdminUnit, isAdminField, currentUser]);

    // Calculate Notifications for Fund Requests (Permintaan Dana)
    const pendingFundRequestCount = React.useMemo(() => {
        if (!state.budgetRequests) return 0;
        if (isSuperAdmin) {
            return state.budgetRequests.filter(r => r.status === 'PENDING').length;
        }
        if (isAdminUnit || isAdminField) {
            return state.budgetRequests.filter(r => {
                const isMine = (isAdminUnit && r.unitId === currentUser.unitId) ||
                    (isAdminField && r.fieldId === currentUser.fieldId);
                return isMine && (r.status === 'APPROVED' || r.status === 'REJECTED') && !r.notified;
            }).length;
        }
        return 0;
    }, [state.budgetRequests, isSuperAdmin, isAdminUnit, isAdminField, currentUser]);

    // Calculate Notifications for Laporan Realisasi
    const pendingReportCount = React.useMemo(() => {
        if (!state.budgetReports) return 0;
        if (isSuperAdmin) {
            return state.budgetReports.filter(r => r.status === 'PENDING' && r.kategoriAset !== 'PENGEMBALIAN').length;
        }
        if (isAdminUnit || isAdminField) {
            return state.budgetReports.filter(r => {
                const isMine = (isAdminUnit && r.unitId === currentUser.unitId) ||
                    (isAdminField && r.fieldId === currentUser.fieldId);
                return isMine && (r.status === 'APPROVED' || r.status === 'REJECTED') && r.kategoriAset !== 'PENGEMBALIAN' && !r.notified;
            }).length;
        }
        return 0;
    }, [state.budgetReports, isSuperAdmin, isAdminUnit, isAdminField, currentUser]);

    // Calculate Notifications for Pengembalian Saldo
    const pendingReturnCount = React.useMemo(() => {
        if (!state.budgetReports) return 0;
        if (isSuperAdmin) {
            return state.budgetReports.filter(r => r.status === 'PENDING' && r.kategoriAset === 'PENGEMBALIAN').length;
        }
        if (isAdminUnit || isAdminField) {
            return state.budgetReports.filter(r => {
                const isMine = (isAdminUnit && r.unitId === currentUser.unitId) ||
                    (isAdminField && r.fieldId === currentUser.fieldId);
                return isMine && (r.status === 'APPROVED' || r.status === 'REJECTED') && r.kategoriAset === 'PENGEMBALIAN' && !r.notified;
            }).length;
        }
        return 0;
    }, [state.budgetReports, isSuperAdmin, isAdminUnit, isAdminField, currentUser]);

    const menuGroups = React.useMemo(() => {
        let groups = [];

        if (isSuperAdmin) {
            groups = [
                {
                    title: 'DATABASE AKUNTANSI',
                    items: [
                        { path: '/', label: 'Dashboard', icon: LayoutDashboard },
                        { path: '/daftar-akun', label: 'Daftar Akun', icon: BookOpen },
                        { path: '/aset-tetap', label: 'Database Aset', icon: HardDrive },
                        { path: '/manajemen-program', label: 'Manajemen Program', icon: List }
                    ]
                },
                {
                    title: 'TRANSAKSI AKUNTANSI',
                    items: [
                        { path: '/jurnal', label: 'Jurnal Umum', icon: FileText },
                        { path: '/buku-besar', label: 'Buku Besar', icon: BookMarked },
                        { path: '/tutup-buku', label: 'Tutup Buku (Closing)', icon: Lock }
                    ]
                },
                {
                    title: 'LAPORAN KEUANGAN',
                    items: [
                        { path: '/neraca-saldo', label: 'Neraca Saldo', icon: Scale },
                        { path: '/neraca', label: 'Posisi Keuangan', icon: Building2 },
                        { path: '/laporan-aktivitas', label: 'Laporan Aktivitas', icon: TrendingUp },
                        { path: '/realisasi-anggaran', label: 'Realisasi Anggaran', icon: Target },
                        { path: '/arus-kas', label: 'Arus Kas', icon: Banknote },
                        { path: '/perubahan-dana', label: 'Perubahan Aset Neto', icon: TrendingUp },
                        { path: '/laporan-program', label: 'Laporan Per Program', icon: List },
                        { path: '/calk', label: 'Catatan Laporan (CALK)', icon: FileText }
                    ]
                },
                {
                    title: 'DASHBOARD & SALDO',
                    items: [
                        { path: '/pelaporan/dashboard', label: 'Dashboard Anggaran', icon: LayoutDashboard },
                        { path: '/pelaporan/realisasi', label: 'Dashboard Realisasi', icon: TrendingUp },
                        { path: '/pelaporan/saldo', label: 'Saldo Yayasan', icon: Wallet },
                        { path: '/pelaporan/saldo-bos', label: 'Saldo BOS', icon: Landmark }
                    ]
                },
                {
                    title: 'PERENCANAAN (RAB)',
                    items: [
                        { path: '/anggaran/rab?source=Yayasan', label: 'RAB Yayasan', icon: Target },
                        { path: '/anggaran/rab?source=BOS', label: 'RAB BOS', icon: Landmark },
                        { path: '/anggaran/arsip-rab', label: 'Arsip RAB', icon: Archive },
                        { path: '/anggaran/distribusi', label: 'Setting Distribusi', icon: Share2 }
                    ]
                },
                {
                    title: 'REALISASI ANGGARAN',
                    items: [
                        { path: '/pelaporan/permintaan', label: 'Permintaan Dana', icon: Send },
                        { path: '/pelaporan/arsip-permintaan', label: 'Arsip Permintaan', icon: History },
                        { path: '/pelaporan/bulanan', label: 'Pengeluaran Yayasan', icon: FileText },
                        { path: '/pelaporan/realisasi-bos', label: 'Pengeluaran BOS', icon: Landmark },
                        { path: '/pelaporan/arsip-laporan', label: 'Arsip Laporan', icon: BookMarked }
                    ]
                },
                {
                    title: 'DATABASE ANGGARAN',
                    items: [
                        { path: '/anggaran/dashboard-siswa', label: 'Dashboard Siswa', icon: LayoutDashboard },
                        { path: '/anggaran/siswa', label: 'Database Siswa', icon: User },
                        { path: '/anggaran/kelas', label: 'Kelas', icon: Users },
                        { path: '/anggaran/database-bos', label: 'Database BOS', icon: Database }
                    ]
                },
                {
                    title: 'PENGATURAN ANGGARAN',
                    items: [
                        { path: '/anggaran/unit-bidang', label: 'Unit & Bidang', icon: Building2 },
                        { path: '/anggaran/tahun-ajaran', label: 'Tahun Ajaran', icon: Calendar },
                        { path: '/anggaran/set-jabatan', label: 'Set Jabatan', icon: Briefcase },
                        { path: '/anggaran/status-siswa', label: 'Status Siswa', icon: UserCheck },
                        { path: '/anggaran/status-ortu', label: 'Status Orang Tua', icon: Heart },
                        { path: '/anggaran/item-penerimaan', label: 'Item Penerimaan', icon: Coins },
                        { path: '/anggaran/item-pengeluaran', label: 'Item Pengeluaran', icon: Receipt },
                        { path: '/anggaran/master-program', label: 'Program Belanja', icon: Layout },
                        { path: '/anggaran/master-bos', label: 'Master BOS', icon: ShieldCheck },
                        { path: '/anggaran/unit-penerima-bos', label: 'Unit Penerima BOS', icon: Building2 },
                        { path: '/anggaran/petunjuk', label: 'Petunjuk Penggunaan', icon: BookOpen }
                    ]
                },
                {
                    title: 'ADMINISTRASI SISTEM',
                    items: [
                        { path: '/pengaturan/backup-restore', label: 'Backup & Restore', icon: Database },
                        { path: '/pengaturan/tempat-sampah', label: 'Tempat Sampah', icon: Trash2 },
                        { path: '/manajemen-user', label: 'Manajemen User', icon: ShieldCheck }
                    ]
                }
            ];
        } else if (isAdminField || isAdminUnit) {
            let isPendidikanKeuangan = false;
            if (isAdminField && state.fields) {
                const fieldName = state.fields.find(f => f.id === currentUser.fieldId)?.name?.toLowerCase() || '';
                isPendidikanKeuangan = fieldName.includes('pendidikan') || fieldName.includes('keuangan');
            }
            const showDatabaseItems = isAdminUnit || isPendidikanKeuangan;

            groups = [
                {
                    title: 'DASHBOARD & SALDO',
                    items: [
                        { path: '/pelaporan/dashboard', label: 'Dashboard Anggaran', icon: LayoutDashboard },
                        { path: '/pelaporan/realisasi', label: 'Dashboard Realisasi', icon: TrendingUp },
                        { path: '/pelaporan/saldo', label: 'Saldo Yayasan', icon: Wallet },
                        ...(hasBos ? [{ path: '/pelaporan/saldo-bos', label: 'Saldo BOS', icon: Landmark }] : [])
                    ]
                },
                {
                    title: 'PERENCANAAN (RAB)',
                    items: [
                        ...(isAdminUnit
                            ? [
                                { path: '/anggaran/rab?source=Yayasan', label: 'RAB Yayasan', icon: Target },
                                ...(hasBos ? [{ path: '/anggaran/rab?source=BOS', label: 'RAB BOS', icon: Landmark }] : [])
                            ]
                            : [{ path: '/anggaran/rab', label: 'RAB', icon: Target }]
                        ),
                        { path: '/anggaran/arsip-rab', label: 'Arsip RAB', icon: Archive }
                    ]
                },
                {
                    title: 'REALISASI ANGGARAN',
                    items: [
                        { path: '/pelaporan/permintaan', label: 'Permintaan Dana', icon: Send },
                        { path: '/pelaporan/arsip-permintaan', label: 'Arsip Permintaan', icon: History },
                        { path: '/pelaporan/bulanan', label: 'Pengeluaran Yayasan', icon: FileText },
                        ...(hasBos ? [{ path: '/pelaporan/realisasi-bos', label: 'Pengeluaran BOS', icon: Landmark }] : []),
                        { path: '/pelaporan/arsip-laporan', label: 'Arsip Laporan', icon: BookMarked }
                    ]
                }
            ];

            if (showDatabaseItems) {
                groups.push({
                    title: 'DATABASE ANGGARAN',
                    items: [
                        { path: '/anggaran/dashboard-siswa', label: 'Dashboard Siswa', icon: LayoutDashboard },
                        { path: '/anggaran/siswa', label: 'Database Siswa', icon: User },
                        { path: '/anggaran/kelas', label: 'Kelas', icon: Users },
                        ...(hasBos ? [{ path: '/anggaran/database-bos', label: 'Database BOS', icon: Database }] : [])
                    ]
                });
            }

            groups.push({
                title: 'PENGATURAN',
                items: [
                    { path: '/anggaran/master-program', label: 'Program Belanja', icon: Layout },
                    { path: '/anggaran/petunjuk', label: 'Petunjuk Penggunaan', icon: BookOpen }
                ]
            });
        }

        return groups;
    }, [isSuperAdmin, isAdminField, isAdminUnit, hasBos, currentUser, state.fields]);

    const groupNotificationCounts = React.useMemo(() => {
        return {
            'PERENCANAAN (RAB)': pendingRabYayasanCount + pendingRabBosCount,
            'REALISASI ANGGARAN': pendingFundRequestCount + pendingReportCount,
            'DASHBOARD & SALDO': pendingReturnCount
        };
    }, [pendingRabYayasanCount, pendingRabBosCount, pendingFundRequestCount, pendingReportCount, pendingReturnCount]);

    // Auto-expand groups that contain the active route
    useEffect(() => {
        const currentPath = location.pathname;
        const currentSearch = location.search;
        const fullPath = currentPath + currentSearch;

        menuGroups.forEach(group => {
            const hasActiveItem = group.items.some(item => {
                const itemBase = (item.path || '').split('?')[0];
                const itemSearch = (item.path || '').split('?')[1] || '';
                const currentSearchClean = currentSearch.replace('?', '');
                
                if (item.path === '/') return currentPath === '/';
                return currentPath === itemBase && (itemSearch === '' || itemSearch === currentSearchClean);
            });

            if (hasActiveItem) {
                setExpandedGroups(prev => ({ ...prev, [group.title]: true }));
            }
        });
    }, [location.pathname, location.search, menuGroups]);

    const checkGroupActive = (group) => {
        const currentPath = location.pathname;
        const currentSearch = location.search;
        return group.items.some(item => {
            const itemBase = (item.path || '').split('?')[0];
            const itemSearch = (item.path || '').split('?')[1] || '';
            const currentSearchClean = currentSearch.replace('?', '');
            
            if (item.path === '/') return currentPath === '/';
            return currentPath === itemBase && (itemSearch === '' || itemSearch === currentSearchClean);
        });
    };

    const toggleGroup = (title) => {
        setExpandedGroups(prev => ({
            ...prev,
            [title]: !prev[title]
        }));
    };

    const handleMouseEnterGroup = (title) => {
        setExpandedGroups(prev => {
            const next = { ...prev };
            next[title] = true;
            
            menuGroups.forEach(g => {
                if (g.title !== title && !checkGroupActive(g)) {
                    next[g.title] = false;
                }
            });
            return next;
        });
    };

    const handleMouseLeaveGroup = (title) => {
        const group = menuGroups.find(g => g.title === title);
        if (group && !checkGroupActive(group)) {
            setExpandedGroups(prev => ({ ...prev, [title]: false }));
        }
    };

    const handleMouseLeaveSidebar = () => {
        setExpandedGroups(prev => {
            const next = {};
            menuGroups.forEach(g => {
                next[g.title] = checkGroupActive(g);
            });
            return next;
        });
    };

    const handleLogout = () => {
        if (window.confirm('Keluar dari sistem?')) {
            dispatch({ type: 'LOGOUT' });
            navigate('/login');
        }
    };

    return (
        <aside 
            onMouseLeave={handleMouseLeaveSidebar}
            className={`sidebar fixed inset-y-0 bg-slate-900 w-72 z-[1000] lg:translate-x-0 transition-transform duration-300 flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
            <div className="sidebar-brand p-8 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/10 rounded-xl shadow-inner backdrop-blur-sm border border-white/5">
                        <Landmark className="text-blue-200" size={24} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xl font-black text-white tracking-tight">SIKAD</span>
                        <span className="text-[10px] text-blue-200/60 font-bold uppercase tracking-wider -mt-1 italic">
                            Sistem Keuangan Dareliman
                        </span>
                    </div>
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
                {menuGroups.map((group, gIdx) => (
                    <div 
                        key={gIdx} 
                        className="space-y-1"
                        onMouseEnter={() => handleMouseEnterGroup(group.title)}
                        onMouseLeave={() => handleMouseLeaveGroup(group.title)}
                    >
                        {/* Accounting System Section (Only for Super Admin at the start) */}
                        {isSuperAdmin && gIdx === 0 && (
                            <div className="px-4 py-2 mt-4 mb-2 flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] shrink-0"></div>
                                <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] whitespace-nowrap">ACCOUNTING SYSTEM</span>
                                <div className="h-px flex-1 bg-slate-800/50"></div>
                            </div>
                        )}

                        {/* Budgeting & Reporting Section */}
                        {((isSuperAdmin && group.title === 'DASHBOARD & SALDO') || (!isSuperAdmin && gIdx === 0)) && (
                            <div className="px-4 py-2 mt-6 mb-2 flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)] shrink-0"></div>
                                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] whitespace-nowrap">BUDGETING & REPORTING</span>
                                <div className="h-px flex-1 bg-slate-800/50"></div>
                            </div>
                        )}

                        {/* Group Header */}
                        {(() => {
                            const groupCount = groupNotificationCounts[group.title] || 0;
                            const showDot = groupCount > 0 && !expandedGroups[group.title];
                            return (
                                <button
                                    onClick={() => toggleGroup(group.title)}
                                    className="w-full flex items-center justify-between px-4 py-4 mt-2 text-[11px] font-bold text-slate-500 hover:text-slate-300 uppercase tracking-[0.2em] transition-colors group"
                                >
                                    <div className="flex items-center gap-2">
                                        <span>{group.title}</span>
                                        {showDot && (
                                            <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)] animate-pulse shrink-0"></span>
                                        )}
                                    </div>
                                    {expandedGroups[group.title] ? (
                                        <ChevronDown size={12} className="text-slate-600 group-hover:text-slate-400" />
                                    ) : (
                                        <ChevronRight size={12} className="text-slate-600 group-hover:text-slate-400" />
                                    )}
                                </button>
                            );
                        })()}

                        {/* Group Items */}
                        {expandedGroups[group.title] && (
                            <div className="space-y-1 animate-in slide-in-from-top-1 duration-200">
                                {group.items.map((item, iIdx) => {
                                    const Icon = item.icon;
                                    return (
                                        <NavLink
                                            key={iIdx}
                                            to={item.path}
                                            onClick={() => {
                                                if (window.innerWidth < 1024) onClose();
                                            }}
                                            className={({ isActive }) => {
                                                const itemPath = item.path || '';
                                                const itemSearch = itemPath.split('?')[1] || '';
                                                const currentSearch = location.search.replace('?', '');
                                                const isParamMatch = itemSearch === currentSearch;
                                                const isTrulyActive = isActive && isParamMatch;

                                                return `
                                                    flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all
                                                     ${isTrulyActive ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/30 scale-[1.02]' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}
                                                `;
                                            }}
                                            end={(item.path || '').split('?')[0] === '/'}
                                        >
                                            <div className={`p-2 rounded-xl transition-colors ${location.pathname === item.path.split('?')[0] ? 'bg-white/20' : 'bg-slate-800/50 group-hover:bg-slate-700'}`}>
                                                 {Icon ? <Icon size={18} /> : <div className="w-[18px] h-[18px] bg-slate-800 rounded" />}
                                            </div>
                                            <span className="text-base font-bold flex-1 tracking-tight">{item.label}</span>
                                            
                                            {/* Notification Badges */}
                                            {(item.label === 'RAB' || item.label === 'RAB Yayasan') && pendingRabYayasanCount > 0 && (
                                                <span className="bg-rose-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full animate-pulse shadow-lg shadow-rose-500/40">
                                                    {pendingRabYayasanCount}
                                                </span>
                                            )}
                                            {item.label === 'RAB BOS' && pendingRabBosCount > 0 && (
                                                <span className="bg-emerald-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full animate-pulse shadow-lg shadow-emerald-500/40">
                                                    {pendingRabBosCount}
                                                </span>
                                            )}
                                            {item.label === 'Permintaan Dana' && pendingFundRequestCount > 0 && (
                                                <span className="bg-amber-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full animate-pulse shadow-lg shadow-amber-500/40">
                                                    {pendingFundRequestCount}
                                                </span>
                                            )}
                                            {item.label === 'Pengeluaran Yayasan' && pendingReportCount > 0 && (
                                                <span className="bg-rose-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full animate-pulse shadow-lg shadow-rose-500/40">
                                                    {pendingReportCount}
                                                </span>
                                            )}
                                            {item.label === 'Saldo Yayasan' && pendingReturnCount > 0 && (
                                                <span className="bg-blue-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full animate-pulse shadow-lg shadow-blue-500/40">
                                                    {pendingReturnCount}
                                                </span>
                                            )}
                                        </NavLink>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ))}
            </nav>

            <div className="p-6 border-t border-slate-800 shrink-0">
                <button
                    className="flex items-center gap-2 px-4 py-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all text-[11px] font-black uppercase tracking-widest mx-auto border border-rose-500/20"
                    onClick={handleLogout}
                >
                    <LogOut size={12} />
                    <span>Keluar</span>
                </button>
                <div className="mt-4 px-4 text-[9px] font-bold text-slate-700 uppercase tracking-widest text-center opacity-40">
                    SIKAD v1.5.0-diag
                </div>
            </div>
        </aside>
    );
}
