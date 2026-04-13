const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugDelete() {
    const testId = '6282F9F4EB58'; // ID dari screenshot
    console.log(`[Debug] Mencoba soft-delete AcademicYear ID: ${testId}`);
    
    try {
        const item = await prisma.academicYear.findUnique({
            where: { id: testId }
        });
        
        if (!item) {
            console.log('[Debug] Data tidak ditemukan di database dengan ID tersebut.');
            return;
        }
        
        console.log('[Debug] Data ditemukan:', item.name);
        
        const updated = await prisma.academicYear.update({
            where: { id: testId },
            data: { isDeleted: true }
        });
        
        console.log('[Debug] Soft-delete BERHASIL:', updated.name);
    } catch (error) {
        console.error('[Debug] Soft-delete GAGAL!');
        console.error('[Debug] Error Code:', error.code);
        console.error('[Debug] Error Message:', error.message);
        console.error('[Debug] Full Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

debugDelete();
