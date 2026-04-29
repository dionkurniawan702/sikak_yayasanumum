const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🚨 MEMULAI PROSES RESET DATA TRANSAKSI...');

    try {
        // Hapus urutan dari child ke parent untuk menghindari foreign key constraint error
        console.log('Menghapus Laporan Realisasi & Pengembalian...');
        await prisma.budgetReport.deleteMany();

        console.log('Menghapus Detail Pengajuan Dana...');
        await prisma.budgetRequestItem.deleteMany();
        
        console.log('Menghapus Pengajuan Dana (RAB Unit)...');
        await prisma.budgetRequest.deleteMany();

        console.log('Menghapus Detail RAB Tahunan...');
        await prisma.rabItem.deleteMany();
        
        console.log('Menghapus RAB Tahunan...');
        await prisma.rab.deleteMany();

        console.log('Menghapus Jurnal Akuntansi...');
        await prisma.journal.deleteMany();

        console.log('Menghapus Transaksi BOS...');
        if (prisma.bosTransaction) await prisma.bosTransaction.deleteMany();
        if (prisma.bosProgram) await prisma.bosProgram.deleteMany();

        console.log('✅ RESET BERHASIL! Seluruh data testing/transaksi telah dihapus.');
        console.log('✅ Data Master (Akun, Unit, Bidang, User Superadmin) TETAP dipertahankan.');
        
    } catch (error) {
        console.error('❌ Gagal mereset data:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
