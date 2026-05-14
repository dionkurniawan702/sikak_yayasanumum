// Script: run_migration.cjs
// Tujuan: Menambah kolom plainPassword ke tabel users di database production
// Cara pakai: node scripts/run_migration.cjs
// (Jalankan dari folder server/)

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();

async function runMigration() {
    console.log('[Migration] Menghubungkan ke database...');
    console.log(`[Migration] DB: ${process.env.DATABASE_URL?.replace(/\/\/.*:.*@/, '//****:****@')}`);

    try {
        await prisma.$connect();
        console.log('[Migration] Koneksi berhasil!');

        // Cek apakah kolom sudah ada
        const columns = await prisma.$queryRaw`SHOW COLUMNS FROM users LIKE 'plainPassword'`;
        
        if (columns.length > 0) {
            console.log('[Migration] Kolom `plainPassword` sudah ada. Tidak perlu migrasi.');
        } else {
            console.log('[Migration] Menambahkan kolom `plainPassword`...');
            await prisma.$executeRaw`ALTER TABLE users ADD COLUMN plainPassword VARCHAR(255) NULL AFTER password`;
            console.log('[Migration] ✅ Kolom `plainPassword` berhasil ditambahkan!');
        }

        // Tampilkan struktur tabel
        const desc = await prisma.$queryRaw`DESCRIBE users`;
        console.log('\n[Migration] Struktur tabel users saat ini:');
        desc.forEach(col => {
            console.log(`  - ${col.Field} (${col.Type}) ${col.Null === 'YES' ? 'nullable' : 'required'}`);
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
