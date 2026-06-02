import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    // Ambil semua siswa aktif yang gender-nya tidak dikenali
    const students = await prisma.student.findMany({
        where: {
            isDeleted: false,
            NOT: [
                { gender: 'laki-laki' },
                { gender: 'L' },
                { gender: 'l' },
                { gender: 'Laki-laki' },
                { gender: 'LAKI-LAKI' },
                { gender: 'perempuan' },
                { gender: 'Perempuan' },
                { gender: 'PEREMPUAN' },
                { gender: 'P' },
                { gender: 'p' },
            ]
        },
        include: {
            unit: true,
            class: true,
            academicYear: true,
        }
    });

    console.log(`\n=== SISWA TANPA KETERANGAN GENDER (${students.length} siswa) ===\n`);
    students.forEach((s, i) => {
        console.log(`${i + 1}. ${s.name}`);
        console.log(`   NIS         : ${s.nis || '-'}`);
        console.log(`   Unit        : ${s.unit?.name || s.unitId}`);
        console.log(`   Kelas       : ${s.class?.name || '-'}`);
        console.log(`   Tahun Ajaran: ${s.academicYear?.name || '-'}`);
        console.log(`   Gender value: "${s.gender || ''}" (kosong/tidak dikenali)`);
        console.log('');
    });

    if (students.length === 0) {
        console.log('Tidak ada siswa tanpa keterangan gender!');
    }
}

main()
  .catch(e => console.error('Error:', e.message))
  .finally(async () => { await prisma.$disconnect(); });
