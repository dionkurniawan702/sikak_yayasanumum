// ========================================
// Data Awal (Seed Data) — SIKAK YAYASAN UMUM
// ========================================

// Daftar Akun (Chart of Accounts)
export const initialAccounts = [
    // === 1. ASET ===
    { id: '1-0000', code: '1-0000', name: 'ASET', type: 'Aset', subType: 'Aset', fund: 'Umum', category: 'header', normalBalance: 'debit' },
    { id: '1-1000', code: '1-1000', name: 'Aset Lancar', type: 'Aset', subType: 'Aset', fund: 'Umum', category: 'header', normalBalance: 'debit' },
    { id: '1-1100', code: '1-1100', name: 'Kas & Setara Kas', type: 'Aset', subType: 'Aset', fund: 'Umum', category: 'header', normalBalance: 'debit' },
    { id: '1-1101', code: '1-1101', name: 'Kas Yayasan (Tunai)', type: 'Aset', subType: 'Aset', fund: 'Dana Umum', category: 'detail', normalBalance: 'debit', initialBalance: 0 },
    { id: '1-1111', code: '1-1111', name: 'Bank Yayasan (BSI)', type: 'Aset', subType: 'Aset', fund: 'Dana Umum', category: 'detail', normalBalance: 'debit', initialBalance: 0 },
    { id: '1-1112', code: '1-1112', name: 'Bank Dana Terikat (Program)', type: 'Aset', subType: 'Aset', fund: 'Dana Terikat', category: 'detail', normalBalance: 'debit', initialBalance: 0 },

    { id: '1-1200', code: '1-1200', name: 'Piutang & Tagihan', type: 'Aset', subType: 'Aset', fund: 'Umum', category: 'header', normalBalance: 'debit' },
    { id: '1-1201', code: '1-1201', name: 'Piutang Operasional (Pendidikan)', type: 'Aset', subType: 'Aset', fund: 'Dana Umum', category: 'detail', normalBalance: 'debit', initialBalance: 0 },
    { id: '1-1202', code: '1-1202', name: 'Piutang Karyawan', type: 'Aset', subType: 'Aset', fund: 'Dana Umum', category: 'detail', normalBalance: 'debit', initialBalance: 0 },

    { id: '1-2000', code: '1-2000', name: 'Aset Tidak Lancar', type: 'Aset', subType: 'Aset', fund: 'Umum', category: 'header', normalBalance: 'debit' },
    { id: '1-2100', code: '1-2100', name: 'Aset Tetap', type: 'Aset', subType: 'Aset', fund: 'Umum', category: 'header', normalBalance: 'debit' },
    { id: '1-2101', code: '1-2101', name: 'Tanah', type: 'Aset', subType: 'Aset', fund: 'Dana Umum', category: 'detail', normalBalance: 'debit', initialBalance: 0 },
    { id: '1-2102', code: '1-2102', name: 'Bangunan & Renovasi', type: 'Aset', subType: 'Aset', fund: 'Dana Umum', category: 'detail', normalBalance: 'debit', initialBalance: 0 },
    { id: '1-2103', code: '1-2103', name: 'Peralatan Kantor & Mesin', type: 'Aset', subType: 'Aset', fund: 'Dana Umum', category: 'detail', normalBalance: 'debit', initialBalance: 0 },
    { id: '1-2104', code: '1-2104', name: 'Kendaraan Operasional', type: 'Aset', subType: 'Aset', fund: 'Dana Umum', category: 'detail', normalBalance: 'debit', initialBalance: 0 },

    { id: '1-2900', code: '1-2900', name: 'Akumulasi Penyusutan', type: 'Aset', subType: 'Aset', fund: 'Umum', category: 'header', normalBalance: 'kredit' },
    { id: '1-2901', code: '1-2901', name: 'Akm. Penyusutan Bangunan', type: 'Aset', subType: 'Aset', fund: 'Dana Umum', category: 'detail', normalBalance: 'kredit', initialBalance: 0 },
    { id: '1-2902', code: '1-2902', name: 'Akm. Penyusutan Peralatan', type: 'Aset', subType: 'Aset', fund: 'Dana Umum', category: 'detail', normalBalance: 'kredit', initialBalance: 0 },
    { id: '1-2903', code: '1-2903', name: 'Akm. Penyusutan Kendaraan', type: 'Aset', subType: 'Aset', fund: 'Dana Umum', category: 'detail', normalBalance: 'kredit', initialBalance: 0 },

    // === 2. LIABILITAS ===
    { id: '2-0000', code: '2-0000', name: 'LIABILITAS', type: 'Kewajiban', subType: 'Liabilitas', fund: 'Umum', category: 'header', normalBalance: 'kredit' },
    { id: '2-1000', code: '2-1000', name: 'Liabilitas Jangka Pendek', type: 'Kewajiban', subType: 'Liabilitas', fund: 'Umum', category: 'header', normalBalance: 'kredit' },
    { id: '2-1100', code: '2-1100', name: 'Utang Usaha & Operasional', type: 'Kewajiban', subType: 'Liabilitas', fund: 'Umum', category: 'header', normalBalance: 'kredit' },
    { id: '2-1101', code: '2-1101', name: 'Utang Supplier (Buku/Atk)', type: 'Kewajiban', subType: 'Liabilitas', fund: 'Dana Umum', category: 'detail', normalBalance: 'kredit', initialBalance: 0 },
    { id: '2-1102', code: '2-1102', name: 'Utang Gaji & Honorarium', type: 'Kewajiban', subType: 'Liabilitas', fund: 'Dana Umum', category: 'detail', normalBalance: 'kredit', initialBalance: 0 },
    { id: '2-1200', code: '2-1200', name: 'Penerimaan Dimuka', type: 'Kewajiban', subType: 'Liabilitas', fund: 'Dana Umum', category: 'detail', normalBalance: 'kredit', initialBalance: 0 },

    // === 3. ASET NETO (EKUITAS PSAK 35) ===
    { id: '3-0000', code: '3-0000', name: 'ASET NETO', type: 'Aset Neto', subType: 'Aset Neto', fund: 'Umum', category: 'header', normalBalance: 'kredit' },
    { id: '3-1000', code: '3-1000', name: 'Aset Neto Tanpa Pembatasan', type: 'Aset Neto', subType: 'Aset Neto', fund: 'Dana Umum', category: 'header', normalBalance: 'kredit' },
    { id: '3-1101', code: '3-1101', name: 'Saldo Aset Neto Tanpa Pembatasan', type: 'Aset Neto', subType: 'Aset Neto', fund: 'Dana Umum', category: 'detail', normalBalance: 'kredit', initialBalance: 0 },

    { id: '3-2000', code: '3-2000', name: 'Aset Neto Dengan Pembatasan', type: 'Aset Neto', subType: 'Aset Neto', fund: 'Dana Terikat', category: 'header', normalBalance: 'kredit' },
    { id: '3-2101', code: '3-2101', name: 'Aset Neto Terikat Temporer', type: 'Aset Neto', subType: 'Aset Neto', fund: 'Dana Terikat', category: 'detail', normalBalance: 'kredit', initialBalance: 0 },
    { id: '3-2102', code: '3-2102', name: 'Aset Neto Terikat Permanen', type: 'Aset Neto', subType: 'Aset Neto', fund: 'Dana Terikat', category: 'detail', normalBalance: 'kredit', initialBalance: 0 },

    // === 4. PENGHASILAN / PENERIMAAN ===
    { id: '4-0000', code: '4-0000', name: 'PENGHASILAN', type: 'Pendapatan', subType: 'Penghasilan', fund: 'Umum', category: 'header', normalBalance: 'kredit' },
    { id: '4-1000', code: '4-1000', name: 'Penghasilan Tanpa Pembatasan', type: 'Pendapatan', subType: 'Penghasilan', fund: 'Dana Umum', category: 'header', normalBalance: 'kredit' },
    { id: '4-1100', code: '4-1100', name: 'Donasi & Infaq Umum', type: 'Pendapatan', subType: 'Penghasilan', fund: 'Dana Umum', category: 'detail', normalBalance: 'kredit', initialBalance: 0 },
    { id: '4-1200', code: '4-1200', name: 'Pendapatan Jasa Pendidikan', type: 'Pendapatan', subType: 'Penghasilan', fund: 'Dana Umum', category: 'detail', normalBalance: 'kredit', initialBalance: 0 },

    { id: '4-2000', code: '4-2000', name: 'Penghasilan Dengan Pembatasan', type: 'Pendapatan', subType: 'Penghasilan', fund: 'Dana Terikat', category: 'header', normalBalance: 'kredit' },
    { id: '4-2101', code: '4-2101', name: 'Donasi Terikat (Sesuai Program)', type: 'Pendapatan', subType: 'Penghasilan', fund: 'Dana Terikat', category: 'detail', normalBalance: 'kredit', initialBalance: 0 },

    // === 5. BEBAN ===
    { id: '5-0000', code: '5-0000', name: 'BEBAN', type: 'Beban', subType: 'Beban', fund: 'Umum', category: 'header', normalBalance: 'debit' },
    { id: '5-1000', code: '5-1000', name: 'Beban Program (Sosial/Pendidikan)', type: 'Beban', subType: 'Beban', fund: 'Dana Terikat', category: 'header', normalBalance: 'debit' },
    { id: '5-1101', code: '5-1101', name: 'Beban Program Pendidikan', type: 'Beban', subType: 'Beban', fund: 'Dana Terikat', category: 'detail', normalBalance: 'debit', initialBalance: 0 },
    { id: '5-1102', code: '5-1102', name: 'Beban Program Kesehatan/Sosial', type: 'Beban', subType: 'Beban', fund: 'Dana Terikat', category: 'detail', normalBalance: 'debit', initialBalance: 0 },

    { id: '5-2000', code: '5-2000', name: 'Beban Umum & Administrasi', type: 'Beban', subType: 'Beban', fund: 'Dana Umum', category: 'header', normalBalance: 'debit' },
    { id: '5-2101', code: '5-2101', name: 'Beban Gaji & Honor (Umum)', type: 'Beban', subType: 'Beban', fund: 'Dana Umum', category: 'detail', normalBalance: 'debit', initialBalance: 0 },
    { id: '5-2102', code: '5-2102', name: 'Beban Listrik, Air & Komunikasi', type: 'Beban', subType: 'Beban', fund: 'Dana Umum', category: 'detail', normalBalance: 'debit', initialBalance: 0 },
    { id: '5-2103', code: '5-2103', name: 'Beban Rumah Tangga & Kantor', type: 'Beban', subType: 'Beban', fund: 'Dana Umum', category: 'detail', normalBalance: 'debit', initialBalance: 0 },
    { id: '5-2401', code: '5-2401', name: 'Beban Penyusutan Aset Tetap', type: 'Beban', subType: 'Beban', fund: 'Dana Umum', category: 'detail', normalBalance: 'debit', initialBalance: 0 },
];

