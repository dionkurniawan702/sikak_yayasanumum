const { PrismaClient } = require('@prisma/client');
process.env.DATABASE_URL = 'mysql://mysql:7dff32cee8db81c86c80@127.0.0.1:3306/dion';
const prisma = new PrismaClient();

async function run() {
    try {
        const req = await prisma.budgetRequest.findUnique({
            where: { id: 'REQ-MQ0LTEIR-RBJ' }
        });
        console.log('Request:', JSON.stringify(req, null, 2));

        const units = await prisma.unit.findMany({
            where: { name: { contains: 'SDIT 2' } }
        });
        console.log('SDIT 2 Units:', JSON.stringify(units, null, 2));

        const users = await prisma.user.findMany({
            where: { username: { contains: 'sdit2' } }
        });
        console.log('SDIT 2 Users:', JSON.stringify(users, null, 2));
    } catch (err) {
        console.error('Database query error:', err);
    } finally {
        await prisma.$disconnect();
    }
}
run();
