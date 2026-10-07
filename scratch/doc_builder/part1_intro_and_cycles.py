import docx
from helpers import (
    add_h1, add_h2, add_h3, add_p, add_bullet, add_callout, 
    add_table, add_code_block
)

def build_part1(doc):
    # ==========================================
    # 1. PENDAHULUAN
    # ==========================================
    add_h1(doc, "1. PENDAHULUAN")
    
    add_h2(doc, "1.1 Latar Belakang Masalah")
    add_p(doc, 
        "Dalam era transformasi digital, tata kelola keuangan pada organisasi nirlaba—khususnya yayasan pendidikan "
        "yang menaungi banyak unit sekolah (multi-unit)—menghadapi tantangan kompleksitas yang sangat tinggi. "
        "Organisasi pendidikan nirlaba tidak hanya dituntut untuk menghasilkan layanan pengajaran yang bermutu, "
        "tetapi juga wajib menjaga akuntabilitas publik, transparansi arus kas, dan kepatuhan terhadap standar akuntansi "
        "keuangan yang berlaku, seperti Interpretasi Standar Akuntansi Keuangan (ISAK) 35 tentang Penyajian Laporan Keuangan "
        "Entitas Berorientasi Nonlaba (pengganti PSAK 45)."
    )
    add_p(doc,
        "Di banyak yayasan perguruan, proses pencatatan keuangan sering kali masih bersifat terfragmentasi (*siloed*). "
        "Setiap unit sekolah (mulai dari jenjang Taman Kanak-Kanak/TAUD, SDIT, SMPIT, SMAIT, hingga Pondok Pesantren) "
        "kerap mengelola buku kasnya sendiri secara manual menggunakan lembar kerja *spreadsheet*. Praktik ini memicu "
        "berbagai risiko fatal: asimetri informasi antara pimpinan yayasan dan kepala unit, lambatnya konsolidasi laporan "
        "keuangan bulanan, kesulitan dalam melacak posisi kas riil, serta tingginya risiko *fraud* seperti manipulasi kuitansi "
        "atau penyelewengan dana komitmen iuran wali murid (SPP)."
    )

    add_callout(doc, 
        "Mengapa Lembaga Pendidikan Membutuhkan SIA Terintegrasi?",
        "Sistem Informasi Akuntansi (SIA) bukan sekadar alat pencatat transaksi, melainkan sistem saraf organisasi yang "
        "menghubungkan perencanaan anggaran (RAB), pengendalian pengeluaran di lapangan, penerimaan dana siswa, hingga pelaporan "
        "keuangan yang memenuhi standar audit. Tanpa sistem yang terotomasi, konsolidasi multi-unit membutuhkan waktu berminggu-minggu "
        "dan sangat rentan terhadap kekeliruan manusia (*human error*).",
        box_type='info'
    )

    add_h2(doc, "1.2 Fenomena dan Masalah di Lapangan")
    add_p(doc, 
        "Berdasarkan observasi pada yayasan pengelola lembaga pendidikan, ditemukan beberapa titik rawan operasional yang mendesak untuk diselesaikan:",
        bold_prefix="Kondisi Empiris:"
    )
    add_bullet(doc, "Penyusunan Rencana Anggaran Biaya (RAB) tahunan masih sering tidak terkontrol dengan realisasi belanja harian, sehingga unit sering mengalami kondisi defisit kas tanpa terdeteksi sejak dini.", bold_prefix="1. Deviasi Anggaran:")
    add_bullet(doc, "Unit pendidikan menerima dana dari tiga sumber utama: komitmen wali murid (SPP, uang masuk, infaq), bantuan pemerintah (Bantuan Operasional Sekolah / BOS), dan donasi publik. Penggabungan rekening kas tanpa pemisahan pos yang tegas menyebabkan dana BOS rawan terpakai untuk pos non-BOS yang melanggar juknis kementerian.", bold_prefix="2. Perbauran Sumber Dana:")
    add_bullet(doc, "Pengeluaran belanja sering kali dicairkan terlebih dahulu sebelum bukti pertanggungjawaban (SPJ/nota) diverifikasi secara sah, mengakibatkan penumpukan kuitansi gantung di akhir tahun buku.", bold_prefix="3. Bukti Belanja Menggantung:")
    add_bullet(doc, "Pimpinan yayasan tidak memiliki visibilitas *real-time* terhadap posisi saldo kas dan buku besar masing-masing unit kerja.", bold_prefix="4. Ketiadaan Dasbor Terpusat:")

    add_h2(doc, "1.3 Rumusan Masalah")
    add_p(doc, "Berdasarkan latar belakang tersebut, perumusan masalah dalam studi analisis dan perancangan SIA ini adalah:")
    add_bullet(doc, "Bagaimana merancang arsitektur Sistem Informasi Akuntansi (SIA) yang mampu mengintegrasikan siklus penganggaran (RAB), pendapatan, dan pengeluaran pada yayasan pendidikan multi-unit secara *real-time*?")
    add_bullet(doc, "Bagaimana memodelkan proses bisnis akuntansi nirlaba menggunakan kerangka kerja Resources, Events, Agents (REA) dan Entity Relationship Diagram (ERD) guna memperkuat kontrol internal?")
    add_bullet(doc, "Bagaimana mendesain skema basis data relasional MySQL yang memenuhi prinsip normalisasi data (1NF, 2NF, 3NF, BCNF) sekaligus mendukung penelusuran jejak audit (*audit trail*) dan rekonsiliasi keuangan?")

    add_h2(doc, "1.4 Tujuan Perancangan")
    add_p(doc, "Tujuan penulisan dan perancangan sistem ini mencakup tiga dimensi utama:")
    add_bullet(doc, "Menghasilkan cetak biru (*blueprint*) konseptual dan logis SIA yang memadukan teori akuntansi ISAK 35 dengan teknologi basis data relasional modern.", bold_prefix="Tujuan Akademis:")
    add_bullet(doc, "Menyediakan panduan implementasi aplikasi SIKAK (Sistem Informasi Keuangan dan Akuntansi Komprehensif) yang dapat langsung dioperasikan oleh kasir unit, kepala sekolah, dan bendahara yayasan.", bold_prefix="Tujuan Praktis:")
    add_bullet(doc, "Menegakkan prinsip pemisahan tugas (*segregation of duties*) dan tata kelola yang baik (*Good Institutional Governance*) melalui mekanisme otorisasi bertingkat.", bold_prefix="Tujuan Pengendalian:")

    add_h2(doc, "1.5 Manfaat Sistem")
    add_p(doc, "Penerapan sistem SIKAK memberikan dampak signifikan bagi berbagai pemangku kepentingan:")
    
    headers_manfaat = ["Pemangku Kepentingan", "Manfaat Operasional", "Dampak Strategis"]
    data_manfaat = [
        ["Pengurus Yayasan", "Monitoring posisi saldo kas/bank terpusat secara real-time.", "Pengambilan keputusan alokasi dana dan ekspansi fasilitas berbasis data valid."],
        ["Kepala Unit / Sekolah", "Kemudahan memantau sisa pagu anggaran unit tanpa perlu kalkulasi manual.", "Pencegahan pengeluaran melebihi plafon (over-budget)."],
        ["Bendahara & Kasir", "Penerbitan kuitansi otomatis dan pencatatan transaksi langsung ke jurnal.", "Peniadaan pekerjaan rekonsiliasi manual yang melelahkan di akhir bulan."],
        ["Auditor Internal/Eksternal", "Ketersediaan jejak audit digital (siapa, kapan, dan apa yang diubah).", "Proses audit keuangan menjadi cepat, transparan, dan terpercaya."],
        ["Wali Murid & Donatur", "Pemberitahuan tagihan dan bukti setor yang transparan dan akurat.", "Meningkatnya kepercayaan publik terhadap integritas amanah yayasan."]
    ]
    add_table(doc, headers_manfaat, data_manfaat, [1.5, 2.5, 2.2])

    # ==========================================
    # 2. PROFIL DAN RUANG LINGKUP
    # ==========================================
    add_h1(doc, "2. PROFIL DAN RUANG LINGKUP")
    
    add_h2(doc, "2.1 Profil Organisasi Studi Kasus")
    add_p(doc, 
        "Studi kasus dalam tugas ini didasarkan pada implementasi nyata aplikasi SIKAK (Sistem Informasi Keuangan dan "
        "Akuntansi Kelembagaan) pada yayasan pendidikan dan dakwah sosial, yaitu Yayasan Wakaf / Perguruan Islam "
        "(studi model Dareliman). Organisasi ini memiliki struktur tata kelola hierarkis berjenjang:"
    )
    add_bullet(doc, "Badan Pembina dan Badan Pengurus Yayasan yang bertanggung jawab atas arah kebijakan strategis, penetapan regulasi anggaran tahunan, dan kepemilikan aset wakaf/hibah.", bold_prefix="Tingkat Puncak (Yayasan Induk):")
    add_bullet(doc, "Organisasi kerja fungsional yang mengoordinasikan beberapa unit sejenis, seperti: Bidang Pendidikan, Bidang Sosial & Dakwah, serta Bidang Sarana & Prasarana.", bold_prefix="Tingkat Menengah (Bidang):")
    add_bullet(doc, "Satuan kerja operasional yang berinteraksi langsung dengan peserta didik dan masyarakat, antara lain: TAUD (Tahfizh Anak Usia Dini), SDIT 1, SDIT 2, SMPIT, SMAIT, Pondok Pesantren, serta Unit Usaha/Sosial.", bold_prefix="Tingkat Operasional (Unit Kerja):")

    add_h2(doc, "2.2 Model Bisnis Organisasi Nirlaba Pendidikan")
    add_p(doc,
        "Berbeda dengan entitas bisnis komersial yang berorientasi pada laba bersih (*profit maximization*), entitas yayasan "
        "pendidikan berorientasi pada keberlanjutan layanan (*service continuity*) dan amanah surplus neto. Arus kas yayasan "
        "ditopang oleh tiga pilar:"
    )
    add_bullet(doc, "Iuran pendidikan berkala (SPP), biaya pendaftaran siswa baru, iuran fasilitas gedung, dan konsumsi asrama. Iuran ini bersifat pendapatan jasa pendidikan dengan komitmen yang telah disepakati wali murid.", bold_prefix="1. Dana Operasional Siswa:")
    add_bullet(doc, "Bantuan Operasional Sekolah (BOS) dari Kementerian Pendidikan yang disalurkan dalam tahapan berkala (Tahap I dan Tahap II). Penggunaannya diatur ketat oleh Petunjuk Teknis (Juknis) nasional berdasarkan 12 Standar Pos Pengeluaran BOS.", bold_prefix="2. Dana Hibah Pemerintah (BOS):")
    add_bullet(doc, "Infaq, sedekah, dan wakaf dari masyarakat untuk pembangunan sarana dakwah, beasiswa anak yatim/dhuafa, atau kegiatan keumatan.", bold_prefix="3. Dana Sosial & Wakaf:")

    add_h2(doc, "2.3 Ruang Lingkup Sistem Informasi")
    add_p(doc, "Aplikasi SIKAK mencakup 6 (enam) modul fungsional terpadu:")
    add_bullet(doc, "Penyusunan Rencana Anggaran Biaya tahunan oleh unit per tahun ajaran dengan status alur persetujuan: DRAFT -> PENDING -> APPROVED / REJECTED.", bold_prefix="1. Modul Penganggaran (RAB):")
    add_bullet(doc, "Pengelolaan data induk siswa, penetapan komitmen iuran individual, penagihan bulanan, dan otomasi alokasi bagi hasil (Distribution Setting) ke yayasan dan unit.", bold_prefix="2. Modul Siklus Pendapatan Siswa:")
    add_bullet(doc, "Pengajuan permintaan dana belanja (Budget Request) bertingkat, pencairan kas, dan pelaporan SPJ riil (Budget Report) yang dilengkapi bukti foto nota dan nomor faktur.", bold_prefix="3. Modul Siklus Pengeluaran & SPJ:")
    add_bullet(doc, "Pencatatan alokasi dana BOS per tahap dan per pos juknis, dengan isolasi pembukuan agar tidak bercampur dengan kas reguler yayasan.", bold_prefix="4. Modul Khusus Dana BOS:")
    add_bullet(doc, "Pencatatan inventaris sarana prasarana sekolah, masa manfaat (umur ekonomis), penyusutan, dan penanggung jawab (PIC) ruang.", bold_prefix="5. Modul Manajemen Aset Tetap:")
    add_bullet(doc, "Bagan Akun Standar (COA), Jurnal Umum double-entry otomatis dan manual, Buku Besar, Neraca Saldo, Laporan Posisi Keuangan, dan Laporan Aktivitas berbasis ISAK 35.", bold_prefix="6. Modul Akuntansi & Buku Besar:")

    add_h2(doc, "2.4 Asumsi dan Batasan Sistem")
    add_p(doc, "Untuk menjaga fokus dan keandalan perancangan, ditetapkan beberapa batasan sistem:")
    add_bullet(doc, "Sistem menggunakan mata uang tunggal Rupiah (IDR).")
    add_bullet(doc, "Metode pencatatan akuntansi menggunakan basis akrual termodifikasi (*modified accrual basis*), di mana komitmen pendapatan siswa diakui saat tahun ajaran berjalan, namun realisasi arus kas dicatat saat pembayaran diterima.")
    add_bullet(doc, "Tahun buku akuntansi mengikuti tahun ajaran pendidikan (dimulai 1 Juli hingga 30 Juni tahun berikutnya) di samping tahun kalender Masehi.")

    # ==========================================
    # 3. SIKLUS PENDAPATAN / PENJUALAN
    # ==========================================
    add_h1(doc, "3. SIKLUS PENDAPATAN / PENJUALAN (REVENUE CYCLE)")

    add_h2(doc, "3.1 Karakteristik Siklus Pendapatan Lembaga Pendidikan")
    add_p(doc,
        "Dalam teori Sistem Informasi Akuntansi konvensional, siklus pendapatan umumnya digambarkan sebagai proses "
        "penjualan barang dagang (*Sales Order Processing*) yang melibatkan penerimaan pesanan pelanggan, pengiriman barang, "
        "penagihan faktur, dan penerimaan kas (*Cash Receipts*). Namun, pada institusi yayasan pendidikan, siklus pendapatan "
        "memiliki karakteristik khusus: tidak ada persediaan barang dagang yang dikirimkan, melainkan penyerahan jasa pendidikan "
        "yang berkelanjutan selama periode kalender akademik."
    )
    add_p(doc,
        "Pendapatan diakui atas dasar pemenuhan kewajiban pelaksanaan jasa pendidikan. Siklus ini berfokus pada "
        "pengelolaan komitmen tarif iuran peserta didik, penagihan terjadwal, penerimaan setoran kas/bank, dan "
        "distribusi persentase penerimaan ke berbagai rekening alokasi."
    )

    add_h2(doc, "3.2 Tiga Jalur Utama Aliran Pendapatan")
    add_p(doc, "Pada sistem SIKAK, siklus penerimaan pendapatan terbagi ke dalam 3 (tiga) kanal utama:")
    
    headers_pendapatan = ["Kanal Pendapatan", "Subjek Pembayar", "Karakteristik & Mekanisme Pengakuan", "Frekuensi"]
    data_pendapatan = [
        ["Iuran Siswa (SPP & Uang Pangkal)", "Wali Murid / Siswa", "Ditetapkan pada awal tahun ajaran melalui tabel StudentIncomeDetail. Komitmen bulanan dengan status mampu/kurang mampu.", "Bulanan & Tahunan"],
        ["Dana Hibah BOS", "Pemerintah (Kemendikbud/Kemenag)", "Disalurkan per semester (Tahap 1 & 2) berdasarkan jumlah cut-off siswa Dapodik. Dana masuk ke rekening khusus BOS.", "Semesteran (2x setahun)"],
        ["Infaq, Donasi & Wakaf", "Masyarakat / Donatur Luar", "Penerimaan sukarela terikat program dakwah atau tidak terikat. Dicatat melalui modul Kontak Donatur dan Jurnal Penerimaan Kas.", "Insidental / Rutin"]
    ]
    add_table(doc, headers_pendapatan, data_pendapatan, [1.5, 1.3, 2.5, 1.2])

    add_h2(doc, "3.3 Alur Dokumen dan Informasi (Flow of Documents & Information)")
    add_p(doc, "Alur operasional siklus pendapatan siswa dari hulu ke hilir berjalan dalam lima langkah sistematis:")
    add_bullet(doc, "Tata Usaha unit memasukkan data siswa baru dan menetapkan rincian tarif komitmen (SPP bulanan, uang gedung, katering) sesuai jenjang kelas dan status ekonomi keluarga (Mampu vs Tidak Mampu). Data tersimpan di tabel Student dan StudentIncomeDetail.", bold_prefix="Langkah 1: Penetapan Komitmen Awal:")
    add_bullet(doc, "Pada awal setiap bulan kalender, sistem mengompilasi daftar piutang tagihan siswa. Tagihan diinformasikan kepada wali murid melalui rekap surat tagihan atau pesan notifikasi.", bold_prefix="Langkah 2: Penerbitan Tagihan:")
    add_bullet(doc, "Wali murid menyetorkan dana secara tunai di loket kasir unit atau melalui transfer ke rekening bank sekolah. Kasir menerima bukti setor.", bold_prefix="Langkah 3: Pembayaran & Verifikasi:")
    add_bullet(doc, "Kasir menginput pelunasan ke sistem SIKAK. Sistem langsung menerbitkan Kuitansi Elektronik bernomor unik sebagai bukti bayar sah bagi wali murid.", bold_prefix="Langkah 4: Penerbitan Bukti Pembayaran:")
    add_bullet(doc, "Sistem secara otomatis mengeksekusi aturan distribusi (Distribution Setting). Misalnya: 70% penerimaan SPP dialokasikan untuk kas operasional unit, 20% disetor ke kas yayasan pusat, dan 10% dialokasikan untuk cadangan pengembangan sarana. Jurnal penerimaan kas langsung terbentuk di tabel journals.", bold_prefix="Langkah 5: Pemotongan Distribusi & Posting Jurnal:")

    add_h2(doc, "3.4 Dokumen Sumber (Source Documents)")
    add_p(doc, "Dokumen-dokumen kunci yang menjadi instrumen hukum dan akuntansi pada siklus ini meliputi:")
    add_bullet(doc, "Formulir komitmen finansial wali murid saat mendaftar ulang yang menjadi dasar entri tarif individual.", bold_prefix="1. Surat Pernyataan Kesanggupan Biaya (SPKB):")
    add_bullet(doc, "Dokumen penagihan resmi yang mencantumkan rincian tunggakan dan biaya bulan berjalan.", bold_prefix="2. Surat Tagihan Pembayaran Siswa (Invoice / Slip SPP):")
    add_bullet(doc, "Kuitansi bernomor seri resmi dari sistem dengan cap digital/tanda tangan kasir, berfungsi sebagai bukti sah penyerahan uang.", bold_prefix="3. Kuitansi Penerimaan Kas (Receipt Voucher):")
    add_bullet(doc, "Dokumen perbankan untuk pencocokan setoran non-tunai pada proses rekonsiliasi berkala.", bold_prefix="4. Rekening Koran Bank (Bank Statement):")

    add_h2(doc, "3.5 Titik Risiko Pengendalian & Mitigasi pada Siklus Pendapatan")
    add_callout(doc,
        "Analisis Risiko Pengendalian: Siklus Pendapatan",
        "Risiko Utama: 'Skimming' (kasir mengambil uang kas sebelum dicatat di sistem) dan 'Lapping' (menggunakan uang setoran siswa B untuk menutupi tunggakan siswa A yang sebelumnya digelapkan).\n"
        "Mitigasi SIKAK: Sistem mewajibkan penerbitan kuitansi bernomor urut terotomasi dengan notifikasi SMS/WA kepada wali murid. Selain itu, aturan 'Distribution Setting' memaksa sistem mengunci saldo penerimaan ke rekening COA yang telah ditetapkan, sehingga kasir tidak dapat memanipulasi pos rekening tujuan.",
        box_type='warn'
    )

    # ==========================================
    # 4. SIKLUS PENGELUARAN / PEMBELIAN
    # ==========================================
    add_h1(doc, "4. SIKLUS PENGELUARAN / PEMBELIAN (EXPENDITURE CYCLE)")

    add_h2(doc, "4.1 Karakteristik Siklus Pengeluaran Berbasis Anggaran")
    add_p(doc,
        "Pada perusahaan manufaktur atau dagang, siklus pengeluaran digerakkan oleh kebutuhan pengadaan bahan baku "
        "melalui surat pesanan pembelian (*Purchase Order*), laporan penerimaan barang (*Receiving Report*), dan faktur vendor. "
        "Sebaliknya, pada yayasan pendidikan nirlaba, siklus pengeluaran digerakkan secara ketat oleh **Plafon Anggaran (RAB)**. "
        "Prinsip dasar yang ditegakkan adalah: *'Tidak ada pengeluaran kas yang boleh dicairkan tanpa persetujuan alokasi anggaran "
        "yang sah di muka (Pre-Approved Budget Control)'*."
    )

    add_h2(doc, "4.2 Enam Tahap Alur Operasional Pengeluaran SIKAK")
    add_p(doc, "Siklus pengeluaran pada SIKAK dirancang dengan arsitektur 6 (enam) tahapan terkontrol:")
    
    headers_tahap = ["No", "Tahapan Operasional", "Tabel Database", "Pelaku (Agent)", "Hasil / Luaran"]
    data_tahap = [
        ["1", "Pengusulan & Pengesahan RAB Tahunan", "rab_plans", "Kepala Unit -> Pimpinan Bidang -> Bendahara Yayasan", "Dokumen RAB berstatus APPROVED sebagai pagu maksimal belanja 1 tahun."],
        ["2", "Pengajuan Permintaan Dana Bulanan", "budget_requests", "Bendahara Unit", "Daftar kebutuhan operasional riil bulan berjalan (Budget Request) dengan status PENDING."],
        ["3", "Verifikasi & Otorisasi Pengeluaran", "budget_requests", "Admin Bidang & Superadmin Yayasan", "Persetujuan pencairan dana setelah memeriksa kesesuaian mata anggaran dan sisa pagu."],
        ["4", "Pencairan Kas / Transfer Bank", "journals (BKK)", "Kasir Yayasan / Bank", "Kas keluar dari Rekening Yayasan ke Rekening Kas Operasional Unit."],
        ["5", "Belanja & Pelaporan SPJ Lapangan", "budget_reports", "Pelaksana Unit / Bendahara Sekolah", "Entri bukti nota toko, bukti foto struk, rincian volume x harga, diskon, dan klasifikasi aset."],
        ["6", "Pemeriksaan Akhir & Posting Jurnal", "journals, assets", "Verifikator Yayasan", "Posting otomatis beban ke buku besar; otomatisasi pencatatan ke tabel assets jika belanja modal."]
    ]
    add_table(doc, headers_tahap, data_tahap, [0.5, 1.8, 1.4, 1.5, 1.6])

    add_h2(doc, "4.3 Dokumen Sumber (Source Documents)")
    add_p(doc, "Dokumen yang terlibat dalam siklus pengeluaran meliputi:")
    add_bullet(doc, "Matriks rencana belanja unit selama satu tahun ajaran yang telah ditandatangani ketua yayasan.", bold_prefix="1. Rencana Anggaran Biaya (RAB):")
    add_bullet(doc, "Formulir permintaan transfer dana operasional bulanan yang diajukan oleh kepala unit.", bold_prefix="2. Surat Permintaan Dana (Budget Request Form):")
    add_bullet(doc, "Voucher kas keluar resmi yayasan yang mendasari transfer antarbank atau penyerahan kas fisik.", bold_prefix="3. Bukti Kas Keluar (BKK):")
    add_bullet(doc, "Struk kasir, kuitansi bermeterai toko rekanan, atau faktur pembelian perlengkapan.", bold_prefix="4. Nota / Faktur Pembelian Asli Toko:")
    add_bullet(doc, "Rekapitulasi penggunaan dana riil disertai lampiran fisik kuitansi belanja untuk diverifikasi tim audit yayasan.", bold_prefix="5. Surat Pertanggungjawaban (SPJ) / Budget Report:")

    add_h2(doc, "4.4 Analisis Fitur Khusus: Pengembalian Sisa Dana dan Reklasifikasi Aset")
    add_p(doc,
        "SIKAK mengakomodasi dua kondisi nyata yang sering terjadi di lapangan saat pelaporan belanja:",
        bold_prefix="Fleksibilitas Akuntansi:"
    )
    add_bullet(doc, "Jika dana yang dicairkan sebesar Rp 10.000.000, namun realisasi belanja fisik hanya menghabiskan Rp 9.500.000, sistem memungkinkan entri Budget Report berkategori 'PENGEMBALIAN' senilai Rp 500.000. Sistem otomatis mengkreditkan kembali kas operasional unit dan mendebitkan kas yayasan, mengembalikan sisa dana tanpa merusak buku besar.", bold_prefix="Kondisi 1: Pengembalian Sisa Dana (Refund):")
    add_bullet(doc, "Jika belanja operasional digunakan untuk membeli barang bernilai tinggi dengan masa manfaat lebih dari 1 tahun (misalnya komputer sekolah atau proyektor), pengguna memilih kategoriAset = 'ASET'. Sistem secara otomatis memasukkan barang tersebut ke master tabel assets lengkap dengan masa manfaat (umurEkonomis) untuk amortisasi penyusutan.", bold_prefix="Kondisi 2: Kapitalisasi Aset Tetap:")

    add_callout(doc,
        "Pengendalian Internal: Pencegahan Belanja Melebihi Pagu (Over-Budget)",
        "Di sistem konvensional, sekolah kerap berbelanja terlebih dahulu dan baru melapor saat kas habis. "
        "Di SIKAK, mesin validasi backend (`anggaran.js`) mengecek sisa saldo pagu mata anggaran sebelum menyetujui Budget Request. "
        "Jika total pengajuan melebihi sisa alokasi RAB tahunan, sistem menolak pengajuan tersebut secara otomatis (*Hard Stop*).",
        box_type='success'
    )
