import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Mencoba memperbarui struktur database...');
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE AcademicYear 
      ADD COLUMN IF NOT EXISTS startDate DATETIME(3) NULL,
      ADD COLUMN IF NOT EXISTS endDate DATETIME(3) NULL;
    `);
    console.log('Struktur database BERHASIL diperbarui.');
  } catch (error) {
    console.error('GAGAL memperbarui database:', error.message);
    console.log('\nSaran: Mohon jalankan SQL berikut secara manual di phpMyAdmin:');
    console.log('ALTER TABLE AcademicYear ADD COLUMN startDate DATETIME(3) NULL, ADD COLUMN endDate DATETIME(3) NULL;');
  } finally {
    await prisma.$disconnect();
  }
}

main();
