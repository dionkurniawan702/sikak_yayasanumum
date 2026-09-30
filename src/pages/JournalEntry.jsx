import { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { formatRupiah, formatTanggal, generateId } from '../utils/format';
import {
    Plus, Trash2, Save, AlertTriangle, CheckCircle, Calendar, FileText,
    Hash, Receipt, Phone, Hourglass, List, PenLine, Download, Upload, History, Info, Pencil, X, Users, Search, FileSpreadsheet,
    ChevronLeft, ChevronRight, Loader2, ArrowUpDown
} from 'lucide-react';
import * as XLSX from 'xlsx';
import CurrencyDisplay from '../components/CurrencyDisplay';
import { api } from '../services/api';

export default function JournalEntry() {
    const { state, dispatch } = useApp();
    const accounts = state.accounts.filter(a => !a.isDeleted);
    const journals = state.journals.filter(j => !j.isDeleted);
    const programs = state.programs.filter(p => !p.isDeleted);
    const detailAccounts = accounts
        .filter(a => a.category === 'detail')
        .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

    const TIPE_URUTAN = ['Aset', 'Kewajiban', 'Aset Neto', 'Pendapatan', 'Beban'];
    const groupedAccounts = TIPE_URUTAN.map(tipe => ({
        tipe,
        accounts: detailAccounts.filter(a => a.type === tipe)
    })).filter(g => g.accounts.length > 0);
    const fileInputRef = useRef(null);

    const [date, setDate] = useState('');
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [reference, setReference] = useState('');
    const [proof, setProof] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [programId, setProgramId] = useState('PRG-GEN');
    

    const [rows, setRows] = useState([
        { accountId: '', debit: '', credit: '' },
        { accountId: '', debit: '', credit: '' },
    ]);
    const [viewMode, setViewMode] = useState('input');
    const [editingJournal, setEditingJournal] = useState(null);
    const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
    const [historySearch, setHistorySearch] = useState('');
    const [historyStatusFilter, setHistoryStatusFilter] = useState('ALL');
    const [selectedPeriod, setSelectedPeriod] = useState('LATEST_500'); // 'LATEST_500' | 'YYYY-MM'
    const [monthJournals, setMonthJournals] = useState([]);
    const [monthTotalCount, setMonthTotalCount] = useState(null);
    const [isLoadingPeriod, setIsLoadingPeriod] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);

    const formatMonthLabel = (ymString) => {
        if (!ymString || ymString === 'LATEST_500') return '500 Transaksi Terbaru';
        const [year, month] = ymString.split('-');
        const monthNames = [
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];
        const mIdx = parseInt(month, 10) - 1;
        return `${monthNames[mIdx] || month} ${year}`;
    };

    const availableMonths = useMemo(() => {
        const options = [{ value: 'LATEST_500', label: '500 Transaksi Terbaru (Default)' }];
        const now = new Date();
        const curYear = now.getFullYear();
        const curMonth = now.getMonth() + 1;
        for (let i = 0; i < 18; i++) {
            let m = curMonth - i;
            let y = curYear;
            while (m <= 0) {
                m += 12;
                y -= 1;
            }
            const val = `${y}-${String(m).padStart(2, '0')}`;
            if (!options.some(o => o.value === val)) {
                options.push({ value: val, label: formatMonthLabel(val) });
            }
        }
        return options;
    }, []);

    useEffect(() => {
        if (selectedPeriod === 'LATEST_500') {
            setMonthJournals([]);
            setMonthTotalCount(null);
            setCurrentPage(1);
            return;
        }

        let isMounted = true;
        setIsLoadingPeriod(true);
        setCurrentPage(1);

        api.get(`/journals?month=${selectedPeriod}`)
            .then(res => {
                if (!isMounted) return;
                const fetched = (res?.data || []).map(j => ({
                    ...j,
                    programId: j.programId || 'PRG-GEN',
                    entries: typeof j.entries === 'string' ? JSON.parse(j.entries) : (j.entries || [])
                }));
                setMonthJournals(fetched);
                setMonthTotalCount(res?.totalCount ?? fetched.length);
            })
            .catch(err => {
                console.error('[Journal Month Fetch Error]', err);
                if (isMounted) {
                    const fallback = journals.filter(j => j.date && j.date.startsWith(selectedPeriod));
                    setMonthJournals(fallback);
                    setMonthTotalCount(fallback.length);
                }
            })
            .finally(() => {
                if (isMounted) setIsLoadingPeriod(false);
            });

        return () => { isMounted = false; };
    }, [selectedPeriod]);

    const downloadTemplate = () => {
        const wsData = [
            ['Tanggal', 'Pihak Terkait', 'Deskripsi', 'No Referensi', 'Program', 'Kode Akun', 'Debit', 'Kredit'],
            ['2026-07-14', 'TAUD', 'Pembelian Alat Jilid (Stapler)', 'Nota-01', 'Umum', '11101', 325000, 0],
            ['', '', '', '', '', '11102', 0, 325000]
        ];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template Jurnal');
        XLSX.writeFile(wb, 'SIKAD-Template-Impor-Jurnal.xlsx');
    };

    const handleImportExcel = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const data = evt.target.result;
                const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const rows = XLSX.utils.sheet_to_json(worksheet);

                if (rows.length === 0) return alert('File Excel kosong!');

                const journalsGrouped = [];
                let currentJournal = null;

                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    
                    const rowDate = row['Tanggal'];
                    const rowDesc = row['Deskripsi'] || row['Keterangan'];
                    const rowName = row['Pihak Terkait'] || row['Nama'];
                    const rowRef = String(row['No Referensi'] || row['Referensi'] || '');
                    const rowProg = String(row['Program'] || '');
                    const rowCode = String(row['Kode Akun'] || row['Akun'] || '').trim();
                    const rowDebit = parseFloat(row['Debit']) || 0;
                    const rowCredit = parseFloat(row['Kredit']) || 0;

                    if (!rowCode) continue; // Skip empty rows

                    const isNewJournal = rowDate || rowDesc || !currentJournal;

                    if (isNewJournal) {
                        if (currentJournal) {
                            journalsGrouped.push(currentJournal);
                        }
                        
                        let parsedDate = new Date();
                        if (rowDate) {
                            parsedDate = new Date(rowDate);
                            if (isNaN(parsedDate.getTime())) parsedDate = new Date();
                        }

                        let matchedProgId = 'PRG-GEN';
                        if (rowProg) {
                            const p = programs.find(pr => pr.name.toLowerCase().includes(rowProg.toLowerCase()) || pr.id.toLowerCase() === rowProg.toLowerCase());
                            if (p) matchedProgId = p.id;
                        }

                        currentJournal = {
                            date: parsedDate.toISOString().slice(0, 10),
                            name: rowName || '',
                            description: rowDesc || 'Jurnal Impor',
                            reference: rowRef || '',
                            programId: matchedProgId,
                            entries: []
                        };
                    }

                    const account = detailAccounts.find(a => a.code === rowCode || a.name === rowCode);
                    if (!account) {
                        throw new Error(`Baris ${i + 2}: Kode Akun "${rowCode}" tidak ditemukan di Chart of Accounts (COA)!`);
                    }

                    currentJournal.entries.push({
                        accountId: account.id,
                        accountName: account.name,
                        debit: rowDebit,
                        credit: rowCredit
                    });
                }

                if (currentJournal) {
                    journalsGrouped.push(currentJournal);
                }

                // Validasi balance
                const invalidJournals = [];
                for (let i = 0; i < journalsGrouped.length; i++) {
                    const j = journalsGrouped[i];
                    const totalD = j.entries.reduce((sum, entry) => sum + entry.debit, 0);
                    const totalC = j.entries.reduce((sum, entry) => sum + entry.credit, 0);
                    
                    if (j.entries.length < 2) {
                        invalidJournals.push(`Jurnal ke-${i+1} (${j.description}): Harus memiliki minimal 2 entri rekening.`);
                    } else if (Math.abs(totalD - totalC) > 0.01 || totalD === 0) {
                        invalidJournals.push(`Jurnal ke-${i+1} (${j.description}): Nilai Debit (${totalD}) dan Kredit (${totalC}) tidak seimbang atau bernilai 0.`);
                    }
                }

                if (invalidJournals.length > 0) {
                    alert('Impor gagal. Temuan kesalahan:\n' + invalidJournals.slice(0, 10).join('\n') + (invalidJournals.length > 10 ? '\n...dan lainnya' : ''));
                    return;
                }

                if (window.confirm(`Berhasil memvalidasi ${journalsGrouped.length} jurnal. Lanjutkan untuk memposting ke database?`)) {
                    for (const j of journalsGrouped) {
                        const journalId = `JRN-${Date.now()}-${generateId()}`;
                        const payload = {
                            ...j,
                            id: journalId,
                            isDeleted: false
                        };
                        dispatch({ type: 'ADD_JOURNAL', payload });
                        await api.pushAction({ type: 'ADD_JOURNAL', payload }, state);
                    }
                    alert(`Sukses memposting ${journalsGrouped.length} jurnal ke database!`);
                    e.target.value = '';
                }

            } catch (err) {
                alert('Gagal memproses file Excel: ' + err.message);
            }
        };
        reader.readAsBinaryString(file);
    };

    const TAX_GROUPS = [
        { label: 'Kelompok 1 (4 Tahun) - Peralatan/Laptop/Motor', value: '4' },
        { label: 'Kelompok 2 (8 Tahun) - Kendaraan/Mesin/AC', value: '8' },
        { label: 'Kelompok 3 (16 Tahun) - Alat Berat/Mesin Kimia', value: '16' },
        { label: 'Kelompok 4 (20 Tahun) - Bangunan Permanen', value: '20' },
        { label: 'Bangunan Tidak Permanen (10 Tahun)', value: '10' },
    ];

    const totalDebit = rows.reduce((s, r) => s + (parseFloat(r.debit) || 0), 0);
    const totalCredit = rows.reduce((s, r) => s + (parseFloat(r.credit) || 0), 0);
    const isBalanced = totalDebit > 0 && Math.abs(totalDebit - totalCredit) < 0.01;
    const difference = Math.abs(totalDebit - totalCredit);

    const activeJournals = selectedPeriod === 'LATEST_500' ? journals : monthJournals;

    const countTotal = selectedPeriod === 'LATEST_500' 
        ? (state.totalJournalsCount || journals.length) 
        : (monthTotalCount ?? activeJournals.length);

    const countDone = activeJournals.filter(j => !j.entries?.some(e => !e.accountId)).length;
    const countPending = activeJournals.filter(j => j.entries?.some(e => !e.accountId)).length;

    const filteredJournals = activeJournals
        .filter(j => !j.isDeleted)
        .filter(j => {
            if (historyStatusFilter === 'PENDING') {
                return j.entries?.some(e => !e.accountId);
            }
            if (historyStatusFilter === 'DONE') {
                return !j.entries?.some(e => !e.accountId);
            }
            return true;
        })
        .filter(j => {
            if (!historySearch.trim()) return true;
            const q = historySearch.toLowerCase();
            return (
                (j.description || '').toLowerCase().includes(q) || 
                (j.name || '').toLowerCase().includes(q) ||
                (j.reference || '').toLowerCase().includes(q) ||
                (j.id || '').toLowerCase().includes(q)
            );
        })
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    const totalPages = Math.max(1, Math.ceil(filteredJournals.length / pageSize));
    const startIndex = (currentPage - 1) * pageSize;
    const paginatedJournals = filteredJournals.slice(startIndex, startIndex + pageSize);

    const exportHistoryToExcel = () => {
        const data = filteredJournals.map(j => ({
            'ID Jurnal': j.id,
            'Tanggal': j.date ? j.date.split('T')[0] : '',
            'Deskripsi': j.description,
            'Pihak Terkait': j.name || '-',
            'Referensi': j.reference || '-',
            'Total': (j.entries || []).reduce((s, e) => s + (e.debit || 0), 0)
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Ringkasan Jurnal');
        XLSX.writeFile(wb, `SIKAD-Ringkasan-Jurnal-${selectedPeriod}.xlsx`);
    };

    const exportDetailedHistoryToExcel = () => {
        const detailedRows = [];
        filteredJournals.forEach(j => {
            const progName = programs.find(p => p.id === j.programId)?.name || 'Umum';
            (j.entries || []).forEach((e, idx) => {
                const acc = accounts.find(a => a.id === e.accountId);
                const accCode = acc?.code || e.accountId || '';
                const accName = acc?.name || e.accountName || '';
                detailedRows.push({
                    'Tanggal': idx === 0 ? (j.date ? j.date.split('T')[0] : '') : '',
                    'Pihak Terkait': idx === 0 ? (j.name || '-') : '',
                    'Deskripsi': idx === 0 ? j.description : '',
                    'No Referensi': idx === 0 ? (j.reference || '-') : '',
                    'Program': idx === 0 ? progName : '',
                    'Kode Akun': accCode,
                    'Nama Akun': accName,
                    'Debit': e.debit || 0,
                    'Kredit': e.credit || 0
                });
            });
        });

        const ws = XLSX.utils.json_to_sheet(detailedRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Detail Jurnal');
        XLSX.writeFile(wb, `SIKAD-Detail-Jurnal-${selectedPeriod}.xlsx`);
    };


    function addRow() {
        setRows([...rows, { accountId: '', debit: '', credit: '' }]);
    }

    function removeRow(idx) {
        if (rows.length <= 2) return;
        setRows(rows.filter((_, i) => i !== idx));
    }

    function updateRow(idx, field, value) {
        setRows(rows.map((r, i) => i === idx ? { ...r, [field]: value, ...(field === 'debit' && value ? { credit: '' } : field === 'credit' && value ? { debit: '' } : {}) } : r));
    }



    function handleEdit(journal) {
        setEditingJournal(journal);
        setDate(journal.date ? journal.date.split('T')[0] : '');
        setName(journal.name || '');
        setDescription(journal.description);
        setReference(journal.reference || '');
        setProof(journal.proof || '');
        setPhoneNumber(journal.phoneNumber || '');
        

        setProgramId(journal.programId || 'PRG-GEN');
        setRows(journal.entries.map(e => ({
            accountId: e.accountId,
            debit: e.debit > 0 ? String(e.debit) : '',
            credit: e.credit > 0 ? String(e.credit) : '',
        })));
        setViewMode('input');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function handleSave() {
        if (!date || !description || !isBalanced) return alert('Periksa kembali input jurnal!');
        
        const hasEmptyAccount = rows.some(r => !r.accountId && (parseFloat(r.debit) || parseFloat(r.credit)));
        if (hasEmptyAccount) return alert('Semua baris jurnal yang memiliki nominal harus diisi dengan akun (COA) yang sesuai!');

        const entries = rows
            .filter(r => r.accountId && (parseFloat(r.debit) || parseFloat(r.credit)))
            .map(r => ({
                accountId: r.accountId,
                accountName: detailAccounts.find(a => a.id === r.accountId)?.name || '',
                debit: parseFloat(r.debit) || 0,
                credit: parseFloat(r.credit) || 0,
            }));

        const payload = { 
            date, name, description, entries, reference, proof, 
            phoneNumber, programId
        };

        try {
            if (editingJournal) {
                const updated = { ...payload, id: editingJournal.id, isDeleted: false };
                dispatch({ type: 'EDIT_JOURNAL', payload: updated });
                await api.pushAction({ type: 'EDIT_JOURNAL', payload: updated }, state);
                if (selectedPeriod !== 'LATEST_500') {
                    setMonthJournals(prev => prev.map(j => j.id === editingJournal.id ? { ...j, ...updated } : j));
                }
                setEditingJournal(null);
                alert('Jurnal berhasil diperbarui!');
            } else {
                const newId = generateId('JRN');
                const newJournal = { ...payload, id: newId, isDeleted: false };
                dispatch({ type: 'ADD_JOURNAL', payload: newJournal });
                await api.pushAction({ type: 'ADD_JOURNAL', payload: newJournal }, state);
                if (selectedPeriod !== 'LATEST_500' && date.startsWith(selectedPeriod)) {
                    setMonthJournals(prev => [newJournal, ...prev]);
                }
                alert('Jurnal berhasil diposting!');
            }
            resetForm();
            setViewMode('list');
        } catch (err) {
            console.error('[Save Journal Error]', err);
            alert('Gagal menyimpan jurnal: ' + err.message);
        }
    }

    function resetForm() {
        setDate('');
        setName('');
        setDescription('');
        setReference('');
        setProof('');

        setRows([{ accountId: '', debit: '', credit: '' }, { accountId: '', debit: '', credit: '' }]);
    }

    const handleDelete = async (id) => {
        if (window.confirm('Yakin ingin menghapus jurnal ini? Jurnal akan dipindahkan ke tempat sampah.')) {
            dispatch({ type: 'DELETE_JOURNAL', payload: id });
            await api.pushAction({ type: 'DELETE_JOURNAL', payload: id }, state);
            if (selectedPeriod !== 'LATEST_500') {
                setMonthJournals(prev => prev.filter(j => j.id !== id));
            }
            alert('Jurnal berhasil dipindahkan ke tempat sampah.');
        }
    };

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Jurnal Umum</h2>
                    <p className="text-slate-500 font-medium tracking-tight">Pencatatan Transaksi Yayasan — Double Entry System</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setViewMode('input')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'input' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-400'}`}>Input</button>
                    <button onClick={() => setViewMode('list')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'list' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-400'}`}>Riwayat</button>
                </div>
            </div>

            {viewMode === 'input' && (
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl animate-in">
                    {/* Bulk Import Action Bar */}
                    <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-50/80 border border-slate-100 p-6 rounded-2xl mb-8 gap-4">
                        <div>
                            <h4 className="text-sm font-black text-slate-800">Impor Jurnal Massal (Excel)</h4>
                            <p className="text-xs text-slate-400 mt-1">Posting beberapa transaksi sekaligus dengan mengunggah template Excel</p>
                        </div>
                        <div className="flex gap-2">
                            {/* Hidden File Input */}
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handleImportExcel} 
                                accept=".xlsx, .xls" 
                                className="hidden" 
                            />
                            <button onClick={downloadTemplate} className="flex items-center gap-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-100 px-4 py-2.5 rounded-xl font-black text-[10px] tracking-wide uppercase transition-all">
                                <Download size={12} /> Template Impor
                            </button>
                            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-100 px-4 py-2.5 rounded-xl font-black text-[10px] tracking-wide uppercase transition-all">
                                <Upload size={12} /> Impor Banyak
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Tanggal Transaksi</label>
                            <input type="date" className="form-input rounded-2xl border-slate-200" value={date} onChange={e => setDate(e.target.value)} />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Pihak Terkait</label>
                            <input className="form-input rounded-2xl border-slate-200" value={name} onChange={e => setName(e.target.value)} placeholder="Nama pihak terkait" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Keterangan Jurnal</label>
                            <input className="form-input rounded-2xl border-slate-200" value={description} onChange={e => setDescription(e.target.value)} placeholder="Deskripsi lengkap transaksi..." />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">No. Referensi / Bukti</label>
                            <input className="form-input rounded-2xl border-slate-200" value={reference} onChange={e => setReference(e.target.value)} placeholder="REF/001" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Program Sosial</label>
                            <select className="form-select rounded-2xl border-slate-200" value={programId} onChange={e => setProgramId(e.target.value)}>
                                {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="bg-slate-50/50 rounded-3xl p-6 mb-8 border border-slate-100">
                        <table className="w-full text-left">
                            <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                <tr>
                                    <th className="pb-4 px-4">Akun Rekening</th>
                                    <th className="pb-4 px-4 text-right">Debit</th>
                                    <th className="pb-4 px-4 text-right">Kredit</th>
                                    <th className="pb-4 px-4 w-12"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, idx) => (
                                    <tr key={idx}>
                                        <td className="py-2 px-2">
                                            <select className="form-select rounded-xl border-slate-100 bg-white" value={row.accountId} onChange={e => updateRow(idx, 'accountId', e.target.value)}>
                                                <option value="">Pilih Akun</option>
                                                {groupedAccounts.map(g => (
                                                    <optgroup key={g.tipe} label={g.tipe.toUpperCase()}>
                                                        {g.accounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                                                    </optgroup>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="py-2 px-2">
                                            <input type="number" className="form-input rounded-xl border-slate-100 bg-white text-right font-bold" value={row.debit} onChange={e => updateRow(idx, 'debit', e.target.value)} placeholder="0" />
                                        </td>
                                        <td className="py-2 px-2">
                                            <input type="number" className="form-input rounded-xl border-slate-100 bg-white text-right font-bold" value={row.credit} onChange={e => updateRow(idx, 'credit', e.target.value)} placeholder="0" />
                                        </td>
                                        <td className="py-2 px-2 text-center">
                                            <button onClick={() => removeRow(idx)} className="text-rose-400 hover:text-rose-600 transition-colors"><Trash2 size={16} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <button onClick={addRow} className="mt-4 flex items-center gap-2 text-xs font-black text-blue-600 uppercase tracking-widest px-4 py-2 bg-blue-50 rounded-xl hover:bg-blue-100 transition-all">
                            <Plus size={14} /> Tambah Baris
                        </button>
                    </div>

                    <div className={`p-6 rounded-3xl border flex justify-between items-center mb-8 ${isBalanced ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                        <div className="flex items-center gap-4">
                            {isBalanced ? <CheckCircle className="text-emerald-500" /> : <AlertTriangle className="text-rose-500" />}
                            <div>
                                <p className={`text-sm font-black ${isBalanced ? 'text-emerald-800' : 'text-rose-800'}`}>{isBalanced ? 'JURNAL SEIMBANG' : 'JURNAL TIDAK SEIMBANG'}</p>
                                <p className="text-xs opacity-60">Selisih: <CurrencyDisplay value={difference} /></p>
                            </div>
                        </div>
                        <div className="text-right">
                           <p className="text-[10px] font-black opacity-40 uppercase tracking-widest">Total Debit</p>
                           <p className="text-xl font-black text-slate-800"><CurrencyDisplay value={totalDebit} /></p>
                        </div>
                    </div>

                    <div className="flex justify-end gap-4">
                        <button onClick={resetForm} className="px-8 py-3 rounded-2xl font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest text-xs">Reset</button>
                        <button onClick={handleSave} disabled={!isBalanced} className="btn btn-primary px-12 py-4 rounded-2xl shadow-xl shadow-blue-500/30 font-black tracking-tight">
                            <Save size={18} /> {editingJournal ? 'SIMPAN PERUBAHAN' : 'POSTING JURNAL'}
                        </button>
                    </div>
                </div>
            )}

            {viewMode === 'list' && (
                <div className="space-y-6 animate-in fade-in duration-500">
                    {/* Statistik & Filter Jurnal */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Total Jurnal */}
                        <div 
                            onClick={() => setHistoryStatusFilter('ALL')}
                            className={`p-6 rounded-[2rem] border transition-all cursor-pointer hover:-translate-y-1 hover:shadow-lg ${
                                historyStatusFilter === 'ALL' 
                                    ? 'bg-blue-50/50 border-blue-200 shadow-blue-100/50' 
                                    : 'bg-white border-slate-100 hover:border-blue-100 shadow-sm'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
                                    <List size={20} />
                                </div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Jurnal</span>
                            </div>
                            <div className="mt-4">
                                <h3 className="text-3xl font-black text-slate-800">{countTotal.toLocaleString('id-ID')}</h3>
                                <p className="text-xs text-slate-400 font-bold mt-1">
                                    {selectedPeriod === 'LATEST_500' 
                                        ? `Menampilkan 500 terbaru dari ${(state.totalJournalsCount || countTotal).toLocaleString('id-ID')} di database` 
                                        : `Transaksi bulan ${formatMonthLabel(selectedPeriod)}`}
                                </p>
                            </div>
                        </div>

                        {/* Jurnal Terisi */}
                        <div 
                            onClick={() => setHistoryStatusFilter('DONE')}
                            className={`p-6 rounded-[2rem] border transition-all cursor-pointer hover:-translate-y-1 hover:shadow-lg ${
                                historyStatusFilter === 'DONE' 
                                    ? 'bg-emerald-50/50 border-emerald-200 shadow-emerald-100/50' 
                                    : 'bg-white border-slate-100 hover:border-emerald-100 shadow-sm'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl">
                                    <CheckCircle size={20} />
                                </div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Terisi COA</span>
                            </div>
                            <div className="mt-4">
                                <h3 className="text-3xl font-black text-slate-800">{countDone.toLocaleString('id-ID')}</h3>
                                <p className="text-xs text-slate-400 font-bold mt-1">Transaksi dengan akun lengkap</p>
                            </div>
                        </div>

                        {/* Menunggu COA */}
                        <div 
                            onClick={() => setHistoryStatusFilter('PENDING')}
                            className={`p-6 rounded-[2rem] border transition-all cursor-pointer hover:-translate-y-1 hover:shadow-lg ${
                                historyStatusFilter === 'PENDING' 
                                    ? 'bg-amber-50/50 border-amber-200 shadow-amber-100/50' 
                                    : 'bg-white border-slate-100 hover:border-amber-100 shadow-sm'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl animate-pulse">
                                    <Hourglass size={20} />
                                </div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Menunggu COA</span>
                            </div>
                            <div className="mt-4">
                                <h3 className="text-3xl font-black text-slate-800">{countPending.toLocaleString('id-ID')}</h3>
                                <p className="text-xs text-slate-400 font-bold mt-1">Perlu pemetaan akun COA</p>
                            </div>
                        </div>
                    </div>

                    {/* Table List Container */}
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden animate-in">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                <tr>
                                    <th colSpan={4} className="px-8 py-4">
                                        <div className="flex flex-col xl:flex-row justify-between items-center gap-4">
                                            <div className="flex flex-col sm:flex-row flex-1 w-full gap-3">
                                                <div className="relative flex-1">
                                                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                                    <input 
                                                        className="form-input pl-12 rounded-2xl border-slate-200 w-full" 
                                                        placeholder="Cari deskripsi, pihak, ref, ID..." 
                                                        value={historySearch} 
                                                        onChange={e => { setHistorySearch(e.target.value); setCurrentPage(1); }} 
                                                    />
                                                </div>

                                                {/* Filter Periode / Bulan */}
                                                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-3 py-2 shadow-sm shrink-0">
                                                    <Calendar size={16} className="text-blue-600 shrink-0" />
                                                    <select 
                                                        className="bg-transparent text-xs font-bold text-slate-700 border-none outline-none cursor-pointer pr-2"
                                                        value={selectedPeriod}
                                                        onChange={e => setSelectedPeriod(e.target.value)}
                                                    >
                                                        {availableMonths.map(opt => (
                                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                        ))}
                                                    </select>
                                                    {isLoadingPeriod && <Loader2 size={14} className="animate-spin text-blue-600 shrink-0" />}
                                                </div>
                                            </div>
                                            
                                            {/* Action Buttons Group */}
                                            <div className="flex flex-wrap gap-2 w-full xl:w-auto justify-start xl:justify-end">
                                                {/* Export Summary */}
                                                <button onClick={exportHistoryToExcel} className="flex items-center gap-1.5 bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl font-black text-[10px] tracking-wide uppercase transition-all shadow-sm">
                                                    <FileSpreadsheet size={12} /> Ekspor Ringkasan
                                                </button>

                                                {/* Export Detailed */}
                                                <button onClick={exportDetailedHistoryToExcel} className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-100 px-4 py-2.5 rounded-xl font-black text-[10px] tracking-wide uppercase transition-all shadow-sm">
                                                    <FileSpreadsheet size={12} /> Ekspor Detail Jurnal
                                                </button>
                                            </div>
                                        </div>
                                    </th>
                                </tr>
                                <tr>
                                    <th className="px-8 py-6">ID / Tanggal</th>
                                    <th className="px-8 py-6">Deskripsi Transaksi</th>
                                    <th className="px-8 py-6 text-right">Nilai Total</th>
                                    <th className="px-8 py-6 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {paginatedJournals.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-8 py-12 text-center text-slate-400">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <Info size={32} className="text-slate-300" />
                                                <p className="font-bold text-sm">Tidak ada transaksi yang ditemukan</p>
                                                <p className="text-xs">Coba ubah kata kunci pencarian atau pilih periode bulan lain.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedJournals.map(j => (
                                        <tr key={j.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-8 py-4">
                                                <p className="font-bold text-blue-600 text-xs">{j.id}</p>
                                                <p className="text-slate-500 text-xs font-medium">{formatTanggal(j.date)}</p>
                                            </td>
                                            <td className="px-8 py-4">
                                                <p className="font-bold text-slate-800 text-sm">{j.description}</p>
                                                <div className="flex gap-2 mt-1 items-center">
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{programs.find(p => p.id === j.programId)?.name || 'Umum'}</p>
                                                    {j.entries?.some(e => !e.accountId) && (
                                                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
                                                            <AlertTriangle size={10} /> Menunggu COA
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-8 py-4 text-right font-black text-slate-800">
                                                <CurrencyDisplay value={(j.entries || []).reduce((s, e) => s + (e.debit || 0), 0)} />
                                            </td>
                                            <td className="px-8 py-4">
                                                <div className="flex justify-center gap-2">
                                                    <button onClick={() => handleEdit(j)} className="p-2 text-slate-300 hover:text-blue-600 transition-all" title="Edit Jurnal"><Pencil size={16}/></button>
                                                    <button onClick={() => handleDelete(j.id)} className="p-2 text-slate-300 hover:text-rose-600 transition-all" title="Hapus Jurnal"><Trash2 size={16}/></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>

                        {/* Pagination Bar */}
                        <div className="px-8 py-4 bg-slate-50/70 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                                <span>
                                    Menampilkan <strong className="text-slate-700 font-bold">{filteredJournals.length === 0 ? 0 : startIndex + 1} - {Math.min(startIndex + pageSize, filteredJournals.length)}</strong> dari <strong className="text-slate-700 font-bold">{filteredJournals.length}</strong> transaksi
                                </span>
                                <span className="text-slate-300">|</span>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Per hal:</span>
                                    <select 
                                        value={pageSize} 
                                        onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                                        className="bg-white border border-slate-200 text-xs font-bold rounded-lg px-2 py-1 outline-none cursor-pointer"
                                    >
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                        <option value={100}>100</option>
                                    </select>
                                </div>
                            </div>

                            {totalPages > 1 && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 transition-all"
                                        title="Halaman Sebelumnya"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    
                                    <span className="text-xs font-bold text-slate-700 px-2">
                                        Halaman {currentPage} dari {totalPages}
                                    </span>

                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 transition-all"
                                        title="Halaman Selanjutnya"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
