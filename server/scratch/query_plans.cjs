process.env.DATABASE_URL = "mysql://mysql:7dff32cee8db81c86c80@127.0.0.1:3306/dion";
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const units = await prisma.unit.findMany({ where: { isDeleted: false } });
        console.log('UNITS IN DATABASE:');
        units.forEach(u => console.log(`- ID: ${u.id}, Name: ${u.name}, FieldId: ${u.fieldId}`));

        const rabPlans = await prisma.rabPlan.findMany();
        console.log('\nRAB PLANS IN DATABASE:');
        for (const p of rabPlans) {
            console.log(`- ID: ${p.id}, UnitId: ${p.unitId}, FieldId: ${p.fieldId}, AcademicYearId: ${p.academicYearId}, Status: ${p.status}`);
            // Let's inspect unique units/fields in the components inside expense
            if (p.expense) {
                const uniqueComponentUnits = new Set();
                Object.entries(p.expense).forEach(([itemId, rawItemPlans]) => {
                    const itemPlans = Array.isArray(rawItemPlans) ? rawItemPlans : [rawItemPlans];
                    itemPlans.forEach(itemPlan => {
                        if (itemPlan && itemPlan.components) {
                            itemPlan.components.forEach(comp => {
                                uniqueComponentUnits.add(comp.unitId || comp.fieldId || 'NONE');
                            });
                        }
                    });
                });
                if (uniqueComponentUnits.size > 0) {
                    console.log(`  Components referenced units/fields:`, Array.from(uniqueComponentUnits));
                }
            }
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await prisma.$disconnect();
    }
}
main();
