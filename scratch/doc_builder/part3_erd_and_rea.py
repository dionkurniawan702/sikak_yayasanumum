import docx
from helpers import (
    add_h1, add_h2, add_h3, add_p, add_bullet, add_callout, 
    add_table, add_code_block
)

def build_part3(doc):
    # ==========================================
    # 8. MODEL KONSEPTUAL, ERD, DAN KARDINALITAS
    # ==========================================
    add_h1(doc, "8. MODEL KONSEPTUAL, ERD, DAN KARDINALITAS")

    add_h2(doc, "8.1 Model Konseptual Basis Data SIKAK")
    add_p(doc,
        "Model konseptual data menyajikan representasi tingkat tinggi dari seluruh entitas bisnis dan keterkaitannya "
        "tanpa terikat pada batasan teknologi penyimpanan fisik. Pada SIKAK Yayasan Umum, model konseptual dibangun "
        "untuk merefleksikan hierarki organisasi pendidikan Islam terpadu, integrasi anggaran partisipatif, pengelolaan "
        "dana BOS, kesiswaan, aset fisik, dan sistem akuntansi berpasangan (double-entry)."
    )

    add_h2(doc, "8.2 Entitas Inti dan Hubungan Relasional (ERD)")
    add_p(doc, "Struktur basis data SIKAK terdiri atas kelompok entitas yang saling berelasi erat:")

    headers_erd = ["Entitas Induk (Parent)", "Relasi", "Entitas Anak (Child)", "Kardinalitas", "Foreign Key & Makna Bisnis"]
    data_erd = [
        ["Field (Bidang)", "memayungi", "Unit (Satuan Kerja)", "1 : N", "Unit.fieldId -> Satu bidang menaungi banyak unit sekolah."],
        ["Unit (Sekolah)", "memiliki", "Class (Kelas)", "1 : N", "Class.unitId -> Satu unit memiliki banyak rombel kelas."],
        ["Unit (Sekolah)", "mendaftar", "Student (Siswa)", "1 : N", "Student.unitId -> Siswa terdaftar pada satu unit pendidikan."],
        ["Class (Kelas)", "menampung", "Student (Siswa)", "1 : N", "Student.classId -> Satu kelas beranggotakan banyak siswa."],
        ["Student (Siswa)", "memiliki komitmen", "StudentIncomeDetail", "1 : N", "StudentIncomeDetail.studentId -> Rincian tarif tagihan per siswa."],
        ["IncomeItem (Pos Masuk)", "ditetapkan pada", "StudentIncomeDetail", "1 : N", "StudentIncomeDetail.incomeItemId -> Jenis pos (SPP, Gedung, dll)."],
        ["Unit (Sekolah)", "menyusun", "RabPlan (Rencana Anggaran)", "1 : N", "RabPlan.unitId -> Dokumen rencana anggaran tahunan unit."],
        ["ExpenseItem (Mata Beban)", "dialokasikan dalam", "BudgetAllocation", "1 : N", "BudgetAllocation.expenseItemId -> Pagu batas belanja tahunan."],
        ["ExpenseItem (Mata Beban)", "diajukan dalam", "BudgetRequest", "1 : N", "BudgetRequest.expenseItemId -> Permohonan belanja kas operasional."],
        ["BudgetRequest (Pengajuan)", "dipertanggungjawabkan", "BudgetReport (SPJ Belanja)", "1 : N", "BudgetReport.budgetRequestId -> Laporan realisasi nota fisik."],
        ["BudgetReport (SPJ)", "membentuk jurnal", "Journal (Buku Besar)", "1 : 1 (opsional)", "BudgetReport.journalId -> Bukti posting otomatis ke jurnal umum."],
        ["AcademicYear (Thn Ajaran)", "mendasari alokasi", "BosAllocation (Dana BOS)", "1 : N", "BosAllocation.academicYearId -> Tahapan penyaluran dana BOS."],
        ["BosPos (Pos Standar BOS)", "dialokasikan ke", "BosAllocation", "1 : N", "BosAllocation.posId -> Klasifikasi juknis resmi BOS nasional."]
    ]
    add_table(doc, headers_erd, data_erd, [1.4, 1.2, 1.4, 0.9, 2.1])

    add_h2(doc, "8.3 Analisis Kardinalitas dan Integritas Referensial")
    add_p(doc, "Kardinalitas mendefinisikan batasan jumlah kemunculan relasi antar entitas:", bold_prefix="Tinjauan Kardinalitas:")
    add_bullet(doc, "Satu entitas induk Field dapat memiliki banyak Unit sekolah di bawahnya (1:N), namun satu Unit hanya boleh terikat pada tepat satu Field (misalnya: SDIT 1 wajib berada di bawah Bidang Pendidikan).", bold_prefix="Relasi 1:N (One-to-Many):")
    add_bullet(doc, "Satu pengajuan permohonan dana (BudgetRequest) dapat dipertanggungjawabkan melalui beberapa transaksi nota belanja (BudgetReport) (1:N). Hal ini merefleksikan kenyataan lapangan di mana uang muka operasional Rp 5.000.000 dapat dibelanjakan ke berbagai toko dengan 5 lembar nota terpisah.", bold_prefix="Relasi 1:N Pengeluaran:")
    add_bullet(doc, "Relasi antara IncomeItem (Pos Penerimaan) dan ExpenseItem (Pos Beban Alokasi) bersifat Many-to-Many (N:M). Hubungan ini dijembatani oleh tabel asosiatif `distribution_settings` yang memuat persentase bagi hasil.", bold_prefix="Relasi N:M Melalui Tabel Asosiatif:")

    add_callout(doc,
        "Pemberlakuan Batasan Integritas Referensial (Referential Integrity)",
        "Pada tingkat skema Prisma dan MySQL, seluruh Foreign Key dilindungi dengan aturan integritas. "
        "Penghapusan data master (misalnya Unit atau Akun) tidak diperkenankan menghapus data riwayat transaksi secara langsung (RESTRICT/CASCADE terkontrol). "
        "SIKAK menerapkan mekanisme 'Soft Delete' (`isDeleted = true`) sehingga relasi data historis di masa lampau tetap utuh dan auditabel.",
        box_type='info'
    )

    # ==========================================
    # 9. PEMODELAN REA (RESOURCES, EVENTS, AGENTS)
    # ==========================================
    add_h1(doc, "9. PEMODELAN REA (RESOURCES, EVENTS, AGENTS)")

    add_h2(doc, "9.1 Landasan Teoretis Framework REA")
    add_p(doc,
        "Kerangka kerja REA dipelopori oleh William E. McCarthy (1982) sebagai paradigma pemodelan Sistem Informasi "
        "Akuntansi modern yang melampaui keterbatasan akuntansi buku besar konvensional (*traditional ledger view*). "
        "Dalam pandangan tradisional, akuntansi hanya berfokus pada debet, kredit, dan akun artifisial. Sebaliknya, "
        "REA memodelkan realitas ekonomi riil ke dalam tiga ontologi fundamental:"
    )
    add_bullet(doc, "Objek-objek berwujud maupun tak berwujud yang memiliki nilai ekonomi langka dan dikendalikan oleh organisasi (misalnya: Kas/Bank, Fasilitas Gedung, Peralatan Komputer, Jasa Pendidikan).", bold_prefix="1. Sumber Daya (Resources - R):")
    add_bullet(doc, "Aktivitas atau peristiwa operasional yang mengubah jumlah atau nilai sumber daya ekonomi, baik berupa transaksi pertukaran riil maupun komitmen masa depan (misalnya: Penerimaan Kas SPP, Pengajuan Dana, Belanja Pembelian Barang).", bold_prefix="2. Peristiwa Ekonomi (Events - E):")
    add_bullet(doc, "Individu, unit organisasi, atau pihak luar yang berpartisipasi dalam peristiwa ekonomi atau memiliki akuntabilitas terhadap pengelolaan sumber daya (misalnya: Siswa/Wali Murid, Bendahara Sekolah, Kasir Yayasan, Toko Rekanan).", bold_prefix="3. Pelaku Ekonomi (Agents - A):")

    add_h2(doc, "9.2 Dekonstruksi Komponen REA pada SIKAK")
    add_p(doc, "Pemetaan komponen REA pada aplikasi SIKAK dikelompokkan ke dalam tabel berikut:")

    headers_rea = ["Kategori REA", "Elemen Sistem SIKAK", "Representasi Logis", "Peran dalam Tata Kelola"]
    data_rea = [
        ["Resource (R)", "Kas & Saldo Bank", "Akun Kas Operasional & Rekening Bank Yayasan", "Sumber daya likuid untuk membiayai operasional."],
        ["Resource (R)", "Jasa Pendidikan", "Kurikulum, Jam Belajar, Layanan Santri", "Layanan inti yang diserahkan kepada peserta didik."],
        ["Resource (R)", "Aset Tetap / Inventaris", "Meja, Kursi, Komputer, Bangunan Gedung", "Sumber daya modal pendukung fasilitas sekolah."],
        ["Event (E) - Commitment", "Penyusunan RAB (RabPlan)", "Alokasi batas pagu per mata anggaran", "Komitmen batas belanja legal selama 1 tahun."],
        ["Event (E) - Commitment", "Penetapan Tarif SPP", "StudentIncomeDetail per siswa", "Komitmen kewajiban bayar wali murid."],
        ["Event (E) - Economic", "Penerimaan Kas Siswa", "Pelunasan SPP & Kuitansi Masuk", "Peristiwa penambahan kas (Inflow/Take Event)."],
        ["Event (E) - Economic", "Realisasi Belanja SPJ", "BudgetReport (pembelian barang/jasa)", "Peristiwa penyerahan kas (Outflow/Give Event)."],
        ["Event (E) - Economic", "Kapitalisasi Aset", "Entri tabel assets dari nota belanja", "Penerimaan sumber daya aset tetap (Take Event)."],
        ["Agent (A) - Internal", "Pengurus / Bendahara Yayasan", "User (Role: superadmin, admin_yayasan)", "Otoritas pemberi dana dan verifikator tertinggi."],
        ["Agent (A) - Internal", "Kepala Sekolah & Bendahara Unit", "User (Role: admin_unit)", "Pengelola kasir dan pelaksana belanja lapangan."],
        ["Agent (A) - External", "Wali Murid / Siswa", "Student, Contact", "Pihak pembayar iuran komitmen pendidikan."],
        ["Agent (A) - External", "Toko / Vendor Penyedia", "AssetVendor, Vendor Nota", "Penyedia barang kebutuhan sarana prasarana."]
    ]
    add_table(doc, headers_rea, data_rea, [1.5, 1.8, 1.9, 1.8])

    add_h2(doc, "9.3 Analisis Dualitas Ekonomi (Economic Duality)")
    add_p(doc,
        "Prinsip sentral dalam pemodelan REA adalah **Dualitas Ekonomi (Economic Duality)**, yaitu hubungan sebab-akibat "
        "antara peristiwa penyerahan (*Give Event*) dan peristiwa penerimaan (*Take Event*). Tidak ada sumber daya yang "
        "diterima tanpa adanya pengorbanan sumber daya lain atau komitmen jasa.",
        bold_prefix="Konsep Dualitas:"
    )

    add_h3(doc, "A. Dualitas Siklus Pendapatan (Revenue Duality)")
    add_p(doc,
        "Yayasan menyerahkan **Layanan Jasa Pendidikan** (*Give Event / Penyerahan Jasa Guru*) kepada siswa. "
        "Sebagai imbalan ekonomis, yayasan menerima **Kas/Setara Kas** (*Take Event / Penerimaan SPP*) dari wali murid. "
        "Dualitas ekonomi ini menghubungkan peristiwa pengajaran dan peristiwa arus kas masuk."
    )

    add_h3(doc, "B. Dualitas Siklus Pengeluaran (Expenditure Duality)")
    add_p(doc,
        "Yayasan menyerahkan **Kas/Bank** (*Give Event / Pencairan Belanja Operasional*). Sebagai imbalannya, "
        "yayasan menerima **Barang Perlengkapan / Jasa Perbaikan / Aset Tetap** (*Take Event / Realisasi Belanja SPJ*). "
        "Dualitas ini dibuktikan secara sah melalui nota faktur fisik dan bukti foto struk pada formulir BudgetReport."
    )

    # ==========================================
    # 10. PEMETAAN ERD/REA KE MODEL RELASIONAL
    # ==========================================
    add_h1(doc, "10. PEMETAAN ERD/REA KE MODEL RELASIONAL")

    add_h2(doc, "10.1 Aturan Transformasi Teoretis REA ke Skema Relasional")
    add_p(doc,
        "Untuk mengimplementasikan model konseptual REA ke dalam basis data relasional (RDBMS) seperti MySQL, "
        "diterapkan 3 (tiga) aturan transformasi standar sistem informasi akuntansi:"
    )
    add_bullet(doc, "Setiap elemen Resource, Event, dan Agent secara mandiri ditransformasikan menjadi satu tabel relasional dengan Primary Key unik.", bold_prefix="Aturan 1 (Entitas ke Tabel):")
    add_bullet(doc, "Hubungan asosiasi 1:N (misalnya antara Agent internal `users` dan Event `budget_requests`) diimplementasikan dengan menempatkan Primary Key entitas sisi '1' sebagai Foreign Key pada tabel sisi 'N'.", bold_prefix="Aturan 2 (Hubungan 1:N):")
    add_bullet(doc, "Hubungan asosiasi N:M (misalnya antara Event penagihan dan berbagai pos pengeluaran alokasi) diimplementasikan melalui pembuatan tabel relasi perantara (*junction / associative table*) yang memuat Foreign Key dari kedua belah pihak.", bold_prefix="Aturan 3 (Hubungan N:M):")

    add_h2(doc, "10.2 Matriks Pemetaan Terintegrasi (Komponen REA <-> Tabel MySQL SIKAK)")
    add_p(doc, "Implementasi fisik pemetaan REA ke skema basis data MySQL SIKAK tersaji secara komprehensif pada matriks berikut:")

    headers_mapping = ["Klasifikasi REA", "Elemen Bisnis", "Nama Tabel MySQL", "Primary Key (PK)", "Foreign Key (FK) Utama"]
    data_mapping = [
        ["Resource", "Kas / Akun Keuangan", "accounts", "id (UUID)", "parentId (Hierarki Akun)"],
        ["Resource", "Aset Tetap Sekolah", "assets", "id (UUID)", "unitId, categoryId"],
        ["Event (Commitment)", "Rencana Anggaran (RAB)", "rab_plans", "id (AY-UNIT-SRC)", "academicYearId, unitId, fieldId"],
        ["Event (Commitment)", "Tarif Iuran Siswa", "StudentIncomeDetail", "id (UUID)", "studentId, incomeItemId"],
        ["Event (Economic)", "Permintaan Belanja", "budget_requests", "id (UUID)", "expenseItemId, unitId, fieldId"],
        ["Event (Economic)", "Realisasi SPJ Belanja", "budget_reports", "id (UUID)", "budgetRequestId, expenseItemId, journalId"],
        ["Event (Economic)", "Jurnal Transaksi Kas", "journals", "id (UUID)", "programId, reference"],
        ["Event (Associative)", "Aturan Bagi Hasil SPP", "distribution_settings", "id (UUID)", "unitId, incomeItemId, expenseItemId"],
        ["Agent (Internal)", "Pengguna / Petugas", "users", "id (UUID)", "unitId, fieldId"],
        ["Agent (Internal)", "Unit Sekolah", "units", "id (UUID)", "fieldId"],
        ["Agent (External)", "Siswa / Wali Murid", "Student", "id (UUID)", "unitId, classId, statusId"],
        ["Agent (External)", "Vendor Toko Rekanan", "asset_vendors", "id (UUID)", "- (Tabel Master Rekanan)"]
    ]
    add_table(doc, headers_mapping, data_mapping, [1.4, 1.6, 1.6, 1.1, 1.3])

    add_callout(doc,
        "Harmonisasi REA dan Standar Akuntansi Relasional",
        "Pemetaan ini membuktikan bahwa pemodelan REA tidak bertentangan dengan kebutuhan pembukuan konvensional. "
        "Justru, pemodelan REA menyediakan data dasar yang jauh lebih kaya: setiap transaksi jurnal di tabel `journals` "
        "dapat ditelusuri kembali (*drill-down*) ke entitas Event riil (`budget_reports`), Agent pelaksana (`users`), "
        "dan Resource fisik (`assets`/`accounts`), mewujudkan sistem akuntansi yang sepenuhnya transparan dan bebas jejak manipulasi.",
        box_type='success'
    )
