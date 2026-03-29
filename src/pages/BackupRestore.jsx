import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Download, UploadCloud, AlertCircle, CheckCircle2, Database, RefreshCw, ShieldCheck, HardDrive } from 'lucide-react';
import { api } from '../services/api';

export default function BackupRestore() {
    const { state, dispatch } = useApp();
    const [uploadStatus, setUploadStatus] = useState({ type: '', message: '' });
    const [syncing, setSyncing] = useState(false);
    const fileInputRef = useRef(null);

    const handleSyncToServer = async () => {
        setSyncing(true);
        setUploadStatus({ type: 'info', message: 'Sedang menyinkronkan data ke server MySQL...' });
        try {
            await api.syncWholeState(state);
            setUploadStatus({
                type: 'success',
                message: 'Data berhasil disinkronkan ke server MySQL secara utuh!'
            });
        } catch (error) {
            setUploadStatus({
                type: 'error',
                message: 'Gagal menyinkronkan data: ' + error.message
            });
        } finally {
            setSyncing(false);
        }
    };

    const handleDownloadBackup = () => {
        try {
            const backupData = JSON.stringify(state, null, 2);
            const blob = new Blob([backupData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const date = new Date().toISOString().split('T')[0];

            const a = document.createElement('a');
            a.href = url;
            a.download = `sikak_yayasan_backup_${date}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error generating backup:', error);
            alert('Terjadi kesalahan saat membuat file backup.');
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
            setUploadStatus({
                type: 'error',
                message: 'Format file tidak valid. Harap unggah file berformat .json'
            });
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsedData = JSON.parse(event.target.result);

                if (!parsedData.accounts || !parsedData.journals) {
                    throw new Error('Struktur data tidak sesuai (accounts/journals tidak ditemukan).');
                }

                if (window.confirm('PERINGATAN: Mengunggah file backup ini akan mengganti/menimpa seluruh data yang ada saat ini. Apakah Anda yakin ingin melanjutkan?')) {
                    dispatch({ type: 'RESTORE_DATA', payload: parsedData });
                    setUploadStatus({
                        type: 'success',
                        message: 'Data berhasil dipulihkan dari file backup!'
                    });
                }
            } catch (error) {
                console.error('Error parsing JSON:', error);
                setUploadStatus({
                    type: 'error',
                    message: `Gagal memproses file: ${error.message || 'File JSON rusak atau tidak dikenali'}`
                });
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-12">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight italic">Backup & Restore</h2>
                    <p className="text-slate-500 font-medium tracking-tight">Perlindungan data dan pemulihan sistem yayasan</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in">
                {/* Download Backup */}
                <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-xl flex flex-col items-center text-center group hover:border-blue-200 transition-all">
                    <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-inner">
                        <Download size={32} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-widest leading-none mb-4">Simpan Cadangan</h3>
                    <p className="text-xs text-slate-400 font-medium leading-relaxed max-w-xs mb-8 uppercase tracking-wider">Unduh seluruh database (Akun, Jurnal, Aset, Program) ke dalam file JSON aman di perangkat Anda.</p>
                    <button onClick={handleDownloadBackup} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-tighter shadow-lg shadow-slate-200 hover:bg-blue-600 transition-all">
                        Unduh Backup .json
                    </button>
                </div>

                {/* Upload Restore */}
                <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-xl flex flex-col items-center text-center group hover:border-blue-200 transition-all">
                    <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-inner">
                        <UploadCloud size={32} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-widest leading-none mb-4">Pulihkan Data</h3>
                    <p className="text-xs text-slate-400 font-medium leading-relaxed max-w-xs mb-8 uppercase tracking-wider italic">Gunakan file backup sebelumnya untuk mengembalikan kondisi data (Menimpa data aktif).</p>
                    <div className="w-full relative">
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                        <button className="w-full py-4 border-2 border-slate-900 text-slate-900 rounded-2xl font-black text-sm uppercase tracking-tighter hover:bg-slate-50 transition-all">
                            Pilih File Backup
                        </button>
                    </div>
                </div>

                {/* Server Sync */}
                <div className="lg:col-span-2 bg-slate-900 p-10 rounded-[40px] shadow-2xl relative overflow-hidden group">
                    <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
                        <div className="w-24 h-24 bg-white/10 rounded-3xl flex items-center justify-center text-blue-400 group-hover:rotate-12 transition-transform duration-500">
                             <RefreshCw size={48} className={syncing ? 'animate-spin' : ''} />
                        </div>
                        <div className="flex-1 text-center md:text-left">
                            <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic mb-3">SINKRONISASI DATABASE PUSAT</h3>
                            <p className="text-sm text-slate-400 font-medium italic mb-6 leading-relaxed max-w-xl">
                                Kirimkan seluruh data lokal yang tersimpan di browser ini ke server database utama yayasan. Gunakan ini untuk memastikan server memiliki data paling mutakhir.
                            </p>
                            <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                                <button onClick={handleSyncToServer} disabled={syncing} className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all">
                                    {syncing ? 'Sinkronisasi...' : 'MULAI SINKRONISASI SEKARANG'}
                                </button>
                                <button onClick={() => window.confirm('Hapus cache lokal?') && dispatch({ type: 'RESET_LOCAL_CACHE' })} className="px-6 py-4 bg-white/5 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] border border-white/5 hover:bg-white/10 transition-all whitespace-nowrap">
                                    Reset Memori Browser
                                </button>
                            </div>
                        </div>
                    </div>
                    <Database size={180} className="absolute -bottom-10 -right-10 text-white/5 pointer-events-none" />
                </div>
            </div>

            {/* Status Feedback */}
            {uploadStatus.message && (
                <div className={`mt-8 p-6 rounded-[32px] border flex items-center gap-6 animate-in zoom-in-95 ${uploadStatus.type === 'error' ? 'bg-rose-50 border-rose-100 text-rose-800' : uploadStatus.type === 'info' ? 'bg-blue-50 border-blue-100 text-blue-800' : 'bg-emerald-50 border-emerald-100 text-emerald-800'}`}>
                    <div className="p-3 bg-white rounded-xl shadow-sm">
                        {uploadStatus.type === 'error' ? <AlertCircle size={24} /> : uploadStatus.type === 'info' ? <RefreshCw className="animate-spin" size={24} /> : <CheckCircle2 size={24} />}
                    </div>
                    <div>
                        <h4 className="font-black text-xs uppercase tracking-widest mb-1">{uploadStatus.type === 'error' ? 'Kegagalan' : uploadStatus.type === 'info' ? 'Memproses' : 'Keberhasilan'}</h4>
                        <p className="text-sm font-bold opacity-80">{uploadStatus.message}</p>
                    </div>
                </div>
            )}

            <div className="mt-20 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest italic">
                Sistem Pencatatan Keuangan Terpusat SIKAK YAYASAN UMUM
            </div>
        </div>
    );
}
