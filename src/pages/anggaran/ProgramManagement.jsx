import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import {
    Plus, Search, Edit2, Trash2, Layout, ChevronRight,
    Layers, Filter, AlertCircle, CheckCircle2, Building2,
    Download, Upload, X, BookOpen, CheckCircle, ChevronLeft, ArrowRight
} from 'lucide-react';
import { generateId } from '../../utils/format';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export default function ProgramManagement() {
    const { state, dispatch } = useApp();
    const { expensePrograms = [], units = [], fields = [], currentUser, accounts = [] } = state;

    const activeAccounts = accounts.filter(a => !a.isDeleted);
    const detailAccounts = activeAccounts
        .filter(a => a.category === 'detail')
        .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

    const TIPE_URUTAN = ['Beban', 'Aset', 'Kewajiban', 'Aset Neto', 'Pendapatan'];
    const groupedAccounts = TIPE_URUTAN.map(tipe => ({
        tipe,
        accounts: detailAccounts.filter(a => a.type === tipe)
    })).filter(g => g.accounts.length > 0);

    const [searchTerm, setSearchTerm] = useState('');
    const [mappingFilter, setMappingFilter] = useState('ALL'); // 'ALL' | 'MAPPED' | 'UNMAPPED'
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({ 
        name: '', 
        description: '', 
        unitId: '', 
        fieldId: '', 
        type: 'Expense',
        debitAccountId: '',
        creditAccountId: ''
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    // Initial Unit/Field for unit/bidang admins
    const initialUnitId = currentUser?.role === 'admin_unit' ? currentUser.unitId : '';
    const initialFieldId = currentUser?.role === 'admin_bidang' ? currentUser.fieldId : '';

    const activePrograms = expensePrograms.filter(item => !item.isDeleted);
    const countTotal = activePrograms.length;
    const countMapped = activePrograms.filter(p => p.debitAccountId && p.creditAccountId).length;
    const countUnmapped = activePrograms.filter(p => !p.debitAccountId || !p.creditAccountId).length;

    const filteredItems = activePrograms.filter(item => {
        if (mappingFilter === 'MAPPED') {
            if (!item.debitAccountId || !item.creditAccountId) return false;
        } else if (mappingFilter === 'UNMAPPED') {
            if (item.debitAccountId && item.creditAccountId) return false;
        }

        const q = searchTerm.toLowerCase();
        const debitAcc = accounts.find(a => a.id === item.debitAccountId);
        const creditAcc = accounts.find(a => a.id === item.creditAccountId);

        const matchesSearch = item.name.toLowerCase().includes(q) ||
            (item.description || '').toLowerCase().includes(q) ||
            (debitAcc?.name || '').toLowerCase().includes(q) ||
            (debitAcc?.code || '').toLowerCase().includes(q) ||
            (creditAcc?.name || '').toLowerCase().includes(q) ||
            (creditAcc?.code || '').toLowerCase().includes(q);
        return matchesSearch;
    });

    const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
    const startIndex = (currentPage - 1) * pageSize;
    const paginatedItems = filteredItems.slice(startIndex, startIndex + pageSize);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            const dataToSave = {
                ...formData,
                unitId: currentUser?.role === 'admin_unit' ? currentUser.unitId : formData.unitId,
                fieldId: currentUser?.role === 'admin_bidang' ? currentUser.fieldId : formData.fieldId,
                debitAccountId: formData.debitAccountId || null,
                creditAccountId: formData.creditAccountId || null
            };

            if (editingItem) {
                const updatedItem = { ...editingItem, ...dataToSave };
                dispatch({ type: 'EDIT_BUDGET_PROGRAM', payload: updatedItem });
                await api.pushAction({ type: 'EDIT_BUDGET_PROGRAM', payload: updatedItem }, state);
                setMessage({ type: 'success', text: 'Program berhasil diperbarui' });
            } else {
                // Duplicate check for new manual entry
                const isDuplicate = expensePrograms.some(p => !p.isDeleted && p.name.toLowerCase() === dataToSave.name.toLowerCase());
                if (isDuplicate) {
                    throw new Error(`Program dengan nama "${dataToSave.name}" sudah ada.`);
                }

                const newItem = {
                    id: `PRG-${generateId()}`,
                    ...dataToSave
                };
                dispatch({ type: 'ADD_BUDGET_PROGRAM', payload: newItem });
                await api.pushAction({ type: 'ADD_BUDGET_PROGRAM', payload: newItem }, state);
                setMessage({ type: 'success', text: 'Program berhasil ditambahkan' });
            }
            setIsModalOpen(false);
            setEditingItem(null);
            setFormData({ name: '', description: '', unitId: '', fieldId: '', type: 'Expense', debitAccountId: '', creditAccountId: '' });
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Hapus program ini?')) return;
        try {
            dispatch({ type: 'DELETE_BUDGET_PROGRAM', payload: id });
            await api.pushAction({ type: 'DELETE_BUDGET_PROGRAM', payload: id }, state);
            setMessage({ type: 'success', text: 'Program berhasil dipindahkan ke tempat sampah' });
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        }
    };

    const handleExport = () => {
        const exportData = filteredItems.map(item => {
            const unitObj = units.find(u => u.id === item.unitId);
            const fieldObj = fields.find(f => f.id === item.fieldId);
            const debitAcc = accounts.find(a => a.id === item.debitAccountId);
            const creditAcc = accounts.find(a => a.id === item.creditAccountId);
            return {
                'Nama Program': item.name,
                'Keterangan': item.description || '',
                'Unit': unitObj?.name || '',
                'Bidang': fieldObj?.name || '',
                'Akun Debet': debitAcc ? `${debitAcc.code} - ${debitAcc.name}` : '',
                'Akun Kredit': creditAcc ? `${creditAcc.code} - ${creditAcc.name}` : '',
                'Status Jurnal': (item.debitAccountId && item.creditAccountId) ? 'Otomatis' : 'Manual'
            };
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Master Program");
        XLSX.writeFile(wb, `Master_Program_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleDownloadTemplate = async () => {
        const workbook = new ExcelJS.Workbook();
        
        // Buat sheet tersembunyi untuk referensi data dropdown
        const lookupSheet = workbook.addWorksheet('DataLookup', { state: 'hidden' });
        lookupSheet.addRow(['Unit', 'Bidang']);
        
        const unitList = units.map(u => u.name);
        const fieldList = fields.map(f => f.name);
        
        const maxLen = Math.max(unitList.length, fieldList.length);
        for (let i = 0; i < maxLen; i++) {
            lookupSheet.addRow([
                unitList[i] || '',
                fieldList[i] || ''
            ]);
        }

        const worksheet = workbook.addWorksheet('Template Import Program');

        worksheet.addRow(['Nama Program', 'Keterangan', 'Unit', 'Bidang']);
        
        worksheet.addRow([
            'Pembangunan Gedung Baru',
            'Program pembangunan fasilitas tambahan',
            currentUser?.role === 'admin_unit' ? (units.find(u => u.id === currentUser.unitId)?.name || '') : 'Nama Unit',
            currentUser?.role === 'admin_bidang' ? (fields.find(f => f.id === currentUser.fieldId)?.name || '') : 'Nama Bidang'
        ]);

        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4F46E5' }
        };

        // Tambahkan validasi dropdown ke kolom Unit (C) dan Bidang (D) untuk semua role
        if (unitList.length > 0) {
            worksheet.dataValidations.add('C2:C1000', {
                type: 'list',
                allowBlank: true,
                formulae: [`DataLookup!$A$2:$A$${unitList.length + 1}`]
            });
        }

        if (fieldList.length > 0) {
            worksheet.dataValidations.add('D2:D1000', {
                type: 'list',
                allowBlank: true,
                formulae: [`DataLookup!$B$2:$B$${fieldList.length + 1}`]
            });
        }

        worksheet.columns.forEach(column => {
            column.width = 25;
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, "Template_Import_Program.xlsx");
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                // Cari sheet data yang benar — template punya sheet tersembunyi 'DataLookup' di urutan pertama
                const DATA_SHEET_NAME = 'Template Import Program';
                const wsname = wb.SheetNames.includes(DATA_SHEET_NAME) 
                    ? DATA_SHEET_NAME 
                    : wb.SheetNames.find(n => n !== 'DataLookup') || wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                if (data.length === 0) {
                    window.alert('File kosong atau format tidak sesuai.');
                    return;
                }

                if (!window.confirm(`Import ${data.length} data program?`)) return;

                let successCount = 0;
                let errorCount = 0;
                let failedItems = [];

                // Deteksi nama kolom aktual dari baris pertama untuk diagnosa
                const firstItem = data[0] || {};
                const availableColumns = Object.keys(firstItem).join(', ');
                const hasNamaProgram = data.some(item => item['Nama Program'] !== undefined);

                if (!hasNamaProgram) {
                    window.alert(
                        `❌ Kolom "Nama Program" tidak ditemukan di file Excel!\n\n` +
                        `Kolom yang terbaca: ${availableColumns || '(tidak ada)'}\n\n` +
                        `Pastikan Anda menggunakan template resmi dengan menekan tombol "Unduh Template Excel".`
                    );
                    return;
                }

                for (const item of data) {
                    try {
                        let unitId = currentUser?.role === 'admin_unit' ? currentUser.unitId : '';
                        let fieldId = currentUser?.role === 'admin_bidang' ? currentUser.fieldId : '';

                        if (currentUser?.role === 'superadmin') {
                            if (item.Unit) {
                                const u = units.find(unit => unit.name.toLowerCase() === item.Unit.toString().toLowerCase());
                                if (u) unitId = u.id;
                            }
                            if (item.Bidang) {
                                const f = fields.find(field => field.name.toLowerCase() === item.Bidang.toString().toLowerCase());
                                if (f) fieldId = f.id;
                            }
                        }

                        // Baris kosong (tidak ada nama program) — hitung sebagai gagal
                        if (!item['Nama Program'] || item['Nama Program'].toString().trim() === '') {
                            errorCount++;
                            failedItems.push(`(Baris kosong / Nama Program tidak diisi)`);
                            continue;
                        }

                        const programName = item['Nama Program'].toString().trim();
                        
                        // Reject if already exists in local state (case-insensitive)
                        const duplicateProgram = expensePrograms.find(p => 
                            !p.isDeleted && 
                            p.name.toLowerCase() === programName.toLowerCase()
                        );

                        if (duplicateProgram) {
                            errorCount++;
                            failedItems.push(`${programName} (Sudah ada di database)`);
                            continue;
                        }

                        const newItem = {
                            id: `PRG-${generateId()}`,
                            name: programName,
                            description: item.Keterangan?.toString() || '',
                            unitId,
                            fieldId,
                            type: 'Expense'
                        };

                        dispatch({ type: 'ADD_BUDGET_PROGRAM', payload: newItem });
                        await api.pushAction({ type: 'ADD_BUDGET_PROGRAM', payload: newItem }, state);
                        successCount++;
                    } catch (err) {
                        console.error('Import Error:', err);
                        errorCount++;
                        failedItems.push(`${item['Nama Program'] || 'Tanpa Nama'} (${err.message})`);
                    }
                }

                let alertMsg = `Import Selesai!\nBerhasil: ${successCount}\nGagal: ${errorCount}`;
                if (failedItems.length > 0) {
                    alertMsg += `\n\nDetail Gagal:\n` + failedItems.join('\n');
                }
                window.alert(alertMsg);
                setShowImportModal(false);
            } catch (err) {
                window.alert('Gagal membaca file: ' + err.message);
            }
        };
        reader.readAsBinaryString(file);
    };

    return (
        <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200">
                            <Layout size={28} />
                        </div>
                        Master Program Belanja
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">Kelola daftar program kerja dan belanja untuk unit/bidang Anda</p>
                </div>

                <div className="flex items-center gap-3">
                    <button 
                        onClick={handleExport}
                        className="budget-export-btn !py-3.5"
                        disabled={filteredItems.length === 0}
                    >
                        <Download size={20} />
                        <span>Export</span>
                    </button>
                    <button 
                        onClick={() => setShowImportModal(true)}
                        className="flex items-center gap-2 px-6 py-3.5 rounded-2xl font-bold bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300 hover:shadow-lg transition-all active:scale-95"
                    >
                        <Upload size={20} />
                        <span>Import Masal</span>
                    </button>
                    <button
                        onClick={() => {
                            setEditingItem(null);
                            setFormData({ name: '', description: '', unitId: initialUnitId, fieldId: initialFieldId, type: 'Expense', debitAccountId: '', creditAccountId: '' });
                            setIsModalOpen(true);
                        }}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3.5 rounded-2xl font-bold transition-all shadow-lg shadow-indigo-200 active:scale-95"
                    >
                        <Plus size={20} />
                        Tambah Program
                    </button>
                </div>
            </div>

            {/* Alert Message */}
            {message && (
                <div className={`p-4 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top duration-300 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                    }`}>
                    {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                    <p className="font-bold text-sm">{message.text}</p>
                </div>
            )}

            {/* Content Card */}
            <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                <div className="p-6 lg:p-8 border-b border-slate-100 bg-slate-50/40 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Search Bar */}
                    <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-indigo-500" size={20} />
                        <input
                            type="text"
                            placeholder="Cari nama program, keterangan, atau kode akun..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full pl-12 pr-6 py-3.5 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-medium text-sm text-slate-800"
                        />
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex items-center gap-2 bg-slate-200/60 p-1.5 rounded-2xl self-start lg:self-auto overflow-x-auto">
                        <button
                            onClick={() => { setMappingFilter('ALL'); setCurrentPage(1); }}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                                mappingFilter === 'ALL'
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <span>Semua</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                mappingFilter === 'ALL' ? 'bg-slate-100 text-slate-700' : 'bg-slate-300/60 text-slate-600'
                            }`}>
                                {countTotal}
                            </span>
                        </button>
                        <button
                            onClick={() => { setMappingFilter('MAPPED'); setCurrentPage(1); }}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                                mappingFilter === 'MAPPED'
                                    ? 'bg-emerald-600 text-white shadow-sm'
                                    : 'text-slate-600 hover:text-emerald-700'
                            }`}
                        >
                            <span className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${mappingFilter === 'MAPPED' ? 'bg-white' : 'bg-emerald-500'}`}></span>
                                Otomatis
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                mappingFilter === 'MAPPED' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                                {countMapped}
                            </span>
                        </button>
                        <button
                            onClick={() => { setMappingFilter('UNMAPPED'); setCurrentPage(1); }}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                                mappingFilter === 'UNMAPPED'
                                    ? 'bg-amber-600 text-white shadow-sm'
                                    : 'text-slate-600 hover:text-amber-700'
                            }`}
                        >
                            <span className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${mappingFilter === 'UNMAPPED' ? 'bg-white' : 'bg-amber-500'}`}></span>
                                Mode Manual
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                mappingFilter === 'UNMAPPED' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-800'
                            }`}>
                                {countUnmapped}
                            </span>
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/70 border-b border-slate-100">
                                <th className="px-8 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Nama Program</th>
                                {currentUser?.role === 'superadmin' && (
                                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Dibuat Oleh</th>
                                )}
                                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Pemetaan Jurnal (Debet / Kredit)</th>
                                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Keterangan</th>
                                <th className="px-8 py-4 text-xs font-black text-slate-500 uppercase tracking-wider text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-600 font-medium text-sm">
                            {paginatedItems.map((item) => {
                                const unitObj = units.find(u => u.id === item.unitId);
                                const fieldObj = fields.find(f => f.id === item.fieldId);
                                const debitAcc = accounts.find(a => a.id === item.debitAccountId);
                                const creditAcc = accounts.find(a => a.id === item.creditAccountId);
                                const isMapped = !!(debitAcc && creditAcc);

                                return (
                                    <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors group">
                                        <td className="px-8 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-2 rounded-full transition-opacity ${
                                                    isMapped ? 'bg-emerald-500' : 'bg-indigo-400 opacity-40 group-hover:opacity-100'
                                                }`} />
                                                <span className="text-slate-900 font-bold group-hover:text-indigo-600 transition-colors">{item.name}</span>
                                            </div>
                                        </td>
                                        {currentUser?.role === 'superadmin' && (
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-slate-800">{unitObj ? unitObj.name : (fieldObj ? fieldObj.name : 'Shared / Global')}</span>
                                                    <span className="text-[10px] uppercase tracking-widest text-slate-400 font-black">
                                                        CREATED
                                                    </span>
                                                </div>
                                            </td>
                                        )}
                                        <td className="px-6 py-4">
                                            {isMapped ? (
                                                <div className="flex flex-col gap-1.5 max-w-md">
                                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/70 text-xs font-semibold" title={`Debet: ${debitAcc.code} - ${debitAcc.name}`}>
                                                        <span className="w-4 h-4 rounded bg-emerald-600 text-white text-[10px] font-black flex items-center justify-center shrink-0">D</span>
                                                        <span className="font-mono text-[11px] text-emerald-900 font-bold">{debitAcc.code}</span>
                                                        <span className="truncate">{debitAcc.name}</span>
                                                    </div>
                                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 text-sky-800 border border-sky-200/70 text-xs font-semibold" title={`Kredit: ${creditAcc.code} - ${creditAcc.name}`}>
                                                        <span className="w-4 h-4 rounded bg-sky-600 text-white text-[10px] font-black flex items-center justify-center shrink-0">K</span>
                                                        <span className="font-mono text-[11px] text-sky-900 font-bold">{creditAcc.code}</span>
                                                        <span className="truncate">{creditAcc.name}</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-500 border border-slate-200/80 text-xs font-medium">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                                    <span>Mode Manual (Menunggu COA)</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 max-w-xs truncate text-xs text-slate-500">
                                            {item.description || '-'}
                                        </td>
                                        <td className="px-8 py-4 whitespace-nowrap">
                                            <div className="flex items-center justify-end gap-1.5 text-slate-500">
                                                <button
                                                    onClick={() => {
                                                        setEditingItem(item);
                                                        setFormData({
                                                            name: item.name,
                                                            description: item.description || '',
                                                            unitId: item.unitId || '',
                                                            fieldId: item.fieldId || '',
                                                            type: item.type || 'Expense',
                                                            debitAccountId: item.debitAccountId || '',
                                                            creditAccountId: item.creditAccountId || ''
                                                        });
                                                        setIsModalOpen(true);
                                                    }}
                                                    className="p-2.5 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                                    title="Edit & Atur Akun Jurnal"
                                                >
                                                    <Edit2 size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    className="p-2.5 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                                    title="Hapus"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredItems.length === 0 && (
                                <tr>
                                    <td colSpan={currentUser?.role === 'superadmin' ? "5" : "4"} className="px-8 py-20 text-center text-slate-400 font-medium">
                                        Tidak ada program belanja yang ditemukan
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination & Summary Footer */}
                <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3 text-xs font-bold text-slate-500">
                        <span>
                            Menampilkan {filteredItems.length === 0 ? 0 : startIndex + 1} - {Math.min(startIndex + pageSize, filteredItems.length)} dari {filteredItems.length} Program
                        </span>
                        <div className="flex items-center gap-1.5">
                            <span className="text-slate-400">|</span>
                            <select
                                value={pageSize}
                                onChange={(e) => {
                                    setPageSize(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all cursor-pointer"
                            >
                                <option value={25}>25 per hal</option>
                                <option value={50}>50 per hal</option>
                                <option value={100}>100 per hal</option>
                                <option value={500}>Semua (500)</option>
                            </select>
                        </div>
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
                                title="Halaman Sebelumnya"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span className="text-xs font-black text-slate-700 px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-sm">
                                Hal {currentPage} / {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
                                title="Halaman Selanjutnya"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-2xl max-h-[92vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                        <div className="p-6 lg:p-8 border-b border-slate-100 bg-indigo-50/50 shrink-0">
                            <h2 className="text-2xl font-black text-slate-900">
                                {editingItem ? 'Edit Program Belanja' : 'Tambah Program Belanja'}
                            </h2>
                            <p className="text-slate-500 text-sm font-medium mt-1">
                                Definisikan nama program belanja serta pemetaan akun jurnal otomatisnya
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 lg:p-8 space-y-6 overflow-y-auto">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Nama Program</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200/70 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:bg-white focus:border-indigo-500 outline-none transition-all font-bold text-slate-900"
                                    placeholder="Contoh: Tagihan Listrik & Air"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Keterangan</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-5 py-3 bg-slate-50 border border-slate-200/70 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:bg-white focus:border-indigo-500 outline-none transition-all font-medium text-slate-700 min-h-[80px]"
                                    placeholder="Penjelasan singkat mengenai program ini..."
                                />
                            </div>

                            {currentUser?.role === 'superadmin' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Unit</label>
                                        <select
                                            value={formData.unitId}
                                            onChange={(e) => setFormData({ ...formData, unitId: e.target.value, fieldId: '' })}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-800 outline-none focus:border-indigo-500"
                                        >
                                            <option value="">(Opsional - Semua Unit)</option>
                                            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Bidang</label>
                                        <select
                                            value={formData.fieldId}
                                            onChange={(e) => setFormData({ ...formData, fieldId: e.target.value, unitId: '' })}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-800 outline-none focus:border-indigo-500"
                                        >
                                            <option value="">(Opsional - Semua Bidang)</option>
                                            {fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* Section: Pemetaan Akun Jurnal Otomatis */}
                            <div className="p-5 bg-gradient-to-br from-indigo-50/70 via-purple-50/40 to-slate-50 rounded-2xl border border-indigo-100/90 space-y-4 shadow-sm">
                                <div className="flex items-center gap-2.5">
                                    <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-sm">
                                        <BookOpen size={18} />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-black uppercase tracking-wider text-indigo-950">
                                            Pemetaan Akun Jurnal Otomatis (Opsi A)
                                        </h4>
                                        <p className="text-[11px] text-slate-500 font-medium">
                                            Pasangan akun default saat pelaporan belanja (LPJ) program ini disetujui / di-ACC
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                                    {/* Akun Debet */}
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                                            <span className="w-4 h-4 rounded bg-emerald-600 text-white text-[9px] font-black inline-flex items-center justify-center">D</span>
                                            Akun Debet (Default Beban / Aset)
                                        </label>
                                        <select
                                            value={formData.debitAccountId}
                                            onChange={(e) => setFormData({ ...formData, debitAccountId: e.target.value })}
                                            className="w-full px-3.5 py-2.5 bg-white border border-indigo-200 rounded-xl font-medium text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                        >
                                            <option value="">-- Mode Manual (Menunggu COA) --</option>
                                            {groupedAccounts.map(group => (
                                                <optgroup key={`debit-${group.tipe}`} label={`--- Kelompok ${group.tipe} ---`}>
                                                    {group.accounts.map(acc => (
                                                        <option key={acc.id} value={acc.id}>
                                                            {acc.code} - {acc.name}
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Akun Kredit */}
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                                            <span className="w-4 h-4 rounded bg-sky-600 text-white text-[9px] font-black inline-flex items-center justify-center">K</span>
                                            Akun Kredit (Default Kas / Bank)
                                        </label>
                                        <select
                                            value={formData.creditAccountId}
                                            onChange={(e) => setFormData({ ...formData, creditAccountId: e.target.value })}
                                            className="w-full px-3.5 py-2.5 bg-white border border-indigo-200 rounded-xl font-medium text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                        >
                                            <option value="">-- Mode Manual (Menunggu COA) --</option>
                                            {groupedAccounts.map(group => (
                                                <optgroup key={`credit-${group.tipe}`} label={`--- Kelompok ${group.tipe} ---`}>
                                                    {group.accounts.map(acc => (
                                                        <option key={acc.id} value={acc.id}>
                                                            {acc.code} - {acc.name}
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="text-[11px] text-slate-600 bg-white/80 p-3 rounded-xl border border-indigo-100/60 leading-relaxed flex items-start gap-2">
                                    <span className="text-sm">💡</span>
                                    <span>
                                        <strong>Bagaimana cara kerjanya?</strong> Ketika LPJ disetujui, jika kedua akun telah diisi, jurnal riil langsung diterbitkan otomatis (Status: <em>Terisi COA</em>). Jika belum diisi, jurnal akan berstatus <em>MENUNGGU COA</em> (mode manual). Akuntan tetap dapat mengedit akun kapan saja di menu Jurnal Umum.
                                    </span>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold transition-all shadow-sm text-sm"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-200 text-sm"
                                >
                                    {loading ? 'Menyimpan...' : 'Simpan Program'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Import Modal */}
            {showImportModal && (
                <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-indigo-50/50">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900">Import Masal Program</h2>
                                <p className="text-slate-500 text-sm font-medium">Impor daftar program belanja dari file Excel</p>
                            </div>
                            <button onClick={() => setShowImportModal(false)} className="p-3 bg-white text-slate-400 hover:text-slate-900 rounded-2xl transition-all shadow-sm">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-8">
                            <div className="mb-8 p-10 border-4 border-dashed border-slate-100 rounded-[32px] flex flex-col items-center justify-center text-center hover:border-indigo-200 transition-all group">
                                <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <Upload size={32} />
                                </div>
                                <button 
                                    onClick={handleDownloadTemplate}
                                    className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-6 hover:underline"
                                >
                                    Unduh Template Excel
                                </button>
                                <label className="cursor-pointer">
                                    <span className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3.5 rounded-2xl font-bold transition-all shadow-lg shadow-indigo-200 block">Pilih File XLSX</span>
                                    <input type="file" className="hidden" accept=".xlsx" onChange={handleFileUpload} />
                                </label>
                            </div>

                            <button onClick={() => setShowImportModal(false)} className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold transition-all">
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
