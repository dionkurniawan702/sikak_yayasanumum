// run_migration.cjs - CommonJS version for easy execution
// Cara pakai (dari folder server/): node scripts/run_migration.cjs
'use strict';

const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();

async function runMigration() {
    console.log('[Migration] Menghubungkan ke database...');

    try {
        await prisma.$connect();
        console.log('[Migration] Koneksi berhasil!');

        // Cek apakah kolom sudah ada
        const columns = await prisma.$queryRaw`SHOW COLUMNS FROM users LIKE 'plainPassword'`;

        if (columns.length > 0) {
            console.log('[Migration] Kolom `plainPassword` sudah ada. Tidak perlu migrasi.');
        } else {
            console.log('[Migration] Menambahkan kolom `plainPassword`...');
            await prisma.$executeRawUnsafe("ALTER TABLE `users` ADD COLUMN `plainPassword` VARCHAR(255) NULL AFTER `password`");
            console.log('[Migration] ✅ Kolom `plainPassword` berhasil ditambahkan!');
        }

        // Tampilkan struktur tabel
        const desc = await prisma.$queryRaw`DESCRIBE users`;
        console.log('\n[Migration] Struktur tabel users:');
        desc.forEach(col => {
            console.log(`  - ${col.Field} (${col.Type})`);
        });

        console.log('\n[Migration] ✅ Selesai!');
    } catch (error) {
        console.error('[Migration] ❌ Error:', error.message);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

runMigration();
