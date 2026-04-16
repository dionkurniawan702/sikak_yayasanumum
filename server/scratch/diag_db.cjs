const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        const users = await prisma.user.findMany({ where: { isDeleted: false } });
        console.log('--- USERS ---');
        console.table(users.map(u => ({ id: u.id, username: u.username, role: u.role, unitId: u.unitId, fieldId: u.fieldId })));

        const plans = await prisma.rabPlan.findMany();
        console.log('\n--- RAB PLANS ---');
        console.table(plans.map(p => ({ id: p.id, academicYearId: p.academicYearId, unitId: p.unitId, status: p.status })));

        const years = await prisma.academicYear.findMany({ where: { isDeleted: false } });
        console.log('\n--- ACADEMIC YEARS ---');
        console.table(years.map(y => ({ id: y.id, name: y.name, isCurrent: y.isCurrent })));

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

check();
