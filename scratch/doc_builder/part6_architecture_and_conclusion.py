import docx
from helpers import (
    add_h1, add_h2, add_h3, add_p, add_bullet, add_callout, 
    add_table, add_code_block
)

def build_part6(doc):
    # ==========================================
    # 17. ARSITEKTUR DAN ALUR IMPLEMENTASI
    # ==========================================
    add_h1(doc, "17. ARSITEKTUR DAN ALUR IMPLEMENTASI")

    add_h2(doc, "17.1 Arsitektur Sistem 3-Tier Enterprise")
    add_p(doc,
        "Aplikasi SIKAK dirancang menggunakan pola arsitektur perangkat lunak 3-Tier Enterprise modern yang memisahkan "
        "tanggung jawab antarmuka pengguna, logika bisnis, dan persistensi data secara modular:"
    )

    headers_tier = ["Lapisan (Tier)", "Teknologi Utama", "Fungsi dan Tanggung Jawab Arsitektural"]
    data_tier = [
        ["1. Presentation Tier (Antarmuka Pengguna)", 
         "React 18 SPA, Vite, Tailwind CSS, Lucide React Icons", 
         "Menyediakan antarmuka interaktif responsif bagi kasir, kepala sekolah, dan bendahara yayasan. Mengelola state aplikasi lokal, validasi masukan form di sisi klien, dan rendering dasbor analitis visual."],
        ["2. Application / Logic Tier (Mesin Logika Bisnis)", 
         "Node.js (v24), Express.js REST API, Prisma ORM, JWT, Bcryptjs", 
         "Memproses seluruh aturan bisnis, validasi otorisasi bertingkat (RBAC), kalkulasi formula distribusi bagi hasil SPP, penegakan saldo pagu RAB, pembuatan transaksi jurnal berpasangan otomatis, dan pencatatan audit log."],
        ["3. Data Persistence Tier (Penyimpanan Relasional)", 
         "MySQL 8.0 (InnoDB Engine)", 
         "Menyimpan seluruh master data, tabel transaksional, batasan foreign key, indeks kecepatan tinggi, dan menjaga sifat keandalan transaksi ACID (Atomicity, Consistency, Isolation, Durability)."]
    ]
    add_table(doc, headers_tier, data_tier, [1.5, 2.0, 3.5])

    add_h2(doc, "17.2 Alur Orkestrasi Data Transaksi (Sequence Flow)")
    add_p(doc, "Alur orkestrasi pemrosesan transaksi belanja dari unit hingga terbentuknya laporan keuangan digambarkan dalam 6 langkah:", bold_prefix="Tahapan Alur:")
    add_bullet(doc, "Bendahara unit menginput formulir permohonan dana belanja di aplikasi web React. Permintaan dikirim melalui HTTP POST `/api/budget-requests` disertai token JWT.", bold_prefix="1. Inisiasi Permintaan:")
    add_bullet(doc, "Middleware Express memeriksa keabsahan token JWT dan mencocokkan sisa pagu mata anggaran di tabel `budget_allocations`. Jika pagu mencukupi, status disetel 'PENDING'.", bold_prefix="2. Validasi Pagu Anggaran:")
    add_bullet(doc, "Admin Bidang dan Superadmin Yayasan meninjau pengajuan melalui modul Approval. Jika disetujui, status diubah menjadi 'APPROVED'.", bold_prefix="3. Otorisasi Bertingkat:")
    add_bullet(doc, "Kasir yayasan mencairkan kas atau mentransfer bank. Dana masuk ke rekening operasional unit.", bold_prefix="4. Pencairan Dana (Disbursement):")
    add_bullet(doc, "Unit berbelanja fisik dan mengunggah SPJ (Budget Report) berisi nomor nota, foto struk, rincian kuantitas, harga, dan diskon via HTTP POST `/api/budget-reports`.", bold_prefix="5. Pelaporan SPJ Lapangan:")
    add_bullet(doc, "Backend secara otomatis menerbitkan voucher jurnal berpasangan di tabel `journals`, mendebitkan beban belanja dan mengkreditkan kas operasional, memperbarui buku besar secara real-time.", bold_prefix="6. Otomasi Posting Jurnal:")

    # ==========================================
    # 18. TUGAS ANALISIS DAN REFLEKSI
    # ==========================================
    add_h1(doc, "18. TUGAS ANALISIS DAN REFLEKSI")

    add_h2(doc, "18.1 Analisis Kritis Keunggulan Sistem SIKAK")
    add_p(doc, "Dari sudut pandang evaluasi Sistem Informasi Akuntansi tingkat Magister, SIKAK memiliki keunggulan kompetitif yang nyata:")
    add_bullet(doc, "Sistem tidak mengizinkan pengeluaran kas tanpa adanya anggaran RAB yang telah disahkan sebelumnya. Hal ini mengubah paradigma pengendalian internal dari yang semula bersifat *detektif-reaktif* (menyesali defisit di akhir tahun) menjadi *preventif-proaktif* (mencegah defisit sejak awal transaksi).", bold_prefix="1. Kontrol Anggaran Preventif di Depan (Pre-Approval Budget Control):")
    add_bullet(doc, "Struktur Bagan Akun Standar dan pemisahan dana (Dana Terikat BOS vs Dana Tidak Terikat Siswa/Wakaf) memenuhi kaidah pelaporan entitas nirlaba ISAK 35 secara presisi.", bold_prefix="2. Kepatuhan Standar Akuntansi Nirlaba (ISAK 35):")
    add_bullet(doc, "Setiap pelunasan iuran siswa langsung dipotong persentasenya ke pos yayasan dan unit secara deterministik di database, menutup celah *lapping* dan keterlambatan setor.", bold_prefix="3. Otomasi Distribusi Bagi Hasil:")
    add_bullet(doc, "Adanya pencatatan audit trail digital yang kebal sunting memberikan jaminan transparansi penuh bagi para auditor independen dan pimpinan yayasan.", bold_prefix="4. Ketersediaan Jejak Forensik Audit:")

    add_h2(doc, "18.2 Analisis Kritis Kelemahan dan Kerentanan Sistem")
    add_p(doc, "Kendati demikian, analisis objektif mengidentifikasi beberapa titik kerentanan yang perlu diantisipasi:", bold_prefix="Titik Kritis:")
    add_bullet(doc, "Meskipun bukti kuitansi foto diunggah ke sistem, verifikasi keaslian nota belanja fisik toko rekanan masih bergantung pada pemeriksaan manual mata manusia (*human visual inspection*). Terdapat risiko verifikator lalai memeriksa nota toko yang diedit atau dipalsukan.", bold_prefix="1. Ketergantungan Verifikasi Fisik Manual:")
    add_bullet(doc, "Sebagaimana dianalisis pada bab normalisasi, penyimpanan array item belanja dalam kolom JSON memerlukan penanganan validasi ketat di sisi Express.js. Galat koding pada backend berpotensi menyebabkan ketidaksesuaian nilai total.", bold_prefix="2. Resiko Integritas Dokumen JSON:")
    add_bullet(doc, "Sebagai aplikasi terpusat berbasis cloud/web, operasional kasir unit sangat bergantung pada stabilitas koneksi internet. Jika jaringan di unit sekolah terputus, kasir tidak dapat mencetak kuitansi instan.", bold_prefix="3. Ketergantungan Konektivitas Jaringan:")

    add_h2(doc, "18.3 Rekomendasi Solusi & Evaluasi Manajerial Jangka Panjang")
    add_p(doc, "Untuk meningkatkan kematangan tata kelola dan mitigasi risiko, direkomendasikan 3 (tiga) inisiatif strategis:")

    add_callout(doc,
        "Inisiatif 1: Integrasi Virtual Account Perbankan (Automated Cash Inflow)",
        "Menggantikan loket kasir tunai fisik dengan nomor Rekening Virtual Account (VA) BSI/Mandiri unik untuk setiap siswa. "
        "Ketika orang tua mentransfer biaya SPP via mobile banking, webhook perbankan langsung mengonfirmasi pelunasan ke SIKAK "
        "secara instan (real-time reconciliation). Hal ini memangkas 100% risiko penyelewengan kas tunai di tangan kasir sekolah.",
        box_type='success'
    )

    add_callout(doc,
        "Inisiatif 2: Penerapan OCR & AI Machine Vision pada Verifikasi Nota SPJ",
        "Mengintegrasikan teknologi Optical Character Recognition (OCR) berbasis AI. "
        "Saat bendahara sekolah memfoto nota belanja toko, mesin AI secara otomatis mengekstrak nama toko, tanggal transaksi, "
        "nomor nota, rincian barang, dan total nilai rupiah, lalu membandingkannya dengan form pengajuan. "
        "Sistem dapat mendeteksi indikasi nota palsu atau nota ganda yang diunggah berulang kali (duplicate invoice detection).",
        box_type='info'
    )

    add_callout(doc,
        "Inisiatif 3: Evolusi ke Arsitektur Event Sourcing & Distributed Ledger",
        "Untuk buku besar tingkat enterprise, sistem dapat berevolusi mengadopsi pola Event Sourcing, di mana setiap mutasi "
        "keuangan dicatat sebagai peristiwa permanen yang tidak dapat diubah (append-only ledger). Hal ini memberikan jaminan "
        "matematis bahwa posisi saldo akun selalu dapat direkonstruksi ulang secara sempurna dari titik awal sejarah pembukuan.",
        box_type='warn'
    )

    add_h2(doc, "18.4 Refleksi Akademis Magister SIA")
    add_p(doc,
        "Penyusunan tugas ini memberikan refleksi mendalam mengenai filosofi Sistem Informasi Akuntansi modern. "
        "Di masa lalu, akuntansi sering kali dipandang secara sempit sebagai profesi klerikal pencatatan historis (jurnal dan buku besar). "
        "Namun, melalui integrasi pemodelan REA McCarthy, pengendalian internal COSO, dan rekayasa basis data relasional Codd, "
        "SIA bertransformasi menjadi **Fondasi Tata Kelola Institusi (Institutional Governance Foundation)**."
    )
    add_p(doc,
        "SIA yang dirancang dengan baik tidak menunggu kecurangan terjadi untuk kemudian dilaporkan, melainkan secara aktif "
        "membangun pagar-pagar digital (*digital guardrails*) yang mengunci setiap pihak agar senantiasa bertindak dalam koridor "
        "amanah dan kepatuhan. Pada organisasi pendidikan nirlaba, keandalan SIA adalah wujud nyata pertanggungjawaban moral "
        "dan spiritual atas dana umat yang diamanahkan."
    )

    # ==========================================
    # 19. KESIMPULAN
    # ==========================================
    add_h1(doc, "19. KESIMPULAN")

    add_h2(doc, "19.1 Sintesis Hasil Analisis dan Perancangan")
    add_p(doc,
        "Berdasarkan pembahasan menyeluruh dari poin 1 hingga poin 18 terhadap sistem SIKAK Yayasan Umum, "
        "dapat ditarik kesimpulan komprehensif sebagai berikut:"
    )
    add_bullet(doc, "Aplikasi SIKAK berhasil menjembatani kebutuhan tata kelola keuangan yayasan pendidikan Islam multi-unit dengan mengintegrasikan 6 pilar operasional: penyusunan RAB partisipatif, siklus pendapatan iuran siswa, siklus pengeluaran berbasis nota SPJ riil, pengelolaan dana hibah BOS terisolasi, inventarisasi aset fisik, dan pembukuan buku besar otomatis berstandar ISAK 35.", bold_prefix="1. Integrasi Menyeluruh:")
    add_bullet(doc, "Penerapan ontologi Resources, Events, Agents (REA) dan Entity Relationship Diagram (ERD) menghasilkan pemahaman proses bisnis yang jauh lebih kaya dibandingkan akuntansi tradisional. Konsep dualitas ekonomi (Give-Take) berhasil menghubungkan peristiwa penyerahan jasa pendidikan dengan arus kas masuk, serta pengeluaran kas dengan perolehan sarana fisik sekolah.", bold_prefix="2. Keunggulan Pemodelan REA & ERD:")
    add_bullet(doc, "Skema basis data MySQL 30 entitas relasional telah diuji memenuhi bentuk normalisasi 1NF, 2NF, 3NF, dan BCNF, menghapuskan anomali penyisipan, pembaruan, dan penghapusan data. Penggunaan tipe data DECIMAL(15,2) dan indeks foreign key menjamin presisi moneter dan performa query laporan keuangan yang optimal.", bold_prefix="3. Ketangguhan Basis Data:")
    add_bullet(doc, "Pengendalian internal berbasis COSO ditegakkan secara nyata melalui otorisasi peran berjenjang (RBAC), pemisahan fungsi pembuat (maker) dan penyetuju (approver), prinsip Zero Budget Tolerance (No Budget No Cash), serta ketersediaan jejak audit digital (audit trail) yang permanen.", bold_prefix="4. Keandalan Pengendalian Internal:")

    add_h2(doc, "19.2 Rekomendasi Manajerial")
    add_p(doc, "Sebagai langkah tindak lanjut bagi pengurus yayasan dan tim pengembang sistem disarankan:")
    add_bullet(doc, "Menyusun Standar Operasional Prosedur (SOP) digital tertulis yang mewajibkan seluruh unit kerja hanya mencairkan dana belanja melalui alur SIKAK tanpa pengecualian.", bold_prefix="1. Formalisasi SOP:")
    add_bullet(doc, "Mempercepat integrasi kerja sama perbankan syariah untuk penerapan Virtual Account siswa guna meniadakan penanganan uang tunai di kasir sekolah.", bold_prefix="2. Digitalisasi Pembayaran:")
    add_bullet(doc, "Melakukan audit sistem berkala terhadap log aktivitas dan melakukan simulasi disaster recovery secara periodik guna menjamin ketersediaan data di masa depan.", bold_prefix="3. Audit Rutin:")
