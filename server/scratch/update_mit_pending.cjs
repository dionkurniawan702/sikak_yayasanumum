const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const mitUnit = await prisma.unit.findFirst({
        where: { name: { contains: 'MIT' } }
    });
    console.log('MIT Unit ID:', mitUnit ? mitUnit.id : 'NOT FOUND');

    if (mitUnit) {
        const updated = await prisma.budgetReport.updateMany({
            where: {
                unitId: mitUnit.id,
                isDeleted: false,
                status: 'PENDING'
            },
            data: {
                status: 'DRAFT',
                notified: false
            }
        });
        console.log(`Successfully updated ${updated.count} reports from PENDING to DRAFT in PostgreSQL database!`);

        const countDraft = await prisma.budgetReport.count({
            where: { unitId: mitUnit.id, isDeleted: false, status: 'DRAFT' }
        });
        const countPending = await prisma.budgetReport.count({
            where: { unitId: mitUnit.id, isDeleted: false, status: 'PENDING' }
        });
        console.log(`Database Status for Unit MIT -> DRAFT: ${countDraft} | PENDING: ${countPending}`);
    }
}

main()
    .catch(err => console.error('Error updating:', err))
    .finally(() => prisma.$disconnect());
