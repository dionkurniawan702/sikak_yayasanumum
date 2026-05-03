import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function repairDistributions() {
    console.log('--- Memulai Pembersihan Duplikat Distribusi ---');
    
    try {
        // 1. Ambil semua data distribusi
        const allSettings = await prisma.distributionSetting.findMany({
            where: { isDeleted: false }
        });

        console.log(`Total data ditemukan: ${allSettings.length}`);

        const seen = new Set();
        const toDelete = [];
        const kept = [];

        // 2. Identifikasi duplikat
        for (const s of allSettings) {
            // Kunci unik: gabungan Unit + Item Penerimaan + Tujuan (ID & Type) + Item Pengeluaran
            const key = `${s.unitId}-${s.incomeItemId}-${s.destId}-${s.destType}-${s.expenseItemId}`;
            
            if (seen.has(key)) {
                toDelete.push(s.id);
            } else {
                seen.add(key);
                kept.push(s.id);
            }
        }

        console.log(`Data Unik: ${kept.length}`);
        console.log(`Data Duplikat akan dihapus: ${toDelete.length}`);

        if (toDelete.length > 0) {
            // 3. Eksekusi penghapusan
            const result = await prisma.distributionSetting.deleteMany({
                where: {
                    id: { in: toDelete }
                }
            });
            console.log(`BERHASIL: ${result.count} data duplikat telah dihapus dari database.`);
        } else {
            console.log('Selesai: Tidak ditemukan data duplikat.');
        }

    } catch (error) {
        console.error('Terjadi kesalahan saat pembersihan:', error);
    } finally {
        await prisma.$disconnect();
    }
}

repairDistributions();
