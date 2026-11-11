import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, BookOpen, FileText, BookMarked,
    Scale, Building2, TrendingUp, Banknote, Landmark, HardDrive, RotateCcw, List, Wallet, Target, Lock,
    User, ShieldCheck, LogOut, Settings, Database, Trash2, Activity, Wifi, WifiOff, AlertCircle, Share2,
    History, Send, Users, Calendar, Layers, Briefcase, UserCheck, Heart, Receipt, Coins, HandCoins, CreditCard, Settings2, Archive, CloudUpload, CloudDownload, RefreshCw, Layout, FolderKanban,
    ChevronDown, ChevronRight, BookCheck, Tag, ArrowLeftRight,
    Search, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { isRemote, api } from '../services/api';
import SyncStatus from './SyncStatus';
import CommandPalette from './CommandPalette';
import ConfirmDialog from './ConfirmDialog';

export default function Sidebar({
    isOpen,
    onClose,
    isCollapsed = false,
    onToggleCollapse,
    isCmdOpen: controlledCmdOpen,
    onOpenCmd,
    onCloseCmd
}) {
    const { state, dispatch } = useApp();
    const { currentUser } = state;
    const navigate = useNavigate();
    const location = useLocation();

    const [expandedGroups, setExpandedGroups] = useState({});
    const [localCmdOpen, setLocalCmdOpen] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    const isCmdOpen = controlledCmdOpen !== undefined ? controlledCmdOpen : localCmdOpen;
    const openCmd = () => (onOpenCmd ? onOpenCmd() : setLocalCmdOpen(true));
    const closeCmd = () => (onCloseCmd ? onCloseCmd() : setLocalCmdOpen(false));

    const isSuperAdmin = currentUser?.role === 'superadmin';
    const isAdminField = currentUser?.role === 'admin_bidang';
    const isAdminUnit = currentUser?.role === 'admin_unit';

    const currentUserUnit = React.useMemo(() =>
        state.units?.find(u => u.id === currentUser?.unitId)
        , [state.units, currentUser]);

    const currentUserField = React.useMemo(() =>
        state.fields?.find(f => f.id === currentUser?.fieldId)
        , [state.fields, currentUser]);

    const isSarprasUser = isSuperAdmin || (isAdminField && (
        currentUserField?.name?.toLowerCase().includes('sarana') ||
        currentUserField?.name?.toLowerCase().includes('sarpras') ||
        currentUser?.name?.toLowerCase().includes('sarana') ||
        currentUser?.name?.toLowerCase().includes('sarpras') ||
        currentUser?.username?.toLowerCase().includes('sarana') ||
        currentUser?.username?.toLowerCase().includes('sarpras')
    ));

    const hasBos = isSuperAdmin || (currentUserUnit && currentUserUnit.receivesBos);

    // Calculate Notifications for Pending Sarpras Asset Procurement
    const pendingSarprasAssetCount = React.useMemo(() => {
        if (!isSarprasUser || !state.rabPlans) return 0;
        let count = 0;
        state.rabPlans.forEach(plan => {
            if (plan.expense && typeof plan.expense === 'object') {
                Object.values(plan.expense).forEach(itemList => {
                    if (Array.isArray(itemList)) {
                        itemList.forEach(group => {
                            if (Array.isArray(group?.components)) {
                                group.components.forEach(comp => {
                                    if (comp && comp.isAsset && comp.sarprasStatus === 'PENDING') {
                                        count++;
                                    }
                                });
                            }
                        });
                    }
                });
            }
        });
        return count;
    }, [isSarprasUser, state.rabPlans]);

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
        if (isSarprasUser) {
            // Count pending requests from ANY unit that contain asset items with pending Sarpras status
            let sarprasAssetReqCount = 0;
            state.budgetRequests.forEach(r => {
                if (r.status === 'REJECTED' || r.isDeleted) return;
                const hasPendingAsset = (r.items || []).some(item => {
                    const isAsset = Boolean(item.isAsset);
                    const st = item.sarprasStatus || (isAsset ? 'PENDING' : null);
                    return isAsset && st === 'PENDING';
                });
                if (hasPendingAsset) sarprasAssetReqCount++;
            });

            // Also include notifications for requests initiated by Sarpras bidang itself
            let ownNotifiedCount = 0;
            if (isAdminField) {
                ownNotifiedCount = state.budgetRequests.filter(r => {
                    const isMine = r.fieldId === currentUser?.fieldId;
                    return isMine && (r.status === 'APPROVED' || r.status === 'REJECTED') && !r.notified;
                }).length;
            }
            return sarprasAssetReqCount + ownNotifiedCount;
        }
        if (isAdminUnit || isAdminField) {
            return state.budgetRequests.filter(r => {
                const isMine = (isAdminUnit && r.unitId === currentUser.unitId) ||
                    (isAdminField && r.fieldId === currentUser.fieldId);
                return isMine && (r.status === 'APPROVED' || r.status === 'REJECTED') && !r.notified;
            }).length;
        }
        return 0;
    }, [state.budgetRequests, isSuperAdmin, isSarprasUser, isAdminUnit, isAdminField, currentUser]);

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

    const isBosReturn = (r) => {
        if (r.kategoriAset !== 'PENGEMBALIAN') return false;
        if (r.source === 'BOS') return true;
        if (r.source === 'YAYASAN') return false;
        if (r.planId?.endsWith('-BOS')) return true;
        if (r.planId?.endsWith('-YAYASAN')) return false;
        if (r.id?.startsWith('RET-BOS-')) return true;
        if (r.id?.startsWith('RET-')) return false;
        return r.category?.trim().toUpperCase() === 'BOS';
    };

    // Calculate Notifications for Pengembalian Saldo Yayasan
    const pendingReturnYayasanCount = React.useMemo(() => {
        if (!state.budgetReports) return 0;
        if (isSuperAdmin) {
            return state.budgetReports.filter(r => r.status === 'PENDING' && r.kategoriAset === 'PENGEMBALIAN' && !isBosReturn(r)).length;
        }
        if (isAdminUnit || isAdminField) {
            return state.budgetReports.filter(r => {
                const isMine = (isAdminUnit && r.unitId === currentUser.unitId) ||
                    (isAdminField && r.fieldId === currentUser.fieldId);
                return isMine && (r.status === 'APPROVED' || r.status === 'REJECTED') && r.kategoriAset === 'PENGEMBALIAN' && !isBosReturn(r) && !r.notified;
            }).length;
        }
        return 0;
    }, [state.budgetReports, isSuperAdmin, isAdminUnit, isAdminField, currentUser]);

    // Calculate Notifications for Pengembalian Saldo BOS
    const pendingReturnBosCount = React.useMemo(() => {
        if (!state.budgetReports) return 0;
        if (isSuperAdmin) {
            return state.budgetReports.filter(r => r.status === 'PENDING' && r.kategoriAset === 'PENGEMBALIAN' && isBosReturn(r)).length;
        }
        if (isAdminUnit || isAdminField) {
            return state.budgetReports.filter(r => {
                const isMine = (isAdminUnit && r.unitId === currentUser.unitId) ||
                    (isAdminField && r.fieldId === currentUser.fieldId);
                return isMine && (r.status === 'APPROVED' || r.status === 'REJECTED') && r.kategoriAset === 'PENGEMBALIAN' && isBosReturn(r) && !r.notified;
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
                        { path: '/aset-tetap', label: 'Database Aset', icon: HardDrive }
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
                        { path: '/arus-kas', label: 'Arus Kas', icon: Banknote },
                        { path: '/perubahan-dana', label: 'Perubahan Aset Neto', icon: TrendingUp },
                        { path: '/calk', label: 'Catatan Laporan (CALK)', icon: FileText },
                        { path: '/laporan-program', label: 'Program Donasi', icon: List }
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
                        { path: '/anggaran/pergeseran', label: 'Pergeseran Anggaran', icon: ArrowLeftRight },
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
                        { path: '/pelaporan/program-belanja', label: 'Laporan Program Belanja', icon: FolderKanban },
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
                        { path: '/anggaran/petunjuk', label: 'Petunjuk Penggunaan', icon: BookOpen },
                        { path: '/anggaran/sop-keuangan', label: 'SOP Keuangan', icon: BookCheck },
                        { path: '/anggaran/pengaturan-aset', label: 'Pengaturan Aset', icon: Tag },
                        { path: '/manajemen-program', label: 'Manajemen Program', icon: List }
                    ]
                },
                {
                    title: 'ADMINISTRASI SISTEM',
                    items: [
                        { path: '/pengaturan/audit-log', label: 'Jejak Aktivitas (Audit Trail)', icon: Activity },
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
                        { path: '/anggaran/pergeseran', label: 'Pergeseran Anggaran', icon: ArrowLeftRight },
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
                        { path: '/pelaporan/program-belanja', label: 'Laporan Program Belanja', icon: FolderKanban },
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
                    { path: '/anggaran/petunjuk', label: 'Petunjuk Penggunaan', icon: BookOpen },
                    { path: '/anggaran/sop-keuangan', label: 'SOP Keuangan', icon: BookCheck },
                    { path: '/anggaran/pengaturan-aset', label: 'Pengaturan Aset', icon: Tag }
                ]
            });
        }

        return groups;
    }, [isSuperAdmin, isAdminField, isAdminUnit, hasBos, currentUser, state.fields]);

    const groupNotificationCounts = React.useMemo(() => {
        return {
            'PERENCANAAN (RAB)': pendingRabYayasanCount + pendingRabBosCount + pendingSarprasAssetCount,
            'REALISASI ANGGARAN': pendingFundRequestCount + pendingReportCount,
            'DASHBOARD & SALDO': pendingReturnYayasanCount + pendingReturnBosCount
        };
    }, [pendingRabYayasanCount, pendingRabBosCount, pendingSarprasAssetCount, pendingFundRequestCount, pendingReportCount, pendingReturnYayasanCount, pendingReturnBosCount]);

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


    const handleLogout = () => {
        setShowLogoutConfirm(true);
    };

    const confirmLogout = () => {
        setShowLogoutConfirm(false);
        dispatch({ type: 'LOGOUT' });
        navigate('/login');
    };

    return (
        <>
        <aside 
            className={`sidebar fixed inset-y-0 bg-[#F7F9F8] border-r border-[#E3E9E5] w-64 ${isCollapsed ? 'lg:w-20' : 'lg:w-64'} z-[1000] lg:translate-x-0 transition-all duration-300 flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
            {/* Brand + Collapse Toggle (Ferna Light Header) */}
            <div className={`sidebar-brand shrink-0 ${isCollapsed ? 'px-4 pt-5 pb-3 lg:px-3' : 'px-4 pt-5 pb-3'}`}>
                <div className={`flex items-center ${isCollapsed ? 'justify-between lg:flex-col lg:gap-2.5' : 'justify-between gap-2.5'}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 bg-[#157A52] rounded-xl flex items-center justify-center text-white shadow-xs shrink-0">
                            <Landmark size={18} />
                        </div>
                        <div className={`flex flex-col min-w-0 ${isCollapsed ? 'lg:hidden' : ''}`}>
                            <span className="text-base font-extrabold text-[#13261E] tracking-tight leading-tight truncate">SIKAD</span>
                            <span className="text-[10px] text-[#6A7B73] font-medium truncate">
                                Keuangan Dareliman
                            </span>
                        </div>
                    </div>

                    {onToggleCollapse && (
                        <button
                            type="button"
                            onClick={onToggleCollapse}
                            className="hidden lg:flex p-1.5 rounded-lg bg-white border border-[#DCE4DF] text-[#55675F] hover:text-[#142920] hover:bg-[#EFF4F1] transition-colors cursor-pointer shrink-0 shadow-[0_1px_2px_rgba(16,32,26,0.03)]"
                            title={isCollapsed ? 'Perluas Sidebar' : 'Lipat Sidebar'}
                        >
                            {isCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
                        </button>
                    )}
                </div>
            </div>

            {/* Quick Action Dark Forest Pill (Ferna "Move money" silhouette -> Cari Menu) */}
            <div className={`shrink-0 pb-3 border-b border-[#E6ECE8] ${isCollapsed ? 'px-3 lg:px-2.5' : 'px-4'}`}>
                <button
                    type="button"
                    onClick={openCmd}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[#162922] hover:bg-[#1E362D] text-white transition-all shadow-xs cursor-pointer ${isCollapsed ? 'lg:justify-center lg:px-0' : 'justify-between'}`}
                    title="Lompat Cepat ke Menu (Ctrl + K)"
                >
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="w-5 h-5 rounded-md bg-white/15 flex items-center justify-center shrink-0">
                            <Search size={12} className="text-emerald-200" />
                        </div>
                        <span className={`text-xs font-bold tracking-tight truncate ${isCollapsed ? 'lg:hidden' : ''}`}>
                            Cari Menu
                        </span>
                    </div>
                    <kbd className={`px-1.5 py-0.5 text-[9px] font-bold text-emerald-100/90 bg-white/10 border border-white/15 rounded shrink-0 ${isCollapsed ? 'lg:hidden' : ''}`}>
                        Ctrl K
                    </kbd>
                </button>
            </div>

            <nav className={`flex-1 overflow-y-auto min-h-0 py-3 space-y-1 sidebar-scrollbar ${isCollapsed ? 'px-3 lg:px-2' : 'px-3'}`}>
                {menuGroups.map((group, gIdx) => (
                    <div 
                        key={gIdx} 
                        className="space-y-0.5"
                    >
                        {/* Accounting System Section (Only for Super Admin at the start) */}
                        {isSuperAdmin && gIdx === 0 && (
                            <div className={`px-2.5 pt-2 pb-1 flex items-center gap-2 ${isCollapsed ? 'lg:hidden' : ''}`}>
                                <span className="text-[10px] font-bold text-[#7D8C84] uppercase tracking-[0.12em] whitespace-nowrap">AKUNTANSI</span>
                                <div className="h-px flex-1 bg-[#E4EAE6]"></div>
                            </div>
                        )}

                        {/* Budgeting & Reporting Section */}
                        {((isSuperAdmin && group.title === 'DASHBOARD & SALDO') || (!isSuperAdmin && gIdx === 0)) && (
                            <div className={`px-2.5 pt-3 pb-1 flex items-center gap-2 ${isCollapsed ? 'lg:hidden' : ''}`}>
                                <span className="text-[10px] font-bold text-[#157A52] uppercase tracking-[0.12em] whitespace-nowrap">ANGGARAN &amp; LAPORAN</span>
                                <div className="h-px flex-1 bg-[#DCE6E0]"></div>
                            </div>
                        )}

                        {/* Group Header */}
                        {(() => {
                            const groupCount = groupNotificationCounts[group.title] || 0;
                            const showDot = groupCount > 0 && !expandedGroups[group.title];
                            return (
                                <>
                                    <button
                                        onClick={() => toggleGroup(group.title)}
                                        className={`w-full flex items-center justify-between px-2.5 py-2 mt-1 text-[10px] font-bold text-[#7A8A82] hover:text-[#24372F] uppercase tracking-[0.12em] transition-colors group cursor-pointer ${isCollapsed ? 'lg:hidden' : ''}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span>{group.title}</span>
                                            {showDot && (
                                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shrink-0"></span>
                                            )}
                                        </div>
                                        {expandedGroups[group.title] ? (
                                            <ChevronDown size={12} className="text-[#8E9E96] group-hover:text-[#364940]" />
                                        ) : (
                                            <ChevronRight size={12} className="text-[#8E9E96] group-hover:text-[#364940]" />
                                        )}
                                    </button>
                                    {isCollapsed && gIdx > 0 && (
                                        <div className="hidden lg:block h-px bg-[#E3E9E5] my-2 mx-2" />
                                    )}
                                </>
                            );
                        })()}

                        {/* Group Items */}
                        {(expandedGroups[group.title] || isCollapsed) && (
                            <div className={`${expandedGroups[group.title] ? 'block' : 'hidden lg:block'} space-y-1 animate-in slide-in-from-top-1 duration-200`}>
                                {group.items.map((item, iIdx) => {
                                    const Icon = item.icon;
                                    const hasNotifBadge =
                                        ((item.label === 'RAB' || item.label === 'RAB Yayasan') && (pendingRabYayasanCount > 0 || pendingSarprasAssetCount > 0)) ||
                                        (item.label === 'RAB BOS' && pendingRabBosCount > 0) ||
                                        (item.label === 'Permintaan Dana' && pendingFundRequestCount > 0) ||
                                        (item.label === 'Pengeluaran Yayasan' && pendingReportCount > 0) ||
                                        (item.label === 'Saldo Yayasan' && pendingReturnYayasanCount > 0) ||
                                        (item.label === 'Saldo BOS' && pendingReturnBosCount > 0);

                                    return (
                                        <NavLink
                                            key={iIdx}
                                            to={item.path}
                                            title={isCollapsed ? item.label : undefined}
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
                                                    relative flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${isCollapsed ? 'lg:justify-center lg:px-2' : ''}
                                                    ${isTrulyActive ? 'bg-[#E2F1EA] text-[#0D6844] font-bold' : 'text-[#44564E] font-medium hover:bg-[#ECF2EE] hover:text-[#142920]'}
                                                `;
                                            }}
                                            end={(item.path || '').split('?')[0] === '/'}
                                        >
                                            {({ isActive }) => {
                                                const itemPath = item.path || '';
                                                const itemSearch = itemPath.split('?')[1] || '';
                                                const currentSearch = location.search.replace('?', '');
                                                const isTrulyActive = isActive && (itemSearch === currentSearch);

                                                return (
                                                    <>
                                                        <span className={`shrink-0 transition-colors ${isTrulyActive ? 'text-[#157A52]' : 'text-[#6A7B73]'}`}>
                                                            {Icon ? <Icon size={17} strokeWidth={isTrulyActive ? 2.25 : 1.9} /> : <div className="w-[17px] h-[17px] bg-[#E3E9E5] rounded" />}
                                                        </span>
                                                        <span className={`text-[13px] flex-1 tracking-tight truncate ${isCollapsed ? 'lg:hidden' : ''}`}>{item.label}</span>

                                                        {/* Compact notification dot when collapsed on desktop */}
                                                        {isCollapsed && hasNotifBadge && (
                                                            <span className="hidden lg:block absolute top-1.5 right-2 w-2 h-2 rounded-full bg-[#157A52] ring-2 ring-[#F7F9F8]" />
                                                        )}

                                                        {/* Notification Badges (Sleek Dark Charcoal / Semantic Pills ala Ferna) */}
                                                        <div className={`flex items-center gap-1 ${isCollapsed ? 'lg:hidden' : ''}`}>
                                                            {(item.label === 'RAB' || item.label === 'RAB Yayasan') && pendingRabYayasanCount > 0 && (
                                                                <span className="bg-[#16231D] text-white text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums">
                                                                    {pendingRabYayasanCount}
                                                                </span>
                                                            )}
                                                            {(item.label === 'RAB' || item.label === 'RAB Yayasan') && pendingSarprasAssetCount > 0 && (
                                                                <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 tabular-nums" title={`${pendingSarprasAssetCount} Pengajuan Aset Menunggu Verifikasi Sarpras`}>
                                                                    📦 {pendingSarprasAssetCount}
                                                                </span>
                                                            )}
                                                            {item.label === 'RAB BOS' && pendingRabBosCount > 0 && (
                                                                <span className="bg-[#157A52] text-white text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums">
                                                                    {pendingRabBosCount}
                                                                </span>
                                                            )}
                                                            {item.label === 'Permintaan Dana' && pendingFundRequestCount > 0 && (
                                                                <span className="bg-[#16231D] text-white text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums">
                                                                    {pendingFundRequestCount}
                                                                </span>
                                                            )}
                                                            {item.label === 'Pengeluaran Yayasan' && pendingReportCount > 0 && (
                                                                <span className="bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums">
                                                                    {pendingReportCount}
                                                                </span>
                                                            )}
                                                            {item.label === 'Saldo Yayasan' && pendingReturnYayasanCount > 0 && (
                                                                <span className="bg-[#16231D] text-white text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums">
                                                                    {pendingReturnYayasanCount}
                                                                </span>
                                                            )}
                                                            {item.label === 'Saldo BOS' && pendingReturnBosCount > 0 && (
                                                                <span className="bg-[#16231D] text-white text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums">
                                                                    {pendingReturnBosCount}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </>
                                                );
                                            }}
                                        </NavLink>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ))}
            </nav>

            {/* Footer: User Profile Card & Logout (Ferna bottom-left profile style) */}
            <div className={`border-t border-[#E3E9E5] bg-white/75 shrink-0 ${isCollapsed ? 'p-3 lg:px-2' : 'p-3.5'}`}>
                <div className={`flex items-center gap-2.5 ${isCollapsed ? 'lg:flex-col lg:gap-2' : 'justify-between'}`}>
                    <div className={`flex items-center gap-2.5 min-w-0 ${isCollapsed ? 'lg:justify-center' : ''}`} title={isCollapsed ? `${currentUser?.name} (${currentUser?.role})` : undefined}>
                        <div className="w-8 h-8 rounded-full bg-[#E2F1EA] text-[#0D6844] border border-[#C6E3D4] flex items-center justify-center text-xs font-extrabold uppercase shrink-0">
                            {(currentUser?.name || 'AD').slice(0, 2)}
                        </div>
                        <div className={`min-w-0 ${isCollapsed ? 'lg:hidden' : ''}`}>
                            <p className="text-xs font-bold text-[#142920] truncate leading-tight">{currentUser?.name}</p>
                            <p className="text-[10px] text-[#7A8A82] font-semibold uppercase tracking-wider truncate">{currentUser?.role}</p>
                        </div>
                    </div>

                    <button
                        className="p-2 text-[#6A7B73] hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-lg transition-all cursor-pointer shrink-0"
                        onClick={handleLogout}
                        title="Keluar dari sistem"
                    >
                        <LogOut size={15} />
                    </button>
                </div>
            </div>
        </aside>

        <CommandPalette
            isOpen={isCmdOpen}
            onOpen={openCmd}
            onClose={closeCmd}
            menuGroups={menuGroups}
        />

        <ConfirmDialog
            isOpen={showLogoutConfirm}
            title="Keluar dari Sistem?"
            message="Anda yakin ingin mengakhiri sesi dan keluar dari aplikasi SIKAD?"
            confirmText="Ya, Keluar"
            cancelText="Batal"
            variant="danger"
            onConfirm={confirmLogout}
            onCancel={() => setShowLogoutConfirm(false)}
        />
        </>
    );
}
