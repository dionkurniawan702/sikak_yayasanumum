import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('--- RabPlan Inspection ---');
    const plans = await prisma.rabPlan.findMany();
    console.log(`Found ${plans.length} plans.`);
    plans.forEach(p => {
        console.log(`ID: ${p.id}, status: ${p.status}`);
        const exp = p.expense || {};
        Object.entries(exp).forEach(([itemId, dataArray]) => {
            console.log(`  Item ID: ${itemId}`);
            if (Array.isArray(dataArray)) {
                dataArray.forEach((planItem, idx) => {
                    console.log(`    Plan [${idx}] ID: ${planItem.id}, total: ${planItem.total}`);
                    if (planItem.components) {
                        console.log(`      Components count: ${planItem.components.length}`);
                        planItem.components.slice(0, 5).forEach((c, cIdx) => {
                            console.log(`        Comp [${cIdx}]: label="${c.label}", volume=${c.volume}, satuan="${c.satuan}", status="${c.status}"`);
                        });
                    }
                });
            } else {
                console.log(`    Legacy structure: ${JSON.stringify(dataArray)}`);
            }
        });
    });
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
