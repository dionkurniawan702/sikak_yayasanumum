import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Download, UploadCloud, AlertCircle, CheckCircle2, Database, RefreshCw, ShieldCheck, HardDrive, Trash2, RotateCcw } from 'lucide-react';
import { api } from '../services/api';

export default function BackupRestore() {
    const { state, dispatch } = useApp();
    const [uploadStatus, setUploadStatus] = useState({ type: '', message: '' });
    const [syncing, setSyncing] = useState(false);
    const fileInputRef = useRef(null);
    const [resetTargetUnitId, setResetTargetUnitId] = useState('');
    const [resetting, setResetting] = useState(false);
    const [resetStatus, setResetStatus] = useState({ type: '', message: '' });

    const { units = [], budgetReports = [], budgetRequests = [], currentUser } = state;
    const isSuperAdmin = currentUser?.role === 'superadmin';
    const activeUnits = units.filter(u => !u.isDeleted);

    const handleResetRealisasi = async () => {
        if (!resetTargetUnitId) {
            setResetStatus({ type: 'error', message: 'Pilih unit terlebih dahulu.' });
            return;
        }
        const unit = activeUnits.find(u => u.id === resetTargetUnitId);
        const unitName = unit?.name || resetTargetUnitId;

        const reportsToDelete = budgetReports.filter(r => r.unitId === resetTargetUnitId);
        const requestsToDelete = budgetRequests.filter(r => r.unitId === resetTargetUnitId);
        const total = reportsToDelete.length + requestsToDelete.length;

        if (total === 0) {
            setResetStatus({ type: 'info', message: `Unit "${unitName}" tidak memiliki data realisasi maupun pengajuan dana.` });
            return;
        }

        const confirmed = window.confirm(
            `⚠️ KONFIRMASI RESET\n\nAnda akan menghapus data berikut milik "${unitName}":\n- ${reportsToDelete.length} Laporan Realisasi\n- ${requestsToDelete.length} Pengajuan Dana\n\nData yang dihapus TIDAK BISA dikembalikan.\nLanjutkan?`
        );
        if (!confirmed) return;

        setResetting(true);
        setResetStatus({ type: 'info', message: `Menghapus ${total} record milik "${unitName}"...` });

        let successCount = 0;
        let failCount = 0;

        try {
            for (const report of reportsToDelete) {
                try {
                    await api.delete(`/budget-reports/${report.id}?permanent=true`);
                    dispatch({ type: 'DELETE_BUDGET_REPORT', payload: report.id });
                    successCount++;
                } catch (e) {
                    console.error('Gagal hapus report:', report.id, e);
                    failCount++;
                }
            }
            for (const req of requestsToDelete) {
                try {
                    await api.delete(`/budget-requests/${req.id}?permanent=true`);
                    dispatch({ type: 'DELETE_BUDGET_REQUEST', payload: req.id });
                    successCount++;
                } catch (e) {
                    console.error('Gagal hapus request:', req.id, e);
                    failCount++;
                }
            }

            if (failCount === 0) {
                setResetStatus({ type: 'success', message: `✅ Berhasil! ${successCount} record data realisasi "${unitName}" telah dihapus.` });
            } else {
                setResetStatus({ type: 'error', message: `Selesai dengan error: ${successCount} berhasil, ${failCount} gagal dihapus.` });
            }
            setResetTargetUnitId('');
        } catch (err) {
            setResetStatus({ type: 'error', message: 'Gagal melakukan reset: ' + err.message });
        } finally {
            setResetting(false);
        }
    };

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
            a.download = `sikad_dareliman_backup_${date}.json`;
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


                {/* Reset Data Realisasi — Superadmin Only */}
                {isSuperAdmin && (
                    <div className="lg:col-span-2 bg-white border-2 border-rose-100 p-10 rounded-[40px] shadow-xl relative overflow-hidden group">
                        <div className="relative z-10 flex flex-col md:flex-row items-start gap-10">
                            <div className="w-24 h-24 bg-rose-50 rounded-3xl flex items-center justify-center text-rose-500 shrink-0 group-hover:scale-105 transition-transform duration-300">
                                <RotateCcw size={44} className={resetting ? 'animate-spin' : ''} />
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">Reset Data Realisasi Per Unit</h3>
                                    <span className="px-3 py-1 bg-rose-100 text-rose-600 rounded-full text-[10px] font-black uppercase tracking-widest">Yayasan</span>
                                </div>
                                <p className="text-sm text-slate-500 font-medium italic mb-6 leading-relaxed max-w-xl">
                                    Hapus seluruh <strong>Laporan Realisasi</strong> dan <strong>Pengajuan Dana</strong> milik unit tertentu untuk memulai ulang pencatatan. Data master (RAB, unit, user) tidak terpengaruh.
                                </p>

                                <div className="flex flex-wrap items-center gap-4">
                                    <select
                                        value={resetTargetUnitId}
                                        onChange={e => { setResetTargetUnitId(e.target.value); setResetStatus({ type: '', message: '' }); }}
                                        disabled={resetting}
                                        className="flex-1 min-w-[220px] p-3 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-slate-700 focus:ring-2 focus:ring-rose-200 focus:border-rose-400 outline-none transition-all disabled:opacity-50"
                                    >
                                        <option value="">-- Pilih Unit --</option>
                                        {activeUnits.map(u => {
                                            const reportCount = budgetReports.filter(r => r.unitId === u.id && !r.isDeleted).length;
                                            const requestCount = budgetRequests.filter(r => r.unitId === u.id && !r.isDeleted).length;
                                            return (
                                                <option key={u.id} value={u.id}>
                                                    {u.name} ({reportCount} realisasi, {requestCount} pengajuan)
                                                </option>
                                            );
                                        })}
                                    </select>

                                    <button
                                        onClick={handleResetRealisasi}
                                        disabled={resetting || !resetTargetUnitId}
                                        className="flex items-center gap-3 px-8 py-3 bg-rose-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-rose-100 hover:bg-rose-700 hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                                    >
                                        <Trash2 size={18} />
                                        {resetting ? 'Menghapus...' : 'Reset Realisasi'}
                                    </button>
                                </div>

                                {resetStatus.message && (
                                    <div className={`mt-5 p-4 rounded-2xl flex items-center gap-4 text-sm font-bold animate-in slide-in-from-bottom-2 duration-300 ${
                                        resetStatus.type === 'error' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                                        resetStatus.type === 'info' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                                        'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                    }`}>
                                        {resetStatus.type === 'error' ? <AlertCircle size={18} /> : resetStatus.type === 'info' ? <RefreshCw size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                                        {resetStatus.message}
                                    </div>
                                )}
                            </div>
                        </div>
                        <Trash2 size={180} className="absolute -bottom-10 -right-10 text-rose-50 pointer-events-none" />
                    </div>
                )}
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
                Sistem Pencatatan Keuangan Terpusat SIKAD DARELIMAN
            </div>
        </div>
    );
}
