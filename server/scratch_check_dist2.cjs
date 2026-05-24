import { PrismaClient } from '@prisma/client';
process.env.DATABASE_URL = "mysql://mysql:7dff32cee8db81c86c80@127.0.0.1:3306/dion";
const prisma = new PrismaClient();

async function main() {
    const settings = await prisma.distributionSetting.findMany();
    const grouped = {};
    settings.forEach(s => {
        const key = `${s.unitId} | ${s.incomeItemId}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push({
            id: s.id,
            destType: s.destType,
            destId: s.destId,
            expenseItemId: s.expenseItemId,
            percentage: s.percentage
        });
    });
    console.log(JSON.stringify(grouped, null, 2));
}

main().finally(() => prisma.$disconnect());
