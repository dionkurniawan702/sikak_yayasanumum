const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🚀 --- CHECKING DATABASE STATE BEFORE SEEDING ---');

    // CONDITIONAL SEEDING GUARD: 
    // This prevents the script from restoring categories (like PAUD/SD) that the user intentionally deleted.
    const unitCount = await prisma.unit.count();
    const accountCount = await prisma.account.count();

    if (unitCount > 0 || accountCount > 0) {
        console.log('✅ Master data (Units/Accounts) already exists.');
        console.log('⚠️  Skipping automatic seeding to preserve user deletions and customizations.');
        return;
    }

    console.log('🚀 --- STARTING COMPREHENSIVE SEEDING YAYASAN UMUM ---');

    // 1. DATA MASTER ACCOUNTS (PSAK 35)
    const accounts = [
        // === 1. ASET ===
        { id: '1-0000', code: '1-0000', name: 'ASET', type: 'Aset', subType: 'Aset', isParent: true, level: 0 },
        { id: '1-1000', code: '1-1000', name: 'Aset Lancar', type: 'Aset', subType: 'Aset', isParent: true, parentId: '1-0000', level: 1 },
        { id: '1-1100', code: '1-1100', name: 'Kas & Setara Kas', type: 'Aset', subType: 'Aset', isParent: true, parentId: '1-1000', level: 2 },
        { id: '1-1101', code: '1-1101', name: 'Kas Yayasan (Tunai)', type: 'Aset', subType: 'Aset', parentId: '1-1100', level: 3 },
        { id: '1-1111', code: '1-1111', name: 'Bank Yayasan (BSI)', type: 'Aset', subType: 'Aset', parentId: '1-1100', level: 3 },
        { id: '1-1112', code: '1-1112', name: 'Bank Dana Terikat (Program)', type: 'Aset', subType: 'Aset', parentId: '1-1100', level: 3 },

        { id: '1-1200', code: '1-1200', name: 'Piutang & Tagihan', type: 'Aset', subType: 'Aset', isParent: true, parentId: '1-1000', level: 2 },
        { id: '1-1201', code: '1-1201', name: 'Piutang Operasional (Pendidikan)', type: 'Aset', subType: 'Aset', parentId: '1-1200', level: 3 },
        { id: '1-1202', code: '1-1202', name: 'Piutang Karyawan', type: 'Aset', subType: 'Aset', parentId: '1-1200', level: 3 },

        { id: '1-2000', code: '1-2000', name: 'Aset Tidak Lancar', type: 'Aset', subType: 'Aset', isParent: true, parentId: '1-0000', level: 1 },
        { id: '1-2100', code: '1-2100', name: 'Aset Tetap', type: 'Aset', subType: 'Aset', isParent: true, parentId: '1-2000', level: 2 },
        { id: '1-2101', code: '1-2101', name: 'Tanah', type: 'Aset', subType: 'Aset', parentId: '1-2100', level: 3 },
        { id: '1-2102', code: '1-2102', name: 'Bangunan & Renovasi', type: 'Aset', subType: 'Aset', parentId: '1-2100', level: 3 },
        { id: '1-2103', code: '1-2103', name: 'Peralatan', type: 'Aset', subType: 'Aset', parentId: '1-2100', level: 3 },
        { id: '1-2104', code: '1-2104', name: 'Kendaraan Operasional', type: 'Aset', subType: 'Aset', parentId: '1-2100', level: 3 },

        { id: '1-2900', code: '1-2900', name: 'Akumulasi Penyusutan', type: 'Aset', subType: 'Aset', isParent: true, parentId: '1-2000', level: 2 },
        { id: '1-2901', code: '1-2901', name: 'Akm. Penyusutan Bangunan', type: 'Aset', subType: 'Aset', parentId: '1-2900', level: 3 },
        { id: '1-2902', code: '1-2902', name: 'Akm. Penyusutan Peralatan', type: 'Aset', subType: 'Aset', parentId: '1-2900', level: 3 },
        { id: '1-2903', code: '1-2903', name: 'Akm. Penyusutan Kendaraan', type: 'Aset', subType: 'Aset', parentId: '1-2900', level: 3 },

        // === 2. LIABILITAS ===
        { id: '2-0000', code: '2-0000', name: 'LIABILITAS', type: 'Kewajiban', subType: 'Liabilitas', isParent: true, level: 0 },
        { id: '2-1000', code: '2-1000', name: 'Liabilitas Jangka Pendek', type: 'Kewajiban', subType: 'Liabilitas', isParent: true, parentId: '2-0000', level: 1 },
        { id: '2-1100', code: '2-1100', name: 'Utang Usaha & Operasional', type: 'Kewajiban', subType: 'Liabilitas', isParent: true, parentId: '2-1000', level: 2 },
        { id: '2-1101', code: '2-1101', name: 'Utang Supplier (Buku/Atk)', type: 'Kewajiban', subType: 'Liabilitas', parentId: '2-1100', level: 3 },
        { id: '2-1102', code: '2-1102', name: 'Utang Gaji & Honorarium', type: 'Kewajiban', subType: 'Liabilitas', parentId: '2-1100', level: 3 },
        { id: '2-1200', code: '2-1200', name: 'Penerimaan Dimuka', type: 'Kewajiban', subType: 'Liabilitas', parentId: '2-1000', level: 2 },

        // === 3. ASET NETO ===
        { id: '3-0000', code: '3-0000', name: 'ASET NETO', type: 'Aset Neto', subType: 'Aset Neto', isParent: true, level: 0 },
        { id: '3-1000', code: '3-1000', name: 'Aset Neto Tanpa Pembatasan', type: 'Aset Neto', subType: 'Aset Neto', parentId: '3-0000', level: 1 },
        { id: '3-1101', code: '3-1101', name: 'Saldo Aset Neto Tanpa Pembatasan', type: 'Aset Neto', subType: 'Aset Neto', parentId: '3-1000', level: 2 },
        { id: '3-2000', code: '3-2000', name: 'Aset Neto Dengan Pembatasan', type: 'Aset Neto', subType: 'Aset Neto', parentId: '3-0000', level: 1 },
        { id: '3-2101', code: '3-2101', name: 'Aset Neto Terikat Temporer', type: 'Aset Neto', subType: 'Aset Neto', parentId: '3-2000', level: 2 },
        { id: '3-2102', code: '3-2102', name: 'Aset Neto Terikat Permanen', type: 'Aset Neto', subType: 'Aset Neto', parentId: '3-2000', level: 2 },

        // === 4. PENGHASILAN ===
        { id: '4-0000', code: '4-0000', name: 'PENGHASILAN', type: 'Pendapatan', subType: 'Penghasilan', isParent: true, level: 0 },
        { id: '4-1000', code: '4-1000', name: 'Penghasilan Tanpa Pembatasan', type: 'Pendapatan', subType: 'Penghasilan', parentId: '4-0000', level: 1 },
        { id: '4-1100', code: '4-1100', name: 'Donasi & Infaq Umum', type: 'Pendapatan', subType: 'Penghasilan', parentId: '4-1000', level: 2 },
        { id: '4-1200', code: '4-1200', name: 'Pendapatan Jasa Pendidikan', type: 'Pendapatan', subType: 'Penghasilan', parentId: '4-1000', level: 2 },
        { id: '4-2000', code: '4-2000', name: 'Penghasilan Dengan Pembatasan', type: 'Pendapatan', subType: 'Penghasilan', parentId: '4-0000', level: 1 },
        { id: '4-2101', code: '4-2101', name: 'Donasi Terikat (Sesuai Program)', type: 'Pendapatan', subType: 'Penghasilan', parentId: '4-2000', level: 2 },

        // === 5. BEBAN ===
        { id: '5-0000', code: '5-0000', name: 'BEBAN', type: 'Beban', subType: 'Beban', isParent: true, level: 0 },
        { id: '5-1000', code: '5-1000', name: 'Beban Program (Sosial/Pendidikan)', type: 'Beban', subType: 'Beban', isParent: true, parentId: '5-0000', level: 1 },
        { id: '5-1101', code: '5-1101', name: 'Beban Program Pendidikan', type: 'Beban', subType: 'Beban', parentId: '5-1000', level: 2 },
        { id: '5-1102', code: '5-1102', name: 'Beban Program Kesehatan/Sosial', type: 'Beban', subType: 'Beban', parentId: '5-1000', level: 2 },
        { id: '5-2000', code: '5-2000', name: 'Beban Umum & Administrasi', type: 'Beban', subType: 'Beban', isParent: true, parentId: '5-0000', level: 1 },
        { id: '5-2101', code: '5-2101', name: 'Beban Gaji & Honor (Umum)', type: 'Beban', subType: 'Beban', parentId: '5-2000', level: 2 },
        { id: '5-2102', code: '5-2102', name: 'Beban Listrik, Air & Komunikasi', type: 'Beban', subType: 'Beban', parentId: '5-2000', level: 2 },
        { id: '5-2103', code: '5-2103', name: 'Beban Rumah Tangga & Kantor', type: 'Beban', subType: 'Beban', parentId: '5-2000', level: 2 },
        { id: '5-2401', code: '5-2401', name: 'Beban Penyusutan Aset Tetap', type: 'Beban', subType: 'Beban', parentId: '5-2000', level: 2 }
    ];

    console.log('Seeding Accounts...');
    for (const acc of accounts) {
        await prisma.account.upsert({
            where: { id: acc.id },
            update: acc,
            create: acc
        });
    }

    // 2. DATA MASTER FIELDS (BIDANG)
    const fields = [
        { id: 'fld-1', name: 'Pendidikan' },
        { id: 'fld-2', name: 'Sosial & Kemanusiaan' },
        { id: 'fld-3', name: 'Dakwah & Religi' },
        { id: 'fld-4', name: 'Umum & Administrasi' }
    ];

    console.log('Seeding Fields...');
    for (const f of fields) {
        await prisma.field.upsert({ where: { id: f.id }, update: f, create: f });
    }

    const units = [
        { id: 'unt-1', name: 'Pendidikan Anak Usia Dini (PAUD)', fieldId: 'fld-1' },
        { id: 'unt-2', name: 'Sekolah Dasar (SD)', fieldId: 'fld-1' },
        { id: 'unt-3', name: 'Sekolah Menengah (SMP/SMA)', fieldId: 'fld-1' },
        { id: 'unt-4', name: 'Panti Asuhan', fieldId: 'fld-2' },
        { id: 'unt-5', name: 'Masjid & Dakwah', fieldId: 'fld-3' },
        { id: 'unt-6', name: 'Kantor Pusat Yayasan', fieldId: 'fld-4' }
    ];

    console.log('Seeding Units...');
    for (const u of units) {
        await prisma.unit.upsert({ where: { id: u.id }, update: u, create: u });
    }

    // 2.1 DATA MASTER CLASSES
    const classes = [
        { id: 'cls-1', name: 'TK-A', unitId: 'unt-1' },
        { id: 'cls-2', name: 'TK-B', unitId: 'unt-1' },
        { id: 'cls-3', name: '1-A', unitId: 'unt-2' },
        { id: 'cls-4', name: '7-A', unitId: 'unt-3' },
        { id: 'cls-5', name: '10-IPA-1', unitId: 'unt-4' }
    ];

    console.log('Seeding Classes...');
    for (const c of classes) {
        await prisma.class.upsert({ where: { id: c.id }, update: c, create: c });
    }

    // 4. DATA MASTER INCOME ITEMS (SUMBER DANA / PENERIMAAN)
    const incomeItems = [
        'Gedung', 'Asrama', 'Lokal', 'Perlengkapan', 'Penggajian',
        'Operasional Bulanan', 'Pengembangan dan Pelatihan', 'Uang Makan',
        'Seragam', 'Kopiah', 'Paket 1 tahun', 'Kegiatan Kesiswaan',
        'Ekskul', 'Uang Ujian', 'Infaq Perpustakaan',
        'Buku komunikasi & Raport(LKPD)',
        'Buku H.Doa, Pedoman Pendidikan dan T. Ibadah',
        'Buku Pelajaran', 'Buku Kontrol Tahfizh', 'Buku Tulis',
        'Uang Osis', 'Biaya Pramuka', 'Biaya UKS', 'Biaya Berobat',
        'Biaya Bus', 'Labor IPA', 'Labor Komputer', 'Outing Class',
        'Komite', 'Biaya Aplikasi', 'Biaya Try Out', 'Biaya Perpisahan',
        'Perawatan Sarpras dan Bangunan', 'Biaya Kompre', 'Sosial'
    ];

    console.log('Seeding Income Items...');
    for (const name of incomeItems) {
        await prisma.incomeItem.upsert({ where: { name }, update: { name }, create: { name } });
    }

    // 5. DATA MASTER SUPPORT (YEARS, GROUPS, POSITIONS)
    const academicYears = [
        { name: '2023-2024', isCurrent: false, isActive: true },
        { name: '2024-2025', isCurrent: false, isActive: true },
        { name: '2025-2026', isCurrent: false, isActive: true },
        { name: '2026-2027', isCurrent: true, isActive: true },
        { name: '2027-2028', isCurrent: false, isActive: true }
    ];
    console.log('Seeding Academic Years...');
    for (const y of academicYears) {
        await prisma.academicYear.upsert({ where: { name: y.name }, update: y, create: y });
    }

    const classGroups = [
        { name: 'Reguler' },
        { name: 'Tahfizh' },
        { name: 'Full Day' },
        { name: 'Boarding' }
    ];
    console.log('Seeding Class Groups...');
    for (const g of classGroups) {
        await prisma.classGroup.upsert({ where: { name: g.name }, update: g, create: g });
    }

    const positions = [
        { name: 'Kepala Unit' },
        { name: 'Bendahara Unit' },
        { name: 'Sekretaris' },
        { name: 'Guru Pengajar' },
        { name: 'Staff Administrasi' },
        { name: 'Supervisor' }
    ];
    console.log('Seeding Positions...');
    for (const p of positions) {
        await prisma.position.upsert({ where: { name: p.name }, update: p, create: p });
    }

    const studentStatuses = [
        { name: 'Aktif' },
        { name: 'Cuti' },
        { name: 'Pindah' },
        { name: 'Alumni' },
        { name: 'Dikeluarkan' }
    ];
    console.log('Seeding Student Statuses...');
    for (const s of studentStatuses) {
        await prisma.studentStatus.upsert({ where: { name: s.name }, update: s, create: s });
    }

    const parentStatuses = [
        { name: 'Mampu' },
        { name: 'Kurang Mampu (Miskin)' },
        { name: 'Yatim' },
        { name: 'Piatu' },
        { name: 'Yatim Piatu' }
    ];
    console.log('Seeding Parent Statuses...');
    for (const p of parentStatuses) {
        await prisma.parentStatus.upsert({ where: { name: p.name }, update: p, create: p });
    }

    // 6. DEFAULT USERS
    const users = [
        { username: 'admin', name: 'Super Administrator', role: 'superadmin', password: 'password123' },
        { username: 'bendahara_pendidikan', name: 'Bendahara Pendidikan', role: 'admin_bidang', fieldId: 'fld-1', password: 'password123' },
        { username: 'admin_sd', name: 'Admin SD Unit', role: 'admin_unit', unitId: 'unt-2', password: 'password123' }
    ];

    console.log('Seeding Users...');
    for (const u of users) {
        await prisma.user.upsert({ where: { username: u.username }, update: u, create: u });
    }

    // 7. PROGRAMS
    const programs = [
        { id: 'PRG-GEN', name: 'Umum / Tanpa Program', category: 'Umum' }
    ];
    console.log('Seeding Programs...');
    for (const pr of programs) {
        await prisma.program.upsert({ where: { id: pr.id }, update: pr, create: pr });
    }

    console.log('✨ --- SEEDING COMPLETE ---');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
