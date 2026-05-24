const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        console.log("Mencari Unit SDIT 1...");
        const unit = await prisma.unit.findFirst({
            where: { name: { contains: 'SDIT 1' } }
        });

        if (!unit) {
            console.log("Unit SDIT 1 tidak ditemukan!");
            return;
        }

        console.log(`Unit ID: ${unit.id} | Name: ${unit.name}`);

        const settings = await prisma.distributionSetting.findMany({
            where: { unitId: unit.id },
            include: {
                incomeItem: true,
                expenseItem: true
            }
        });

        console.log(`Total aturan distribusi di database untuk SDIT 1: ${settings.length}`);

        const grouped = {};
        for (const s of settings) {
            const incomeName = s.incomeItem ? s.incomeItem.name : s.incomeItemId;
            if (!grouped[incomeName]) grouped[incomeName] = [];
            grouped[incomeName].push(s);
        }

        for (const [income, rules] of Object.entries(grouped)) {
            console.log(`\n=== Penerimaan: ${income} ===`);
            let total = 0;
            for (const r of rules) {
                const expenseName = r.expenseItem ? r.expenseItem.name : r.expenseItemId;
                console.log(`- ${expenseName}: ${r.percentage}%`);
                total += parseFloat(r.percentage);
            }
            console.log(`TOTAL PERSENTASE: ${total}%`);
        }

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

check();
