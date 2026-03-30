const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- FINAL SEEDING YAYASAN UMUM START ---');

  // 1. DATA MASTER ACCOUNTS (Chart of Accounts)
  const accounts = [
    { id: '1-0000', name: 'Aset', type: 'Asset', isHeader: true },
    { id: '1-1000', name: 'Aset Lancar', type: 'Asset', isHeader: true, parentId: '1-0000' },
    { id: '1-1100', name: 'Kas & Setara Kas', type: 'Asset', isHeader: true, parentId: '1-1000' },
    { id: '1-1101', name: 'Kas Yayasan (Umum)', type: 'Asset', parentId: '1-1100' },
    { id: '1-1102', name: 'Kas Dana Terikat', type: 'Asset', parentId: '1-1100' },
    { id: '1-1111', name: 'Bank Yayasan (BSI)', type: 'Asset', parentId: '1-1100' },
    { id: '1-1112', name: 'Bank Dana Terikat', type: 'Asset', parentId: '1-1100' },
    { id: '1-1201', name: 'Piutang Operasional', type: 'Asset', parentId: '1-1000' },
    { id: '1-2000', name: 'Aset Tidak Lancar', type: 'Asset', isHeader: true, parentId: '1-0000' },
    { id: '1-2101', name: 'Peralatan Kantor', type: 'Asset', parentId: '1-2000' },
    { id: '1-2201', name: 'Kendaraan Operasional', type: 'Asset', parentId: '1-2000' },
    { id: '3-0000', name: 'Aset Neto', type: 'Equity', isHeader: true },
    { id: '3-1000', name: 'Aset Neto Tidak Terikat', type: 'Equity', parentId: '3-0000' },
    { id: '3-2000', name: 'Aset Neto Terikat', type: 'Equity', parentId: '3-0000' },
    { id: '4-0000', name: 'Pendapatan', type: 'Revenue', isHeader: true },
    { id: '4-1000', name: 'Pendapatan Pendidikan', type: 'Revenue', parentId: '4-0000' },
    { id: '5-0000', name: 'Beban', type: 'Expense', isHeader: true },
    { id: '5-1000', name: 'Beban Gaji & Upah', type: 'Expense', parentId: '5-0000' },
    { id: '5-2000', name: 'Beban Operasional', type: 'Expense', parentId: '5-0000' }
  ];

  console.log('Seeding Accounts...');
  for (const acc of accounts) {
    await prisma.account.upsert({ where: { id: acc.id }, update: acc, create: acc });
  }

  // 2. DATA MASTER INCOME ITEMS (35 ITEMS)
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

  // 3. ADMIN USER (Default)
  const adminExists = await prisma.user.findFirst({ where: { username: 'admin' } });
  if (!adminExists) {
    console.log('Seeding Admin User...');
    await prisma.user.create({
      data: {
        username: 'admin',
        password: 'password123', // Usually hashed, but for initial seed it's ok
        name: 'Super Administrator',
        role: 'SUPERADMIN'
      }
    });
  }

  console.log('--- FINAL SEEDING COMPLETE ---');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
