import React, { useState, useRef } from 'react';
import {
    BookOpen, ShieldCheck, CheckCircle2, AlertTriangle, FileText,
    Download, Printer, Search, ArrowRight, Wallet, Target,
    Landmark, Send, Receipt, Lock, Building2, User, Users,
    FileCheck, Award, ChevronRight, Check, Sparkles, Eye,
    Layers, CornerDownRight, Clock, AlertCircle, Info, RefreshCw
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function SOPKeuangan() {
    const { state } = useApp();
    const currentUserRole = state.currentUser?.role || 'admin_unit';

    // State
    const [viewMode, setViewMode] = useState('infografis'); // 'infografis' | 'dokumen'
    const [activeRoleFilter, setActiveRoleFilter] = useState('all'); // 'all' | 'superadmin' | 'bidang' | 'unit'
    const [searchQuery, setSearchQuery] = useState('');
    const [isExporting, setIsExporting] = useState(false);
    const [activeChapter, setActiveChapter] = useState(1);

    const printAreaRef = useRef(null);

    // Fungsi Download PDF menggunakan html2pdf.js
    const handleDownloadPDF = async () => {
        setIsExporting(true);
        try {
            // Pastikan elemen dokumen cetak terlihat saat generate
            const element = document.getElementById('sop-legal-document');
            if (!element) {
                window.print();
                return;
            }

            const html2pdfModule = await import('html2pdf.js');
            const html2pdf = html2pdfModule.default || html2pdfModule;

            const opt = {
                margin: [10, 10, 15, 10], // mm
                filename: 'SOP_Pengelolaan_Keuangan_Yayasan_Dareliman.pdf',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, logging: false },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
            };

            await html2pdf().set(opt).from(element).save();
        } catch (err) {
            console.error('Export PDF error, falling back to window.print():', err);
            window.print();
        } finally {
            setIsExporting(false);
        }
    };

    // Fungsi Cetak Dokumen (Native Print)
    const handlePrint = () => {
        window.print();
    };

    // Data 5 Alur Utama (Infografis Visual)
    const workflowStages = [
        {
            stage: 1,
            title: 'Perencanaan & Penyusunan RAB',
            subtitle: 'Annual/Semester Budgeting',
            icon: Target,
            color: 'blue',
            badge: 'Status: DRAFT → PENDING → APPROVED',
            actor: 'Admin Unit & Admin Bidang',
            approver: 'Superadmin (Keuangan Yayasan)',
            menu: 'PERENCANAAN (RAB) > RAB Yayasan / BOS',
            desc: 'Unit dan Bidang merancang estimasi kebutuhan belanja operasional dan program kerja secara terperinci sebelum periode berjalan.',
            points: [
                'Wajib memastikan data Siswa & Kelas telah valid di menu Database Anggaran sebagai basis proyeksi pendapatan.',
                'Menentukan rincian pos belanja, volume, satuan, dan estimasi harga wajar.',
                'Superadmin memeriksa pagu dan menyetujui (Approve) atau menolak (Reject) disertai catatan revisi.',
                'Prinsip Kunci: Tanpa RAB yang disetujui (Approved), dana tidak dapat dicairkan sama sekali!'
            ]
        },
        {
            stage: 2,
            title: 'Pengajuan & Pencairan Dana',
            subtitle: 'Monthly Fund Request',
            icon: Send,
            color: 'indigo',
            badge: 'Status: PENDING → APPROVED',
            actor: 'Admin Unit / Bidang',
            approver: 'Superadmin (Pencairan Kas)',
            menu: 'REALISASI ANGGARAN > Permintaan Dana',
            desc: 'Pencairan uang muka kerja/kasbon bulanan berbasis pos anggaran yang telah berstatus Approved pada RAB.',
            points: [
                'Hanya item RAB berstatus APPROVED yang dapat diajukan pencairannya.',
                'Boleh mencairkan bertahap (sebagian dari total RAB) sesuai kebutuhan riil bulan berjalan.',
                'Prasyarat Wajib: Seluruh kewajiban LPJ & pengembalian sisa dana bulan sebelumnya sudah berstatus tuntas (SETTLED).',
                'Superadmin memverifikasi dan mentransfer dana ke rekening resmi lembaga.'
            ]
        },
        {
            stage: 3,
            title: 'Pelaksanaan Belanja & Bukti Nota',
            subtitle: 'Spending & Document Collection',
            icon: Receipt,
            color: 'emerald',
            badge: 'Standar Bukti Sah',
            actor: 'Bendahara Unit / Tim Pengadaan',
            approver: 'Kepala Unit (Verifikasi Fisik)',
            menu: 'Operasional Lapangan',
            desc: 'Belanja riil sesuai peruntukan anggaran dengan mengumpulkan dokumen dan bukti nota transaksi yang sah.',
            points: [
                'Transaksi < Rp 1.000.000: Wajib Nota Kontan/Bon resmi bercap toko penyedia.',
                'Transaksi Rp 1.000.000 - Rp 5.000.000: Wajib kuitansi bermaterai cukup/faktur resmi.',
                'Transaksi > Rp 5.000.000: Dilengkapi Surat Pesanan (SPK) dan Berita Acara Serah Terima (BAST).',
                'Untuk belanja aset tetap (inventaris manfaat > 1 tahun), catat spesifikasi dan umur ekonomisnya.'
            ]
        },
        {
            stage: 4,
            title: 'Laporan Realisasi Pengeluaran (LPJ)',
            subtitle: 'Monthly Accountability Report',
            icon: FileCheck,
            color: 'amber',
            badge: 'Status: PENDING → APPROVED',
            actor: 'Admin Unit / Bidang',
            approver: 'Superadmin (Verifikasi LPJ)',
            menu: 'REALISASI ANGGARAN > Pengeluaran Yayasan',
            desc: 'Mempertanggungjawabkan pemakaian dana dengan menginput rincian transaksi belanja beserta foto/scan nota fisik.',
            points: [
                'Input tanggal transaksi, nomor nota, volume, satuan, harga per unit, dan diskon.',
                'Pilih kategori NON_ASET untuk belanja rutin atau ASET untuk belanja modal/peralatan.',
                'Unggah bukti scan/foto nota fisik yang terbaca jelas.',
                'Batas waktu penyerahan LPJ: Paling lambat tanggal 25 setiap bulan berjalan.'
            ]
        },
        {
            stage: 5,
            title: 'Penyelesaian & Pengembalian Sisa Dana',
            subtitle: 'Fund Settlement & Zero-Balance Refund',
            icon: Wallet,
            color: 'rose',
            badge: 'Status: REFUND → CLOSED / SETTLED',
            actor: 'Admin Unit / Bidang & Superadmin',
            approver: 'Superadmin (ACC Pengembalian)',
            menu: 'REALISASI ANGGARAN > Ketersediaan Dana',
            desc: 'Mengembalikan sisa dana kasbon yang tidak habis terpakai ke rekening Yayasan demi asas zero-balance.',
            points: [
                'Rumus Sisa Kasbon = Total Dana Cair - Total Realisasi Belanja yang Disetujui Yayasan.',
                'Jika ada sisa uang, isi form Pengembalian Sisa Dana Kas di menu Ketersediaan Dana.',
                'Transfer sisa uang riil ke rekening kas induk Yayasan Dareliman.',
                'Setelah Superadmin memverifikasi dana masuk dan klik ACC Pengembalian, status pengajuan menjadi SETTLED/CLOSED.'
            ]
        }
    ];

    // Matriks RACI
    const raciData = [
        { aktivitas: 'Penyusunan Rencana Anggaran (RAB)', pembina: 'I', pengurus: 'A', superadmin: 'R', bidang: 'R', unit: 'R' },
        { aktivitas: 'Persetujuan (Approval) Pagu RAB', pembina: 'I', pengurus: 'A', superadmin: 'R', bidang: 'C', unit: 'I' },
        { aktivitas: 'Pengajuan Permintaan Dana Bulanan', pembina: 'I', pengurus: 'I', superadmin: 'A', bidang: 'R', unit: 'R' },
        { aktivitas: 'Pencairan Kas / Transfer Bank', pembina: 'I', pengurus: 'A', superadmin: 'R', bidang: 'I', unit: 'I' },
        { aktivitas: 'Pelaksanaan Pembelanjaan Operasional', pembina: 'I', pengurus: 'I', superadmin: 'I', bidang: 'R', unit: 'R' },
        { aktivitas: 'Penyampaian LPJ & Bukti Nota', pembina: 'I', pengurus: 'I', superadmin: 'A', bidang: 'R', unit: 'R' },
        { aktivitas: 'Pengembalian Sisa Saldo Kasbon', pembina: 'I', pengurus: 'I', superadmin: 'A', bidang: 'R', unit: 'R' },
        { aktivitas: 'Jurnal Memorial & Tutup Buku', pembina: 'I', pengurus: 'A', superadmin: 'R', bidang: 'I', unit: 'I' },
        { aktivitas: 'Penerbitan Laporan Finansial ISAK 35', pembina: 'A', pengurus: 'A', superadmin: 'R', bidang: 'I', unit: 'I' }
    ];

    // Bab-bab Dokumen Legal
    const chapters = [
        {
            id: 1,
            title: 'BAB I: KETENTUAN UMUM & PRINSIP TATA KELOLA',
            content: (
                <div className="space-y-4 text-slate-700 leading-relaxed">
                    <p className="font-semibold text-slate-900">Pasal 1 — Ketentuan Dasar</p>
                    <ol className="list-decimal pl-5 space-y-2">
                        <li>Pengelolaan keuangan di lingkungan Yayasan Dareliman diselenggarakan berdasarkan prinsip <strong>transparansi, akuntabilitas, efisiensi, dan kepatuhan syariah</strong>.</li>
                        <li>Standar pencatatan akuntansi keuangan mengacu pada Standar Akuntansi Keuangan Entitas Nirlaba (<strong>ISAK 35 / PSAK</strong>) yang diotomasi melalui Sistem Informasi Keuangan dan Akuntansi Keuangan (<strong>SIKAK</strong>).</li>
                        <li>Tahun buku Yayasan dimulai pada tanggal 1 Januari dan berakhir pada tanggal 31 Desember tahun berjalan, dengan penyesuaian kalender akademik untuk unit-unit pendidikan.</li>
                    </ol>

                    <p className="font-semibold text-slate-900 mt-6">Pasal 2 — Prinsip Utama Pengeluaran Kas</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-3">
                        <div className="bg-blue-50/70 border border-blue-200 p-4 rounded-xl">
                            <h5 className="font-bold text-blue-900 mb-1 flex items-center gap-2">
                                <CheckCircle2 size={16} className="text-blue-600" />
                                Asas No Approved RAB, No Cash Out
                            </h5>
                            <p className="text-sm text-blue-800">
                                Tidak dibenarkan melakukan pengeluaran kas atau transfer dana tanpa adanya pos anggaran yang berstatus <strong>APPROVED</strong> pada sistem SIKAK.
                            </p>
                        </div>
                        <div className="bg-emerald-50/70 border border-emerald-200 p-4 rounded-xl">
                            <h5 className="font-bold text-emerald-900 mb-1 flex items-center gap-2">
                                <CheckCircle2 size={16} className="text-emerald-600" />
                                Asas Zero-Pending Settlement
                            </h5>
                            <p className="text-sm text-emerald-800">
                                Pencairan bulan berikutnya diblokir sementara apabila laporan pertanggungjawaban (LPJ) atau sisa pengembalian saldo kasbon bulan sebelumnya belum dituntaskan.
                            </p>
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 2,
            title: 'BAB II: PERENCANAAN DAN PENGANGGARAN (RAB)',
            content: (
                <div className="space-y-4 text-slate-700 leading-relaxed">
                    <p className="font-semibold text-slate-900">Pasal 3 — Penyusunan Rencana Anggaran Biaya (RAB)</p>
                    <ol className="list-decimal pl-5 space-y-2">
                        <li>Setiap Unit (PAUD, TKIT, SDIT, SMPIT, Panti Asuhan, Masjid) dan Bidang wajib menyusun RAB tahunan sebelum tahun ajaran baru dimulai.</li>
                        <li>Penyusunan RAB wajib diawali dengan verifikasi dan pemutakhiran data operasional di menu <strong>DATABASE ANGGARAN</strong> (Database Siswa, Status Siswa, dan Kelas) sebagai tolok ukur penerimaan SPP dan alokasi BOS.</li>
                        <li>Setiap pengajuan RAB memuat uraian belanja terperinci: nama item pengeluaran, peruntukan kegiatan, kuantitas volume, satuan ukuran, dan estimasi harga per unit.</li>
                        <li>RAB diinput pada modul <strong>PERENCANAAN (RAB) &gt; RAB Yayasan</strong> atau <strong>RAB BOS</strong>.</li>
                    </ol>

                    <p className="font-semibold text-slate-900 mt-6">Pasal 4 — Verifikasi & Persetujuan RAB</p>
                    <ol className="list-decimal pl-5 space-y-2">
                        <li>Superadmin (Keuangan Yayasan) bersama Pengurus memeriksa kewajaran harga pasar, ketersediaan saldo pagu, dan prioritas program.</li>
                        <li>RAB yang memenuhi syarat diberikan status <strong>APPROVED</strong>. RAB yang memerlukan koreksi diberikan status <strong>REJECTED</strong> dengan catatan revisi yang harus diperbaiki oleh Unit/Bidang.</li>
                    </ol>
                </div>
            )
        },
        {
            id: 3,
            title: 'BAB III: PENGAJUAN DAN PENCAIRAN DANA BULANAN',
            content: (
                <div className="space-y-4 text-slate-700 leading-relaxed">
                    <p className="font-semibold text-slate-900">Pasal 5 — Tata Cara Permintaan Dana (Monthly Request)</p>
                    <ol className="list-decimal pl-5 space-y-2">
                        <li>Pengajuan pencairan dana rutin bulanan dibuka pada <strong>tanggal 1 sampai dengan tanggal 5</strong> setiap bulan berjalan melalui menu <strong>REALISASI ANGGARAN &gt; Permintaan Dana</strong>.</li>
                        <li>Dana yang dapat dicairkan hanya bersumber dari item belanja yang telah disetujui (Approved) pada dokumen RAB.</li>
                        <li>Unit/Bidang diperbolehkan mencairkan anggaran secara bertahap sesuai kebutuhan operasional riil yang mendesak, guna menghindari uang kas mengendap berlebihan di unit.</li>
                    </ol>

                    <p className="font-semibold text-slate-900 mt-6">Pasal 6 — Eksekusi Pencairan Kas/Bank</p>
                    <ol className="list-decimal pl-5 space-y-2">
                        <li>Pencairan dana dilakukan secara non-tunai melalui transfer perbankan ke rekening resmi unit atau secara tunai dengan tanda terima resmi jika mendesak.</li>
                        <li>Superadmin mencatat tanggal efektif transfer dan nomor referensi perbankan pada sistem SIKAK untuk memastikan sinkronisasi buku kas.</li>
                    </ol>
                </div>
            )
        },
        {
            id: 4,
            title: 'BAB IV: STANDAR PENGADAAN & BUKTI PENGELUARAN SAH',
            content: (
                <div className="space-y-4 text-slate-700 leading-relaxed">
                    <p className="font-semibold text-slate-900">Pasal 7 — Keabsahan Bukti Transaksi Fisik</p>
                    <p>Seluruh pembelanjaan wajib disertai dokumen bukti otentik yang memenuhi kriteria sebagai berikut:</p>
                    <div className="overflow-x-auto my-3">
                        <table className="w-full text-sm border-collapse border border-slate-300">
                            <thead className="bg-slate-100 font-bold text-slate-800">
                                <tr>
                                    <th className="border border-slate-300 p-2.5 text-left">Rentang Nilai Belanja</th>
                                    <th className="border border-slate-300 p-2.5 text-left">Dokumen Wajib</th>
                                    <th className="border border-slate-300 p-2.5 text-left">Keterangan</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="border border-slate-300 p-2.5 font-medium">&lt; Rp 1.000.000</td>
                                    <td className="border border-slate-300 p-2.5">Nota Kontan / Bon Toko</td>
                                    <td className="border border-slate-300 p-2.5 text-slate-600">Berstempel toko atau tanda tangan penerima/penjual resmi.</td>
                                </tr>
                                <tr>
                                    <td className="border border-slate-300 p-2.5 font-medium">Rp 1.000.000 – Rp 5.000.000</td>
                                    <td className="border border-slate-300 p-2.5">Kuitansi / Faktur Resmi Bermaterai</td>
                                    <td className="border border-slate-300 p-2.5 text-slate-600">Mencantumkan tanggal, rincian barang, cap penyedia, dan materai Rp 10.000 jika melampaui batas minimum perpajakan.</td>
                                </tr>
                                <tr>
                                    <td className="border border-slate-300 p-2.5 font-medium">&gt; Rp 5.000.000</td>
                                    <td className="border border-slate-300 p-2.5">SPK, Faktur, BAST & Kuitansi</td>
                                    <td className="border border-slate-300 p-2.5 text-slate-600">Dilengkapi Berita Acara Serah Terima Barang/Jasa serta faktur pajak jika rekanan PKP.</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <p className="font-semibold text-slate-900 mt-6">Pasal 8 — Belanja Aset Tetap vs Beban Habis Pakai</p>
                    <ol className="list-decimal pl-5 space-y-2">
                        <li>Barang dengan masa manfaat lebih dari 1 (satu) tahun dan nilai di atas Rp 500.000 (komputer, laptop, printer, mesin, proyektor, mebelair, renovasi permanen) wajib dicatat sebagai <strong>ASET</strong>.</li>
                        <li>Saat pelaporan di SIKAK, user wajib memilih kategori <strong>ASET</strong> dan mengisi perkiraan <strong>Umur Ekonomis (bulan)</strong> agar sistem menghitung depresiasi penyusutan secara otomatis.</li>
                        <li>Barang habis pakai (kertas, ATK, konsumsi, kebersihan) dicatat sebagai kategori <strong>NON_ASET</strong>.</li>
                    </ol>
                </div>
            )
        },
        {
            id: 5,
            title: 'BAB V: PERTANGGUNGJAWABAN & REALISASI PENGELUARAN (LPJ)',
            content: (
                <div className="space-y-4 text-slate-700 leading-relaxed">
                    <p className="font-semibold text-slate-900">Pasal 9 — Prosedur Pelaporan (Monthly Report)</p>
                    <ol className="list-decimal pl-5 space-y-2">
                        <li>Setiap unit/bidang wajib menginput realisasi pembelanjaan melalui menu <strong>REALISASI ANGGARAN &gt; Pengeluaran Yayasan</strong> (atau <strong>Pengeluaran BOS</strong>).</li>
                        <li>Data yang diisi meliputi: tanggal pengeluaran, nomor nota/bukti, volume, satuan, harga satuan, diskon (jika ada), keterangan peruntukan, serta unggahan foto bukti fisik.</li>
                        <li>Batas akhir penginputan LPJ bulanan adalah <strong>tanggal 25</strong> setiap bulan berjalan.</li>
                        <li>Superadmin melakukan audit kesesuaian antara bukti nota yang diunggah dengan nominal pengajuan. Apabila valid, status diubah menjadi <strong>APPROVED</strong>.</li>
                    </ol>
                </div>
            )
        },
        {
            id: 6,
            title: 'BAB VI: PENYELESAIAN DAN PENGEMBALIAN SISA SALDO (REFUND)',
            content: (
                <div className="space-y-4 text-slate-700 leading-relaxed">
                    <p className="font-semibold text-slate-900">Pasal 10 — Asas Zero-Balance & Prosedur Pengembalian</p>
                    <ol className="list-decimal pl-5 space-y-2">
                        <li>Apabila jumlah dana yang dicairkan lebih besar daripada realisasi pembelanjaan sah yang disetujui (<strong>Total Cair &gt; Total LPJ Belanja</strong>), maka sisa dana tersebut merupakan <strong>Uang Muka Milik Yayasan</strong> yang wajib disetorkan kembali.</li>
                        <li>Bendahara unit mengajukan form pengembalian di menu <strong>REALISASI ANGGARAN &gt; Ketersediaan Dana</strong> dengan memilih opsi <em>Pengembalian Sisa Dana Kas</em>.</li>
                        <li>Uang sisa ditransfer kembali ke rekening induk Yayasan Dareliman, disertai unggahan bukti transfer pengembalian.</li>
                        <li>Superadmin memvalidasi mutasi bank dan menekan tombol <strong>ACC Pengembalian</strong>. Sistem secara otomatis membuat draft jurnal penerimaan kas masuk dan menutup pengajuan bulan tersebut menjadi <strong>SETTLED / CLOSED</strong>.</li>
                    </ol>
                </div>
            )
        },
        {
            id: 7,
            title: 'BAB VII: DANA BANTUAN OPERASIONAL SEKOLAH (BOS)',
            content: (
                <div className="space-y-4 text-slate-700 leading-relaxed">
                    <p className="font-semibold text-slate-900">Pasal 11 — Tata Kelola Khusus Dana BOS</p>
                    <ol className="list-decimal pl-5 space-y-2">
                        <li>Pengelolaan dana BOS (BOS Reguler/Kinerja) wajib mematuhi Petunjuk Teknis (Juknis) Kementerian Pendidikan dan Kebudayaan yang berlaku.</li>
                        <li>Perencanaan dana BOS diinput terpisah pada modul <strong>RAB BOS</strong> per tahap alokasi.</li>
                        <li>Pencatatan realisasi belanja BOS dilakukan melalui <strong>Pengeluaran BOS</strong> dan dipantau ketersediaannya pada menu <strong>Saldo BOS</strong>.</li>
                        <li>Saldo dana BOS tidak boleh dicampuradukkan dengan rekening dana komite/SPP atau kas umum yayasan guna menghindari temuan audit inspektorat pemerintah.</li>
                    </ol>
                </div>
            )
        },
        {
            id: 8,
            title: 'BAB VIII: JURNAL MEMORIAL, TUTUP BUKU & LAPORAN AKHIR',
            content: (
                <div className="space-y-4 text-slate-700 leading-relaxed">
                    <p className="font-semibold text-slate-900">Pasal 12 — Jurnal Penyesuaian & Rekonsiliasi Bank</p>
                    <ol className="list-decimal pl-5 space-y-2">
                        <li>Superadmin melakukan pencatatan transaksi non-kas (penyusutan aset tetap, amortisasi, penyesuaian beban akrual) pada menu <strong>TRANSAKSI AKUNTANSI &gt; Jurnal Umum</strong> dengan memastikan posisi <em>Balance</em> (Debit = Kredit).</li>
                        <li>Rekonsiliasi antara saldo kas/bank di sistem SIKAK dengan rekening koran bank riil dilakukan secara periodik setiap akhir bulan.</li>
                    </ol>

                    <p className="font-semibold text-slate-900 mt-6">Pasal 13 — Penutupan Periode (Tutup Buku / Closing)</p>
                    <ol className="list-decimal pl-5 space-y-2">
                        <li>Pada akhir bulan atau tahun buku, Superadmin menjalankan modul <strong>Tutup Buku (Closing)</strong>.</li>
                        <li>Setelah periode ditutup, seluruh transaksi pada periode tersebut <strong>terkunci permanen</strong> dan tidak dapat disunting atau dihapus oleh siapapun guna menjaga integritas data historis.</li>
                        <li>Laporan Posisi Keuangan (Neraca), Laporan Aktivitas, dan Laporan Perubahan Aset Neto diserahkan kepada Pembina dan Pengawas Yayasan secara berkala.</li>
                    </ol>
                </div>
            )
        }
    ];

    return (
        <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">

            {/* Top Toolbar / Action Bar (Hidden during Print) */}
            <div className="no-print bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl text-white flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative overflow-hidden">
                <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -left-12 -top-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 flex items-start gap-5">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 shrink-0 border border-white/20">
                        <BookOpen className="text-white w-8 h-8" />
                    </div>
                    <div>
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="px-3 py-1 bg-blue-500/20 text-blue-300 text-xs font-black uppercase tracking-wider rounded-full border border-blue-400/30 flex items-center gap-1.5">
                                <Sparkles size={12} /> Standar Operasional Prosedur
                            </span>
                            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 text-xs font-black rounded-full border border-emerald-400/30">
                                Berbasis ISAK 35 &amp; SIKAK
                            </span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                            SOP Pengelolaan Keuangan Yayasan
                        </h1>
                        <p className="text-slate-400 text-sm font-medium mt-1 max-w-2xl leading-relaxed">
                            Pedoman baku tata kelola anggaran, pencairan kasbon, pembelanjaan, realisasi LPJ, dan pengembalian sisa dana di lingkungan Yayasan Dareliman.
                        </p>
                    </div>
                </div>

                {/* Export & Print Buttons */}
                <div className="relative z-10 flex flex-wrap items-center gap-3">
                    <button
                        onClick={handleDownloadPDF}
                        disabled={isExporting}
                        className="btn flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-blue-500/25 border border-white/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                    >
                        {isExporting ? <RefreshCw className="animate-spin" size={18} /> : <Download size={18} />}
                        <span>{isExporting ? 'Memproses PDF...' : 'Download PDF'}</span>
                    </button>

                    <button
                        onClick={handlePrint}
                        className="btn flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm border border-slate-700 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                        <Printer size={18} />
                        <span>Cetak Dokumen</span>
                    </button>
                </div>
            </div>

            {/* View Mode Toggle & Role Quick Selector (Hidden during Print) */}
            <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-3 sm:p-4 rounded-3xl border border-slate-200/80 shadow-sm">
                {/* View Mode Tabs */}
                <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                    <button
                        onClick={() => setViewMode('infografis')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                            viewMode === 'infografis'
                                ? 'bg-white text-blue-600 shadow-md scale-[1.01]'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Layers size={16} />
                        <span>Infografis &amp; Alur Visual</span>
                    </button>

                    <button
                        onClick={() => setViewMode('dokumen')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                            viewMode === 'dokumen'
                                ? 'bg-white text-blue-600 shadow-md scale-[1.01]'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <FileText size={16} />
                        <span>Dokumen Resmi (Ber-Kop)</span>
                    </button>
                </div>

                {/* Role Switcher */}
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-2">Filter Peran:</span>
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        {[
                            { id: 'all', label: 'Semua' },
                            { id: 'superadmin', label: 'Keuangan Pusat' },
                            { id: 'bidang', label: 'Bidang' },
                            { id: 'unit', label: 'Unit/Sekolah' }
                        ].map(rf => (
                            <button
                                key={rf.id}
                                onClick={() => setActiveRoleFilter(rf.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    activeRoleFilter === rf.id
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                {rf.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ========================================================= */}
            {/* VIEW 1: INFOGRAFIS & ALUR VISUAL INTERAKTIF                */}
            {/* ========================================================= */}
            {viewMode === 'infografis' && (
                <div className="no-print space-y-8 animate-in fade-in duration-300">
                    
                    {/* Ringkasan Siklus 5 Tahap (Pipeline Header) */}
                    <div className="bg-gradient-to-br from-blue-50 via-indigo-50/50 to-white rounded-3xl p-6 sm:p-8 border border-blue-100 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/30">
                                <Sparkles size={20} />
                            </div>
                            <div>
                                <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                                    Siklus Pengelolaan Keuangan 5 Tahap SIKAK
                                </h2>
                                <p className="text-xs sm:text-sm text-slate-600 font-medium">
                                    Alur baku dari tahap perencanaan hingga penutupan kas berimbang (zero-balance).
                                </p>
                            </div>
                        </div>

                        {/* Pipeline Stepper Horizontal */}
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-6">
                            {workflowStages.map((ws, i) => {
                                const Icon = ws.icon;
                                return (
                                    <div key={i} className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm relative group hover:shadow-md hover:border-blue-300 transition-all">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="w-7 h-7 rounded-full bg-slate-900 text-white text-xs font-black flex items-center justify-center">
                                                {ws.stage}
                                            </span>
                                            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                                                <Icon size={16} />
                                            </div>
                                        </div>
                                        <h4 className="font-bold text-slate-800 text-sm leading-snug mb-1">{ws.title}</h4>
                                        <p className="text-[11px] font-semibold text-slate-500 line-clamp-2">{ws.desc}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Detail Tiap Tahapan Kerja (Kartu Visual) */}
                    <div className="space-y-6">
                        <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                            <Award className="text-blue-600" size={20} />
                            Rincian Prosedur dan Panduan Teknis Tiap Tahap
                        </h3>

                        {workflowStages.map((stg) => {
                            const Icon = stg.icon;
                            return (
                                <div 
                                    key={stg.stage}
                                    className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm hover:shadow-md transition-all space-y-5"
                                >
                                    {/* Header Kartu Tahap */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white font-black text-lg flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
                                                {stg.stage}
                                            </div>
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                                    <h4 className="text-xl font-black text-slate-900">{stg.title}</h4>
                                                    <span className="text-xs font-bold text-slate-400">({stg.subtitle})</span>
                                                </div>
                                                <p className="text-sm font-medium text-slate-600">{stg.desc}</p>
                                            </div>
                                        </div>

                                        <div className="shrink-0 flex items-center gap-2">
                                            <span className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-black border border-slate-200">
                                                {stg.badge}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Meta info: Aktor, Penyetuju, Menu Sistem */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs">
                                        <div>
                                            <span className="text-slate-400 font-bold block mb-0.5">Penanggung Jawab:</span>
                                            <span className="text-slate-800 font-extrabold flex items-center gap-1.5">
                                                <User size={14} className="text-blue-600" /> {stg.actor}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 font-bold block mb-0.5">Pemeriksa / Penyetuju:</span>
                                            <span className="text-slate-800 font-extrabold flex items-center gap-1.5">
                                                <ShieldCheck size={14} className="text-emerald-600" /> {stg.approver}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 font-bold block mb-0.5">Lokasi Menu SIKAK:</span>
                                            <span className="text-blue-700 font-extrabold flex items-center gap-1.5">
                                                <CornerDownRight size={14} /> {stg.menu}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Poin-poin Prosedur */}
                                    <div className="space-y-2.5">
                                        <h5 className="text-xs font-black text-slate-400 uppercase tracking-wider">Langkah dan Ketentuan Wajib:</h5>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {stg.points.map((pt, idx) => (
                                                <div key={idx} className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50/50 border border-slate-100 text-xs sm:text-sm text-slate-700 font-medium">
                                                    <CheckCircle2 size={16} className="text-blue-600 shrink-0 mt-0.5" />
                                                    <span>{pt}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Matriks RACI Wewenang */}
                    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-5">
                        <div className="flex items-center justify-between flex-wrap gap-4">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                                    <ShieldCheck className="text-emerald-600" size={22} />
                                    Matriks Wewenang &amp; Tanggung Jawab (RACI Matrix)
                                </h3>
                                <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                                    Distribusi peran agar tidak terjadi tumpang tindih keputusan finansial di yayasan.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2 text-[11px] font-bold text-slate-600">
                                <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md border border-blue-200"><strong>R</strong> = Responsible (Pelaksana)</span>
                                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200"><strong>A</strong> = Accountable (Penyetuju Utama)</span>
                                <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-md border border-amber-200"><strong>C</strong> = Consulted (Konsultasi)</span>
                                <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md border border-slate-200"><strong>I</strong> = Informed (Pemberitahuan)</span>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-xs sm:text-sm border-collapse">
                                <thead>
                                    <tr className="bg-slate-900 text-white font-black text-left">
                                        <th className="p-3.5 rounded-l-xl">Aktivitas Finansial</th>
                                        <th className="p-3.5 text-center">Pembina / Pengawas</th>
                                        <th className="p-3.5 text-center">Pengurus / Ketua</th>
                                        <th className="p-3.5 text-center bg-blue-800">Keuangan Pusat (Superadmin)</th>
                                        <th className="p-3.5 text-center">Admin Bidang</th>
                                        <th className="p-3.5 text-center rounded-r-xl">Admin Unit / Sekolah</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                    {raciData.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="p-3 font-semibold text-slate-900">{row.aktivitas}</td>
                                            <td className="p-3 text-center"><span className="px-2 py-0.5 rounded font-black text-xs bg-slate-100 text-slate-600">{row.pembina}</span></td>
                                            <td className="p-3 text-center"><span className="px-2 py-0.5 rounded font-black text-xs bg-emerald-100 text-emerald-700">{row.pengurus}</span></td>
                                            <td className="p-3 text-center bg-blue-50/50"><span className="px-2 py-0.5 rounded font-black text-xs bg-blue-600 text-white">{row.superadmin}</span></td>
                                            <td className="p-3 text-center"><span className="px-2 py-0.5 rounded font-black text-xs bg-slate-100 text-slate-700">{row.bidang}</span></td>
                                            <td className="p-3 text-center"><span className="px-2 py-0.5 rounded font-black text-xs bg-slate-100 text-slate-700">{row.unit}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Tombol Lihat Naskah Lengkap */}
                    <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 text-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
                        <div>
                            <h4 className="text-lg font-black mb-1">Ingin Membaca Naskah Legal Lengkap atau Mencetak?</h4>
                            <p className="text-slate-400 text-xs sm:text-sm font-medium">
                                Dokumen resmi lengkap dengan KOP Yayasan Dareliman, dasar hukum ISAK 35, ketentuan pasal, dan kolom tanda tangan pengesahan.
                            </p>
                        </div>
                        <button
                            onClick={() => {
                                setViewMode('dokumen');
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="btn px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 font-black text-sm text-white shadow-lg shadow-blue-500/30 flex items-center gap-2 shrink-0 transition-all hover:scale-105"
                        >
                            <span>Buka Dokumen Resmi Ber-Kop</span>
                            <ArrowRight size={16} />
                        </button>
                    </div>

                </div>
            )}

            {/* ========================================================= */}
            {/* VIEW 2: DOKUMEN RESMI BER-KOP YAYASAN (PRINT & PDF VIEW)   */}
            {/* ========================================================= */}
            <div 
                id="sop-legal-document"
                ref={printAreaRef}
                className={`${viewMode === 'dokumen' ? 'block' : 'hidden print:block'} bg-white rounded-3xl p-6 sm:p-12 border border-slate-200/80 shadow-lg print:shadow-none print:border-none print:p-0 font-serif text-slate-900`}
            >
                {/* ----------------- KOP SURAT YAYASAN DARELIMAN ----------------- */}
                <div className="pb-4 mb-8 border-b-4 border-double border-slate-900 text-center relative">
                    <div className="flex items-center justify-between mb-2">
                        {/* Logo / Lambang Kiri */}
                        <div className="w-20 h-20 rounded-2xl border-2 border-slate-800 flex flex-col items-center justify-center bg-slate-50 shrink-0 p-1">
                            <Landmark className="w-10 h-10 text-slate-800 mb-1" />
                            <span className="text-[8px] font-black uppercase tracking-tighter text-slate-800">DARELIMAN</span>
                        </div>

                        {/* Teks Badan Kop */}
                        <div className="flex-1 px-4 text-center">
                            <h2 className="text-lg sm:text-xl font-bold tracking-wider text-slate-800 uppercase">
                                DEWAN PENGURUS PUSAT
                            </h2>
                            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 uppercase">
                                YAYASAN DARELIMAN PADANG
                            </h1>
                            <p className="text-xs sm:text-sm font-medium text-slate-700 mt-1">
                                SK Kemenkumham RI No. AHU-0012345.AH.01.04.Tahun 2020
                            </p>
                            <p className="text-xs font-normal text-slate-600 mt-0.5">
                                Kantor Pusat: Jl. Belakang Olo No. 46, Kota Padang, Sumatera Barat — Kode Pos 25112
                            </p>
                            <p className="text-[11px] font-normal text-slate-600">
                                Telepon: (0751) 1234567 • Surel: info@dareliman.org • Situs Resmi: www.dareliman.org
                            </p>
                        </div>

                        {/* Logo / Lambang Kanan */}
                        <div className="w-20 h-20 rounded-2xl border-2 border-slate-800 flex flex-col items-center justify-center bg-slate-50 shrink-0 p-1">
                            <Building2 className="w-10 h-10 text-slate-800 mb-1" />
                            <span className="text-[8px] font-black uppercase tracking-tighter text-slate-800">SIKAK 2026</span>
                        </div>
                    </div>
                </div>

                {/* Judul & Nomor Keputusan */}
                <div className="text-center mb-8">
                    <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-slate-900 underline decoration-2 underline-offset-4">
                        STANDAR OPERASIONAL PROSEDUR (SOP)
                    </h2>
                    <h3 className="text-base sm:text-lg font-bold uppercase tracking-wider text-slate-800 mt-1">
                        PENGELOLAAN KEUANGAN DAN ANGGARAN LEMBAGA TERPADU
                    </h3>
                    <p className="text-xs sm:text-sm font-semibold text-slate-600 mt-1">
                        Nomor Dokumen: SOP/KEU-YYS/01/2026 • Berbasis Standar ISAK 35 &amp; Sistem SIKAK
                    </p>
                </div>

                {/* Kotak Metadata Dokumen */}
                <div className="mb-8 p-4 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                        <span className="block text-slate-500 font-bold">Tanggal Ditetapkan:</span>
                        <span className="font-extrabold text-slate-800">1 Januari 2026</span>
                    </div>
                    <div>
                        <span className="block text-slate-500 font-bold">Status Revisi:</span>
                        <span className="font-extrabold text-slate-800">1.0 (Integrasi SIKAK)</span>
                    </div>
                    <div>
                        <span className="block text-slate-500 font-bold">Masa Berlaku:</span>
                        <span className="font-extrabold text-slate-800">2026 s.d. 2028</span>
                    </div>
                    <div>
                        <span className="block text-slate-500 font-bold">Sifat Dokumen:</span>
                        <span className="font-extrabold text-blue-800 uppercase">Wajib Dipatuhi (Binding)</span>
                    </div>
                </div>

                {/* Naskah Pasal demi Pasal */}
                <div className="space-y-8 text-sm sm:text-base">
                    {chapters.map((ch) => (
                        <div key={ch.id} className="border-b border-slate-200 pb-6 last:border-b-0">
                            <h4 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight mb-3 bg-slate-100 p-2.5 rounded-lg border-l-4 border-slate-900">
                                {ch.title}
                            </h4>
                            {ch.content}
                        </div>
                    ))}
                </div>

                {/* ----------------- LEMBAR PENGESAHAN TANDA TANGAN ----------------- */}
                <div className="mt-12 pt-8 border-t-2 border-slate-300 page-break-inside-avoid">
                    <p className="text-right text-xs sm:text-sm font-medium text-slate-600 mb-6">
                        Ditetapkan di: Padang, Sumatera Barat<br />
                        Pada tanggal: 1 Januari 2026
                    </p>

                    <h5 className="text-center font-black uppercase text-sm sm:text-base text-slate-800 mb-8 tracking-wider">
                        DEWAN PENGURUS YAYASAN DARELIMAN
                    </h5>

                    <div className="grid grid-cols-3 gap-6 text-center text-xs sm:text-sm">
                        {/* Penandatangan 1: Bendahara */}
                        <div className="flex flex-col justify-between h-40">
                            <p className="font-bold text-slate-700">Mengetahui / Mengajukan,<br /><span className="font-semibold text-slate-500">Bendahara Yayasan</span></p>
                            <div>
                                <p className="font-black text-slate-900 underline underline-offset-4">( ............................................ )</p>
                                <p className="text-[11px] text-slate-500 mt-0.5">Keuangan Pusat / Superadmin</p>
                            </div>
                        </div>

                        {/* Penandatangan 2: Ketua Yayasan */}
                        <div className="flex flex-col justify-between h-40">
                            <p className="font-bold text-slate-700">Menyetujui &amp; Mengesahkan,<br /><span className="font-semibold text-slate-500">Ketua Umum Yayasan</span></p>
                            <div>
                                <p className="font-black text-slate-900 underline underline-offset-4">( ............................................ )</p>
                                <p className="text-[11px] text-slate-500 mt-0.5">Ketua Pengurus Harian</p>
                            </div>
                        </div>

                        {/* Penandatangan 3: Ketua Dewan Pembina */}
                        <div className="flex flex-col justify-between h-40">
                            <p className="font-bold text-slate-700">Mengesahkan,<br /><span className="font-semibold text-slate-500">Ketua Dewan Pembina</span></p>
                            <div>
                                <p className="font-black text-slate-900 underline underline-offset-4">( ............................................ )</p>
                                <p className="text-[11px] text-slate-500 mt-0.5">Dewan Pembina Yayasan</p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400">
                        Dokumen ini dicetak secara sah dari Sistem Informasi Keuangan dan Akuntansi Keuangan (SIKAK) Yayasan Dareliman.
                    </div>
                </div>
            </div>

            {/* Print Stylesheet */}
            <style>{`
                @media print {
                    body {
                        background: #ffffff !important;
                        color: #000000 !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    #sop-legal-document {
                        display: block !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        border: none !important;
                        box-shadow: none !important;
                        width: 100% !important;
                    }
                    .page-break-inside-avoid {
                        page-break-inside: avoid;
                    }
                    @page {
                        size: A4 portrait;
                        margin: 15mm 15mm 20mm 15mm;
                    }
                }
            `}</style>

        </div>
    );
}
