// ========================================
// Data Awal (Seed Data) — SIKAK YAYASAN UMUM (Base: LAZIS PSAK 109)
// ========================================

// Daftar Akun (Chart of Accounts)
export const initialAccounts = [
    // === 1. ASET ===
    { id: '11000', code: '1-1000', name: 'Aset Lancar', type: 'Aset', subType: 'Aset Lancar', fund: 'Umum', category: 'header', normalBalance: 'debit' },
    { id: '11101', code: '1-1101', name: 'Kas Yayasan (Umum)', type: 'Aset', subType: 'Aset Lancar', fund: 'Dana Umum', category: 'detail', normalBalance: 'debit', initialBalance: 0 },
    { id: '11102', code: '1-1102', name: 'Kas Dana Terikat', type: 'Aset', subType: 'Aset Lancar', fund: 'Dana Terikat', category: 'detail', normalBalance: 'debit', initialBalance: 0 },
    { id: '11111', code: '1-1111', name: 'Bank Yayasan (BSI)', type: 'Aset', subType: 'Aset Lancar', fund: 'Dana Umum', category: 'detail', normalBalance: 'debit', initialBalance: 0 },
    { id: '11112', code: '1-1112', name: 'Bank Dana Terikat', type: 'Aset', subType: 'Aset Lancar', fund: 'Dana Terikat', category: 'detail', normalBalance: 'debit', initialBalance: 0 },
    { id: '11201', code: '1-1201', name: 'Piutang Operasional', type: 'Aset', subType: 'Aset Lancar', fund: 'Dana Umum', category: 'detail', normalBalance: 'debit', initialBalance: 0 },
    
    { id: '12000', code: '1-2000', name: 'Aset Tidak Lancar', type: 'Aset', subType: 'Aset Tidak Lancar', fund: 'Umum', category: 'header', normalBalance: 'debit' },
    { id: '12101', code: '1-2101', name: 'Peralatan Kantor', type: 'Aset', subType: 'Aset Tidak Lancar', fund: 'Dana Umum', category: 'detail', normalBalance: 'debit', initialBalance: 0 },
    { id: '12201', code: '1-2201', name: 'Kendaraan Operasional', type: 'Aset', subType: 'Aset Tidak Lancar', fund: 'Dana Umum', category: 'detail', normalBalance: 'debit', initialBalance: 0 },
    { id: '12901', code: '1-2901', name: 'Akumulasi Penyusutan', type: 'Aset', subType: 'Aset Tidak Lancar', fund: 'Dana Umum', category: 'detail', normalBalance: 'kredit', initialBalance: 0 },

    // === 2. LIABILITAS ===
    { id: '21000', code: '2-1000', name: 'Liabilitas', type: 'Kewajiban', subType: 'Kewajiban Jangka Pendek', fund: 'Umum', category: 'header', normalBalance: 'kredit' },
    { id: '21101', code: '2-1101', name: 'Utang Operasional', type: 'Kewajiban', subType: 'Kewajiban Jangka Pendek', fund: 'Dana Umum', category: 'detail', normalBalance: 'kredit', initialBalance: 0 },
    { id: '21102', code: '2-1102', name: 'Utang Program Sosial', type: 'Kewajiban', subType: 'Kewajiban Jangka Pendek', fund: 'Dana Terikat', category: 'detail', normalBalance: 'kredit', initialBalance: 0 },

    // === 3. ASET NETO (EKUITAS PSAK 35) ===
    { id: '31000', code: '3-1000', name: 'Aset Neto Tanpa Pembatasan', type: 'Saldo Dana', subType: 'Saldo Dana', fund: 'Dana Umum', category: 'header', normalBalance: 'kredit' },
    { id: '31101', code: '3-1101', name: 'Aset Neto Tanpa Pembatasan', type: 'Saldo Dana', subType: 'Saldo Dana', fund: 'Dana Umum', category: 'detail', normalBalance: 'kredit', initialBalance: 0 },

    { id: '32000', code: '3-2000', name: 'Aset Neto Dengan Pembatasan', type: 'Saldo Dana', subType: 'Saldo Dana', fund: 'Dana Terikat', category: 'header', normalBalance: 'kredit' },
    { id: '32101', code: '3-2101', name: 'Aset Neto Terikat Temporer', type: 'Saldo Dana', subType: 'Saldo Dana', fund: 'Dana Terikat', category: 'detail', normalBalance: 'kredit', initialBalance: 0 },
    { id: '32102', code: '3-2102', name: 'Aset Neto Terikat Permanen', type: 'Saldo Dana', subType: 'Saldo Dana', fund: 'Dana Terikat', category: 'detail', normalBalance: 'kredit', initialBalance: 0 },

    // === 4. PENGHASILAN / PENERIMAAN ===
    { id: '41000', code: '4-1000', name: 'Penghasilan Tanpa Pembatasan', type: 'Pendapatan', subType: 'Pendapatan', fund: 'Dana Umum', category: 'header', normalBalance: 'kredit' },
    { id: '41101', code: '4-1101', name: 'Donasi Umum', type: 'Pendapatan', subType: 'Pendapatan', fund: 'Dana Umum', category: 'detail', normalBalance: 'kredit', initialBalance: 0 },
    { id: '41102', code: '4-1102', name: 'Sumbangan Pengurus', type: 'Pendapatan', subType: 'Pendapatan', fund: 'Dana Umum', category: 'detail', normalBalance: 'kredit', initialBalance: 0 },

    { id: '42000', code: '4-2000', name: 'Penghasilan Dengan Pembatasan', type: 'Pendapatan', subType: 'Pendapatan', fund: 'Dana Terikat', category: 'header', normalBalance: 'kredit' },
    { id: '42101', code: '4-2101', name: 'Donasi Terikat Program', type: 'Pendapatan', subType: 'Pendapatan', fund: 'Dana Terikat', category: 'detail', normalBalance: 'kredit', initialBalance: 0 },

    // === 5. BEBAN PROGRAM & OPERASIONAL ===
    { id: '51000', code: '5-1000', name: 'Beban Program Sosial', type: 'Beban', subType: 'Beban Sosial', fund: 'Dana Terikat', category: 'header', normalBalance: 'debit' },
    { id: '51101', code: '5-1101', name: 'Beban Pendidikan', type: 'Beban', subType: 'Beban Sosial', fund: 'Dana Terikat', category: 'detail', normalBalance: 'debit', initialBalance: 0 },
    { id: '51102', code: '5-1102', name: 'Beban Kesehatan', type: 'Beban', subType: 'Beban Sosial', fund: 'Dana Terikat', category: 'detail', normalBalance: 'debit', initialBalance: 0 },

    { id: '61000', code: '6-1000', name: 'Beban Operasional', type: 'Beban', subType: 'Beban Operasional', fund: 'Dana Umum', category: 'header', normalBalance: 'debit' },
    { id: '61101', code: '6-1101', name: 'Gaji Karyawan', type: 'Beban', subType: 'Beban Operasional', fund: 'Dana Umum', category: 'detail', normalBalance: 'debit', initialBalance: 0 },
    { id: '61102', code: '6-1102', name: 'Beban Listrik, Air & Internet', type: 'Beban', subType: 'Beban Operasional', fund: 'Dana Umum', category: 'detail', normalBalance: 'debit', initialBalance: 0 },
];

// Daftar Program Yayasan
export const initialPrograms = [
    { id: 'PRG-001', name: 'Program Pendidikan Gratis', category: 'Sosial' },
    { id: 'PRG-002', name: 'Layanan Kesehatan Masyarakat', category: 'Sosial' },
    { id: 'PRG-GEN', name: 'Umum / Tanpa Program', category: 'Umum' },
];

// Jurnal Awal
export const initialJournals = [];

// Aset Tetap Awal
export const initialAssets = [];
