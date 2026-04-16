const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        const user = await prisma.user.findFirst({
            where: { username: { contains: 'sdit' } }
        });
        if (user) {
            console.log('--- USER info ---');
            console.log(JSON.stringify(user, null, 2));
        } else {
            console.log('User not found');
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

check();
