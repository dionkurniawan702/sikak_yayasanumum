import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import Layout from './components/Layout';
import Login from './pages/Login';
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ChartOfAccounts = lazy(() => import('./pages/ChartOfAccounts'));
const JournalEntry = lazy(() => import('./pages/JournalEntry'));

const FixedAssets = lazy(() => import('./pages/FixedAssets'));
const GeneralLedger = lazy(() => import('./pages/GeneralLedger'));
const TrialBalance = lazy(() => import('./pages/TrialBalance'));
const BalanceSheet = lazy(() => import('./pages/BalanceSheet'));
const ActivityReport = lazy(() => import('./pages/ActivityReport'));
const ProgramManagement = lazy(() => import('./pages/ProgramManagement'));
const CashFlowStatement = lazy(() => import('./pages/CashFlowStatement'));
const StatementOfChangesInNetAssets = lazy(() => import('./pages/StatementOfChangesInNetAssets'));
const ProgramReport = lazy(() => import('./pages/ProgramReport'));
const Budgeting = lazy(() => import('./pages/Budgeting'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const PeriodClosing = lazy(() => import('./pages/PeriodClosing'));
const AuditLog = lazy(() => import('./pages/AuditLog'));
const BackupRestore = lazy(() => import('./pages/BackupRestore'));
const TrashBin = lazy(() => import('./pages/TrashBin'));
const Profile = lazy(() => import('./pages/Profile'));
const FieldUnitManagement = lazy(() => import('./pages/anggaran/FieldUnitManagement'));
const StudentDatabase = lazy(() => import('./pages/anggaran/StudentDatabase'));
const StudentDashboard = lazy(() => import('./pages/anggaran/StudentDashboard'));
const DistributionSettings = lazy(() => import('./pages/anggaran/DistributionSettings'));
const MonthlyRequest = lazy(() => import('./pages/pelaporan/MonthlyRequest'));
const MonthlyReport = lazy(() => import('./pages/pelaporan/MonthlyReport'));
const ArchiveRequests = lazy(() => import('./pages/pelaporan/ArchiveRequests'));
const BudgetDashboard = lazy(() => import('./pages/pelaporan/BudgetDashboard'));
const RealizationDashboard = lazy(() => import('./pages/pelaporan/RealizationDashboard'));
const FundAvailability = lazy(() => import('./pages/pelaporan/FundAvailability'));
const IncomeItemManagement = lazy(() => import('./pages/anggaran/IncomeItemManagement'));
const ExpenseItemManagement = lazy(() => import('./pages/anggaran/ExpenseItemManagement'));
const BudgetProgramManagement = lazy(() => import('./pages/anggaran/ProgramManagement'));
const BOSMasterManagement = lazy(() => import('./pages/anggaran/BOSMasterManagement'));
const ClassManagement = lazy(() => import('./pages/anggaran/ClassManagement'));
const RAB = lazy(() => import('./pages/anggaran/RAB'));
const BOSRecipientUnitManagement = lazy(() => import('./pages/anggaran/BOSRecipientUnitManagement'));
const BOSDatabase = lazy(() => import('./pages/anggaran/BOSDatabase'));
const BOSSaldo = lazy(() => import('./pages/pelaporan/BOSSaldo'));
const BOSMonthlyReport = lazy(() => import('./pages/pelaporan/BOSMonthlyReport'));
const UserManual = lazy(() => import('./pages/anggaran/UserManual'));
import GenericMasterManagement from './components/GenericMasterManagement';
import {
    Calendar,
    Users2,
    Briefcase,
    UserCheck,
    UserCircle,
    RefreshCw,
    Database
} from 'lucide-react';

// Placeholder untuk halaman yang belum dimigrasi
const Placeholder = ({ title }) => (
    <div className="p-8">
        <div className="bg-white p-12 rounded-3xl border border-slate-100 flex flex-col items-center justify-center text-center shadow-xl animate-in">
            <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mb-6">
                <svg className="w-10 h-10 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">{title}</h2>
            <p className="text-slate-500 font-medium max-w-md">Modul ini sedang dalam proses migrasi ke standar SIKAD Dareliman. Silakan cek kembali beberapa saat lagi.</p>
        </div>
    </div>
);

function PrivateRoute({ children }) {
    const { state } = useApp();
    return state.currentUser ? children : <Navigate to="/login" />;
}

function SuperAdminRoute({ children }) {
    const { state } = useApp();
    if (!state.currentUser) return <Navigate to="/login" />;
    return state.currentUser.role === 'superadmin' ? children : <Navigate to="/" />;
}

// Redirect non-superadmin users to the budget dashboard
function RoleBasedIndex() {
    const { state } = useApp();
    const role = state.currentUser?.role;
    if (role === 'admin_unit' || role === 'admin_bidang') {
        return <Navigate to="/pelaporan/dashboard" replace />;
    }
    return <Dashboard />;
}

const SyncOverlay = ({ message }) => (
    <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-500">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-10 rounded-[3rem] shadow-2xl flex flex-col items-center text-center max-w-sm w-full animate-in zoom-in-95 duration-500">
            <div className="relative mb-8">
                <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full animate-pulse" />
                <div className="relative w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-500/40">
                    <RefreshCw className="text-white animate-spin" size={40} />
                </div>
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg border-4 border-slate-900/20">
                    <Database className="text-white" size={14} />
                </div>
            </div>

            <h3 className="text-2xl font-black text-white mb-2 tracking-tight">Menyelaraskan Data</h3>
            <p className="text-blue-100/70 font-medium text-sm leading-relaxed">
                {message || 'Sedang memproses data dengan server pusat. Mohon tunggu sebentar...'}
            </p>

            <div className="mt-8 flex gap-1">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
            </div>
        </div>
    </div>
);

const GlobalProgressLoader = () => {
    const [isLoading, setIsLoading] = React.useState(false);

    React.useEffect(() => {
        const handleStart = () => setIsLoading(true);
        const handleEnd = () => setIsLoading(false);

        window.addEventListener('app-loading-start', handleStart);
        window.addEventListener('app-loading-end', handleEnd);

        return () => {
            window.removeEventListener('app-loading-start', handleStart);
            window.removeEventListener('app-loading-end', handleEnd);
        };
    }, []);

    React.useEffect(() => {
        if (isLoading) {
            document.body.classList.add('cursor-loading-active');
        } else {
            document.body.classList.remove('cursor-loading-active');
        }
    }, [isLoading]);

    return null;
};

const PageLoader = () => (
    <div className="flex items-center justify-center min-h-[60vh] w-full">
        <div className="flex flex-col items-center gap-4 bg-white/50 backdrop-blur-sm p-8 rounded-3xl">
            <RefreshCw className="w-10 h-10 text-blue-500 animate-spin" />
            <p className="text-slate-500 font-medium animate-pulse tracking-wide">Memuat modul...</p>
        </div>
    </div>
);

function AppContent() {
    const { state } = useApp();
    return (
        <BrowserRouter>
            <GlobalProgressLoader />
            <Suspense fallback={<PageLoader />}>
                <Routes>
                    <Route path="/login" element={<Login />} />

                <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
                    <Route index element={<RoleBasedIndex />} />
                    <Route path="daftar-akun" element={<ChartOfAccounts />} />
                    <Route path="jurnal" element={<JournalEntry />} />


                    {/* Reports & Management (Placeholders for now) */}
                    <Route path="profil" element={<Profile />} />
                    <Route path="aset-tetap" element={<FixedAssets />} />
                    <Route path="manajemen-program" element={<ProgramManagement />} />
                    <Route path="manajemen-anggaran" element={<Budgeting />} />
                    <Route path="buku-besar" element={<GeneralLedger />} />
                    <Route path="neraca-saldo" element={<TrialBalance />} />
                    <Route path="neraca" element={<BalanceSheet />} />
                    <Route path="laporan-aktivitas" element={<ActivityReport />} />
                    <Route path="arus-kas" element={<CashFlowStatement />} />
                    <Route path="perubahan-dana" element={<StatementOfChangesInNetAssets />} />
                    <Route path="laporan-program" element={<ProgramReport />} />
                    <Route path="tutup-buku" element={<PeriodClosing />} />
                    <Route path="manajemen-user" element={<UserManagement />} />
                    <Route path="calk" element={<Placeholder title="Catatan Atas Laporan Keuangan" />} />

                    <Route path="pengaturan/backup-restore" element={<SuperAdminRoute><BackupRestore /></SuperAdminRoute>} />
                    <Route path="pengaturan/audit-log" element={<SuperAdminRoute><AuditLog /></SuperAdminRoute>} />
                    <Route path="pengaturan/tempat-sampah" element={<SuperAdminRoute><TrashBin /></SuperAdminRoute>} />

                    {/* ANGGARAN & PELAPORAN ROUTES */}
                    <Route path="pelaporan/dashboard" element={<BudgetDashboard />} />
                    <Route path="pelaporan/realisasi" element={<RealizationDashboard />} />
                    <Route path="pelaporan/bos" element={<Placeholder title="BOS (Bantuan Operasional Sekolah)" />} />
                    <Route path="pelaporan/saldo" element={<FundAvailability />} />
                    <Route path="pelaporan/saldo-bos" element={<BOSSaldo />} />

                    <Route path="anggaran/rab" element={<RAB />} />
                    <Route path="anggaran/arsip-rab" element={<Placeholder title="Arsip RAB" />} />
                    <Route path="anggaran/distribusi" element={<DistributionSettings />} />

                    <Route path="pelaporan/permintaan" element={<MonthlyRequest />} />
                    <Route path="pelaporan/arsip-permintaan" element={<ArchiveRequests />} />
                    <Route path="pelaporan/bulanan" element={<MonthlyReport />} />
                    <Route path="pelaporan/realisasi-bos" element={<BOSMonthlyReport />} />
                    <Route path="pelaporan/arsip-laporan" element={<Placeholder title="Arsip Laporan Realisasi" />} />
                    <Route path="pelaporan/ketersediaan" element={<FundAvailability />} />

                    <Route path="anggaran/dashboard-siswa" element={<StudentDashboard />} />
                    <Route path="anggaran/siswa" element={<StudentDatabase />} />
                    <Route path="anggaran/kelas" element={<ClassManagement />} />

                    <Route path="anggaran/unit-bidang" element={<FieldUnitManagement />} />
                    <Route path="anggaran/tahun-ajaran" element={
                        <GenericMasterManagement
                            title="Tahun Ajaran"
                            entity="academicYears"
                            actionPrefix="ACADEMIC_YEAR"
                            icon={Calendar}
                            description="Kelola periode tahun ajaran aktif dan mendatang"
                        />
                    } />
                    <Route path="anggaran/set-jabatan" element={
                        <GenericMasterManagement
                            title="Set Jabatan"
                            entity="positions"
                            actionPrefix="POSITION"
                            icon={Briefcase}
                            description="Master data jabatan struktural unit dan yayasan"
                        />
                    } />
                    <Route path="anggaran/status-siswa" element={
                        <GenericMasterManagement
                            title="Status Siswa"
                            entity="studentStatuses"
                            actionPrefix="STUDENT_STATUS"
                            icon={UserCheck}
                            description="Master status keberadaan siswa (Aktif, Mutasi, dsb)"
                        />
                    } />
                    <Route path="anggaran/status-ortu" element={
                        <GenericMasterManagement
                            title="Status Orang Tua"
                            entity="parentStatuses"
                            actionPrefix="PARENT_STATUS"
                            icon={UserCircle}
                            description="Master status ekonomi/sosial orang tua"
                        />
                    } />
                    <Route path="anggaran/item-penerimaan" element={<IncomeItemManagement />} />
                    <Route path="anggaran/item-pengeluaran" element={<ExpenseItemManagement />} />
                    <Route path="anggaran/unit-penerima-bos" element={<BOSRecipientUnitManagement />} />
                    <Route path="anggaran/database-bos" element={<BOSDatabase />} />
                    <Route path="anggaran/master-program" element={<BudgetProgramManagement />} />
                    <Route path="anggaran/master-bos" element={<BOSMasterManagement />} />
                    <Route path="anggaran/petunjuk" element={<UserManual />} />
                </Route>
                </Routes>
            </Suspense>
        </BrowserRouter>
    );
}

export default function App() {
    return (
        <AppProvider>
            <AppContent />
        </AppProvider>
    );
}
