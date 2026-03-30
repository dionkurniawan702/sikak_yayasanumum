const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- SEEDING BIDANG & UNIT ---');

    const bidangNames = [
        'Bidang Keuangan',
        'Bidang SDM',
        'Bidang Pendidikan',
        'Bidang Sarana Prasarana',
        'Bidang Pembangunan',
        'Bidang IT'
    ];

    const fields = {};
    for (const name of bidangNames) {
        const field = await prisma.field.upsert({
            where: { id: name }, // Using name as ID temporarily or just creating
            update: { name },
            create: { name }
        });
        fields[name] = field;
        console.log(`Created Bidang: ${name}`);
    }

    const pendidikanUnits = [
        'TKIT 1', 'TKIT 2', 'TKIT 3', 'TAUD SaQu', 'SDIT 1', 'SDIT 2', 'SDIT 3', 
        'MIT SaQu', 'SMPIT Padang', 'SMPIT 50 Kota', 'SMAIT', 'PonPes Putra', 'Ponpes Putri'
    ];

    const pendidikanField = fields['Bidang Pendidikan'];
    for (const unitName of pendidikanUnits) {
        await prisma.unit.upsert({
            where: { id: unitName },
            update: { name: unitName, fieldId: pendidikanField.id },
            create: { name: unitName, fieldId: pendidikanField.id }
        });
        console.log(`Created Unit: ${unitName} under Pendidikan`);
    }

    console.log('--- SEEDING INCOME ITEMS ---');
    const incomeItems = [
        'Gedung', 'Asrama', 'Lokal', 'Perlengkapan', 'SPP', 'Uang Makan', 'Seragam', 
        'Kopiah', 'Paket 1 tahun', 'Kegiatan Kesiswaan', 'Ekskul', 'Uang Ujian', 
        'Infaq Perpustakaan', 'Buku komunikasi & Raport(LKPD)', 
        'Buku H.Doa, Pedoman Pendidikan dan T. Ibadah', 'Buku Pelajaran', 
        'Buku Kontrol Tahfizh', 'Buku Tulis', 'Uang Osis', 'Biaya Pramuka', 
        'Biaya UKS', 'Biaya Berobat', 'Biaya Bus', 'Labor IPA', 'Labor Komputer', 
        'Outing Class', 'Komite', 'Biaya Aplikasi', 'Biaya Try Out', 'Biaya Perpisahan', 
        'Perawatan Sarpras dan Bangunan', 'Biaya Kompre', 'Sosial', 
        'Dana BOS 2024 Tahap 2', 'Dana BOS 2025 Tahap 1'
    ];

    for (const name of incomeItems) {
        await prisma.incomeItem.upsert({
            where: { id: name },
            update: { name },
            create: { name }
        });
        console.log(`Created Income Item: ${name}`);
    }

    console.log('--- SEEDING COMPLETE ---');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
