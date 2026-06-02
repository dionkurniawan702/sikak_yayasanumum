import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
const prisma = new PrismaClient();

async function cleanStudentDuplicates() {
    console.log("Mulai membersihkan duplikasi Siswa...");
    try {
        const students = await prisma.student.findMany({
            where: { isDeleted: false },
            orderBy: { createdAt: 'asc' }
        });
        
        const groups = {};
        for (const s of students) {
            const key = `${s.name.toLowerCase().trim()}-${s.nis || ''}-${s.classId || ''}-${s.unitId}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(s);
        }

        const toDeleteIds = [];
        let dupesFound = 0;

        for (const key in groups) {
            const items = groups[key];
            if (items.length > 1) {
                // Keep the first one (oldest), delete the rest
                for (let i = 1; i < items.length; i++) {
                    toDeleteIds.push(items[i].id);
                    dupesFound++;
                }
            }
        }

        if (toDeleteIds.length > 0) {
            await prisma.studentIncomeDetail.deleteMany({
                where: { studentId: { in: toDeleteIds } }
            });
            await prisma.student.deleteMany({
                where: { id: { in: toDeleteIds } }
            });
            console.log(`Berhasil menghapus ${dupesFound} data siswa duplikat!`);
        } else {
            console.log("Tidak ada duplikasi siswa yang ditemukan. Data sudah bersih.");
        }
    } catch (err) {
        console.error("Error:", err.message);
    }
}

cleanStudentDuplicates().finally(() => prisma.$disconnect());
