// ========================================
// Data Awal (Seed Data) — SIKAK YAYASAN UMUM
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
    { id: '31000', code: '3-1000', name: 'Aset Neto Tanpa Pembatasan', type: 'Aset Neto', subType: 'Aset Neto', fund: 'Dana Umum', category: 'header', normalBalance: 'kredit' },
    { id: '31101', code: '3-1101', name: 'Aset Neto Tanpa Pembatasan', type: 'Aset Neto', subType: 'Aset Neto', fund: 'Dana Umum', category: 'detail', normalBalance: 'kredit', initialBalance: 0 },

    { id: '32000', code: '3-2000', name: 'Aset Neto Dengan Pembatasan', type: 'Aset Neto', subType: 'Aset Neto', fund: 'Dana Terikat', category: 'header', normalBalance: 'kredit' },
    { id: '32101', code: '3-2101', name: 'Aset Neto Terikat Temporer', type: 'Aset Neto', subType: 'Aset Neto', fund: 'Dana Terikat', category: 'detail', normalBalance: 'kredit', initialBalance: 0 },
    { id: '32102', code: '3-2102', name: 'Aset Neto Terikat Permanen', type: 'Aset Neto', subType: 'Aset Neto', fund: 'Dana Terikat', category: 'detail', normalBalance: 'kredit', initialBalance: 0 },

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

// Item Penerimaan
export const initialIncomeItems = [
    { id: 'INC-001', name: 'Gedung' },
    { id: 'INC-002', name: 'Asrama' },
    { id: 'INC-003', name: 'Lokal' },
    { id: 'INC-004', name: 'Perlengkapan' },
    { id: 'INC-005', name: 'Penggajian' },
    { id: 'INC-006', name: 'Operasional Bulanan' },
    { id: 'INC-007', name: 'Pengembangan dan Pelatihan' },
    { id: 'INC-008', name: 'Uang Makan' },
    { id: 'INC-009', name: 'Seragam' },
    { id: 'INC-010', name: 'Kopiah' },
    { id: 'INC-011', name: 'Paket 1 tahun' },
    { id: 'INC-012', name: 'Kegiatan Kesiswaan' },
    { id: 'INC-013', name: 'Ekskul' },
    { id: 'INC-014', name: 'Uang Ujian' },
    { id: 'INC-015', name: 'Infaq Perpustakaan' },
    { id: 'INC-016', name: 'Buku komunikasi & Raport(LKPD)' },
    { id: 'INC-017', name: 'Buku H.Doa, Pedoman Pendidikan dan T. Ibadah' },
    { id: 'INC-018', name: 'Buku Pelajaran' },
    { id: 'INC-019', name: 'Buku Kontrol Tahfizh' },
    { id: 'INC-020', name: 'Buku Tulis' },
    { id: 'INC-021', name: 'Uang Osis' },
    { id: 'INC-022', name: 'Biaya Pramuka' },
    { id: 'INC-023', name: 'Biaya UKS' },
    { id: 'INC-024', name: 'Biaya Berobat' },
    { id: 'INC-025', name: 'Biaya Bus' },
    { id: 'INC-026', name: 'Labor IPA' },
    { id: 'INC-027', name: 'Labor Komputer' },
    { id: 'INC-028', name: 'Outing Class' },
    { id: 'INC-029', name: 'Komite' },
    { id: 'INC-030', name: 'Biaya Aplikasi' },
    { id: 'INC-031', name: 'Biaya Try Out' },
    { id: 'INC-032', name: 'Biaya Perpisahan' },
    { id: 'INC-033', name: 'Perawatan Sarpras dan Bangunan' },
    { id: 'INC-034', name: 'Biaya Kompre' },
    { id: 'INC-035', name: 'Sosial' },
    { id: 'INC-036', name: 'SPP' }
];

