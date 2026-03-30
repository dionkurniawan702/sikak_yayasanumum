const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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

async function main() {
    console.log('Seeding Income Items...');
    
    for (const name of incomeItems) {
        // Check if exists
        const existing = await prisma.incomeItem.findFirst({
            where: { name, isDeleted: false }
        });
        
        if (!existing) {
            await prisma.incomeItem.create({
                data: { name }
            });
            console.log(`Added: ${name}`);
        } else {
            console.log(`Skipped (exists): ${name}`);
        }
    }
    
    console.log('Seeding complete!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
