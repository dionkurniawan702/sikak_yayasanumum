-- Migration: add_plain_password
-- Tambahkan kolom plainPassword ke tabel users
-- Jalankan script ini di MySQL server production

ALTER TABLE `users` 
ADD COLUMN `plainPassword` VARCHAR(255) NULL 
AFTER `password`;

-- Verifikasi hasilnya
DESCRIBE `users`;
