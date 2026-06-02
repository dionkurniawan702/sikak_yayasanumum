import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const units = await prisma.unit.findMany();
    console.log("Units:", units.map(u => ({id: u.id, name: u.name})));
    
    const students = await prisma.student.groupBy({
        by: ['unitId'],
        _count: {
            id: true,
        },
    });
    
    console.log("\nStudents per unit:");
    for (const group of students) {
        const unitName = units.find(u => u.id === group.unitId)?.name || 'Unknown';
        console.log(`- ${unitName} (${group.unitId}): ${group._count.id} students`);
    }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
