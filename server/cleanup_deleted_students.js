import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function cleanupDeletedStudents() {
    try {
        console.log('🔍 Mencari siswa yang sudah di-soft-delete...');

        const deletedStudents = await prisma.student.findMany({
            where: { isDeleted: true },
            select: { id: true, name: true }
        });

        if (deletedStudents.length === 0) {
            console.log('✅ Tidak ada siswa yang perlu dihapus permanen.');
            return;
        }

        console.log(`📋 Ditemukan ${deletedStudents.length} siswa yang akan dihapus permanen:`);
        deletedStudents.forEach(s => console.log(`   - ${s.name} (${s.id})`));

        const ids = deletedStudents.map(s => s.id);

        // 1. Hapus StudentIncomeDetail yang berelasi
        const deletedDetails = await prisma.studentIncomeDetail.deleteMany({
            where: { studentId: { in: ids } }
        });
        console.log(`\n🗑️  ${deletedDetails.count} baris StudentIncomeDetail dihapus.`);

        // 2. Hapus Student secara permanen
        const deletedResult = await prisma.student.deleteMany({
            where: { id: { in: ids } }
        });
        console.log(`✅ ${deletedResult.count} siswa berhasil dihapus permanen dari database.`);

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

cleanupDeletedStudents();
