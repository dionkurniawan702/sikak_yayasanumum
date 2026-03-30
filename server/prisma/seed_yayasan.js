const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- SEEDING YAYASAN UMUM DATA MASTER ---');

    // 1. CLEAR OLD DATA (Optional, but ensures standard Yayasan structure)
    // Warning: Only use if you want a fresh start
    // await prisma.account.deleteMany({}); 

    // 2. SEED CHART OF ACCOUNTS (COA) STANDAR YAYASAN UMUM
    const accounts = [
        // ASET
        { id: '1-0000', name: 'Aset', type: 'Asset', isHeader: true },
        { id: '1-1000', name: 'Aset Lancar', type: 'Asset', isHeader: true, parentId: '1-0000' },
        { id: '1-1100', name: 'Kas & Setara Kas', type: 'Asset', isHeader: true, parentId: '1-1000' },
        { id: '1-1101', name: 'Kas Bendahara Yayasan', type: 'Asset', parentId: '1-1100' },
        { id: '1-1102', name: 'Bank BSI Yayasan', type: 'Asset', parentId: '1-1100' },
        { id: '1-1103', name: 'Bank Nagari Yayasan', type: 'Asset', parentId: '1-1100' },
        
        // KEWAJIBAN
        { id: '2-0000', name: 'Kewajiban', type: 'Liability', isHeader: true },
        { id: '2-1000', name: 'Kewajiban Jangka Pendek', type: 'Liability', isHeader: true, parentId: '2-0000' },
        { id: '2-1100', name: 'Hutang Operasional', type: 'Liability', parentId: '2-1000' },
        
        // ASET NETO (EKUITAS YAYASAN)
        { id: '3-0000', name: 'Aset Neto', type: 'Equity', isHeader: true },
        { id: '3-1000', name: 'Aset Neto Tidak Terikat', type: 'Equity', parentId: '3-0000' },
        { id: '3-2000', name: 'Aset Neto Terikat Kontemporer', type: 'Equity', parentId: '3-0000' },
        
        // PENDAPATAN
        { id: '4-0000', name: 'Pendapatan', type: 'Revenue', isHeader: true },
        { id: '4-1000', name: 'Pendapatan Pendidikan (SPP/Pendaftaran)', type: 'Revenue', parentId: '4-0000' },
        { id: '4-2000', name: 'Pendapatan Infaq & Shadaqah', type: 'Revenue', parentId: '4-0000' },
        { id: '4-3000', name: 'Pendapatan Hibah/BOS', type: 'Revenue', parentId: '4-0000' },
        
        // BEBAN
        { id: '5-0000', name: 'Beban', type: 'Expense', isHeader: true },
        { id: '5-1000', name: 'Beban Gaji & Tunjangan', type: 'Expense', parentId: '5-0000' },
        { id: '5-2000', name: 'Beban Operasional Pendidikan', type: 'Expense', parentId: '5-0000' },
        { id: '5-3000', name: 'Beban Sarana & Prasarana', type: 'Expense', parentId: '5-0000' },
        { id: '5-4000', name: 'Beban Umum & Administrasi', type: 'Expense', parentId: '5-0000' }
    ];

    console.log('Seeding Accounts...');
    for (const acc of accounts) {
        await prisma.account.upsert({
            where: { id: acc.id },
            update: acc,
            create: acc
        });
    }

    // 2. SEED BIDANG & UNIT
    const bidangNames = ['Bidang Keuangan', 'Bidang SDM', 'Bidang Pendidikan', 'Bidang Sarpras', 'Bidang IT'];
    for (const name of bidangNames) {
        await prisma.field.upsert({ where: { name }, update: { name }, create: { name } });
    }

    const units = ['TKIT', 'SDIT', 'SMPIT', 'SMAIT', 'PonPes', 'Yayasan Pusat'];
    const eduField = await prisma.field.findFirst({ where: { name: 'Bidang Pendidikan' } });
    for (const name of units) {
        await prisma.unit.upsert({ 
            where: { name }, 
            update: { name, fieldId: eduField.id }, 
            create: { name, fieldId: eduField.id } 
        });
    }

    // 3. SEED INCOME ITEMS (SUMBER DANA - 35 items)
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

    for (const name of incomeItems) {
        await prisma.incomeItem.upsert({
            where: { name }, 
            update: { name },
            create: { name }
        });
    }

    console.log('--- SEEDING YAYASAN COMPLETE ---');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
