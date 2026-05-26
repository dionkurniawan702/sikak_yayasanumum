const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Starting cleanup of duplicate students...");
    
    try {
        // Find units with 'SDIT 2' or just run globally if no specific SDIT 2 unit
        const units = await prisma.unit.findMany({
            where: { name: { contains: 'SDIT' } } // Can broaden to 'SDIT 2' or globally
        });
        
        console.log(`Found ${units.length} SDIT units. Proceeding to find duplicates globally...`);

        // Fetch all active students
        const students = await prisma.student.findMany({
            where: { isDeleted: false },
            include: { unit: true, class: true }
        });

        // Group students by name + unitId
        const studentMap = {};
        students.forEach(s => {
            const key = `${s.name.trim().toLowerCase()}_${s.unitId}`;
            if (!studentMap[key]) {
                studentMap[key] = [];
            }
            studentMap[key].push(s);
        });

        let duplicateGroups = 0;
        let deletedCount = 0;
        let mergedIncomeCount = 0;

        for (const key in studentMap) {
            const group = studentMap[key];
            if (group.length > 1) {
                duplicateGroups++;
                // Sort by creation or completeness (assuming older ID is the original)
                // If ids are UUIDs, we just pick the first one as primary.
                const primary = group[0];
                const duplicates = group.slice(1);
                
                console.log(`\nDuplicate Group [${key}] - Keeping ID: ${primary.id}`);
                
                for (const dup of duplicates) {
                    console.log(`  - Found duplicate ID: ${dup.id}, Name: ${dup.name}`);
                    
                    // 1. Find all Income Details of the duplicate
                    const incomeDetails = await prisma.studentIncomeDetail.findMany({
                        where: { studentId: dup.id }
                    });
                    
                    if (incomeDetails.length > 0) {
                        console.log(`    -> Merging ${incomeDetails.length} income details to primary ID.`);
                        // Move income details to primary
                        for (const detail of incomeDetails) {
                            // Only migrate if primary doesn't already have the exact same income detail to avoid unique constraint violations
                            const existingDetail = await prisma.studentIncomeDetail.findFirst({
                                where: {
                                    studentId: primary.id,
                                    incomeItemId: detail.incomeItemId,
                                    amount: detail.amount
                                }
                            });
                            
                            if (!existingDetail) {
                                await prisma.studentIncomeDetail.update({
                                    where: { id: detail.id },
                                    data: { studentId: primary.id }
                                });
                                mergedIncomeCount++;
                            } else {
                                // Delete duplicate detail if primary already has it
                                await prisma.studentIncomeDetail.delete({ where: { id: detail.id } });
                            }
                        }
                    }
                    
                    // 2. Delete the duplicate student
                    await prisma.student.delete({ where: { id: dup.id } });
                    deletedCount++;
                    console.log(`    -> Deleted duplicate student ID: ${dup.id}`);
                }
            }
        }
        
        console.log(`\n--- Cleanup Summary ---`);
        console.log(`Total duplicate groups found: ${duplicateGroups}`);
        console.log(`Total duplicate students deleted: ${deletedCount}`);
        console.log(`Total income records merged: ${mergedIncomeCount}`);
        
    } catch (e) {
        console.error("Error during cleanup:", e);
    }
}

main().finally(() => prisma.$disconnect());
