import docx
from helpers import (
    add_h1, add_h2, add_h3, add_p, add_bullet, add_callout, 
    add_table, add_code_block
)

def build_part2(doc):
    # ==========================================
    # 5. ATURAN BISNIS, SKEMA PENGODEAN, DAN TITIK PENGENDALIAN
    # ==========================================
    add_h1(doc, "5. ATURAN BISNIS, SKEMA PENGODEAN, DAN TITIK PENGENDALIAN")

    add_h2(doc, "5.1 Aturan Bisnis Sistem (Business Rules)")
    add_p(doc,
        "Aturan bisnis (*Business Rules*) merupakan sekumpulan batasan logis dan kebijakan operasional yang "
        "ditanamkan ke dalam logika perangkat lunak (*software logic*) untuk memastikan bahwa setiap transaksi "
        "akuntansi dieksekusi secara benar, patuh, dan bebas dari distorsi. Pada aplikasi SIKAK, terdapat "
        "5 (lima) aturan bisnis fundamental:"
    )

    headers_rules = ["No", "Nama Aturan Bisnis", "Deskripsi & Mekanisme Penegakan", "Implikasi Akuntansi"]
    data_rules = [
        ["BR-01", "Prinsip No Budget No Cash (Zero Budget Tolerance)", 
         "Permintaan dana (Budget Request) hanya dapat diajukan jika mata anggaran belanja terdaftar dalam dokumen RAB yang telah disetujui (status APPROVED). Sistem secara otomatis menolak transaksi jika nilai pengajuan melebihi sisa alokasi pagu tahunan.", 
         "Mencegah defisit anggaran tak terkontrol dan memastikan kepatuhan realisasi terhadap rencana kerja."],
        ["BR-02", "Prinsip Jurnal Berpasangan Seimbang (Balanced Double-Entry)", 
         "Setiap transaksi pembukuan ke tabel journals wajib memiliki total debit sama dengan total kredit (Sum(Debit) = Sum(Credit)). Backend menolak penyimpanan draf jurnal jika selisih tidak bernilai 0 (nol).", 
         "Menjamin integritas persamaan dasar akuntansi: Aset = Kewajiban + Aset Neto."],
        ["BR-03", "Formula Otomasi Bagi Hasil (Distribution Formula)", 
         "Setiap pelunasan iuran siswa (SPP) otomatis dialokasikan ke pos belanja atau kas tujuan berdasarkan tabel distribution_settings. Contoh: 70% Operasional Unit, 20% Kas Yayasan, 10% Pengembangan.", 
         "Menghilangkan manipulasi kasir unit dalam menyembunyikan setoran bagi hasil yayasan."],
        ["BR-04", "Ambang Batas Kapitalisasi Aset (Capitalization Threshold)", 
         "Belanja operasional yang memiliki masa manfaat ekonomis > 12 bulan dan ditandai sebagai 'ASET' otomatis memicu pembuatan entri baru di tabel assets dan pembukuan jurnal reklasifikasi aset tetap.", 
         "Kepatuhan pelaporan Laporan Posisi Keuangan ISAK 35 (pemisahan belanja modal vs beban operasional)."],
        ["BR-05", "Keabadian Jejak Rekam (Immutable Audit Trail)", 
         "Setiap tindakan penambahan, pengubahan, penghapusan, atau persetujuan status wajib dicatat ke tabel audit_logs. Tabel ini bersifat append-only (hanya dapat dibaca superadmin dan tidak dapat disunting).", 
         "Memberikan jaminan non-repudiasi (transparansi hukum) jika terjadi sengketa atau audit forensik."]
    ]
    add_table(doc, headers_rules, data_rules, [0.6, 1.8, 2.8, 1.6])

    add_h2(doc, "5.2 Skema Pengodean (Coding Schemes)")
    add_p(doc,
        "Skema pengodean terstruktur dirancang untuk mempermudah identifikasi entitas, pengelompokan data, "
        "dan efisiensi pemrosesan query basis data. SIKAK menerapkan skema pengodean hierarkis dan bermakna (*significant codes*):"
    )

    add_h3(doc, "A. Bagan Akun Standar / Chart of Accounts (COA) Hierarkis 4-Level")
    add_p(doc, "Struktur kode akun akuntansi menggunakan format blok berjenjang `X.X.XX.XX`:")
    add_bullet(doc, "Level 1 (Klasifikasi Utama): 1 = Aset, 2 = Liabilitas, 3 = Aset Neto (Ekuitas), 4 = Pendapatan, 5 = Beban.", bold_prefix="Digit 1:")
    add_bullet(doc, "Level 2 (Kelompok Akun): 1.1 = Aset Lancar, 1.2 = Aset Tetap, 5.1 = Beban Operasional Pendidikan, 5.2 = Beban Administrasi & Umum.", bold_prefix="Digit 2:")
    add_bullet(doc, "Level 3 (Sub-Kelompok): 1.1.01 = Kas dan Setara Kas, 1.1.02 = Kas di Bank, 5.1.01 = Beban Gaji Guru & Karyawan.", bold_prefix="Digit 3-4:")
    add_bullet(doc, "Level 4 (Akun Spesifik / Satker): 1.1.01.01 = Kas Kasir SDIT 1, 1.1.01.02 = Kas Kasir SMPIT, 1.1.02.01 = Bank BSI Operasional Yayasan.", bold_prefix="Digit 5-6:")

    add_h3(doc, "B. Skema Pengodean Dokumen dan Master Data")
    headers_kode = ["Objek Data", "Format Kode / Pola Penomoran", "Contoh Nilai Riil", "Keterangan"]
    data_kode = [
        ["Tahun Ajaran", "AY-[TAHUN_MULAI]-[TAHUN_SELESAI]", "AY-2026-2027", "Penanda siklus akademik"],
        ["Rencana Anggaran (RAB)", "[TAHUN]-[UNIT_KODE]-[SUMBER]", "AY-2026-2027-UNIT_SDIT1-YAYASAN", "Unik per unit per tahun per sumber dana"],
        ["Permintaan Dana", "REQ-[THN][BLN]-[UNIT]-[NO_URUT]", "REQ-202610-SDIT1-0012", "Penomoran surat permohonan dana"],
        ["Voucher Jurnal", "JV-[YYYYMMDD]-[NO_URUT]", "JV-20261007-0045", "Nomor referensi bukti pembukuan"],
        ["Aset Tetap", "AST-[KATEGORI]-[UNIT]-[TAHUN]-[NO]", "AST-KOMP-SDIT1-2026-0008", "Label barcode inventaris fisik"]
    ]
    add_table(doc, headers_kode, data_kode, [1.5, 2.2, 1.8, 1.3])

    add_h2(doc, "5.3 Titik Pengendalian Internal Berbasis Framework COSO")
    add_p(doc,
        "Perancangan kontrol internal pada SIKAK diselaraskan dengan kerangka kerja pengendalian internal "
        "Committee of Sponsoring Organizations of the Treadway Commission (COSO) yang mencakup 5 (lima) komponen:"
    )

    add_bullet(doc, "Menanamkan etika akuntabilitas publik dan komitmen anti-penyelewengan melalui kebijakan sistem tertulis serta penetapan wewenang formal di tingkat yayasan.", bold_prefix="1. Lingkungan Pengendalian (Control Environment):")
    add_bullet(doc, "Sistem memetakan potensi risiko kebocoran kas (misalnya kasir tidak menyetor uang SPP, pengajuan belanja fiktif, pembelian barang tanpa nota asli). Titik rawan tersebut diisolasi dengan validasi sistem.", bold_prefix="2. Penilaian Risiko (Risk Assessment):")
    add_bullet(doc, "Penerapan kontrol preventif (verifikasi pagu otomatis sebelum persetujuan), kontrol detektif (notifikasi selisih pembukuan), dan pemisahan tugas (*Segregation of Duties*).", bold_prefix="3. Aktivitas Pengendalian (Control Activities):")
    add_bullet(doc, "Penyampaian status persetujuan secara transparan melalui sistem; pengiriman notifikasi instan kepada kepala unit jika laporan SPJ disetujui atau ditolak dengan alasan tertulis.", bold_prefix="4. Informasi & Komunikasi (Information & Communication):")
    add_bullet(doc, "Dasbor monitoring saldo buku kas yayasan secara real-time dan evaluasi rutin log aktivitas oleh auditor internal yayasan.", bold_prefix="5. Pemantauan (Monitoring Activities):")

    # ==========================================
    # 6. DESAIN LOGIN, OTORISASI, DAN HAK AKSES
    # ==========================================
    add_h1(doc, "6. DESAIN LOGIN, OTORISASI, DAN HAK AKSES")

    add_h2(doc, "6.1 Arsitektur Otentikasi Berbasis JSON Web Token (JWT)")
    add_p(doc,
        "Keamanan akses pengguna merupakan garda terdepan integritas data keuangan. SIKAK menerapkan arsitektur "
        "otentikasi nir-keadaan (*stateless authentication*) berbasis standar industri JSON Web Token (JWT) yang "
        "dikombinasikan dengan enkripsi kata sandi menggunakan pustaka `bcryptjs` (salt rounds = 10)."
    )
    add_p(doc, "Alur proses masuk sistem (*Login Flow*) berjalan sebagai berikut:", bold_prefix="Mekanisme Kerja:")
    add_bullet(doc, "Pengguna menginput kredensial `username` dan `password` pada antarmuka web login.")
    add_bullet(doc, "Backend Express.js menerima permintaan dan mencocokkan hash password di basis data menggunakan fungsi `bcrypt.compare()`.")
    add_bullet(doc, "Jika valid, backend menerbitkan token JWT bertandatangan digital (`JWT_SECRET`) dengan masa kedaluwarsa 24 jam.")
    add_bullet(doc, "Payload JWT memuat klaim identitas minimum: `{ id, username, role, unitId, fieldId }`.")
    add_bullet(doc, "Setiap permintaan API berikutnya menyertakan header `Authorization: Bearer <token>` yang divalidasi oleh middleware keamanan sebelum mengakses sumber daya.")

    add_code_block(doc,
        "// Potongan Middleware Otentikasi dan Otorisasi (server/routes/audit.js)\n"
        "export const requireSuperAdmin = (req, res, next) => {\n"
        "    const authHeader = req.headers['authorization'];\n"
        "    const token = authHeader && authHeader.split(' ')[1];\n"
        "    if (!token) return res.status(401).json({ error: 'Akses ditolak: Token tidak ditemukan.' });\n"
        "    try {\n"
        "        const decoded = jwt.verify(token, JWT_SECRET);\n"
        "        if (decoded.role !== 'superadmin') {\n"
        "            return res.status(403).json({ error: 'Hanya Superadmin yang memiliki hak akses ini.' });\n"
        "        }\n"
        "        req.user = decoded;\n"
        "        next();\n"
        "    } catch (err) {\n"
        "        return res.status(401).json({ error: 'Token tidak valid atau kedaluwarsa.' });\n"
        "    }\n"
        "};",
        "Implementasi Middleware Otorisasi Superadmin"
    )

    add_h2(doc, "6.2 Matriks Otorisasi Berbasis Peran (Role-Based Access Control / RBAC)")
    add_p(doc, "SIKAK membagi hak akses ke dalam 4 (empat) peran utama guna menegakkan privilese minimum (*least privilege principle*):")

    headers_rbac = ["Fitur & Modul SIKAK", "Superadmin (Yayasan)", "Admin Bidang", "Admin Unit / Bendahara Sekolah"]
    data_rbac = [
        ["Manajemen Master COA & User", "Penuh (CRUD)", "Lihat Saja", "Tidak Memiliki Akses"],
        ["Penyusunan RAB Unit (Draft)", "Review & Setujui", "Verifikasi Bidang", "Input & Edit Unit Sendiri"],
        ["Pengajuan Dana (Budget Request)", "Otorisasi Pencairan", "Verifikasi Kelayakan", "Input Pengajuan Unit"],
        ["Pelaporan SPJ (Budget Report)", "Audit & Posting Jurnal", "Review Bukti Nota", "Input Nota, Foto, & Kwitansi"],
        ["Penerimaan Siswa & SPP", "Monitoring Konsolidasi", "Monitoring Bidang", "Input Siswa & Kasir Bayar"],
        ["Jurnal Penyesuaian & Tutup Buku", "Penuh (CRUD)", "Tidak Ada Akses", "Tidak Ada Akses"],
        ["Akses Jejak Audit (Audit Trail)", "Penuh (Read Only)", "Tidak Ada Akses", "Tidak Ada Akses"],
        ["Pemulihan Data (Trash Bin)", "Bisa Memulihkan Data", "Tidak Ada Akses", "Tidak Ada Akses"]
    ]
    add_table(doc, headers_rbac, data_rbac, [2.0, 1.7, 1.5, 1.6])

    add_h2(doc, "6.3 Prinsip Pemisahan Tugas (Segregation of Duties / SoD)")
    add_callout(doc,
        "Pemisahan Fungsi Pembuat (Maker) dan Penyetuju (Approver)",
        "Konflik kepentingan adalah sumber utama penipuan akuntansi. SIKAK memisahkan secara tegas:\n"
        "1. Fungsi Pembuat Pengajuan (Maker): Bendahara unit mengusulkan permohonan belanja (Budget Request).\n"
        "2. Fungsi Pemeriksa (Checker): Admin Bidang meninjau kesesuaian teknis dan fisik kegiatan sekolah.\n"
        "3. Fungsi Penyetuju Pembayaran (Approver): Superadmin / Bendahara Yayasan mengesahkan pencairan kas.\n"
        "Dengan arsitektur ini, tidak ada satu orang pun yang dapat mencairkan kas untuk dirinya sendiri tanpa persetujuan pihak lain.",
        box_type='warn'
    )

    # ==========================================
    # 7. ANALISIS KEBUTUHAN DATA
    # ==========================================
    add_h1(doc, "7. ANALISIS KEBUTUHAN DATA")

    add_h2(doc, "7.1 Dekomposisi Kebutuhan Data Sistem")
    add_p(doc,
        "Analisis kebutuhan data bertujuan untuk mengidentifikasi seluruh entitas, atribut, dan relasi "
        "yang diperlukan untuk menjalankan siklus akuntansi secara utuh. Kebutuhan data SIKAK diklasifikasikan "
        "menjadi tiga kategori besar:"
    )

    add_bullet(doc, "Data referensi statis yang menjadi fondasi operasional. Meliputi: Pengguna (User), Akun Akuntansi (Account), Bidang Organisasi (Field), Satuan Pendidikan (Unit), Kelas (Class), Siswa (Student), Tahun Akademik (AcademicYear), Komponen Penerimaan (IncomeItem), Mata Anggaran Belanja (ExpenseItem), Pos BOS (BosPos), dan Kategori Aset (AssetCategory).", bold_prefix="1. Data Induk (Master Data):")
    add_bullet(doc, "Data dinamis yang dihasilkan dari aktivitas operasional harian. Meliputi: Dokumen Rencana Anggaran (RabPlan), Pengajuan Pencairan Dana (BudgetRequest), Realisasi Belanja & SPJ (BudgetReport), Transaksi Pembukuan (Journal), dan Distribusi Persentase (DistributionSetting).", bold_prefix="2. Data Transaksional (Transactional Data):")
    add_bullet(doc, "Data pengawasan sistem untuk mencatat rekam jejak setiap aksi pengguna (AuditLog), status penghapusan logis (isDeleted flag), serta catatan waktu (timestamp updatedAt/createdAt).", bold_prefix="3. Data Audit dan Jejak Riwayat (Audit & Metadata):")

    add_h2(doc, "7.2 Analisis Kebutuhan Input - Proses - Output (IPO)")
    add_p(doc, "Secara fungsional, hubungan antara masukan, pengolahan, dan keluaran sistem disajikan pada tabel berikut:")

    headers_ipo = ["Siklus / Modul", "Masukan Data (Input)", "Logika Pemrosesan (Process)", "Keluaran Informasi (Output)"]
    data_ipo = [
        ["Penganggaran (RAB)", 
         "Pagu usulan per mata anggaran, tahun ajaran, unit kerja, sumber dana (Yayasan/BOS).", 
         "Validasi format, komparasi dengan realisasi tahun lalu, penentuan status (Draft -> Approved).", 
         "Dokumen RAB Definitif, Plafon Belanja Unit per Kategori."],
        ["Siklus Pendapatan", 
         "NIS, nama siswa, tarif SPP bulanan, nominal setoran kasir, tanggal bayar.", 
         "Pencocokan tagihan, pemotongan persentase alokasi bagi hasil, pembuatan jurnal kas masuk otomatis.", 
         "Kuitansi elektronik siswa, Rekapitulasi Piutang SPP, Jurnal Kas Penerimaan."],
        ["Siklus Pengeluaran", 
         "Form pengajuan dana, nota fisik, foto kuitansi, nomor nota toko, volume, harga satuan, diskon.", 
         "Verifikasi batas pagu anggaran, pengecekan maker-approver, posting otomatis beban belanja & aset.", 
         "Surat Kas Keluar (BKK), Laporan Realisasi Anggaran (SPJ), Kartu Inventaris Aset Baru."],
        ["Buku Besar & ISAK 35", 
         "Entri jurnal otomatis dari siklus pendapatan dan pengeluaran, serta jurnal penyesuaian manual.", 
         "Posting buku besar, kalkulasi saldo berjalan, pemisahan pembatasan aset neto terikat & tidak terikat.", 
         "Buku Besar, Neraca Saldo, Laporan Posisi Keuangan, Laporan Aktivitas, Laporan Arus Kas."]
    ]
    add_table(doc, headers_ipo, data_ipo, [1.4, 1.8, 2.0, 1.6])
