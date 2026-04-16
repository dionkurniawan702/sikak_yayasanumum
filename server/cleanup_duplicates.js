
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const DRY_RUN = process.env.DRY_RUN !== 'false';

async function cleanupDuplicates() {
    console.log(`=== DATABASE CLEANUP (${DRY_RUN ? 'DRY RUN' : 'EXECUTE'}) ===\n`);

    try {
        // 1. KONSOLIDASI TAHUN AJARAN (ACADEMIC YEARS)
        console.log('--- Konsolidasi Tahun Ajaran ---');
        const ay = await prisma.academicYear.findMany();
        
        const ayGroups = {}; // normalizedName -> records[]
        ay.forEach(r => {
            const normalized = r.name.replace(/\//g, '-');
            if (!ayGroups[normalized]) ayGroups[normalized] = [];
            ayGroups[normalized].push(r);
        });

        for (const [name, records] of Object.entries(ayGroups)) {
            if (records.length > 1) {
                console.log(`\nMenemukan duplikat untuk "${name}":`);
                
                // Pilih target (yang memakai '-' atau yang id-nya paling rapi)
                const target = records.find(r => r.name.includes('-')) || records[0];
                const sources = records.filter(r => r.id !== target.id);

                console.log(`  + TARGET (KEEP): ID=${target.id}, Name="${target.name}"`);
                
                for (const source of sources) {
                    console.log(`  - SOURCE (MERGE & DELETE): ID=${source.id}, Name="${source.name}"`);
                    
                    if (!DRY_RUN) {
                        // Move dependencies
                        console.log(`    Moving students from ${source.id} to ${target.id}...`);
                        await prisma.student.updateMany({
                            where: { academicYearId: source.id },
                            data: { academicYearId: target.id }
                        });

                        console.log(`    Moving budget items...`);
                        // Adjust if there are other models referencing academicYearId
                        
                        // Delete old record
                        await prisma.academicYear.delete({ where: { id: source.id } });
                        console.log(`    Deleted ID=${source.id}`);
                    }
                }
            } else if (records[0] && records[0].name.includes('/')) {
                // Rename if only 1 exists but with wrong format
                const record = records[0];
                const newName = record.name.replace(/\//g, '-');
                console.log(`\nNormalisasi format: "${record.name}" -> "${newName}"`);
                if (!DRY_RUN) {
                    await prisma.academicYear.update({
                        where: { id: record.id },
                        data: { name: newName }
                    });
                }
            }
        }

        // 2. KONSOLIDASI SISWA (STUDENTS) - Hanya jika nama & tahun sama persis
        console.log('\n--- Konsolidasi Siswa ---');
        const students = await prisma.student.findMany({
            where: { isDeleted: false },
            include: { _count: { select: { incomeDetails: true, payments: true } } }
        });

        const studentGroups = {}; // name|ayId -> records[]
        students.forEach(s => {
            const key = `${s.name.trim().toLowerCase()}|${s.academicYearId}`;
            if (!studentGroups[key]) studentGroups[key] = [];
            studentGroups[key].push(s);
        });

        for (const [key, records] of Object.entries(studentGroups)) {
            if (records.length > 1) {
                console.log(`\nSiswa duplikat: "${records[0].name}" [AY ID: ${records[0].academicYearId}]`);
                
                // Pilih target (yang punya data histori terbanyak)
                const target = records.sort((a, b) => (b._count.incomeDetails + b._count.payments) - (a._count.incomeDetails + a._count.payments))[0];
                const sources = records.filter(r => r.id !== target.id);

                console.log(`  + TARGET (KEEP): ID=${target.id} (Data count: ${target._count.incomeDetails + target._count.payments})`);
                
                for (const source of sources) {
                    console.log(`  - SOURCE (DELETE): ID=${source.id} (Data count: ${source._count.incomeDetails + source._count.payments})`);
                    if (!DRY_RUN) {
                        // Move dependencies if any (details and payments)
                        await prisma.studentIncomeDetail.updateMany({
                            where: { studentId: source.id },
                            data: { studentId: target.id }
                        });
                        await prisma.studentPayment.updateMany({
                            where: { studentId: source.id },
                            data: { studentId: target.id }
                        });

                        await prisma.student.delete({ where: { id: source.id } });
                    }
                }
            }
        }

        console.log('\nCleanup process complete.');

    } catch (error) {
        console.error('\nERROR during cleanup:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

cleanupDuplicates();
