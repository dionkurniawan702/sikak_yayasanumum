const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Looking for units with 'SDIT' in name...");
    const units = await prisma.unit.findMany({
        where: { name: { contains: 'SDIT' } }
    });
    console.log("Found SDIT units:", units.map(u => ({ id: u.id, name: u.name })));

    console.log("\nSearching for duplicate students...");
    
    // Get all students
    const students = await prisma.student.findMany({
        where: { isDeleted: false },
        include: { unit: true, class: true }
    });

    const studentMap = {};
    const duplicates = [];

    students.forEach(s => {
        // Group by name, NIS, and unitId. (Treating null NIS as empty string)
        const key = `${s.name.trim().toLowerCase()}_${(s.nis || '').trim()}_${s.unitId}`;
        
        if (!studentMap[key]) {
            studentMap[key] = [];
        }
        studentMap[key].push(s);
    });

    let duplicateCount = 0;
    for (const key in studentMap) {
        if (studentMap[key].length > 1) {
            duplicateCount++;
            const dupes = studentMap[key];
            console.log(`\nDuplicate Group [${key}] - ${dupes.length} records:`);
            dupes.forEach(d => {
                console.log(`  - ID: ${d.id}, Name: ${d.name}, NIS: ${d.nis}, Unit: ${d.unit?.name}, Class: ${d.class?.name}`);
            });
            duplicates.push(dupes);
        }
    }

    console.log(`\nTotal duplicate groups found: ${duplicateCount}`);
    
    // Check if there's any active transaction with the duplicates, e.g. StudentIncomeDetail
    console.log("\nChecking for related records on duplicates...");
    
}

main().finally(() => prisma.$disconnect());
