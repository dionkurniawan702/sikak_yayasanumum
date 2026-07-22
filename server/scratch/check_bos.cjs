process.env.DATABASE_URL = "mysql://mysql:7dff32cee8db81c86c80@127.0.0.1:3306/dion";
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const allocations = await prisma.bosAllocation.findMany();
        console.log('ALL BOS ALLOCATIONS IN DB (total:', allocations.length, '):');
        allocations.forEach(a => {
            console.log(`ID: ${a.id} | UnitId: ${a.unitId} | StageId: ${a.stageId} | PosId: ${a.posId} | Amount: ${a.amount} | isDeleted: ${a.isDeleted} | deletedAt: ${a.deletedAt}`);
        });

        const stages = await prisma.bosStage.findMany();
        console.log('\nSTAGES:');
        stages.forEach(s => console.log(`ID: ${s.id} | Name: ${s.name}`));

        const posList = await prisma.bosPos.findMany();
        console.log('\nPOS LIST:');
        posList.forEach(p => console.log(`ID: ${p.id} | Name: ${p.name}`));

        const units = await prisma.unit.findMany();
        console.log('\nUNITS:');
        units.forEach(u => console.log(`ID: ${u.id} | Name: ${u.name}`));
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await prisma.$disconnect();
    }
}
main();