// Item Pengeluaran
export const initialExpenseItems = [
    { id: 'EXP-001', name: 'Gedung', sourceOfFunds: 'Gedung' },
    { id: 'EXP-002', name: 'Asrama', sourceOfFunds: 'Asrama' },
    { id: 'EXP-003', name: 'Lokal', sourceOfFunds: 'Lokal' },
    { id: 'EXP-004', name: 'Perlengkapan', sourceOfFunds: 'Perlengkapan' },
    { id: 'EXP-005', name: 'Penggajian', sourceOfFunds: 'SPP' },
    { id: 'EXP-006', name: 'Operasional Bulanan', sourceOfFunds: 'SPP' },
    { id: 'EXP-007', name: 'Pengembangan dan Pelatihan', sourceOfFunds: 'SPP' },
    { id: 'EXP-008', name: 'Uang Makan', sourceOfFunds: 'Uang Makan' },
    { id: 'EXP-009', name: 'Seragam', sourceOfFunds: 'Seragam' },
    { id: 'EXP-010', name: 'Kopiah', sourceOfFunds: 'Kopiah' },
    { id: 'EXP-011', name: 'Paket 1 tahun', sourceOfFunds: 'Paket 1 tahun' },
    { id: 'EXP-012', name: 'Kegiatan Kesiswaan', sourceOfFunds: 'Kegiatan Kesiswaan' },
    { id: 'EXP-013', name: 'Ekskul', sourceOfFunds: 'Ekskul' },
    { id: 'EXP-014', name: 'Uang Ujian', sourceOfFunds: 'Uang Ujian' },
    { id: 'EXP-015', name: 'Infaq Perpustakaan', sourceOfFunds: 'Infaq Perpustakaan' },
    { id: 'EXP-016', name: 'Buku komunikasi & Raport(LKPD)', sourceOfFunds: 'Buku komunikasi & Raport(LKPD)' },
    { id: 'EXP-017', name: 'Buku H.Doa, Pedoman Pendidikan dan T. Ibadah', sourceOfFunds: 'Buku H.Doa, Pedoman Pendidikan dan T. Ibadah' },
    { id: 'EXP-018', name: 'Buku Pelajaran', sourceOfFunds: 'Buku Pelajaran' },
    { id: 'EXP-019', name: 'Buku Kontrol Tahfizh', sourceOfFunds: 'Buku Kontrol Tahfizh' },
    { id: 'EXP-020', name: 'Buku Tulis', sourceOfFunds: 'Buku Tulis' },
    { id: 'EXP-021', name: 'Uang Osis', sourceOfFunds: 'Uang Osis' },
    { id: 'EXP-022', name: 'Biaya Pramuka', sourceOfFunds: 'Biaya Pramuka' },
    { id: 'EXP-023', name: 'Biaya UKS', sourceOfFunds: 'Biaya UKS' },
    { id: 'EXP-024', name: 'Biaya Berobat', sourceOfFunds: 'Biaya Berobat' },
    { id: 'EXP-025', name: 'Biaya Bus', sourceOfFunds: 'Biaya Bus' },
    { id: 'EXP-026', name: 'Labor IPA', sourceOfFunds: 'Labor IPA' },
    { id: 'EXP-027', name: 'Labor Komputer', sourceOfFunds: 'Labor Komputer' },
    { id: 'EXP-028', name: 'Outing Class', sourceOfFunds: 'Outing Class' },
    { id: 'EXP-029', name: 'Komite', sourceOfFunds: 'Komite' },
    { id: 'EXP-030', name: 'Biaya Aplikasi', sourceOfFunds: 'Biaya Aplikasi' },
    { id: 'EXP-031', name: 'Biaya Try Out', sourceOfFunds: 'Biaya Try Out' },
    { id: 'EXP-032', name: 'Biaya Perpisahan', sourceOfFunds: 'Biaya Perpisahan' },
    { id: 'EXP-033', name: 'Perawatan Sarpras dan Bangunan', sourceOfFunds: 'Perawatan Sarpras dan Bangunan' },
    { id: 'EXP-034', name: 'Biaya Kompre', sourceOfFunds: 'Biaya Kompre' },
    { id: 'EXP-035', name: 'Sosial', sourceOfFunds: 'Sosial' }
];
