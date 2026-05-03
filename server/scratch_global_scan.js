import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function auditBudget() {
    console.log('--- Audit Mendalam Saldo Anggaran ---');
    
    try {
        const activeYear = await prisma.academicYear.findFirst({
            where: { name: '2026-2027', isDeleted: false }
        });

        if (!activeYear) return console.error('Tahun ajaran tidak ditemukan');

        // 1. Hitung Total Murni Pendapatan Siswa
        const students = await prisma.student.findMany({
            where: { 
                academicYearId: activeYear.id,
                isDeleted: false,
                status: { name: { notIn: ['Alumni', 'Pindah', 'Dikeluarkan', 'Cuti', 'Non Aktif'] } }
            }
        });

        let totalMurni = 0;
        students.forEach(s => {
            (s.incomeDetails || []).forEach(d => {
                totalMurni += (parseFloat(d.amount) || 0);
            });
        });

        console.log(`\nTOTAL MURNI PENDAPATAN SISWA: Rp ${totalMurni.toLocaleString('id-ID')}`);
        console.log(`(Angka yang Anda harapkan adalah: Rp 29.923.062.000)`);

        if (Math.abs(totalMurni - 29923062000) < 1000000) {
            console.log('>>> KONFIRMASI: Total pendapatan siswa SUDAH BENAR.');
            console.log('>>> KESIMPULAN: Masalah ada di aturan distribusi (Double Counting).');
        } else {
            console.log('>>> PERINGATAN: Bahkan total murni pendapatan siswa pun berbeda.');
        }

        // 2. Audit Aturan Distribusi
        const settings = await prisma.distributionSetting.findMany({ where: { isDeleted: false } });
        const unitItemSums = {};

        settings.forEach(s => {
            const key = `${s.unitId}|${s.incomeItemId}`;
            unitItemSums[key] = (unitItemSums[key] || 0) + (parseFloat(s.percentage) || 0);
        });

        console.log('\n[HASIL SCAN PERSENTASE DISTRIBUSI]');
        let foundOver100 = false;
        for (const key in unitItemSums) {
            if (unitItemSums[key] > 100.1) {
                console.log(`Peringatan! Key ${key} memiliki total persentase: ${unitItemSums[key]}%`);
                foundOver100 = true;
            }
        }

        if (!foundOver100) {
            console.log('Semua persentase distribusi di database adalah 100% atau kurang.');
            console.log('Maka masalahnya mungkin ada di logika Dashboard (Double Counting Field vs Unit).');
        }

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

auditBudget();
