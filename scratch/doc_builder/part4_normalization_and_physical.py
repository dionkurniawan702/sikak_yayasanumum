import docx
from helpers import (
    add_h1, add_h2, add_h3, add_p, add_bullet, add_callout, 
    add_table, add_code_block
)

def build_part4(doc):
    # ==========================================
    # 11. FUNCTIONAL DEPENDENCY DAN NORMALISASI
    # ==========================================
    add_h1(doc, "11. FUNCTIONAL DEPENDENCY DAN NORMALISASI")

    add_h2(doc, "11.1 Teori Ketergantungan Fungsional (Functional Dependency - FD)")
    add_p(doc,
        "Dalam teori basis data relasional (Edgar F. Codd), Ketergantungan Fungsional (*Functional Dependency / FD*) "
        "dinyatakan dengan notasi $X \\rightarrow Y$, yang bermakna bahwa nilai dari atribut atau himpunan atribut $X$ "
        "(determinan) secara unik menentukan nilai dari atribut $Y$ (dependen). Analisis ketergantungan fungsional "
        "merupakan instrumen matematika formal untuk mengevaluasi apakah suatu tabel dirancang secara sehat tanpa redundansi data."
    )

    add_p(doc, "Pada entitas operasional SIKAK, berikut adalah ketergantungan fungsional kunci yang diidentifikasi:")
    add_bullet(doc, "id -> { code, name, category, type, balance, parentId, level, isDeleted }", bold_prefix="FD Akun Keuangan (accounts):")
    add_bullet(doc, "id -> { name, nis, unitId, classId, academicYearId, statusId, gender, isDeleted }", bold_prefix="FD Siswa (Student):")
    add_bullet(doc, "id -> { expenseItemId, unitId, academicYearId, totalAmount, date, status, source }", bold_prefix="FD Pengajuan Dana (budget_requests):")
    add_bullet(doc, "id -> { budgetRequestId, expenseItemId, unitId, amount, date, nomorNota, volume, harga, diskon, kategoriAset }", bold_prefix="FD Realisasi Belanja (budget_reports):")
    add_bullet(doc, "{ unitId, academicYearId, incomeItemId, expenseItemId } -> { percentage, destType, destId }", bold_prefix="FD Aturan Distribusi (distribution_settings):")

    add_h2(doc, "11.2 Anomali Data pada Skema Tidak Ternormalisasi (UNF)")
    add_p(doc, 
        "Jika data keuangan disimpan dalam satu tabel tunggal tak ternormalisasi (misalnya menggabungkan data Siswa, "
        "Kelas, Unit, Pos SPP, dan Pembayaran ke dalam satu baris lembar kerja), akan timbul 3 (tiga) anomali fatal:",
        bold_prefix="Potensi Kerusakan Data:"
    )
    add_bullet(doc, "Kita tidak dapat mendaftarkan Unit Sekolah atau Kelas baru sebelum ada siswa pertama yang mendaftar ke kelas tersebut, karena ketiadaan kunci siswa.", bold_prefix="1. Anomali Penyisipan (Insert Anomaly):")
    add_bullet(doc, "Jika nama sebuah Unit Sekolah diubah (misalnya 'SDIT 1' diganti menjadi 'SDIT Permata 1'), maka ribuan baris data transaksi siswa yang memuat nama tersebut harus diperbarui satu per satu. Jika ada satu baris terlewat, terjadi inkonsistensi data serius.", bold_prefix="2. Anomali Pembaruan (Update Anomaly):")
    add_bullet(doc, "Jika seorang siswa lulus atau keluar dan datanya dihapus, informasi tentang tarif kelas atau informasi pos SPP yang terkait secara tidak sengaja ikut terhapus dari sistem.", bold_prefix="3. Anomali Penghapusan (Delete Anomaly):")

    add_h2(doc, "11.3 Tahapan Normalisasi Basis Data")
    add_p(doc, "SIKAK menerapkan tahapan normalisasi bertahap untuk membasmi anomali tersebut:")

    add_h3(doc, "A. Bentuk Normal Pertama (1NF - First Normal Form)")
    add_p(doc,
        "Suatu tabel memenuhi 1NF jika dan hanya jika seluruh atribut bernilai atomik (tidak ada nilai berulang atau "
        "grup berulang / repeating groups) dan setiap baris memiliki kunci utama (*Primary Key*) yang unik. "
        "Pada SIKAK, penetapan iuran siswa tidak disimpan sebagai kolom-kolom berulang seperti `spp1, spp2, gedung, katering` "
        "di tabel `Student`, melainkan didekomposisi ke tabel baris atomik `StudentIncomeDetail` di mana setiap baris "
        "merepresentasikan tepat satu pasang `{ studentId, incomeItemId, amount }`."
    )

    add_h3(doc, "B. Bentuk Normal Kedua (2NF - Second Normal Form)")
    add_p(doc,
        "Suatu tabel memenuhi 2NF jika telah berada dalam 1NF dan setiap atribut non-kunci bergantung sepenuhnya secara "
        "fungsional pada Kunci Utama Utuh (*Full Functional Dependency*), bukan pada bagian dari kunci komposit "
        "(*menghilangkan ketergantungan parsial / partial dependency*). Pada tabel asosiatif `distribution_settings`, "
        "informasi detail tentang Unit atau Akun tidak disimpan berulang di tabel tersebut; yang disimpan hanyalah "
        "Foreign Key `{ unitId, incomeItemId, expenseItemId }` dan atribut unik persentasenya (`percentage`)."
    )

    add_h3(doc, "C. Bentuk Normal Ketiga (3NF - Third Normal Form)")
    add_p(doc,
        "Suatu tabel memenuhi 3NF jika telah berada dalam 2NF dan tidak mengandung Ketergantungan Transitif "
        "(*Transitive Functional Dependency*), di mana atribut non-kunci menentukan atribut non-kunci lainnya ($X \\rightarrow Y$ "
        "dan $Y \\rightarrow Z$). Sebagai contoh: pada tabel `Student`, kita tidak menyimpan `fieldName` (nama bidang) "
        "karena `studentId -> unitId` dan `unitId -> fieldId`. Menyimpan nama bidang pada tabel siswa akan melanggar 3NF. "
        "Oleh karena itu, relasi dinormalisasi berjenjang: Siswa terikat ke Unit, dan Unit terikat ke Bidang (Field)."
    )

    add_h3(doc, "D. Boyce-Codd Normal Form (BCNF)")
    add_p(doc,
        "BCNF adalah penyempurnaan dari 3NF di mana setiap determinan wajib merupakan Superkey. Seluruh tabel master "
        "dan transaksional utama SIKAK telah memenuhi standar BCNF, menjamin integritas logika tanpa celah anomali fungsional."
    )

    add_h2(doc, "11.4 Analisis Kritis Tingkat Lanjut: Desain Hibrida Kolom JSON")
    add_callout(doc,
        "Evaluasi Akademis S2: Penggunaan Kolom JSON pada Tabel Transaksional Modern",
        "Dalam skema fisik SIKAK (`schema.prisma`), tabel `journals` memiliki kolom `entries Json?` dan tabel `budget_requests` memiliki `items Json?`.\n"
        "Tinjauan Kritis:\n"
        "Secara teoretis normalisasi murni Codd (1NF), penyimpanan dokumen JSON dalam satu kolom melanggar prinsip atomisitas ketat. "
        "Namun, dalam arsitektur perangkat lunak enterprise modern (Prisma + MySQL 8.0), pendekatan Hibrida Relasional-Dokumen ini "
        "diadopsi dengan pertimbangan desain yang sangat rasional:\n"
        "1. Kebutuhan Snapshot Pembukuan yang Tidak Boleh Berubah: Rincian jurnal berpasangan (multi-debit multi-kredit) merupakan satu kesatuan transaksi atomik. Menyimpannya dalam satu dokumen JSON mencegah transaksi tersimpan setengah jalan (*dirty read / partial commit*) tanpa memerlukan transaksi tabel ganda yang kompleks.\n"
        "2. Performa Pembacaan (Read Latency): Menampilkan buku besar dan voucher transaksi dapat dilakukan dengan 1 kali query SELECT tanpa perlu melakukan operasi JOIN yang sangat berat ke tabel anak ribuan baris.\n"
        "3. Mitigasi: Integritas nilai debit dan kredit dalam JSON divalidasi secara ketat oleh skrip backend sebelum query INSERT dieksekusi, menjaga kepatuhan akuntansi tetap sempurna.",
        box_type='warn'
    )

    # ==========================================
    # 12. DESAIN LOGIS FINAL
    # ==========================================
    add_h1(doc, "12. DESAIN LOGIS FINAL")

    add_h2(doc, "12.1 Kamus Data Logis (Logical Data Dictionary)")
    add_p(doc,
        "Desain logis mendefinisikan struktur seluruh tabel, kunci primer, kunci asing, dan batasan integritas data "
        "yang telah lolos proses normalisasi secara komprehensif:"
    )

    headers_dict = ["Nama Tabel", "Atribut Kunci", "Tipe Data Logis", "Batasan / Nullability", "Deskripsi Semantik"]
    data_dict = [
        ["users", "id (PK)\nusername (UQ)\nrole\nunitId (FK)", "UUID / String\nString(50)\nEnum/String\nUUID", "NOT NULL\nNOT NULL, UNIQUE\nNOT NULL\nNULLABLE", "Akun pengguna sistem dan otorisasi hak akses."],
        ["accounts", "id (PK)\ncode (UQ)\nname\ntype\nbalance", "UUID\nString(20)\nString(100)\nString(30)\nDecimal(15,2)", "NOT NULL\nNOT NULL\nNOT NULL\nNULLABLE\nDEFAULT 0.00", "Bagan Akun Standar (COA) dan saldo berjalan akuntansi."],
        ["journals", "id (PK)\ndate\nname\nentries\nreference", "UUID\nDateTime\nString(100)\nJSON\nString(50)", "NOT NULL\nNULLABLE\nNULLABLE\nNULLABLE\nNULLABLE", "Voucher jurnal pembukuan double-entry yayasan."],
        ["rab_plans", "id (PK)\nacademicYearId\nunitId\nstatus", "String(100)\nString(36)\nString(36)\nEnum(10)", "NOT NULL\nNOT NULL\nNULLABLE\nDEFAULT 'DRAFT'", "Dokumen usulan Rencana Anggaran Biaya unit."],
        ["budget_requests", "id (PK)\nunitId (FK)\ntotalAmount\nstatus", "UUID\nString(36)\nDecimal(15,2)\nEnum(10)", "NOT NULL\nNULLABLE\nNOT NULL\nDEFAULT 'PENDING'", "Permohonan pencairan dana belanja operasional."],
        ["budget_reports", "id (PK)\nbudgetRequestId (FK)\namount\nnomorNota\nstatus", "UUID\nString(36)\nDecimal(15,2)\nString(100)\nEnum(10)", "NOT NULL\nNULLABLE\nNOT NULL\nNULLABLE\nDEFAULT 'PENDING'", "Realisasi pertanggungjawaban nota belanja lapangan."],
        ["assets", "id (PK)\nname\ncost\nusefulLifeMonths\nstatus", "UUID\nString(150)\nDecimal(15,2)\nInteger\nString(30)", "NOT NULL\nNOT NULL\nNULLABLE\nNULLABLE\nDEFAULT 'Tersedia'", "Buku inventaris fisik dan aset tetap yayasan."],
        ["audit_logs", "id (PK)\nuserId\naction\nentity\ntimestamp", "UUID\nString(36)\nString(50)\nString(50)\nDateTime", "NOT NULL\nNULLABLE\nNOT NULL\nNOT NULL\nDEFAULT NOW()", "Jejak rekam aktivitas transaksi pengguna."]
    ]
    add_table(doc, headers_dict, data_dict, [1.1, 1.4, 1.4, 1.3, 2.0])

    # ==========================================
    # 13. DESAIN FISIK DATABASE MYSQL
    # ==========================================
    add_h1(doc, "13. DESAIN FISIK DATABASE MYSQL")

    add_h2(doc, "13.1 Skrip DDL (Data Definition Language) MySQL Tabel Utama")
    add_p(doc, "Berikut adalah sintaks DDL MySQL resmi yang dihasilkan dari pemetaan Prisma ORM pada sistem SIKAK:")

    add_code_block(doc,
        "-- 1. Tabel Master Bagan Akun (accounts)\n"
        "CREATE TABLE `accounts` (\n"
        "    `id` VARCHAR(36) NOT NULL,\n"
        "    `code` VARCHAR(50) NOT NULL,\n"
        "    `name` VARCHAR(191) NOT NULL,\n"
        "    `category` VARCHAR(50) NULL,\n"
        "    `type` VARCHAR(50) NULL,\n"
        "    `subType` VARCHAR(50) NULL,\n"
        "    `fund` VARCHAR(50) NULL,\n"
        "    `balance` DECIMAL(15, 2) NULL DEFAULT 0.00,\n"
        "    `isParent` BOOLEAN NOT NULL DEFAULT FALSE,\n"
        "    `parentId` VARCHAR(36) NULL,\n"
        "    `level` INT NOT NULL DEFAULT 0,\n"
        "    `orderIdx` INT NOT NULL DEFAULT 0,\n"
        "    `isDeleted` BOOLEAN NOT NULL DEFAULT FALSE,\n"
        "    PRIMARY KEY (`id`),\n"
        "    INDEX `idx_accounts_code` (`code`),\n"
        "    INDEX `idx_accounts_parent` (`parentId`)\n"
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n"
        "-- 2. Tabel Permohonan Anggaran (budget_requests)\n"
        "CREATE TABLE `budget_requests` (\n"
        "    `id` VARCHAR(36) NOT NULL,\n"
        "    `expenseItemId` VARCHAR(36) NULL,\n"
        "    `unitId` VARCHAR(36) NULL,\n"
        "    `fieldId` VARCHAR(36) NULL,\n"
        "    `academicYearId` VARCHAR(36) NULL,\n"
        "    `amount` DECIMAL(15, 2) NULL,\n"
        "    `totalAmount` DECIMAL(15, 2) NULL,\n"
        "    `items` JSON NULL,\n"
        "    `date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n"
        "    `month` VARCHAR(20) NULL,\n"
        "    `year` INT NULL,\n"
        "    `source` VARCHAR(20) NULL,\n"
        "    `description` VARCHAR(255) NULL,\n"
        "    `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',\n"
        "    `notified` BOOLEAN NOT NULL DEFAULT FALSE,\n"
        "    `isDeleted` BOOLEAN NOT NULL DEFAULT FALSE,\n"
        "    PRIMARY KEY (`id`),\n"
        "    INDEX `idx_budget_req_unit` (`unitId`),\n"
        "    INDEX `idx_budget_req_status` (`status`)\n"
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n"
        "-- 3. Tabel Laporan Realisasi SPJ (budget_reports)\n"
        "CREATE TABLE `budget_reports` (\n"
        "    `id` VARCHAR(36) NOT NULL,\n"
        "    `budgetRequestId` VARCHAR(36) NULL,\n"
        "    `expenseItemId` VARCHAR(36) NULL,\n"
        "    `unitId` VARCHAR(36) NULL,\n"
        "    `fieldId` VARCHAR(36) NULL,\n"
        "    `academicYearId` VARCHAR(36) NULL,\n"
        "    `planId` VARCHAR(100) NULL,\n"
        "    `amount` DECIMAL(15, 2) NULL,\n"
        "    `date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n"
        "    `description` TEXT NULL,\n"
        "    `journalId` VARCHAR(36) NULL,\n"
        "    `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',\n"
        "    `nomorNota` VARCHAR(100) NULL,\n"
        "    `volume` DECIMAL(15, 4) NULL,\n"
        "    `satuan` VARCHAR(50) NULL,\n"
        "    `harga` DECIMAL(15, 2) NULL,\n"
        "    `diskon` DECIMAL(15, 2) NULL,\n"
        "    `kategoriAset` VARCHAR(50) NULL DEFAULT 'NON_ASET',\n"
        "    `isDeleted` BOOLEAN NOT NULL DEFAULT FALSE,\n"
        "    PRIMARY KEY (`id`),\n"
        "    INDEX `idx_budget_rep_req` (`budgetRequestId`),\n"
        "    INDEX `idx_budget_rep_unit` (`unitId`),\n"
        "    INDEX `idx_budget_rep_journal` (`journalId`)\n"
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;",
        "Sintaks DDL Fisik Tabel Inti SIKAK (MySQL 8.0 / InnoDB Engine)"
    )

    add_h2(doc, "13.2 Justifikasi Pemilihan Tipe Data Fisik")
    add_p(doc, "Pemilihan tipe data fisik dilakukan secara cermat demi menjamin integritas presisi aritmatika akuntansi:")
    add_bullet(doc, "Seluruh nilai moneter (uang rupiah) wajib menggunakan `DECIMAL(15,2)`, bukan `FLOAT` atau `DOUBLE`. Tipe data floating-point biner rentan terhadap galat pembulatan (*rounding precision error*) pada perhitungan keuangan besar, sedangkan DECIMAL menyimpan representasi nilai desimal eksak berpresisi tinggi.", bold_prefix="1. Penggunaan DECIMAL(15,2):")
    add_bullet(doc, "Penggunaan UUID string 36-karakter memungkinkan pembuatan ID unik secara terdistribusi di sisi aplikasi sebelum data dikirim ke basis data, mencegah konflik ID saat migrasi atau sinkronisasi multi-server.", bold_prefix="2. Kunci Utama Berbasis UUID (VARCHAR(36)):")
    add_bullet(doc, "Menyimpan nilai volume fisik belanja (misal: 12.5000 liter atau 3.7500 rim) dengan tingkat akurasi tinggi.", bold_prefix="3. Penggunaan DECIMAL(15,4) untuk Volume:")

    add_h2(doc, "13.3 Strategi Indeks Basis Data (Indexing Strategy)")
    add_p(doc,
        "Untuk menjaga performa query kecepatan tinggi saat memproses puluhan ribu baris transaksi, SIKAK "
        "menerapkan pengindeksan strategis: (a) Pengindeksan Foreign Key (`unitId`, `academicYearId`) untuk mempercepat JOIN, "
        "(b) Pengindeksan kolom status (`idx_budget_req_status`) untuk mempercepat query filtering transaksi pending pada dasbor admin, "
        "serta (c) Composite Unique Constraint (`@@unique([fieldId, name])` pada Unit) untuk mencegah duplikasi nama unit dalam satu bidang organisasi."
    )
