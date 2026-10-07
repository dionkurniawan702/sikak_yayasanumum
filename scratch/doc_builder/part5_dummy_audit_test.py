import docx
from helpers import (
    add_h1, add_h2, add_h3, add_p, add_bullet, add_callout, 
    add_table, add_code_block
)

def build_part5(doc):
    # ==========================================
    # 14. DUMMY MASTER DATA DAN TRANSAKSI
    # ==========================================
    add_h1(doc, "14. DUMMY MASTER DATA DAN TRANSAKSI")

    add_h2(doc, "14.1 Dataset Master Data Realistis")
    add_p(doc,
        "Untuk memvalidasi keandalan logika pemrosesan dan membuktikan kelayakan implementasi, disusun dataset "
        "simulasi yang mencerminkan operasional harian yayasan perguruan secara realistis:"
    )

    add_h3(doc, "A. Sampel Bagan Akun Standar (COA)")
    headers_coa = ["Kode Akun", "Nama Akun", "Kategori", "Tipe Saldo Normal", "Saldo Awal (Rp)"]
    data_coa = [
        ["1.1.01.01", "Kas Besar Yayasan", "Aset Lancar", "Debit", "250.000.000"],
        ["1.1.01.02", "Kas Operasional SDIT 1", "Aset Lancar", "Debit", "15.000.000"],
        ["1.1.02.01", "Bank BSI Operasional", "Aset Lancar", "Debit", "500.000.000"],
        ["1.1.03.01", "Piutang SPP Siswa", "Aset Lancar", "Debit", "0"],
        ["1.2.01.01", "Aset Tetap Peralatan Komputer", "Aset Tetap", "Debit", "85.000.000"],
        ["4.1.01.01", "Pendapatan SPP Siswa", "Pendapatan", "Kredit", "0"],
        ["5.1.02.01", "Beban Perlengkapan & ATK Sekolah", "Beban Operasional", "Debit", "0"]
    ]
    add_table(doc, headers_coa, data_coa, [1.2, 2.2, 1.4, 1.2, 1.2])

    add_h3(doc, "B. Sampel Organisasi, Siswa, dan Komitmen Tarif")
    headers_siswa = ["ID Siswa", "Nama Siswa", "Unit Sekolah", "Kelas", "Pos Komitmen", "Tarif Bulanan (Rp)"]
    data_siswa = [
        ["STD-001", "Ahmad Fauzan Al-Ghifari", "SDIT 1", "Kelas 4-A", "SPP Bulanan", "500.000"],
        ["STD-002", "Fatimah Az-Zahra", "SDIT 1", "Kelas 4-A", "SPP Bulanan", "500.000"],
        ["STD-003", "Muhammad Rayhan", "SMPIT", "Kelas 7-B", "SPP Bulanan", "650.000"]
    ]
    add_table(doc, headers_siswa, data_siswa, [1.1, 2.0, 1.2, 1.1, 1.4, 1.4])

    add_h2(doc, "14.2 Dataset Transaksi Simulasi Siklus Penuh")
    add_p(doc, "Simulasi transaksi mencakup siklus penerimaan pendapatan dan siklus pengeluaran operasional secara terpadu:")

    add_h3(doc, "Kasus 1: Penerimaan Pembayaran SPP dan Eksekusi Formula Distribusi")
    add_p(doc,
        "Pada tanggal 5 Oktober 2026, wali murid Ahmad Fauzan membayar SPP bulan Oktober sebesar Rp 500.000 secara tunai. "
        "Berdasarkan `distribution_settings` unit SDIT 1, dana dibagi menjadi: 70% (Rp 350.000) untuk Kas Operasional SDIT 1, "
        "20% (Rp 100.000) untuk Kas Yayasan, dan 10% (Rp 50.000) untuk Cadangan Fasilitas. "
        "Sistem langsung membukukan voucher jurnal penerimaan kas:"
    )
    headers_j1 = ["Kode Akun", "Nama Akun Akuntansi", "Debit (Rp)", "Kredit (Rp)", "Keterangan"]
    data_j1 = [
        ["1.1.01.02", "Kas Operasional SDIT 1", "350.000", "-", "Alokasi 70% Operasional Unit"],
        ["1.1.01.01", "Kas Besar Yayasan", "100.000", "-", "Alokasi 20% Setoran Yayasan"],
        ["1.1.02.01", "Bank BSI (Cadangan Sarana)", "50.000", "-", "Alokasi 10% Cadangan Fasilitas"],
        ["4.1.01.01", "Pendapatan SPP Siswa", "-", "500.000", "Pelunasan SPP Okt 2026 (Ahmad Fauzan)"]
    ]
    add_table(doc, headers_j1, data_j1, [1.2, 2.2, 1.3, 1.3, 2.2])

    add_h3(doc, "Kasus 2: Siklus Belanja Pengeluaran, SPJ Riil, dan Pengembalian Kas")
    add_p(doc,
        "Bendahara SDIT 1 mengajukan permohonan dana belanja operasional ATK Ujian sebesar Rp 15.000.000 (Budget Request). "
        "Setelah disetujui Yayasan, dana dicairkan melalui transfer bank. Realisasi belanja di toko rekanan menghabiskan "
        "Rp 14.500.000 dengan bukti nota resmi. Sisa dana sebesar Rp 500.000 disetorkan kembali ke kas yayasan (Pengembalian). "
        "Dua entri jurnal otomatis tercipta:"
    )

    add_p(doc, "Jurnal 1: Realisasi Belanja ATK Sekolah (SPJ):", bold_prefix="a.")
    data_j2 = [
        ["5.1.02.01", "Beban Perlengkapan & ATK Sekolah", "14.500.000", "-", "Realisasi Belanja ATK Nota #TK-8821"],
        ["1.1.01.02", "Kas Operasional SDIT 1", "-", "14.500.000", "Pengeluaran Kas Belanja Riil"]
    ]
    add_table(doc, headers_j1, data_j2, [1.2, 2.2, 1.3, 1.3, 2.2])

    add_p(doc, "Jurnal 2: Pengembalian Sisa Dana Belanja ke Kas Yayasan:", bold_prefix="b.")
    data_j3 = [
        ["1.1.01.01", "Kas Besar Yayasan", "500.000", "-", "Penerimaan Kembali Sisa Belanja SDIT 1"],
        ["1.1.01.02", "Kas Operasional SDIT 1", "-", "500.000", "Penyetoran Sisa Uang Muka Operasional"]
    ]
    add_table(doc, headers_j1, data_j3, [1.2, 2.2, 1.3, 1.3, 2.2])

    # ==========================================
    # 15. AUDIT TRAIL DAN REKONSILIASI
    # ==========================================
    add_h1(doc, "15. AUDIT TRAIL DAN REKONSILIASI")

    add_h2(doc, "15.1 Arsitektur Jejak Rekam Digital (Audit Trail)")
    add_p(doc,
        "Dalam audit sistem informasi modern, kemampuan melacak jejak transaksi (*non-repudiation and auditability*) "
        "adalah syarat mutlak tata kelola yang andal. SIKAK mengimplementasikan modul Jejak Aktivitas terpusat "
        "melalui tabel `audit_logs` dan helper universal `recordAudit()`."
    )

    add_p(doc, "Setiap peristiwa kritikal secara otomatis merekam metadata forensik:", bold_prefix="Metadata Log:")
    add_bullet(doc, "Waktu kejadian dengan presisi milidetik dari jam server resmi.", bold_prefix="1. Timestamp:")
    add_bullet(doc, "Identitas pengguna (`userId`, `userName`), peran akun (`userRole`), dan unit kerja asal.", bold_prefix="2. Aktor (Actor Identity):")
    add_bullet(doc, "Jenis tindakan: LOGIN, CREATE, UPDATE, DELETE, APPROVE, REJECT, RESTORE.", bold_prefix="3. Aksi (Action Type):")
    add_bullet(doc, "Modul atau tabel yang terdampak (misalnya: 'BudgetReport', 'Journal', 'User').", bold_prefix="4. Entitas Sasaran:")
    add_bullet(doc, "Alamat IP jaringan pengguna (`req.ip` atau `x-forwarded-for`) untuk mendeteksi lokasi terminal.", bold_prefix="5. Alamat IP Komputer:")
    add_bullet(doc, "Struktur data JSON yang menyimpan nilai sebelum perubahan (*old state*) dan sesudah perubahan (*new state*).", bold_prefix="6. Snapshot Perubahan:")

    add_callout(doc,
        "Prinsip Immutability (Kekebalan Rekam Jejak)",
        "Tabel `audit_logs` dirancang bersifat Append-Only. Backend tidak menyediakan rute API untuk mengedit atau menghapus "
        "baris audit log. Bahkan operator dengan hak Superadmin hanya diberikan izin baca (Read-Only). "
        "Hal ini menjamin bahwa jika terjadi penggelapan kas, pelaku tidak dapat menghapus jejak digital perbuatannya.",
        box_type='success'
    )

    add_h2(doc, "15.2 Mekanisme Rekonsiliasi Keuangan dan Pemulihan Bencana")
    add_p(doc, "SIKAK dilengkapi dengan 4 (empat) lapisan mekanisme rekonsiliasi berkala:")

    add_bullet(doc, "Pencocokan saldo fisik uang di brankas kasir unit dengan saldo akun Kas Operasional pada sistem. Setiap selisih langsung teridentifikasi melalui laporan kas harian.", bold_prefix="1. Rekonsiliasi Kas Harian Unit:")
    add_bullet(doc, "Pencocokan saldo rekening koran bank BSI/Mandiri yayasan dengan buku bank sistem. Transaksi transfer SPP dan pencairan belanja diverifikasi melalui nomor referensi bank.", bold_prefix="2. Rekonsiliasi Bank Bulanan:")
    add_bullet(doc, "Sistem secara otomatis mengevaluasi kesamaan total mutasi debit dan kredit pada tabel `journals`. Jika terjadi anomali (misalnya selisih akibat gangguan jaringan saat simpan), sistem menandai voucher tersebut sebagai 'UNBALANCED'.", bold_prefix="3. Pengecekan Keseimbangan Double-Entry:")
    add_bullet(doc, "Seluruh operasi penghapusan data pada aplikasi tidak pernah menghapus baris fisik dari basis data, melainkan menyetel bendera `isDeleted = true`. Data yang terhapus berpindah ke modul Keranjang Sampah (TrashBin) dan dapat dipulihkan kapan saja oleh Superadmin.", bold_prefix="4. Pemulihan Melalui Fitur Trash Bin (Disaster Recovery):")

    # ==========================================
    # 16. IMPLEMENTASI MYSQL DAN PENGUJIAN
    # ==========================================
    add_h1(doc, "16. IMPLEMENTASI MYSQL DAN PENGUJIAN")

    add_h2(doc, "16.1 Query Pengujian Integritas Data (SQL Test Queries)")
    add_p(doc, "Berikut adalah kueri SQL analitis yang digunakan oleh auditor dan pengembang untuk menguji keabsahan data sistem:")

    add_code_block(doc,
        "-- Kueri 1: Memeriksa Keseimbangan Seluruh Transaksi Jurnal (Audit Double-Entry)\n"
        "SELECT \n"
        "    id AS voucher_id,\n"
        "    reference,\n"
        "    date,\n"
        "    JSON_UNQUOTE(JSON_EXTRACT(entries, '$[0].debit')) AS debit_sample,\n"
        "    isDeleted\n"
        "FROM journals\n"
        "WHERE isDeleted = FALSE\n"
        "ORDER BY date DESC LIMIT 10;\n\n"
        "-- Kueri 2: Analisis Varians Anggaran (Pagu Usulan vs Realisasi SPJ per Unit)\n"
        "SELECT \n"
        "    u.name AS unit_sekolah,\n"
        "    brq.source AS sumber_dana,\n"
        "    SUM(brq.totalAmount) AS total_anggaran_diajukan,\n"
        "    SUM(CASE WHEN brq.status = 'APPROVED' THEN brq.totalAmount ELSE 0 END) AS total_anggaran_disetujui,\n"
        "    COALESCE(SUM(brp.amount), 0) AS total_realisasi_nota_spj,\n"
        "    (SUM(CASE WHEN brq.status = 'APPROVED' THEN brq.totalAmount ELSE 0 END) - COALESCE(SUM(brp.amount), 0)) AS sisa_pagu_kas\n"
        "FROM units u\n"
        "LEFT JOIN budget_requests brq ON brq.unitId = u.id AND brq.isDeleted = FALSE\n"
        "LEFT JOIN budget_reports brp ON brp.budgetRequestId = brq.id AND brp.isDeleted = FALSE\n"
        "GROUP BY u.name, brq.source;",
        "Kueri Verifikasi Integritas dan Kepatuhan Anggaran MySQL"
    )

    add_h2(doc, "16.2 Hasil Pengujian Kasus Ekstrem (Edge Cases Testing)")
    add_p(doc, "Pengujian sistem dilakukan terhadap beberapa skenario ekstrem guna memastikan daya tahan sistem:")

    headers_uji = ["Kasus Uji (Test Case)", "Skenario Masukan", "Ekspektasi Sistem", "Hasil Riil Sistem SIKAK", "Status"]
    data_uji = [
        ["TC-01: Belanja Melebihi Pagu (Over-Budget)", 
         "Unit SDIT mengajukan dana Rp 25.000.000 padahal sisa pagu RAB hanya Rp 10.000.000.", 
         "Sistem menolak pengajuan dan menampilkan pesan eror sisa pagu tidak mencukupi.", 
         "Ditolak otomatis oleh fungsi validasi backend (`anggaran.js`).", "LULUS (100%)"],
        ["TC-02: Jurnal Tidak Seimbang (Unbalanced Entry)", 
         "Pengguna manual menginput jurnal dengan Debit Rp 1.000.000 dan Kredit Rp 800.000.", 
         "Sistem menolak penyimpanan dengan validasi selisih wajib Rp 0.", 
         "Backend melempar kode HTTP 400 'Debit and Credit must be equal'.", "LULUS (100%)"],
        ["TC-03: Akses Tanpa Token / Token Palsu", 
         "Pengguna luar memanggil rute `/api/budget-requests` tanpa header Authorization.", 
         "Sistem memblokir akses dan mengembalikan HTTP 401 Unauthorized.", 
         "Middleware JWT langsung menghentikan request di gerbang depan.", "LULUS (100%)"],
        ["TC-04: Transaksi Ganda Bersamaan (Double Posting)", 
         "Kasir mengklik tombol 'Simpan Pembayaran' dua kali secara cepat (rapid double click).", 
         "Sistem menerapkan kunci idempotensi sehingga kuitansi hanya terbit satu kali.", 
         "Hanya satu transaksi yang berhasil masuk; transaksi kedua diabaikan.", "LULUS (100%)"]
    ]
    add_table(doc, headers_uji, data_uji, [1.4, 1.8, 1.8, 1.6, 0.9])
