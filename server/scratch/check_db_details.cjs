const { PrismaClient } = require('@prisma/client');
process.env.DATABASE_URL = "mysql://mysql:7dff32cee8db81c86c80@127.0.0.1:3306/dion";
const prisma = new PrismaClient();

async function main() {
    console.log('--- Academic Years in DB ---');
    const years = await prisma.academicYear.findMany({ where: { isDeleted: false } });
    console.log(years.map(y => ({ id: y.id, name: y.name, isCurrent: y.isCurrent })));

    console.log('\n--- Distribution Settings count by academicYearId ---');
    const settings = await prisma.distributionSetting.findMany();
    console.log(`Total settings in DB: ${settings.length}`);

    const counts = {};
    settings.forEach(s => {
        const key = s.academicYearId || 'null';
        counts[key] = (counts[key] || 0) + 1;
    });
    console.log(counts);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
