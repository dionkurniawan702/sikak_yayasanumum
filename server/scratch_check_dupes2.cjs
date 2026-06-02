const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const students = await prisma.student.findMany({ where: { unit: { name: 'SDIT 2' }, isDeleted: false } });
    const map = {};
    let dupes = 0;
    students.forEach(s => {
        const key = s.name + '|' + s.nis + '|' + s.classId;
        if(map[key]) {
            map[key]++;
            dupes++;
        } else {
            map[key] = 1;
        }
    });
    console.log('Total students:', students.length, 'Exact duplicates:', dupes);
    
    // Check if there are students with same name but different NIS/Class
    const nameMap = {};
    let dupesByName = 0;
    students.forEach(s => {
        const key = s.name;
        if(nameMap[key]) {
            nameMap[key]++;
            dupesByName++;
        } else {
            nameMap[key] = 1;
        }
    });
    console.log('Total students:', students.length, 'Duplicates by Name only:', dupesByName);
}
main().finally(() => prisma.$disconnect());
