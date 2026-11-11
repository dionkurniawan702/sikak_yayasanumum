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

    const formatRoleLabel = (role) => {
        if (role === 'superadmin') return 'Super Administrator';
        if (role === 'admin_unit') return 'Admin Unit';
        if (role === 'admin_bidang') return 'Admin Bidang';
        return role || 'Pengguna';
    };

    const getGroupRingClass = (title) => {
        if (title === 'PERENCANAAN (RAB)') {
            return 'bg-gradient-to-br from-[#34D399] to-[#157A52] border-emerald-200/80 shadow-[0_0_12px_rgba(52,211,153,0.45)]';
        }
        if (title === 'REALISASI ANGGARAN') {
            return 'bg-gradient-to-br from-[#FB7185] via-[#DF6B45] to-[#F59E0B] border-amber-200/80 shadow-[0_0_12px_rgba(245,158,11,0.45)]';
        }
        if (title === 'DATABASE ANGGARAN' || title === 'PENGATURAN' || title === 'PENGATURAN ANGGARAN' || title === 'PENGATURAN SISTEM') {
            return 'bg-gradient-to-br from-[#2DD4BF] to-[#0D9488] border-teal-200/80 shadow-[0_0_12px_rgba(45,212,191,0.45)]';
        }
        return 'bg-gradient-to-br from-[#38BDF8] to-[#2563EB] border-sky-200/80 shadow-[0_0_12px_rgba(56,189,248,0.45)]';
    };

    return (
        <>
        <aside 
            className={`sidebar fixed inset-y-0 left-0 w-64 ${isCollapsed ? 'lg:w-20' : 'lg:w-64'} z-[900] lg:z-[1000] transition-all duration-300 flex flex-col overflow-hidden bg-gradient-to-br from-[#0B1E3D] via-[#174673] to-[#1A7385] text-white border-r border-white/10 lg:shadow-[4px_0_24px_rgba(11,30,61,0.16)] ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        >
            {/* Atmospheric Ambient Glows */}
            <div className="pointer-events-none absolute -top-16 -left-16 w-60 h-60 rounded-full bg-sky-400/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -right-14 w-56 h-56 rounded-full bg-teal-300/15 blur-3xl" />

            {/* Top Edge: Subtle SIKAD Brand & Collapse Toggle */}
            <div className={`relative z-10 shrink-0 px-4 pt-3.5 pb-1 flex items-center ${isCollapsed ? 'lg:justify-center lg:px-2' : 'justify-between'}`}>
                <div className={`flex items-center gap-2 min-w-0 ${isCollapsed ? 'lg:hidden' : ''}`}>
                    <div className="w-6 h-6 rounded-lg bg-white/15 border border-white/25 flex items-center justify-center text-white shrink-0">
                        <Landmark size={13} />
                    </div>
                    <span className="text-[11px] font-bold tracking-[0.18em] text-white/85 uppercase truncate">SIKAD</span>
                </div>

                {onToggleCollapse && (
                    <button
                        type="button"
                        onClick={onToggleCollapse}
                        className="hidden lg:flex p-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-white/80 hover:text-white transition-colors cursor-pointer shrink-0"
                        title={isCollapsed ? 'Perluas Sidebar' : 'Lipat Sidebar'}
                    >
                        {isCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
                    </button>
                )}
            </div>

            {/* Hero User Profile (Centered Avatar with Flanking Settings & Logout) */}
            <div className={`relative z-10 shrink-0 border-b border-white/12 ${isCollapsed ? 'px-2 pt-2 pb-3' : 'px-4 pt-2 pb-4'}`}>
                {isCollapsed ? (
                    <div className="flex flex-col items-center gap-2" title={`${currentUser?.name} (${formatRoleLabel(currentUser?.role)})`}>
                        <button
                            type="button"
                            onClick={() => navigate('/profil')}
                            className="relative w-10 h-10 rounded-full p-[2px] bg-gradient-to-br from-[#F43F5E] via-[#E11D48] to-[#FB7185] shadow-md cursor-pointer"
                        >
                            <div className="w-full h-full rounded-full bg-gradient-to-b from-[#FB7185] to-[#E11D48] flex items-center justify-center text-white font-bold text-xs uppercase">
                                {(currentUser?.name || 'AD').slice(0, 2)}
                            </div>
                            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#113158]" />
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center text-center">
                        <div className="flex items-center justify-center gap-5">
                            <button
                                type="button"
                                onClick={() => {
                                    navigate('/profil');
                                    if (window.innerWidth < 1024) onClose();
                                }}
                                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white/85 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95"
                                title="Pengaturan Profil"
                            >
                                <Settings size={16} strokeWidth={1.8} />
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    navigate('/profil');
                                    if (window.innerWidth < 1024) onClose();
                                }}
                                className="relative w-16 h-16 rounded-full p-[3px] bg-gradient-to-br from-[#F43F5E] via-[#E11D48] to-[#FB7185] shadow-[0_8px_24px_rgba(225,29,72,0.38)] hover:scale-105 transition-transform cursor-pointer"
                                title="Buka Profil Saya"
                            >
                                <div className="w-full h-full rounded-full bg-gradient-to-b from-[#FB7185] to-[#E11D48] flex items-center justify-center text-white font-extrabold text-xl tracking-wide uppercase">
                                    {(currentUser?.name || 'AD').slice(0, 2)}
                                </div>
                                <span className="absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-[#13355A]" />
                            </button>

                            <button
                                type="button"
                                onClick={handleLogout}
                                className="w-9 h-9 rounded-full bg-white/10 hover:bg-rose-500/30 border border-white/20 hover:border-rose-300/50 text-white/85 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95"
                                title="Keluar dari sistem"
                            >
                                <LogOut size={16} strokeWidth={1.8} />
                            </button>
                        </div>

                        <p className="text-sm font-bold text-white tracking-tight truncate max-w-full px-2 mt-2.5">
                            {currentUser?.name || 'Pengguna SIKAD'}
                        </p>
                        <span className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-[10px] font-semibold text-sky-100/90 tracking-wide">
                            {formatRoleLabel(currentUser?.role)}
                        </span>
                    </div>
                )}
            </div>

            <nav className={`relative z-10 flex-1 overflow-y-auto min-h-0 py-3 space-y-1 sidebar-scrollbar ${isCollapsed ? 'px-3 lg:px-2' : 'px-3'}`}>
                {menuGroups.map((group, gIdx) => {
                    const groupRingAccent = getGroupRingClass(group.title);
                    return (
                    <div 
                        key={gIdx} 
                        className="space-y-0.5"
                    >
                        {/* Accounting System Section (Only for Super Admin at the start) */}
                        {isSuperAdmin && gIdx === 0 && (
                            <div className={`px-2 pt-1.5 pb-1 flex items-center gap-2 ${isCollapsed ? 'lg:hidden' : ''}`}>
                                <span className="text-[9.5px] font-bold text-sky-200/75 uppercase tracking-[0.15em] whitespace-nowrap">AKUNTANSI</span>
                                <div className="h-px flex-1 bg-white/12"></div>
                            </div>
                        )}

                        {/* Budgeting & Reporting Section */}
                        {((isSuperAdmin && group.title === 'DASHBOARD & SALDO') || (!isSuperAdmin && gIdx === 0)) && (
                            <div className={`px-2 pt-2.5 pb-1 flex items-center gap-2 ${isCollapsed ? 'lg:hidden' : ''}`}>
                                <span className="text-[9.5px] font-bold text-emerald-300/85 uppercase tracking-[0.15em] whitespace-nowrap">ANGGARAN &amp; LAPORAN</span>
                                <div className="h-px flex-1 bg-white/12"></div>
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
                                        className={`w-full flex items-center justify-between px-2 py-2 mt-1 text-[10px] font-bold text-white/55 hover:text-white uppercase tracking-[0.14em] transition-colors group cursor-pointer ${isCollapsed ? 'lg:hidden' : ''}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span>{group.title}</span>
                                            {showDot && (
                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0"></span>
                                            )}
                                        </div>
                                        {expandedGroups[group.title] ? (
                                            <ChevronDown size={12} className="text-white/45 group-hover:text-white" />
                                        ) : (
                                            <ChevronRight size={12} className="text-white/45 group-hover:text-white" />
                                        )}
                                    </button>
                                    {isCollapsed && gIdx > 0 && (
                                        <div className="hidden lg:block h-px bg-white/12 my-2 mx-2" />
                                    )}
                                </>
                            );
                        })()}

                        {/* Group Items (Circular Icon Rings + Minimalist Hairline Contrast List) */}
                        {(expandedGroups[group.title] || isCollapsed) && (
                            <div className={`${expandedGroups[group.title] ? 'block' : 'hidden lg:block'} space-y-0.5 animate-in slide-in-from-top-1 duration-200`}>
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
                                                    group relative flex items-center gap-3 px-2.5 py-2 rounded-xl transition-all duration-200 ${isCollapsed ? 'lg:justify-center lg:px-1' : 'border-b border-white/[0.06] last:border-b-0'}
                                                    ${isTrulyActive
                                                        ? 'bg-white/15 text-white font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-xs'
                                                        : 'text-white/75 font-medium hover:bg-white/[0.07] hover:text-white'}
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
                                                        {isTrulyActive && !isCollapsed && (
                                                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.75)]" />
                                                        )}

                                                        <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border transition-all duration-200 ${
                                                            isTrulyActive
                                                                ? `${groupRingAccent} text-white scale-105`
                                                                : 'border-white/30 bg-white/[0.05] text-white/80 group-hover:border-white/65 group-hover:bg-white/12 group-hover:text-white'
                                                        }`}>
                                                            {Icon ? <Icon size={15} strokeWidth={isTrulyActive ? 2.2 : 1.75} /> : <div className="w-3.5 h-3.5 bg-white/30 rounded-full" />}
                                                        </span>
                                                        <span className={`text-[13px] flex-1 tracking-tight truncate ${isCollapsed ? 'lg:hidden' : ''}`}>{item.label}</span>

                                                        {/* Compact notification dot when collapsed on desktop */}
                                                        {isCollapsed && hasNotifBadge && (
                                                            <span className="hidden lg:block absolute top-1.5 right-2 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-[#113158]" />
                                                        )}

                                                        {/* Notification Badges (Vibrant Pills on Cobalt-Teal Canvas) */}
                                                        <div className={`flex items-center gap-1 ${isCollapsed ? 'lg:hidden' : ''}`}>
                                                            {(item.label === 'RAB' || item.label === 'RAB Yayasan') && pendingRabYayasanCount > 0 && (
                                                                <span className="bg-amber-400 text-[#13261E] text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums shadow-2xs">
                                                                    {pendingRabYayasanCount}
                                                                </span>
                                                            )}
                                                            {(item.label === 'RAB' || item.label === 'RAB Yayasan') && pendingSarprasAssetCount > 0 && (
                                                                <span className="bg-amber-300/25 text-amber-100 border border-amber-300/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 tabular-nums" title={`${pendingSarprasAssetCount} Pengajuan Aset Menunggu Verifikasi Sarpras`}>
                                                                    📦 {pendingSarprasAssetCount}
                                                                </span>
                                                            )}
                                                            {item.label === 'RAB BOS' && pendingRabBosCount > 0 && (
                                                                <span className="bg-emerald-400 text-[#0B291E] text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums shadow-2xs">
                                                                    {pendingRabBosCount}
                                                                </span>
                                                            )}
                                                            {item.label === 'Permintaan Dana' && pendingFundRequestCount > 0 && (
                                                                <span className="bg-sky-300 text-[#0B1E3D] text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums shadow-2xs">
                                                                    {pendingFundRequestCount}
                                                                </span>
                                                            )}
                                                            {item.label === 'Pengeluaran Yayasan' && pendingReportCount > 0 && (
                                                                <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums shadow-2xs">
                                                                    {pendingReportCount}
                                                                </span>
                                                            )}
                                                            {item.label === 'Saldo Yayasan' && pendingReturnYayasanCount > 0 && (
                                                                <span className="bg-sky-300 text-[#0B1E3D] text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums shadow-2xs">
                                                                    {pendingReturnYayasanCount}
                                                                </span>
                                                            )}
                                                            {item.label === 'Saldo BOS' && pendingReturnBosCount > 0 && (
                                                                <span className="bg-emerald-400 text-[#0B291E] text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums shadow-2xs">
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
                    );
                })}
            </nav>

            {/* Bottom Anchor: Quick Search Pill (+ Logout when desktop collapsed) */}
            <div className={`relative z-10 border-t border-white/12 bg-black/15 shrink-0 ${isCollapsed ? 'p-2.5 space-y-2' : 'p-3'}`}>
                <button
                    type="button"
                    onClick={openCmd}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/18 border border-white/20 text-white/90 transition-all cursor-pointer ${isCollapsed ? 'lg:justify-center lg:px-0' : 'justify-between'}`}
                    title="Lompat Cepat ke Menu (Ctrl + K)"
                >
                    <div className="flex items-center gap-2 min-w-0">
                        <Search size={14} className="text-sky-200 shrink-0" />
                        <span className={`text-xs font-semibold tracking-tight truncate ${isCollapsed ? 'lg:hidden' : ''}`}>
                            Cari Menu Cepat
                        </span>
                    </div>
                    <kbd className={`px-1.5 py-0.5 text-[9px] font-bold text-white/85 bg-white/15 border border-white/20 rounded shrink-0 ${isCollapsed ? 'lg:hidden' : ''}`}>
                        Ctrl K
                    </kbd>
                </button>

                {isCollapsed && (
                    <button
                        type="button"
                        className="hidden lg:flex w-full items-center justify-center p-2 text-white/75 hover:text-white hover:bg-rose-500/30 border border-transparent hover:border-rose-300/40 rounded-xl transition-all cursor-pointer"
                        onClick={handleLogout}
                        title="Keluar dari sistem"
                    >
                        <LogOut size={15} />
                    </button>
                )}
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
