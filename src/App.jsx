import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ChartOfAccounts from './pages/ChartOfAccounts';
import JournalEntry from './pages/JournalEntry';

import FixedAssets from './pages/FixedAssets';
import GeneralLedger from './pages/GeneralLedger';
import TrialBalance from './pages/TrialBalance';
import BalanceSheet from './pages/BalanceSheet';
import ActivityReport from './pages/ActivityReport';
import ProgramManagement from './pages/ProgramManagement';
import CashFlowStatement from './pages/CashFlowStatement';
import StatementOfChangesInNetAssets from './pages/StatementOfChangesInNetAssets';
import ProgramReport from './pages/ProgramReport';
import Budgeting from './pages/Budgeting';
import UserManagement from './pages/UserManagement';
import PeriodClosing from './pages/PeriodClosing';
import AuditLog from './pages/AuditLog';
import BackupRestore from './pages/BackupRestore';
import TrashBin from './pages/TrashBin';
import Profile from './pages/Profile';
import FieldUnitManagement from './pages/anggaran/FieldUnitManagement';
import StudentDatabase from './pages/anggaran/StudentDatabase';
import DistributionSettings from './pages/anggaran/DistributionSettings';
import MonthlyRequest from './pages/pelaporan/MonthlyRequest';
import MonthlyReport from './pages/pelaporan/MonthlyReport';
import BudgetDashboard from './pages/pelaporan/BudgetDashboard';
import FundAvailability from './pages/pelaporan/FundAvailability';
import IncomeItemManagement from './pages/anggaran/IncomeItemManagement';
import ExpenseItemManagement from './pages/anggaran/ExpenseItemManagement';
import BudgetProgramManagement from './pages/anggaran/ProgramManagement';
import BOSMasterManagement from './pages/anggaran/BOSMasterManagement';
import ClassManagement from './pages/anggaran/ClassManagement';
import RAB from './pages/anggaran/RAB';
import GenericMasterManagement from './components/GenericMasterManagement';
import { 
    Calendar,
    Users2,
    Briefcase,
    UserCheck,
    UserCircle
} from 'lucide-react';

// Placeholder untuk halaman yang belum dimigrasi
const Placeholder = ({ title }) => (
    <div className="p-8">
        <div className="bg-white p-12 rounded-3xl border border-slate-100 flex flex-col items-center justify-center text-center shadow-xl animate-in">
            <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mb-6">
                <svg className="w-10 h-10 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">{title}</h2>
            <p className="text-slate-500 font-medium max-w-md">Modul ini sedang dalam proses migrasi ke standar PSAK 35 Yayasan Umum. Silakan cek kembali beberapa saat lagi.</p>
        </div>
    </div>
);

// Private Route Guard
function PrivateRoute({ children }) {
    const { state } = useApp();
    return state.currentUser ? children : <Navigate to="/login" />;
}

export default function App() {
    return (
        <AppProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    
                    <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
                        <Route index element={<Dashboard />} />
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
                        
                        <Route path="pengaturan/backup-restore" element={<BackupRestore />} />
                        <Route path="pengaturan/audit-log" element={<AuditLog />} />
                        <Route path="pengaturan/tempat-sampah" element={<TrashBin />} />

                        {/* ANGGARAN & PELAPORAN ROUTES */}
                        <Route path="pelaporan/dashboard" element={<BudgetDashboard />} />
                        <Route path="pelaporan/realisasi" element={<Placeholder title="Dashboard Realisasi" />} />
                        <Route path="pelaporan/bos" element={<Placeholder title="BOS (Bantuan Operasional Sekolah)" />} />
                        <Route path="pelaporan/saldo" element={<Placeholder title="Informasi Saldo Dana" />} />
                        
                        <Route path="anggaran/rab" element={<RAB />} />
                        <Route path="anggaran/arsip-rab" element={<Placeholder title="Arsip RAB" />} />
                        <Route path="anggaran/distribusi" element={<DistributionSettings />} />
                        
                        <Route path="pelaporan/permintaan" element={<MonthlyRequest />} />
                        <Route path="pelaporan/arsip-permintaan" element={<Placeholder title="Arsip Permintaan Dana" />} />
                        <Route path="pelaporan/bulanan" element={<MonthlyReport />} />
                        <Route path="pelaporan/arsip-laporan" element={<Placeholder title="Arsip Laporan Realisasi" />} />
                        <Route path="pelaporan/ketersediaan" element={<FundAvailability />} />

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
                        <Route path="anggaran/master-program" element={<BudgetProgramManagement />} />
                        <Route path="anggaran/master-bos" element={<BOSMasterManagement />} />
                        <Route path="anggaran/sumber-dana" element={<IncomeItemManagement />} />
                    </Route>
                </Routes>
            </BrowserRouter>
        </AppProvider>
    );
}
