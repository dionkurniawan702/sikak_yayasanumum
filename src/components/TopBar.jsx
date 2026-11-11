import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, Calendar, Search } from 'lucide-react';
import { useApp } from '../context/AppContext';

const ROUTE_LABELS = {
    '/': 'Executive Dashboard',
    '/daftar-akun': 'Daftar Akun (COA)',
    '/aset-tetap': 'Database Aset',
    '/jurnal': 'Jurnal Umum',
    '/buku-besar': 'Buku Besar',
    '/tutup-buku': 'Tutup Buku (Closing)',
    '/neraca-saldo': 'Neraca Saldo',
    '/neraca': 'Posisi Keuangan',
    '/laporan-aktivitas': 'Laporan Aktivitas',
    '/arus-kas': 'Arus Kas',
    '/perubahan-dana': 'Perubahan Aset Neto',
    '/calk': 'Catatan Laporan (CALK)',
    '/laporan-program': 'Program Donasi',
    '/pelaporan/dashboard': 'Dashboard Anggaran',
    '/pelaporan/realisasi': 'Dashboard Realisasi',
    '/pelaporan/saldo': 'Saldo Yayasan',
    '/pelaporan/saldo-bos': 'Saldo BOS',
    '/anggaran/rab?source=Yayasan': 'RAB Yayasan',
    '/anggaran/rab?source=BOS': 'RAB BOS',
    '/anggaran/rab': 'Perencanaan RAB',
    '/anggaran/pergeseran': 'Pergeseran Anggaran',
    '/anggaran/arsip-rab': 'Arsip RAB',
    '/anggaran/distribusi': 'Setting Distribusi',
    '/pelaporan/permintaan': 'Permintaan Dana',
    '/pelaporan/arsip-permintaan': 'Arsip Permintaan',
    '/pelaporan/bulanan': 'Pengeluaran Yayasan',
    '/pelaporan/realisasi-bos': 'Pengeluaran BOS',
    '/pelaporan/program-belanja': 'Laporan Program Belanja',
    '/pelaporan/arsip-laporan': 'Arsip Laporan'
};

/**
 * Top Header Bar global bernuansa bersih & lapang (Ferna-inspired).
 * Hanya menampilkan ringkasan konteks aktif dan pemicu Command Palette (Ctrl+K).
 */
export default function TopBar({ onOpenSearch }) {
    const { state } = useApp();
    const location = useLocation();
    const navigate = useNavigate();
    const { currentUser, academicYears = [], globalAcademicYearId, rabPlans = [], budgetReports = [], fundRequests = [] } = state;

    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 11) return 'Selamat pagi';
        if (hour < 15) return 'Selamat siang';
        if (hour < 18) return 'Selamat sore';
        return 'Selamat malam';
    }, []);

    const todayText = useMemo(() => {
        try {
            return new Intl.DateTimeFormat('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            }).format(new Date());
        } catch {
            return '';
        }
    }, []);

    const activeRouteLabel = useMemo(() => {
        const full = `${location.pathname}${location.search}`;
        return ROUTE_LABELS[full] || ROUTE_LABELS[location.pathname] || 'SIKAD Workspace';
    }, [location.pathname, location.search]);

    const activeYearName = useMemo(() => {
        const found = academicYears.find(y => y.id === globalAcademicYearId) || academicYears.find(y => y.isActive);
        return found?.name || '';
    }, [academicYears, globalAcademicYearId]);

    const pendingTotal = useMemo(() => {
        if (currentUser?.role !== 'superadmin') return 0;
        const rab = (rabPlans || []).filter(p => p.status === 'PENDING').length;
        const req = (fundRequests || []).filter(r => r.status === 'PENDING').length;
        const rep = (budgetReports || []).filter(r => r.status === 'PENDING' && !r.isDeleted && r.kategoriAset !== 'PENGEMBALIAN').length;
        return rab + req + rep;
    }, [currentUser?.role, rabPlans, fundRequests, budgetReports]);

    return (
        <header className="print:hidden sticky top-0 z-[500] bg-[#F4F7F5]/90 backdrop-blur-sm border-b border-[#E3E9E5] px-4 lg:px-8 py-3">
            <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-4">
                {/* Left: Greeting & Live Context */}
                <div className="min-w-0 pl-10 lg:pl-0">
                    <p className="text-sm font-bold text-[#142920] truncate leading-tight">
                        {greeting}, <span className="text-[#157A52]">{currentUser?.name || 'Admin'}</span>
                    </p>
                    <div className="flex items-center gap-2 text-[11px] font-medium text-[#6A7B73] mt-0.5 truncate">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#157A52] shrink-0" />
                        <span className="truncate">{todayText} • <span className="font-semibold text-[#3B4F46]">{activeRouteLabel}</span></span>
                    </div>
                </div>

                {/* Center: Search Trigger (Ctrl + K) */}
                <button
                    type="button"
                    onClick={onOpenSearch}
                    className="hidden md:flex items-center justify-between gap-4 w-full max-w-sm bg-white hover:bg-[#FAFDFB] border border-[#DCE4DF] hover:border-[#9FC9B1] rounded-xl px-3.5 py-2 text-left transition-all shadow-[0_1px_2px_rgba(16,32,26,0.03)] cursor-pointer"
                    title="Cari Menu Cepat (Ctrl + K)"
                >
                    <div className="flex items-center gap-2.5 min-w-0">
                        <Search size={15} className="text-[#7A8A82] shrink-0" />
                        <span className="text-xs font-medium text-[#7A8A82] truncate">
                            Cari menu, laporan, RAB, jurnal...
                        </span>
                    </div>
                    <kbd className="px-1.5 py-0.5 text-[10px] font-bold text-[#6A7B73] bg-[#F2F6F4] border border-[#DCE4DF] rounded shrink-0">
                        Ctrl K
                    </kbd>
                </button>

                {/* Right: Active Year Pill + Pending Bell */}
                <div className="flex items-center gap-2.5 shrink-0">
                    <button
                        type="button"
                        onClick={onOpenSearch}
                        className="md:hidden p-2 bg-white border border-[#DCE4DF] rounded-xl text-[#45574F] hover:bg-[#EFF4F1] transition-colors cursor-pointer"
                        title="Cari Menu (Ctrl + K)"
                    >
                        <Search size={16} />
                    </button>

                    {activeYearName && (
                        <div className="hidden sm:flex items-center gap-2 bg-white border border-[#DCE4DF] rounded-xl px-3 py-1.5 shadow-[0_1px_2px_rgba(16,32,26,0.02)]">
                            <Calendar size={14} className="text-[#157A52] shrink-0" />
                            <span className="text-xs font-bold text-[#24372F] tabular-nums">TA {activeYearName}</span>
                        </div>
                    )}

                    {currentUser?.role === 'superadmin' && (
                        <button
                            type="button"
                            onClick={() => navigate('/anggaran/rab?source=Yayasan')}
                            className="relative p-2 bg-white hover:bg-[#EFF4F1] border border-[#DCE4DF] rounded-xl text-[#364940] transition-colors cursor-pointer"
                            title={pendingTotal > 0 ? `${pendingTotal} antrean review menunggu persetujuan` : 'Tidak ada antrean pending'}
                        >
                            <Bell size={17} />
                            {pendingTotal > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-[#157A52] text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-xs tabular-nums">
                                    {pendingTotal}
                                </span>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
}

