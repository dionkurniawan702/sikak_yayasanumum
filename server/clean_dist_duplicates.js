import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
const prisma = new PrismaClient();

async function cleanDuplicates() {
    console.log("Mulai membersihkan duplikasi Pengaturan Distribusi...");
    try {
        const settings = await prisma.distributionSetting.findMany();
        
        // Group by Unit + IncomeItem + ExpenseItem + DestId
        const groups = {};
        for (const s of settings) {
            const key = `${s.unitId}-${s.incomeItemId}-${s.expenseItemId}-${s.destId}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(s);
        }

        let deletedCount = 0;
        const toDeleteIds = [];

        for (const key in groups) {
            const items = groups[key];
            if (items.length > 1) {
                // Keep the most recent one (or the one with highest percentage if they manually added)
                // We'll just keep the LAST one that was inserted (assuming it's the newest)
                const keep = items[items.length - 1];
                for (let i = 0; i < items.length - 1; i++) {
                    toDeleteIds.push(items[i].id);
                }
            }
        }

        if (toDeleteIds.length > 0) {
            const result = await prisma.distributionSetting.deleteMany({
                where: { id: { in: toDeleteIds } }
            });
            console.log(`Berhasil menghapus ${result.count} data duplikat!`);
        } else {
            console.log("Tidak ada duplikasi yang ditemukan. Data sudah bersih.");
        }
    } catch (err) {
        console.error("Error:", err.message);
    }
}

cleanDuplicates().finally(() => prisma.$disconnect());
