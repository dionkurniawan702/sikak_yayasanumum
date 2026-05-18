import React, { useState } from 'react';
import { BookOpen, User, Building2, Crown, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const StepText = ({ number, title, description, details, colorClass = "blue" }) => (
    <div className="flex gap-4 mb-8 last:mb-0">
        <div className="flex-shrink-0 mt-1">
            <div className={`w-8 h-8 rounded-full bg-${colorClass}-100 text-${colorClass}-600 flex items-center justify-center font-black border border-${colorClass}-200 shadow-sm`}>
                {number}
            </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm w-full">
            <h4 className="text-lg font-bold text-slate-800 mb-2">{title}</h4>
            <p className="text-slate-600 font-medium mb-3 leading-relaxed">{description}</p>
            {details && (
                <ul className="space-y-2.5 mt-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    {details.map((detail, idx) => (
                        <li key={idx} className="flex items-start gap-3 text-sm text-slate-700">
                            <CheckCircle2 size={18} className={`text-${colorClass}-500 mt-0.5 shrink-0`} />
                            <span className="leading-relaxed">{detail}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    </div>
);

export default function UserManual() {
    const { state } = useApp();
    const currentUserRole = state.currentUser?.role || 'admin_unit';
    
    const [activeTab, setActiveTab] = useState(
        currentUserRole === 'superadmin' ? 'superadmin' : 
        currentUserRole === 'admin_bidang' ? 'bidang' : 'unit'
    );

    const tabs = [
        { id: 'unit', label: 'Petunjuk Unit', icon: User, color: 'blue' },
        { id: 'bidang', label: 'Petunjuk Bidang', icon: Building2, color: 'emerald' },
        { id: 'superadmin', label: 'Petunjuk Superadmin', icon: Crown, color: 'amber' }
    ];

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
            
            {/* Header */}
            <div className="bg-slate-900 rounded-[2rem] p-8 shadow-xl flex items-start gap-6">
                <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center border border-blue-500/30 shrink-0">
                    <BookOpen className="text-blue-400 w-8 h-8" />
                </div>
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight mb-2">Buku Petunjuk Penggunaan</h1>
                    <p className="text-slate-400 font-medium max-w-3xl leading-relaxed">
                        Panduan langkah demi langkah yang rinci untuk menjalankan siklus keuangan di SIKAD. 
                        Silakan pilih peran (Role) Anda di bawah ini untuk melihat prosedur kerja yang tepat.
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-3">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    const colorClass = tab.color;
                    
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all duration-200 border-2 ${
                                isActive 
                                ? `border-${colorClass}-500 bg-${colorClass}-50 text-${colorClass}-700 shadow-md scale-[1.02]` 
                                : `border-slate-200 bg-white text-slate-500 hover:border-${colorClass}-300 hover:text-slate-700`
                            }`}
                        >
                            <div className={`p-2 rounded-xl ${isActive ? `bg-${colorClass}-500 text-white shadow-sm` : 'bg-slate-100 text-slate-400'}`}>
                                <Icon size={18} />
                            </div>
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Content Area */}
            <div className="bg-slate-50 rounded-[2rem] p-8 border border-slate-200">
                
                {/* ----------------- UNIT GUIDE ----------------- */}
                {activeTab === 'unit' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="mb-8 border-b border-slate-200 pb-6">
                            <h2 className="text-2xl font-black text-slate-800 mb-2">Alur Kerja User Unit (Sekolah/Lembaga)</h2>
                            <p className="text-slate-500">Sebagai Admin Unit, Anda bertanggung jawab menyiapkan data dasar operasional (seperti data siswa), merencanakan anggaran belanja, dan melaporkan bukti penggunaannya secara tertib.</p>
                        </div>
                        
                        <div className="space-y-2">
                            <StepText 
                                number="1" 
                                colorClass="blue"
                                title="Persiapan: Database Anggaran (Siswa & Kelas)" 
                                description="Sebelum menyusun rancangan biaya (RAB), pastikan data operasional sekolah/unit sudah benar dan mutakhir."
                                details={[
                                    "Buka menu DATABASE ANGGARAN > Kelas untuk mendaftarkan dan memverifikasi kelas yang aktif pada tahun ajaran ini.",
                                    "Buka menu DATABASE ANGGARAN > Database Siswa untuk mencatat siswa baru, atau memperbarui status siswa lama (Aktif, Pindah, atau Lulus).",
                                    "Validitas data siswa sangat krusial karena berpengaruh pada target penerimaan SPP dan alokasi BOS (jika unit Anda menerimanya)."
                                ]}
                            />
                            <StepText 
                                number="2" 
                                colorClass="blue"
                                title="Tahap Perencanaan: Membuat RAB (Rencana Anggaran Biaya)" 
                                description="Setelah database rapi, mulailah merancang anggaran belanja yang dibutuhkan oleh unit Anda."
                                details={[
                                    "Masuk ke menu PERENCANAAN (RAB) > RAB Yayasan (atau RAB BOS).",
                                    "Klik tombol 'Tambah RAB'. Masukkan item barang/jasa, kuantitas, serta perkiraan harga seakurat mungkin.",
                                    "Pastikan total anggaran tidak melebihi alokasi atau limit yang telah ditetapkan oleh pusat.",
                                    "Setelah disimpan, RAB akan berstatus 'PENDING'. Anda tidak dapat meminta dana sebelum RAB ini berstatus 'APPROVED' (Disetujui oleh Superadmin)."
                                ]}
                            />
                            <StepText 
                                number="3" 
                                colorClass="blue"
                                title="Tahap Pencairan: Mengajukan Permintaan Dana" 
                                description="Jika RAB Anda sudah disetujui (Approved) dan Anda membutuhkan dana tersebut dalam waktu dekat untuk dibelanjakan."
                                details={[
                                    "Buka menu REALISASI ANGGARAN > Permintaan Dana.",
                                    "Buat permintaan baru. Sistem otomatis hanya akan menampilkan daftar RAB yang sudah di-Approve.",
                                    "Pilih item mana yang mau dicairkan uangnya hari ini, masukkan nominal permintaannya (boleh sebagian dari total RAB).",
                                    "Kirim permintaan dan tunggu Superadmin memverifikasi dan mentransfer/menyerahkan dana tersebut."
                                ]}
                            />
                            <StepText 
                                number="4" 
                                colorClass="blue"
                                title="Tahap Akhir: Laporan Pengeluaran (Realisasi)" 
                                description="Setelah Anda menerima uang dan membelanjakannya, Anda WAJIB melaporkan bukti pemakaiannya secara transparan."
                                details={[
                                    "Buka menu REALISASI ANGGARAN > Pengeluaran Yayasan.",
                                    "Pilih riwayat penerimaan dana yang belum dilaporkan.",
                                    "Masukkan nominal dana yang 'benar-benar habis terpakai'.",
                                    "Jika ada sisa uang (kembalian dari toko/supplier), Anda wajib mengisinya pada kolom Sisa/Kembalian. Sistem akan mengarahkan Anda untuk melakukan prosedur 'Pengembalian Saldo' ke pusat."
                                ]}
                            />
                        </div>
                    </div>
                )}

                {/* ----------------- BIDANG GUIDE ----------------- */}
                {activeTab === 'bidang' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="mb-8 border-b border-slate-200 pb-6">
                            <h2 className="text-2xl font-black text-slate-800 mb-2">Alur Kerja User Bidang</h2>
                            <p className="text-slate-500">Sebagai Admin Bidang, Anda berfokus pada pengelolaan anggaran kegiatan lintas unit atau operasional divisi khusus di Yayasan.</p>
                        </div>
                        
                        <div className="space-y-2">
                            <StepText 
                                number="1" 
                                colorClass="emerald"
                                title="Persiapan: Pengecekan Database & Pagu Anggaran" 
                                description="Pastikan Anda mengetahui ruang lingkup anggaran yang diserahkan ke Bidang Anda."
                                details={[
                                    "Jika Anda berada di Bidang Pendidikan/Keuangan, Anda memiliki akses baca (Read-only) ke menu Database Anggaran untuk memantau data Siswa secara global guna keperluan analisis.",
                                    "Pantau menu DASHBOARD & SALDO > Saldo Yayasan untuk melihat alokasi pagu dana khusus yang tersedia untuk kegiatan Bidang Anda sebelum mulai membuat rencana."
                                ]}
                            />
                            <StepText 
                                number="2" 
                                colorClass="emerald"
                                title="Tahap Perencanaan: Membuat RAB Kegiatan Bidang" 
                                description="Rencanakan secara detail pembiayaan untuk program-program kerja Bidang Anda."
                                details={[
                                    "Buka menu PERENCANAAN (RAB) > RAB Yayasan.",
                                    "Buat rincian kebutuhan operasional rutin atau acara spesifik. Masukkan nominal estimasi yang tajam dan masuk akal.",
                                    "Simpan pengajuan dan pantau statusnya hingga berstatus 'APPROVED' oleh Superadmin."
                                ]}
                            />
                            <StepText 
                                number="3" 
                                colorClass="emerald"
                                title="Tahap Pencairan: Permintaan Dana Kegiatan" 
                                description="Cairkan dana yang RAB-nya sudah disetujui, sesaat sebelum kegiatan/program dieksekusi."
                                details={[
                                    "Buka menu REALISASI ANGGARAN > Permintaan Dana.",
                                    "Tarik dana dari kuota RAB yang tersedia. Pastikan nominal yang ditarik sesuai dengan kebutuhan acara dalam waktu dekat.",
                                    "Kirim permintaan pencairan ke bagian keuangan pusat (Superadmin)."
                                ]}
                            />
                            <StepText 
                                number="4" 
                                colorClass="emerald"
                                title="Tahap Akhir: Pelaporan Bukti Pengeluaran" 
                                description="Seluruh dana yang ditarik menjadi tanggung jawab Bidang untuk dipertanggungjawabkan penggunaannya."
                                details={[
                                    "Buka menu REALISASI ANGGARAN > Pengeluaran Yayasan sesegera mungkin setelah kegiatan/pembelanjaan selesai.",
                                    "Input total nilai belanja yang sebenarnya.",
                                    "Apabila anggaran acara bersisa, nilai sisa tersebut wajib dicatatkan agar sistem mengembalikan saldo tersebut ke kas Yayasan (Pengembalian Saldo)."
                                ]}
                            />
                        </div>
                    </div>
                )}

                {/* ----------------- SUPERADMIN GUIDE ----------------- */}
                {activeTab === 'superadmin' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="mb-8 border-b border-slate-200 pb-6">
                            <h2 className="text-2xl font-black text-slate-800 mb-2">Alur Kerja Superadmin (Keuangan Pusat)</h2>
                            <p className="text-slate-500">Superadmin memiliki hak tertinggi untuk menyetujui arus kas, mencatat penyesuaian jurnal, serta memastikan Laporan Keuangan konsolidasi berjalan akurat (Balance).</p>
                        </div>
                        
                        <div className="space-y-2">
                            <StepText 
                                number="1" 
                                colorClass="amber"
                                title="Fungsi Kontrol: Verifikasi (Approval) RAB & Pencairan" 
                                description="Setiap aktivitas finansial dari Unit dan Bidang tidak akan berjalan tanpa persetujuan Anda."
                                details={[
                                    "Perhatikan indikator notifikasi (angka berkedip berwarna merah/hijau/kuning) pada menu sidebar sebelah kiri. Itu adalah antrean tugas Anda.",
                                    "Buka menu PERENCANAAN (RAB) dan periksa kelayakan harga serta urgensi barang yang diajukan Unit/Bidang.",
                                    "Buka menu Permintaan Dana untuk menyetujui proses transfer uang tunai ke tangan Unit/Bidang.",
                                    "Gunakan tombol 'Approve' jika valid, atau 'Reject' jika harus dikoreksi/ditolak dengan menuliskan catatan alasan."
                                ]}
                            />
                            <StepText 
                                number="2" 
                                colorClass="amber"
                                title="Fungsi Akuntansi: Transaksi & Jurnal Umum" 
                                description="Proses akuntansi utama seperti pencairan dan pelaporan berjalan otomatis, namun Anda butuh Jurnal Umum untuk transaksi non-rutin."
                                details={[
                                    "Buka menu TRANSAKSI AKUNTANSI > Jurnal Umum untuk mencatat penyusutan aset tetap, pembayaran hutang/piutang, investasi, atau mutasi antar bank.",
                                    "Pastikan setiap jurnal yang dibuat selalu Balance (Nilai Debit = Nilai Kredit). Sistem akan menolak jika jurnal tidak seimbang.",
                                    "Gunakan menu Tutup Buku (Closing) di akhir periode untuk mengunci transaksi agar tidak bisa diedit lagi secara tidak sengaja oleh siapapun."
                                ]}
                            />
                            <StepText 
                                number="3" 
                                colorClass="amber"
                                title="Fungsi Manajerial: Laporan Keuangan Real-Time" 
                                description="Seluruh aktivitas dari Unit, Bidang, dan Jurnal Anda akan bermuara pada laporan akhir."
                                details={[
                                    "Buka kelompok menu LAPORAN KEUANGAN untuk melihat performa kesehatan yayasan.",
                                    "Cek 'Posisi Keuangan (Neraca)' untuk mengevaluasi total Aset, Kewajiban, dan Aset Neto berjalan.",
                                    "Cek 'Laporan Aktivitas' untuk melihat rincian Penerimaan (Surplus) vs Pengeluaran (Defisit).",
                                    "Tarik laporan 'Buku Besar' kapan saja untuk menelusuri rincian pergerakan dana pada satu akun spesifik (misalnya hanya akun Kas Bank BCA)."
                                ]}
                            />
                            <StepText 
                                number="4" 
                                colorClass="amber"
                                title="Fungsi Administrator: Pengaturan Master Data & User" 
                                description="Anda yang menentukan tata letak sistem dan akses keamanan."
                                details={[
                                    "Gunakan menu PENGATURAN ANGGARAN untuk mendaftarkan Unit baru, Bidang baru, atau Program Belanja baru.",
                                    "Gunakan menu ADMINISTRASI SISTEM > Manajemen User untuk membuat akun pengguna (login) bagi karyawan.",
                                    "Superadmin bisa mereset password atau melihat password lama user dengan cara mengklik icon Mata (👁️) pada saat mengedit profil user tersebut."
                                ]}
                            />
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
