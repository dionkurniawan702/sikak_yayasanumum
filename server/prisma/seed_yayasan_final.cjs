const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🚀 --- STARTING COMPREHENSIVE SEEDING YAYASAN UMUM ---');

    // 1. DATA MASTER ACCOUNTS (PSAK 35)
    const accounts = [
        { id: '1-0000', name: 'ASET', type: 'Asset', isParent: true, level: 0 },
        { id: '1-1000', name: 'Aset Lancar', type: 'Asset', isParent: true, parentId: '1-0000', level: 1 },
        { id: '1-1100', name: 'Kas & Setara Kas', type: 'Asset', isParent: true, parentId: '1-1000', level: 2 },
        { id: '1-1101', name: 'Kas Yayasan (Umum)', type: 'Asset', parentId: '1-1100', level: 3 },
        { id: '1-1102', name: 'Kas Dana Terikat', type: 'Asset', parentId: '1-1100', level: 3 },
        { id: '1-1111', name: 'Bank Yayasan (BSI)', type: 'Asset', parentId: '1-1100', level: 3 },
        { id: '1-1112', name: 'Bank Dana Terikat', type: 'Asset', parentId: '1-1100', level: 3 },
        { id: '1-1201', name: 'Piutang Operasional', type: 'Asset', parentId: '1-1000', level: 2 },
        { id: '1-2000', name: 'Aset Tidak Lancar', type: 'Asset', isParent: true, parentId: '1-0000', level: 1 },
        { id: '1-2101', name: 'Peralatan Kantor', type: 'Asset', parentId: '1-2000', level: 2 },
        { id: '1-2201', name: 'Kendaraan Operasional', type: 'Asset', parentId: '1-2000', level: 2 },
        
        { id: '2-0000', name: 'LIABILITAS', type: 'Liability', isParent: true, level: 0 },
        { id: '2-1000', name: 'Utang Jangka Pendek', type: 'Liability', isParent: true, parentId: '2-0000', level: 1 },
        { id: '2-1101', name: 'Utang Gaji', type: 'Liability', parentId: '2-1000', level: 2 },

        { id: '3-0000', name: 'ASET NETO', type: 'Equity', isParent: true, level: 0 },
        { id: '3-1000', name: 'Aset Neto Tidak Terikat', type: 'Equity', parentId: '3-0000', level: 1 },
        { id: '3-2000', name: 'Aset Neto Terikat', type: 'Equity', parentId: '3-0000', level: 1 },
        
        { id: '4-0000', name: 'PENDAPATAN', type: 'Revenue', isParent: true, level: 0 },
        { id: '4-1000', name: 'Pendapatan Pendidikan', type: 'Revenue', parentId: '4-0000', level: 1 },
        { id: '4-2000', name: 'Pendapatan Donasi', type: 'Revenue', parentId: '4-0000', level: 1 },

        { id: '5-0000', name: 'BEBAN', type: 'Expense', isParent: true, level: 0 },
        { id: '5-1000', name: 'Beban Gaji & Upah', type: 'Expense', parentId: '5-0000', level: 1 },
        { id: '5-2000', name: 'Beban Operasional', type: 'Expense', parentId: '5-0000', level: 1 },
        { id: '5-3000', name: 'Beban Program Sosial', type: 'Expense', parentId: '5-0000', level: 1 }
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

    // 3. DATA MASTER UNITS
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
        { name: '2023/2024', isCurrent: false },
        { name: '2024/2025', isCurrent: true },
        { name: '2025/2026', isCurrent: false }
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
        { id: 'prg-1', name: 'Beasiswa Pendidikan Dhuafa', category: 'Sosial', targetAmount: 50000000 },
        { id: 'prg-2', name: 'Pembangunan Masjid Kampus', category: 'Dakwah', targetAmount: 500000000 },
        { id: 'prg-3', name: 'Operasional Panti Asuhan', category: 'Sosial', targetAmount: 100000000 }
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
