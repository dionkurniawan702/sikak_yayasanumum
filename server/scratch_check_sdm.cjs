
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Fields ---');
    const fields = await prisma.field.findMany({ where: { isDeleted: false } });
    console.log(JSON.stringify(fields, null, 2));

    const sdmField = fields.find(f => f.name.includes('SDM'));
    if (!sdmField) {
        console.log('Field SDM not found');
        return;
    }

    console.log('\n--- User with SDM ---');
    const users = await prisma.user.findMany({ 
        where: { fieldId: sdmField.id, isDeleted: false } 
    });
    console.log(JSON.stringify(users, null, 2));

    console.log('\n--- RAB Plans for SDM ---');
    const rabPlans = await prisma.rabPlan.findMany({
        where: { fieldId: sdmField.id, status: 'APPROVED' }
    });
    console.log(JSON.stringify(rabPlans, null, 2));

    console.log('\n--- Distribution Settings for SDM ---');
    const dists = await prisma.distributionSetting.findMany({
        where: { destId: sdmField.id, isDeleted: false }
    });
    console.log(JSON.stringify(dists, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
