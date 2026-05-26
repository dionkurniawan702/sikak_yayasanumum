const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const sdit1 = await prisma.unit.findFirst({ where: { name: 'SDIT 1' } });
    console.log('Unit SDIT 1:', sdit1?.id);
    
    const student = await prisma.student.findFirst({ 
        where: { name: 'Calon Murid Baru 21' },
        include: { incomeDetails: true, status: true, academicYear: true } 
    });
    console.log('Student:', student?.name, 'Status:', student?.status?.name, 'AcademicYear:', student?.academicYear?.name);
    console.log('Income Details:', student?.incomeDetails);
    
    const incItem = await prisma.incomeItem.findFirst({ where: { name: { contains: 'Buku Tulis' } } });
    console.log('Income Item Buku Tulis:', incItem);
    
    const distSettings = await prisma.distributionSetting.findMany({
        where: { unitId: sdit1?.id, incomeItemId: incItem?.id }
    });
    console.log('Dist Settings for this income item:', distSettings);
    
    const expItem = await prisma.expenseItem.findFirst({ where: { name: { contains: 'Buku Tulis' } } });
    console.log('Expense Item Buku Tulis:', expItem);
}

main().catch(console.error).finally(() => prisma.$disconnect());
