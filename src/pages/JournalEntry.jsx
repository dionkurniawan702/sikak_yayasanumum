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
    const [historyProgramFilter, setHistoryProgramFilter] = useState('ALL');
    const [historyAccountFilter, setHistoryAccountFilter] = useState('ALL');
    const [selectedPeriod, setSelectedPeriod] = useState('LATEST_500'); // 'LATEST_500' | 'YYYY-MM'
    const [monthJournals, setMonthJournals] = useState([]);
    const [monthTotalCount, setMonthTotalCount] = useState(null);
    const [isLoadingPeriod, setIsLoadingPeriod] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);

    // Enhanced Export State (Rentang Tanggal, Filter Akun, Unit, Program, dan Rincian Permintaan Dana)
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [exportFormat, setExportFormat] = useState('DETAILED'); // 'DETAILED' | 'SUMMARY'
    const [exportPreset, setExportPreset] = useState('THIS_ACADEMIC_YEAR');
    const [exportStartDate, setExportStartDate] = useState('');
    const [exportEndDate, setExportEndDate] = useState('');
    const [exportAccountId, setExportAccountId] = useState('ALL');
    const [exportAccountPosition, setExportAccountPosition] = useState('ALL'); // 'ALL' | 'DEBIT' | 'CREDIT'
    const [exportProgramId, setExportProgramId] = useState('ALL');
    const [exportUnitId, setExportUnitId] = useState('ALL');
    const [exportIncludeBudget, setExportIncludeBudget] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [exportError, setExportError] = useState(null);

    const applyDatePreset = (preset) => {
        setExportPreset(preset);
        setExportError(null);
        const now = new Date();
        const curYear = now.getFullYear();
        const curMonth = now.getMonth() + 1; // 1-12

        if (preset === 'THIS_MONTH') {
            const start = `${curYear}-${String(curMonth).padStart(2, '0')}-01`;
            const lastDay = new Date(curYear, curMonth, 0).getDate();
            const end = `${curYear}-${String(curMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            setExportStartDate(start);
            setExportEndDate(end);
        } else if (preset === 'LAST_MONTH') {
            let prevYear = curYear;
            let prevMonth = curMonth - 1;
            if (prevMonth === 0) {
                prevMonth = 12;
                prevYear -= 1;
            }
            const start = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
            const lastDay = new Date(prevYear, prevMonth, 0).getDate();
            const end = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            setExportStartDate(start);
            setExportEndDate(end);
        } else if (preset === 'THIS_ACADEMIC_YEAR') {
            let ayStartYear = curMonth >= 7 ? curYear : curYear - 1;
            let ayEndYear = ayStartYear + 1;
            setExportStartDate(`${ayStartYear}-07-01`);
            setExportEndDate(`${ayEndYear}-06-30`);
        } else if (preset === 'ALL') {
            setExportStartDate('');
            setExportEndDate('');
        }
    };

    useEffect(() => {
        applyDatePreset('THIS_ACADEMIC_YEAR');
    }, []);

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
            if (historyProgramFilter !== 'ALL') {
                return (j.programId || 'PRG-GEN') === historyProgramFilter;
            }
            return true;
        })
        .filter(j => {
            if (historyAccountFilter !== 'ALL') {
                return (j.entries || []).some(e => e.accountId === historyAccountFilter);
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

    const openExportModal = (format = 'DETAILED') => {
        setExportFormat(format);
        setExportError(null);
        if (historyProgramFilter !== 'ALL') setExportProgramId(historyProgramFilter);
        if (historyAccountFilter !== 'ALL') setExportAccountId(historyAccountFilter);
        setIsExportModalOpen(true);
    };

    const exportHistoryToExcel = () => openExportModal('SUMMARY');
    const exportDetailedHistoryToExcel = () => openExportModal('DETAILED');

    const executeExport = async () => {
        try {
            setIsExporting(true);
            setExportError(null);

            // Construct query URL
            let queryParams = ['includeBudgetDetails=true'];
            if (exportPreset !== 'ALL') {
                if (exportStartDate) queryParams.push(`startDate=${exportStartDate}`);
                if (exportEndDate) queryParams.push(`endDate=${exportEndDate}`);
            }
            if (exportProgramId !== 'ALL') {
                queryParams.push(`programId=${exportProgramId}`);
            }

            const url = `/journals?${queryParams.join('&')}`;
            console.log('[Export] Fetching journals for export with URL:', url);

            let rawJournals = [];
            try {
                const res = await api.get(url);
                rawJournals = res?.data || [];
            } catch (fetchErr) {
                console.warn('[Export] Remote fetch failed, falling back to local state:', fetchErr);
                rawJournals = journals;
            }

            if (!rawJournals || rawJournals.length === 0) {
                setExportError('Tidak ada data jurnal yang ditemukan pada rentang tanggal/periode yang dipilih.');
                setIsExporting(false);
                return;
            }

            // Parse entries
            let processed = rawJournals.map(j => ({
                ...j,
                programId: j.programId || 'PRG-GEN',
                entries: typeof j.entries === 'string' ? JSON.parse(j.entries) : (j.entries || [])
            }));

            // Filter by date if local fallback was used
            if (exportPreset !== 'ALL') {
                if (exportStartDate) {
                    processed = processed.filter(j => j.date && j.date.slice(0, 10) >= exportStartDate);
                }
                if (exportEndDate) {
                    processed = processed.filter(j => j.date && j.date.slice(0, 10) <= exportEndDate);
                }
            }

            // Filter by Program if selected
            if (exportProgramId !== 'ALL') {
                processed = processed.filter(j => (j.programId || 'PRG-GEN') === exportProgramId);
            }

            // Filter by Account (COA) & Position if selected
            if (exportAccountId !== 'ALL') {
                processed = processed.filter(j => {
                    const entries = j.entries || [];
                    if (exportAccountPosition === 'DEBIT') {
                        return entries.some(e => e.accountId === exportAccountId && (parseFloat(e.debit) || 0) > 0);
                    }
                    if (exportAccountPosition === 'CREDIT') {
                        return entries.some(e => e.accountId === exportAccountId && (parseFloat(e.credit) || 0) > 0);
                    }
                    return entries.some(e => e.accountId === exportAccountId);
                });
            }

            // Filter by Unit if selected
            if (exportUnitId !== 'ALL') {
                const selectedUnitObj = (state.units || []).find(u => u.id === exportUnitId);
                const selectedUnitName = selectedUnitObj?.name?.toLowerCase() || '';
                processed = processed.filter(j => {
                    const jName = (j.name || '').toLowerCase();
                    const repUnitId = j.budgetReport?.unitId;
                    const repUnitName = (j.budgetReport?.unitName || '').toLowerCase();
                    return (
                        repUnitId === exportUnitId ||
                        (selectedUnitName && repUnitName.includes(selectedUnitName)) ||
                        (selectedUnitName && jName.includes(selectedUnitName))
                    );
                });
            }

            if (processed.length === 0) {
                setExportError('Tidak ada data jurnal yang cocok dengan filter yang dipilih.');
                setIsExporting(false);
                return;
            }

            // Sort descending by date
            processed.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

            // Generate filename based on filters
            const dateTag = exportPreset === 'ALL' 
                ? 'Semua-Periode' 
                : `${exportStartDate || 'Awal'}_sd_${exportEndDate || 'Akhir'}`;

            if (exportFormat === 'DETAILED') {
                // DETAILED EXPORT - 1 BARIS PER TRANSAKSI (DEBIT & KREDIT SEJAJAR)
                const detailedRows = [];
                let rowNumber = 1;

                processed.forEach(j => {
                    const progName = programs.find(p => p.id === j.programId)?.name || 'Umum';
                    // Enrichment fallback from local state if budgetReport/budgetRequest is missing
                    const rep = j.budgetReport || (state.budgetReports || []).find(r => r.journalId === j.id);
                    const req = j.budgetRequest || (rep?.budgetRequestId ? (state.budgetRequests || []).find(rq => rq.id === rep.budgetRequestId) : null);
                    const unitName = rep?.unitName || (rep?.unitId ? (state.units || []).find(u => u.id === rep.unitId)?.name : null) || j.name || '-';
                    const expName = rep?.expenseItemName || (rep?.expenseItemId ? (state.expenseItems || []).find(ei => ei.id === rep.expenseItemId)?.name : null) || '-';

                    const debits = (j.entries || []).filter(e => (parseFloat(e.debit) || 0) > 0);
                    const credits = (j.entries || []).filter(e => (parseFloat(e.credit) || 0) > 0);

                    // Resolve Debit Account(s)
                    let debitCode = '-';
                    let debitName = '-';
                    let debitAmount = 0;

                    if (debits.length === 1) {
                        const acc = accounts.find(a => a.id === debits[0].accountId);
                        debitCode = acc?.code || debits[0].accountId || '-';
                        debitName = acc?.name || debits[0].accountName || '-';
                        debitAmount = parseFloat(debits[0].debit) || 0;
                    } else if (debits.length > 1) {
                        debitCode = debits.map(d => {
                            const acc = accounts.find(a => a.id === d.accountId);
                            return acc?.code || d.accountId || '-';
                        }).join('; ');
                        debitName = debits.map(d => {
                            const acc = accounts.find(a => a.id === d.accountId);
                            return `${acc?.name || d.accountName || '-'} (${(parseFloat(d.debit) || 0).toLocaleString('id-ID')})`;
                        }).join('; ');
                        debitAmount = debits.reduce((sum, d) => sum + (parseFloat(d.debit) || 0), 0);
                    }

                    // Resolve Credit Account(s)
                    let creditCode = '-';
                    let creditName = '-';
                    let creditAmount = 0;

                    if (credits.length === 1) {
                        const acc = accounts.find(a => a.id === credits[0].accountId);
                        creditCode = acc?.code || credits[0].accountId || '-';
                        creditName = acc?.name || credits[0].accountName || '-';
                        creditAmount = parseFloat(credits[0].credit) || 0;
                    } else if (credits.length > 1) {
                        creditCode = credits.map(c => {
                            const acc = accounts.find(a => a.id === c.accountId);
                            return acc?.code || c.accountId || '-';
                        }).join('; ');
                        creditName = credits.map(c => {
                            const acc = accounts.find(a => a.id === c.accountId);
                            return `${acc?.name || c.accountName || '-'} (${(parseFloat(c.credit) || 0).toLocaleString('id-ID')})`;
                        }).join('; ');
                        creditAmount = credits.reduce((sum, c) => sum + (parseFloat(c.credit) || 0), 0);
                    }

                    const nominalTotal = debitAmount || creditAmount || (j.entries || []).reduce((s, e) => s + (parseFloat(e.debit) || 0), 0);

                    const baseRow = {
                        'No': rowNumber,
                        'Tanggal': j.date ? j.date.split('T')[0] : '',
                        'ID Jurnal': j.id,
                        'Pihak Terkait': j.name || '-',
                        'Deskripsi Transaksi': j.description || '-',
                        'No Referensi': j.reference || '-',
                        'Program': progName,
                        'Kode Akun Debit': debitCode,
                        'Nama Akun Debit': debitName,
                        'Kode Akun Kredit': creditCode,
                        'Nama Akun Kredit': creditName,
                        'Nominal (Rp)': nominalTotal
                    };

                    if (exportIncludeBudget) {
                        // Resolve precise Rincian Pengeluaran / Dana Permintaan (from SPJ category or Request Item)
                        let rincianDana = '-';
                        if (rep) {
                            if (rep.category && rep.category !== 'General' && rep.category !== '-') {
                                rincianDana = rep.category;
                            } else if (req) {
                                const reqItems = Array.isArray(req.items) 
                                    ? req.items 
                                    : (typeof req.items === 'string' ? JSON.parse(req.items || '[]') : []);
                                if (reqItems.length > 0) {
                                    const matched = (rep.componentId && reqItems.find(i => (i.componentId || i.id) === rep.componentId))
                                        || (rep.expenseItemId && reqItems.find(i => i.expenseItemId === rep.expenseItemId))
                                        || (reqItems.length === 1 ? reqItems[0] : null);
                                    if (matched?.name) {
                                        rincianDana = matched.name;
                                    }
                                }
                            }
                            if (rincianDana === '-' && rep.description) {
                                rincianDana = rep.description;
                            }
                        }
                        if (rincianDana === '-' && req?.description) {
                            rincianDana = req.description;
                        }
                        if (rincianDana === '-') {
                            rincianDana = j.description || '-';
                        }

                        baseRow['No. Permintaan Dana (Req ID)'] = req?.id || '-';
                        baseRow['Rincian Dana Permintaan'] = rincianDana;
                        baseRow['Unit Pemohon'] = unitName;
                        baseRow['Item Pengeluaran'] = expName;
                        baseRow['No. Nota SPJ'] = rep?.nomorNota || '-';
                        baseRow['Volume'] = rep?.volume ? `${rep.volume} ${rep.satuan || ''}`.trim() : '-';
                        baseRow['Harga Satuan (Rp)'] = rep?.harga || '-';
                        baseRow['Diskon (Rp)'] = rep?.diskon || 0;
                        baseRow['Kategori Aset'] = rep?.kategoriAset || '-';
                    }

                    detailedRows.push(baseRow);
                    rowNumber++;
                });

                const ws = XLSX.utils.json_to_sheet(detailedRows);
                
                // Column widths
                const colWidths = [
                    { wch: 6 },  // No
                    { wch: 12 }, // Tanggal
                    { wch: 18 }, // ID Jurnal
                    { wch: 22 }, // Pihak Terkait
                    { wch: 35 }, // Deskripsi
                    { wch: 18 }, // Referensi
                    { wch: 15 }, // Program
                    { wch: 16 }, // Kode Akun Debit
                    { wch: 30 }, // Nama Akun Debit
                    { wch: 16 }, // Kode Akun Kredit
                    { wch: 30 }, // Nama Akun Kredit
                    { wch: 16 }  // Nominal
                ];

                if (exportIncludeBudget) {
                    colWidths.push(
                        { wch: 25 }, // No Req
                        { wch: 32 }, // Rincian Dana Permintaan
                        { wch: 20 }, // Unit Pemohon
                        { wch: 25 }, // Item Pengeluaran
                        { wch: 18 }, // No Nota
                        { wch: 15 }, // Volume
                        { wch: 16 }, // Harga
                        { wch: 14 }, // Diskon
                        { wch: 16 }  // Kategori Aset
                    );
                }
                ws['!cols'] = colWidths;
                ws['!autofilter'] = { ref: ws['!ref'] };

                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Detail Jurnal 1 Baris');
                XLSX.writeFile(wb, `SIKAD-Detail-Jurnal-${dateTag}.xlsx`);
            } else {
                // SUMMARY EXPORT
                const summaryRows = processed.map((j, idx) => {
                    const progName = programs.find(p => p.id === j.programId)?.name || 'Umum';
                    const rep = j.budgetReport || (state.budgetReports || []).find(r => r.journalId === j.id);
                    const req = j.budgetRequest || (rep?.budgetRequestId ? (state.budgetRequests || []).find(rq => rq.id === rep.budgetRequestId) : null);
                    const unitName = rep?.unitName || (rep?.unitId ? (state.units || []).find(u => u.id === rep.unitId)?.name : null) || j.name || '-';
                    const expName = rep?.expenseItemName || (rep?.expenseItemId ? (state.expenseItems || []).find(ei => ei.id === rep.expenseItemId)?.name : null) || '-';
                    const totalVal = (j.entries || []).reduce((s, e) => s + (e.debit || 0), 0);

                    let rincianDana = '-';
                    if (rep) {
                        if (rep.category && rep.category !== 'General' && rep.category !== '-') {
                            rincianDana = rep.category;
                        } else if (req) {
                            const reqItems = Array.isArray(req.items) 
                                ? req.items 
                                : (typeof req.items === 'string' ? JSON.parse(req.items || '[]') : []);
                            if (reqItems.length > 0) {
                                const matched = (rep.componentId && reqItems.find(i => (i.componentId || i.id) === rep.componentId))
                                    || (rep.expenseItemId && reqItems.find(i => i.expenseItemId === rep.expenseItemId))
                                    || (reqItems.length === 1 ? reqItems[0] : null);
                                if (matched?.name) {
                                    rincianDana = matched.name;
                                }
                            }
                        }
                        if (rincianDana === '-' && rep.description) {
                            rincianDana = rep.description;
                        }
                    }
                    if (rincianDana === '-' && req?.description) {
                        rincianDana = req.description;
                    }
                    if (rincianDana === '-') {
                        rincianDana = j.description || '-';
                    }

                    const row = {
                        'No': idx + 1,
                        'ID Jurnal': j.id,
                        'Tanggal': j.date ? j.date.split('T')[0] : '',
                        'Pihak Terkait': j.name || '-',
                        'Deskripsi': j.description,
                        'Referensi': j.reference || '-',
                        'Program': progName,
                        'Total Transaksi (Rp)': totalVal
                    };

                    if (exportIncludeBudget) {
                        row['No. Permintaan Dana (Req ID)'] = req?.id || '-';
                        row['Rincian Dana Permintaan'] = rincianDana;
                        row['Unit Pemohon'] = unitName;
                        row['Item Pengeluaran'] = expName;
                        row['No. Nota SPJ'] = rep?.nomorNota || '-';
                    }

                    return row;
                });

                const ws = XLSX.utils.json_to_sheet(summaryRows);
                ws['!cols'] = [
                    { wch: 6 },
                    { wch: 18 },
                    { wch: 12 },
                    { wch: 22 },
                    { wch: 35 },
                    { wch: 18 },
                    { wch: 15 },
                    { wch: 18 },
                    { wch: 25 },
                    { wch: 32 },
                    { wch: 20 },
                    { wch: 25 },
                    { wch: 18 }
                ];
                ws['!autofilter'] = { ref: ws['!ref'] };

                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Ringkasan Jurnal');
                XLSX.writeFile(wb, `SIKAD-Ringkasan-Jurnal-${dateTag}.xlsx`);
            }

            // Close modal after success
            setIsExportModalOpen(false);
        } catch (err) {
            console.error('[Export Error]', err);
            setExportError(`Terjadi kesalahan saat mengekspor: ${err.message}`);
        } finally {
            setIsExporting(false);
        }
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

                                                {/* Filter Program */}
                                                <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-2xl px-3 py-2 shadow-sm shrink-0">
                                                    <select 
                                                        className="bg-transparent text-xs font-bold text-slate-700 border-none outline-none cursor-pointer pr-2 max-w-[130px] truncate"
                                                        value={historyProgramFilter}
                                                        onChange={e => { setHistoryProgramFilter(e.target.value); setCurrentPage(1); }}
                                                        title="Filter Berdasarkan Program"
                                                    >
                                                        <option value="ALL">Semua Program</option>
                                                        {programs.map(p => (
                                                            <option key={p.id} value={p.id}>{p.name}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* Filter Akun COA */}
                                                <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-2xl px-3 py-2 shadow-sm shrink-0">
                                                    <select 
                                                        className="bg-transparent text-xs font-bold text-slate-700 border-none outline-none cursor-pointer pr-2 max-w-[150px] truncate"
                                                        value={historyAccountFilter}
                                                        onChange={e => { setHistoryAccountFilter(e.target.value); setCurrentPage(1); }}
                                                        title="Filter Berdasarkan Akun COA"
                                                    >
                                                        <option value="ALL">Semua Akun (COA)</option>
                                                        {detailAccounts.map(a => (
                                                            <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                            
                                            {/* Action Buttons Group */}
                                            <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto justify-start xl:justify-end">
                                                {/* Main Enhanced Export Button */}
                                                <button 
                                                    onClick={() => openExportModal('DETAILED')} 
                                                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-2xl font-black text-[11px] tracking-wide uppercase transition-all shadow-md shadow-emerald-600/20 active:scale-95"
                                                    title="Ekspor Jurnal dengan Filter Tanggal, Akun COA, dan Rincian Permintaan Dana"
                                                >
                                                    <FileSpreadsheet size={15} /> Ekspor Excel (Filter Periode & COA)
                                                </button>

                                                {/* Quick Summary Export */}
                                                <button 
                                                    onClick={() => openExportModal('SUMMARY')} 
                                                    className="flex items-center gap-1.5 bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-2xl font-black text-[10px] tracking-wide uppercase transition-all shadow-sm"
                                                    title="Ekspor Ringkasan Transaksi Jurnal"
                                                >
                                                    <List size={13} /> Ringkasan
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

            {/* Modal Dialog Ekspor Jurnal Lengkap */}
            {isExportModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="px-6 py-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-md">
                                    <FileSpreadsheet size={22} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black tracking-tight">Ekspor Jurnal Umum ke Excel</h3>
                                    <p className="text-xs text-emerald-100 font-medium">Atur rentang tanggal, filter akun, dan rincian belanja</p>
                                </div>
                            </div>
                            <button 
                                type="button"
                                disabled={isExporting}
                                onClick={() => setIsExportModalOpen(false)}
                                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all disabled:opacity-50"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
                            {/* 1. Format Ekspor */}
                            <div>
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block mb-2">
                                    Format Laporan Excel
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setExportFormat('DETAILED')}
                                        className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col gap-1 ${
                                            exportFormat === 'DETAILED' 
                                                ? 'border-emerald-500 bg-emerald-50/60 text-emerald-950 ring-2 ring-emerald-500/20' 
                                                : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                                        }`}
                                    >
                                        <span className="font-black text-xs flex items-center gap-1.5">
                                            <span className={`w-2.5 h-2.5 rounded-full ${exportFormat === 'DETAILED' ? 'bg-emerald-600' : 'bg-slate-300'}`}></span>
                                            Detail 1 Baris (Debit & Kredit Sejajar)
                                        </span>
                                        <span className="text-[11px] text-slate-500 font-medium pl-4">
                                            Akun Debit & Kredit sejajar dalam 1 baris excel (mudah filter & rekap), plus rincian SPJ & Permintaan Dana
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setExportFormat('SUMMARY')}
                                        className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col gap-1 ${
                                            exportFormat === 'SUMMARY' 
                                                ? 'border-emerald-500 bg-emerald-50/60 text-emerald-950 ring-2 ring-emerald-500/20' 
                                                : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                                        }`}
                                    >
                                        <span className="font-black text-xs flex items-center gap-1.5">
                                            <span className={`w-2.5 h-2.5 rounded-full ${exportFormat === 'SUMMARY' ? 'bg-emerald-600' : 'bg-slate-300'}`}></span>
                                            Ringkasan Transaksi
                                        </span>
                                        <span className="text-[11px] text-slate-500 font-medium pl-4">
                                            1 baris per voucher transaksi dengan total nilai mutasi
                                        </span>
                                    </button>
                                </div>
                            </div>

                            {/* 2. Pilihan Rentang Tanggal */}
                            <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100 space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                                        <Calendar size={14} className="text-emerald-600" /> Rentang Tanggal Ekspor
                                    </label>
                                    <span className="text-[11px] text-emerald-700 font-bold bg-emerald-100/70 px-2.5 py-0.5 rounded-full">
                                        Mencegah aplikasi berat
                                    </span>
                                </div>

                                {/* Preset buttons */}
                                <div className="flex flex-wrap gap-1.5">
                                    {[
                                        { id: 'THIS_ACADEMIC_YEAR', label: 'Tahun Ajaran Ini' },
                                        { id: 'THIS_MONTH', label: 'Bulan Ini' },
                                        { id: 'LAST_MONTH', label: 'Bulan Lalu' },
                                        { id: 'ALL', label: 'Semua Riwayat (7.000+)' },
                                        { id: 'CUSTOM', label: 'Kustom' },
                                    ].map(p => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => applyDatePreset(p.id)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                                exportPreset === p.id 
                                                    ? 'bg-emerald-600 text-white shadow-sm' 
                                                    : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                                            }`}
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>

                                {exportPreset !== 'ALL' && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 block mb-1">Dari Tanggal:</label>
                                            <input 
                                                type="date"
                                                value={exportStartDate}
                                                onChange={e => { setExportStartDate(e.target.value); setExportPreset('CUSTOM'); }}
                                                className="form-input w-full rounded-xl text-xs py-2 border-slate-200"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 block mb-1">Sampai Tanggal:</label>
                                            <input 
                                                type="date"
                                                value={exportEndDate}
                                                onChange={e => { setExportEndDate(e.target.value); setExportPreset('CUSTOM'); }}
                                                className="form-input w-full rounded-xl text-xs py-2 border-slate-200"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 3. Filter Spesifik: Kode Akun, Nama Akun COA, Program & Unit */}
                            <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100 space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider">
                                        Filter Akun (COA), Program & Unit
                                    </label>
                                    <span className="text-[10px] text-slate-400 font-bold">
                                        Opsional / Kosongkan jika ingin semua
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {/* Dropdown 1: Kode Akun */}
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 block mb-1">
                                            Pilihan Kode Akun:
                                        </label>
                                        <select
                                            value={exportAccountId}
                                            onChange={e => setExportAccountId(e.target.value)}
                                            className="form-select w-full rounded-xl text-xs py-2 border-slate-200 bg-white"
                                        >
                                            <option value="ALL">Semua Kode Akun</option>
                                            {detailAccounts.map(acc => (
                                                <option key={acc.id} value={acc.id}>
                                                    {acc.code} — {acc.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Dropdown 2: Nama Akun / COA */}
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 block mb-1">
                                            Pilihan Nama Akun (COA):
                                        </label>
                                        <select
                                            value={exportAccountId}
                                            onChange={e => setExportAccountId(e.target.value)}
                                            className="form-select w-full rounded-xl text-xs py-2 border-slate-200 bg-white"
                                        >
                                            <option value="ALL">Semua Nama Akun COA</option>
                                            {groupedAccounts.map(g => (
                                                <optgroup key={g.tipe} label={`--- Kelompok ${g.tipe} ---`}>
                                                    {g.accounts.map(acc => (
                                                        <option key={acc.id} value={acc.id}>
                                                            {acc.name} [{acc.code}]
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Dropdown 3: Program */}
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 block mb-1">
                                            Pilihan Program:
                                        </label>
                                        <select
                                            value={exportProgramId}
                                            onChange={e => setExportProgramId(e.target.value)}
                                            className="form-select w-full rounded-xl text-xs py-2 border-slate-200 bg-white"
                                        >
                                            <option value="ALL">Semua Program</option>
                                            {programs.map(p => (
                                                <option key={p.id} value={p.id}>
                                                    {p.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Dropdown 4: Unit / Satuan */}
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 block mb-1">
                                            Pilihan Unit / Satuan:
                                        </label>
                                        <select
                                            value={exportUnitId}
                                            onChange={e => setExportUnitId(e.target.value)}
                                            className="form-select w-full rounded-xl text-xs py-2 border-slate-200 bg-white"
                                        >
                                            <option value="ALL">Semua Unit / Lembaga</option>
                                            {(state.units || []).filter(u => !u.isDeleted).map(u => (
                                                <option key={u.id} value={u.id}>
                                                    {u.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Opsi Posisi Akun jika akun dipilih */}
                                {exportAccountId !== 'ALL' && (
                                    <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60 mt-1">
                                        <span className="text-[10px] font-bold text-slate-500">Posisi Akun:</span>
                                        {[
                                            { id: 'ALL', label: 'Debit maupun Kredit' },
                                            { id: 'DEBIT', label: 'Hanya Posisi Debit' },
                                            { id: 'CREDIT', label: 'Hanya Posisi Kredit' }
                                        ].map(pos => (
                                            <button
                                                key={pos.id}
                                                type="button"
                                                onClick={() => setExportAccountPosition(pos.id)}
                                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                                    exportAccountPosition === pos.id 
                                                        ? 'bg-emerald-600 text-white shadow-xs' 
                                                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                                                }`}
                                            >
                                                {pos.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* 4. Opsi Rincian Permintaan Dana */}
                            <div className="pt-2">
                                <label className="flex items-start gap-3 p-3.5 bg-blue-50/60 border border-blue-100 rounded-2xl cursor-pointer hover:bg-blue-50 transition-colors">
                                    <input 
                                        type="checkbox"
                                        checked={exportIncludeBudget}
                                        onChange={e => setExportIncludeBudget(e.target.checked)}
                                        className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                                    />
                                    <div className="flex-1 text-xs">
                                        <span className="font-bold text-slate-800 block">Sertakan Kolom Rincian Permintaan Dana & SPJ</span>
                                        <span className="text-[11px] text-slate-500 block mt-0.5">
                                            Menambahkan No. Pengajuan Dana, Rincian Dana Permintaan, Unit Pemohon, Item Pengeluaran, No. Nota SPJ, dan Rincian Barang (Volume &times; Harga) pada transaksi belanja.
                                        </span>
                                    </div>
                                </label>
                            </div>

                            {/* Error Message if any */}
                            {exportError && (
                                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                                    <AlertTriangle size={16} className="shrink-0 text-rose-600" />
                                    <span>{exportError}</span>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-xs text-slate-400 font-medium">
                                {exportPreset === 'ALL' 
                                    ? 'Menyiapkan penarikan seluruh data riwayat' 
                                    : (exportStartDate && exportEndDate ? `Periode: ${exportStartDate} s/d ${exportEndDate}` : 'Pilih tanggal')}
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    disabled={isExporting}
                                    onClick={() => setIsExportModalOpen(false)}
                                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all disabled:opacity-50"
                                >
                                    Batal
                                </button>
                                <button
                                    type="button"
                                    disabled={isExporting}
                                    onClick={executeExport}
                                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2 disabled:opacity-60"
                                >
                                    {isExporting ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            <span>Memproses Ekspor...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Download size={16} />
                                            <span>Unduh File Excel</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
