process.env.DATABASE_URL = "mysql://mysql:7dff32cee8db81c86c80@127.0.0.1:3306/dion";
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Connecting to local database...');
    const reportIds = ['REL-1783386299120', 'REL-1784172056918'];
    const targetReqId = 'REQ-MRDOLNZQ-B1E';

    for (const id of reportIds) {
        console.log(`Updating ${id} -> budgetRequestId: ${targetReqId}`);
        const res = await prisma.budgetReport.update({
            where: { id: id },
            data: { budgetRequestId: targetReqId }
        });
        console.log(`Result for ${id}:`, res.id, res.budgetRequestId);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