// Daftar Program Yayasan
export const initialPrograms = [
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
    { id: 'EXP-035', name: 'Sosial', sourceOfFunds: 'Sosial' },
    { id: 'EXP-036', name: 'Aset', sourceOfFunds: 'Persentase Konfigurasi', isFieldOnly: true },
    { id: 'EXP-037', name: 'Pengembangan (umum)', sourceOfFunds: 'Persentase Konfigurasi', isFieldOnly: true }
];

// Tahun Ajaran Awal
export const initialAcademicYears = [
    { id: 'AY-2024-2025', name: '2024-2025', startDate: '2024-07-01', endDate: '2025-06-30', isCurrent: false, isActive: true },
    { id: 'AY-2025-2026', name: '2025-2026', startDate: '2025-07-01', endDate: '2026-06-30', isCurrent: true, isActive: true },
    { id: 'AY-2026-2027', name: '2026-2027', startDate: '2026-07-01', endDate: '2027-06-30', isCurrent: false, isActive: true },
];

// Status Siswa
export const initialStudentStatuses = [
    { id: 'ST-AKTIF', name: 'Aktif' },
    { id: 'ST-LULUS', name: 'Lulus' },
    { id: 'ST-KELUAR', name: 'Keluar' },
];

// Data Siswa Awal (untuk testing RAP)
export const initialStudents = [
    {
        id: 'S-001',
        name: 'Ahmad Faisal',
        nis: '12345',
        unitId: 'SMP', // ID unit harus sesuai dengan yang ada di state
        academicYearId: 'AY-2025-2026',
        statusId: 'ST-AKTIF',
        incomeDetails: [
            { incomeItemId: 'INC-036', amount: 500000 }, // SPP
            { incomeItemId: 'INC-001', amount: 10000000 } // Gedung
        ]
    },
    {
        id: 'S-002',
        name: 'Siti Aminah',
        nis: '12346',
        unitId: 'SMP',
        academicYearId: 'AY-2025-2026',
        statusId: 'ST-AKTIF',
        incomeDetails: [
            { incomeItemId: 'INC-036', amount: 500000 },
            { incomeItemId: 'INC-001', amount: 10000000 }
        ]
    }
];
