import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
    try {
        console.log("Checking Academic Years in DB...");
        const years = await prisma.academicYear.findMany();
        console.log("Found:", years.length, "records");
        years.forEach(y => {
            console.log(`- ID: "${y.id}", Name: "${y.name}", Start: ${y.startDate}, End: ${y.endDate}`);
        });
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

check();
