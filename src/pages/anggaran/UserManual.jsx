import React, { useState } from 'react';
import { BookOpen, User, Building2, Crown, ChevronRight, Image as ImageIcon, Send, FileText, Target, Wallet } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const ScreenshotPlaceholder = ({ title, icon: Icon, colorClass }) => (
    <div className={`mt-4 rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col bg-slate-50 aspect-video max-h-64`}>
        <div className="bg-slate-800 px-4 py-2 flex items-center gap-2">
            <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
            </div>
            <div className="text-[10px] font-medium text-slate-400 ml-2 bg-slate-700/50 px-2 py-0.5 rounded">
                sikad.dareliman.or.id
            </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-slate-50 to-slate-100">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-3 shadow-inner bg-white border ${colorClass}`}>
                {Icon ? <Icon size={32} className="opacity-70" /> : <ImageIcon size={32} className="opacity-50 text-slate-400" />}
            </div>
            <p className="text-sm font-bold text-slate-600">Ilustrasi: {title}</p>
            <p className="text-xs text-slate-400 mt-1 max-w-[250px]">
                Area ini disiapkan untuk menampilkan screenshot aplikasi Anda.
            </p>
        </div>
    </div>
);

const InstructionStep = ({ step, title, description, screenshot, icon, colorClass }) => (
    <div className="relative pl-10 pb-10 last:pb-0">
        {/* Timeline line */}
        <div className="absolute left-[19px] top-8 bottom-0 w-px bg-slate-200 last:bg-transparent"></div>
        
        {/* Step number indicator */}
        <div className={`absolute left-0 top-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-black text-white shadow-lg shadow-slate-200 border-4 border-white z-10 ${colorClass}`}>
            {step}
        </div>
        
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
            <h4 className="text-lg font-bold text-slate-800 mb-2">{title}</h4>
            <p className="text-slate-600 leading-relaxed text-sm">{description}</p>
            
            {screenshot && (
                <ScreenshotPlaceholder title={title} icon={icon} colorClass={colorClass.replace('bg-', 'border-').replace('500', '200')} />
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
        { id: 'unit', label: 'Panduan Unit', icon: User, color: 'bg-blue-500', hoverColor: 'hover:bg-blue-50', activeColor: 'text-blue-600 bg-blue-50 border-blue-200' },
        { id: 'bidang', label: 'Panduan Bidang', icon: Building2, color: 'bg-emerald-500', hoverColor: 'hover:bg-emerald-50', activeColor: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
        { id: 'superadmin', label: 'Panduan Superadmin', icon: Crown, color: 'bg-amber-500', hoverColor: 'hover:bg-amber-50', activeColor: 'text-amber-600 bg-amber-50 border-amber-200' }
    ];

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl"></div>
                
                <div className="relative z-10 flex items-start gap-6">
                    <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-inner border border-white/20 shrink-0">
                        <BookOpen className="text-blue-200 w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-white tracking-tight mb-2">Buku Petunjuk Penggunaan</h1>
                        <p className="text-blue-100/80 font-medium max-w-2xl leading-relaxed">
                            Panduan interaktif untuk membantu Anda memahami fitur dan alur kerja Sistem Keuangan Dareliman (SIKAD). Pilih peran Anda di bawah ini untuk melihat panduan yang relevan.
                        </p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-3">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all duration-200 border-2 ${
                                isActive 
                                ? tab.activeColor + ' shadow-sm scale-[1.02]' 
                                : 'border-transparent bg-white text-slate-500 hover:text-slate-700 ' + tab.hoverColor + ' shadow-sm'
                            }`}
                        >
                            <div className={`p-2 rounded-xl ${isActive ? tab.color + ' text-white shadow-md' : 'bg-slate-100 text-slate-400'}`}>
                                <Icon size={18} />
                            </div>
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Content Area */}
            <div className="bg-slate-50 rounded-[2rem] p-8 border border-slate-200 shadow-sm">
                
                {/* ----------------- UNIT GUIDE ----------------- */}
                {activeTab === 'unit' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="mb-8">
                            <h2 className="text-2xl font-black text-slate-800 mb-2">Panduan User Unit</h2>
                            <p className="text-slate-500">Tugas utama Unit adalah menyusun RAB, mengajukan permintaan dana, dan melaporkan bukti pengeluaran.</p>
                        </div>
                        
                        <div className="space-y-4">
                            <InstructionStep 
                                step="1" 
                                title="Cek Saldo Tersedia" 
                                description="Buka menu 'Saldo Yayasan' atau 'Saldo BOS' untuk melihat batas anggaran yang masih bisa digunakan sesuai dengan RAB yang sudah disetujui."
                                screenshot={true}
                                icon={Wallet}
                                colorClass="bg-blue-500 text-white"
                            />
                            <InstructionStep 
                                step="2" 
                                title="Membuat Perencanaan (RAB)" 
                                description="Masuk ke menu 'RAB Yayasan'. Klik tombol 'Tambah RAB', isi detail barang/jasa, lalu ajukan. Anda harus menunggu persetujuan Superadmin agar RAB bisa dicairkan."
                                screenshot={true}
                                icon={Target}
                                colorClass="bg-blue-500 text-white"
                            />
                            <InstructionStep 
                                step="3" 
                                title="Mengajukan Permintaan Dana" 
                                description="Saat butuh dana untuk kegiatan, buka menu 'Permintaan Dana'. Pilih RAB yang sudah disetujui, isi nominal yang dibutuhkan, lalu klik 'Ajukan'."
                                screenshot={true}
                                icon={Send}
                                colorClass="bg-blue-500 text-white"
                            />
                            <InstructionStep 
                                step="4" 
                                title="Melaporkan Pengeluaran" 
                                description="Setelah dana dicairkan dan dibelanjakan, buka 'Pengeluaran Yayasan'. Catat realisasi penggunaan dana dan lampirkan bukti nota/struk jika diperlukan."
                                screenshot={true}
                                icon={FileText}
                                colorClass="bg-blue-500 text-white"
                            />
                        </div>
                    </div>
                )}

                {/* ----------------- BIDANG GUIDE ----------------- */}
                {activeTab === 'bidang' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="mb-8">
                            <h2 className="text-2xl font-black text-slate-800 mb-2">Panduan User Bidang</h2>
                            <p className="text-slate-500">Bidang mengelola anggaran operasional dan kegiatan lintas unit. Alurnya mirip dengan Unit.</p>
                        </div>
                        
                        <div className="space-y-4">
                            <InstructionStep 
                                step="1" 
                                title="Pantau Saldo Bidang" 
                                description="Buka menu 'Saldo Yayasan' untuk melihat total pagu anggaran khusus kegiatan Bidang Anda yang belum terealisasi."
                                screenshot={true}
                                icon={Wallet}
                                colorClass="bg-emerald-500 text-white"
                            />
                            <InstructionStep 
                                step="2" 
                                title="Pengajuan RAB Bidang" 
                                description="Melalui menu 'RAB', Anda bisa merencanakan kebutuhan anggaran dalam satu periode (bulanan/semesteran)."
                                screenshot={true}
                                icon={Target}
                                colorClass="bg-emerald-500 text-white"
                            />
                            <InstructionStep 
                                step="3" 
                                title="Realisasi & Pelaporan" 
                                description="Ajukan 'Permintaan Dana' sebelum kegiatan. Setelah kegiatan selesai, wajib laporkan penggunaan sebenarnya di 'Pengeluaran Yayasan'. Sisa dana harus dikembalikan."
                                screenshot={true}
                                icon={Send}
                                colorClass="bg-emerald-500 text-white"
                            />
                        </div>
                    </div>
                )}

                {/* ----------------- SUPERADMIN GUIDE ----------------- */}
                {activeTab === 'superadmin' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="mb-8">
                            <h2 className="text-2xl font-black text-slate-800 mb-2">Panduan Superadmin</h2>
                            <p className="text-slate-500">Superadmin bertanggung jawab memvalidasi anggaran, mencatat jurnal akuntansi, dan memantau laporan.</p>
                        </div>
                        
                        <div className="space-y-4">
                            <InstructionStep 
                                step="1" 
                                title="Approval RAB & Permintaan Dana" 
                                description="Setiap ada pengajuan baru, akan muncul notifikasi angka berkedip di menu kiri. Buka menu tersebut, periksa rinciannya, lalu pilih 'Setujui' atau 'Tolak'."
                                screenshot={true}
                                icon={Target}
                                colorClass="bg-amber-500 text-white"
                            />
                            <InstructionStep 
                                step="2" 
                                title="Mencatat Jurnal Umum" 
                                description="Untuk transaksi yang tidak terjadi otomatis (seperti penyusutan aset atau penyesuaian), catat manual melalui menu 'Jurnal Umum'. Pastikan nilai Debit & Kredit Balance."
                                screenshot={true}
                                icon={FileText}
                                colorClass="bg-amber-500 text-white"
                            />
                            <InstructionStep 
                                step="3" 
                                title="Memantau Laporan Keuangan" 
                                description="Tarik laporan 'Posisi Keuangan (Neraca)', 'Laporan Aktivitas', dan 'Buku Besar' kapan saja secara Real-Time melalui kelompok menu Laporan Keuangan."
                                screenshot={true}
                                icon={BookOpen}
                                colorClass="bg-amber-500 text-white"
                            />
                            <InstructionStep 
                                step="4" 
                                title="Manajemen Pengguna (User)" 
                                description="Di menu 'Manajemen User', Anda bisa menambah akun untuk Unit/Bidang baru, mereset password, serta melihat password mereka."
                                screenshot={true}
                                icon={User}
                                colorClass="bg-amber-500 text-white"
                            />
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
