import { PrismaClient } from '@prisma/client';

process.env.DATABASE_URL = "mysql://mysql:7dff32cee8db81c86c80@127.0.0.1:3306/dion";
const prisma = new PrismaClient();

async function run() {
    try {
        console.log('--- DIAGNOSTIC: checking REQ-MROG905F-B56 ---');
        // Find the target request
        const req = await prisma.budgetRequest.findFirst({
            where: {
                id: { startsWith: 'REQ-MROG905F-B56' }
            }
        });

        if (!req) {
            console.log('Target request REQ-MROG905F-B56 not found!');
            // Let's search by code if it is a different ID format
            const allReqs = await prisma.budgetRequest.findMany({
                where: {
                    id: { contains: 'MROG905F' }
                }
            });
            console.log('Similar requests:', allReqs.map(r => ({ id: r.id, status: r.status, unitId: r.unitId, fieldId: r.fieldId })));
            return;
        }

        console.log('Target Request details:');
        console.log(JSON.stringify(req, null, 2));

        const { unitId, fieldId, academicYearId, month } = req;
        console.log(`\nUnitId: ${unitId}, FieldId: ${fieldId}, AcademicYearId: ${academicYearId}, Month: ${month}`);

        // Find prior requests in the same academic year
        const priorRequests = await prisma.budgetRequest.findMany({
            where: {
                unitId: unitId || null,
                fieldId: fieldId || null,
                academicYearId: academicYearId,
                status: 'APPROVED',
                isDeleted: false,
                month: { lt: month }
            }
        });

        console.log(`\nPrior Approved Requests found: ${priorRequests.length}`);
        priorRequests.forEach(r => {
            console.log(`- Request [${r.id}] Month: ${r.month}, Status: ${r.status}, Amount: ${r.totalAmount}`);
        });

        const priorRequestIds = priorRequests.map(r => r.id);

        // Find reports for those prior requests
        const priorReports = await prisma.budgetReport.findMany({
            where: {
                budgetRequestId: { in: priorRequestIds },
                isDeleted: false
            }
        });

        console.log(`\nReports for prior requests: ${priorReports.length}`);
        priorReports.forEach(r => {
            console.log(`- Report [${r.id}] Month: ${r.date?.toISOString().slice(0, 7)} (date: ${r.date}), Status: ${r.status}, Amount: ${r.amount}, Kategori: ${r.kategoriAset}, Nota: ${r.nomorNota}`);
        });

        // Find returns (pengembalian)
        const returns = await prisma.budgetReport.findMany({
            where: {
                unitId: unitId || null,
                fieldId: fieldId || null,
                academicYearId: academicYearId,
                kategoriAset: 'PENGEMBALIAN',
                isDeleted: false
            }
        });

        console.log(`\nReturns for unit/field: ${returns.length}`);
        returns.forEach(r => {
            console.log(`- Return [${r.id}] Date: ${r.date}, Status: ${r.status}, Amount: ${r.amount}, Nota: ${r.nomorNota}`);
        });

    } catch (err) {
        console.error('Error running diagnostic script:', err);
    } finally {
        await prisma.$disconnect();
    }
}

run();
