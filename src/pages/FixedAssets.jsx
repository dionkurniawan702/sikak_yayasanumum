import { useState, useMemo, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatRupiah, formatTanggal, generateId } from '../utils/format';
import { hitungNilaiBuku, hitungTotalPenyusutan } from '../utils/depreciation';
import { 
    Plus, X, Trash2, Tag, Calendar, Pencil, Download, Upload, 
    FileSpreadsheet, Search, Filter, ShieldCheck, Landmark, 
    Sparkles, RefreshCw, CheckCircle2, AlertTriangle, AlertCircle, 
    Building2, Settings, Store, UserCheck, MapPin, Layers
} from 'lucide-react';
import * as XLSX from 'xlsx';
import CurrencyDisplay from '../components/CurrencyDisplay';
import { api } from '../services/api';

export default function FixedAssets() {
    const { state, dispatch } = useApp();
    const { 
        assets = [], 
        assetCategories = [], 
        assetVendors = [], 
        assetRooms = [], 
        assetPics = [],
        units = [],
        accounts = [],
        currentUser
    } = state;

    const isSuperAdmin = currentUser?.role === 'superadmin';
    const myUnitId = currentUser?.unitId;

    // Filters
    const [search, setSearch] = useState('');
    const [filterCategory, setFilterCategory] = useState('ALL');
    const [filterFundSource, setFilterFundSource] = useState('ALL');
    const [filterCondition, setFilterCondition] = useState('ALL');
    const [filterUnit, setFilterUnit] = useState(isSuperAdmin ? 'ALL' : (myUnitId || 'ALL'));

    // Modal
    const [showModal, setShowModal] = useState(false);
    const [editingAsset, setEditingAsset] = useState(null);
    const fileInputRef = useRef(null);

    // Initial Form State
    const defaultForm = {
        code: '',
        name: '',
        brand: '',
        vendor: '',
        acquisitionDate: new Date().toISOString().slice(0, 10),
        acquisitionStatus: 'Beli Baru',
        cost: '',
        residualValue: '0',
        economicLife: '4',
        pic: '',
        category: assetCategories[0]?.name || 'Furnitur',
        fundSource: 'Yayasan',
        condition: 'BAIK',
        unitId: myUnitId || (units[0]?.id || ''),
        assetRoom: '',
        description: ''
    };

    const [form, setForm] = useState(defaultForm);

    // Filtered Assets
    const filteredAssets = useMemo(() => {
        const q = search.toLowerCase();
        return (assets || [])
            .filter(a => !a.isDeleted)
            .filter(a => {
                // Search
                const matchSearch = !q || 
                    (a.code || '').toLowerCase().includes(q) ||
                    (a.name || '').toLowerCase().includes(q) ||
                    (a.brand || '').toLowerCase().includes(q) ||
                    (a.vendor || '').toLowerCase().includes(q) ||
                    (a.pic || '').toLowerCase().includes(q) ||
                    (a.category || '').toLowerCase().includes(q);

                // Category Filter
                const matchCategory = filterCategory === 'ALL' || a.category === filterCategory;

                // Fund Source Filter
                const matchFund = filterFundSource === 'ALL' || (a.fundSource || 'Yayasan').toUpperCase() === filterFundSource.toUpperCase();

                // Condition Filter
                const matchCondition = filterCondition === 'ALL' || (a.condition || 'BAIK').toUpperCase() === filterCondition.toUpperCase();

                // Unit Filter
                const matchUnit = filterUnit === 'ALL' || a.unitId === filterUnit;

                return matchSearch && matchCategory && matchFund && matchCondition && matchUnit;
            })
            .sort((a, b) => new Date(b.acquisitionDate || 0) - new Date(a.acquisitionDate || 0));
    }, [assets, search, filterCategory, filterFundSource, filterCondition, filterUnit]);

    // Summary Calculations
    const totalCount = filteredAssets.length;
    const totalCost = filteredAssets.reduce((s, a) => s + (parseFloat(a.cost) || 0), 0);
    const totalBookValue = filteredAssets.reduce((s, a) => s + hitungNilaiBuku(a), 0);
    const goodConditionCount = filteredAssets.filter(a => (a.condition || 'BAIK').toUpperCase() === 'BAIK').length;
    const yayasanCount = filteredAssets.filter(a => (a.fundSource || 'Yayasan').toUpperCase() === 'YAYASAN').length;
    const bosCount = filteredAssets.filter(a => (a.fundSource || '').toUpperCase() === 'BOS').length;

    // Helper: Generate Asset Code
    const generateAssetCode = (catName, targetUnitId, acqDate) => {
        const prefix = 'DEI';
        
        // Find unit code
        let unitCode = 'MIT';
        const targetUnit = units.find(u => u.id === targetUnitId);
        if (targetUnit && targetUnit.name) {
            const uName = targetUnit.name.toUpperCase();
            if (uName.includes('SMPIT')) unitCode = 'SMPIT';
            else if (uName.includes('SDIT 1') || uName.includes('SDIT1')) unitCode = 'SDIT1';
            else if (uName.includes('SDIT 2') || uName.includes('SDIT2')) unitCode = 'SDIT2';
            else if (uName.includes('TKIT 1') || uName.includes('TKIT1')) unitCode = 'TKIT1';
            else if (uName.includes('TKIT 2') || uName.includes('TKIT2')) unitCode = 'TKIT2';
            else if (uName.includes('TAUD')) unitCode = 'TAUD';
            else if (uName.includes('MIT')) unitCode = 'MIT';
            else unitCode = uName.replace(/[^A-Z0-9]/g, '').slice(0, 5) || 'YYS';
        }

        // Find category code
        let catCode = 'FU';
        const foundCat = assetCategories.find(c => c.name?.toLowerCase() === (catName || '').toLowerCase());
        if (foundCat && foundCat.code) {
            catCode = foundCat.code.toUpperCase();
        } else if (catName) {
            catCode = catName.slice(0, 3).toUpperCase();
        }

        // Year
        const year = acqDate ? new Date(acqDate).getFullYear() : new Date().getFullYear();

        // Find max sequence number for this prefix pattern
        const codePattern = `${prefix}.${unitCode}.${catCode}.${year}.`;
        let maxSeq = 0;
        (assets || []).forEach(a => {
            if (a.code && a.code.startsWith(codePattern)) {
                const parts = a.code.split('.');
                const lastNum = parseInt(parts[parts.length - 1], 10);
                if (!isNaN(lastNum) && lastNum > maxSeq) {
                    maxSeq = lastNum;
                }
            }
        });

        const nextSeq = String(maxSeq + 1).padStart(4, '0');
        return `${prefix}.${unitCode}.${catCode}.${year}.${nextSeq}`;
    };

    // Open Modal Tambah
    const handleOpenAdd = () => {
        setEditingAsset(null);
        const initialUnitId = myUnitId || (units[0]?.id || '');
        const initialCat = assetCategories[0]?.name || 'Furnitur';
        const initialDate = new Date().toISOString().slice(0, 10);

        // find default economic life for category
        const catObj = assetCategories.find(c => c.name === initialCat);
        const defaultEco = catObj ? String(catObj.economicLife ?? 4) : '4';

        setForm({
            ...defaultForm,
            unitId: initialUnitId,
            category: initialCat,
            code: '',
            economicLife: defaultEco,
            acquisitionDate: initialDate
        });
        setShowModal(true);
    };

    // Open Modal Edit
    const handleOpenEdit = (asset) => {
        setEditingAsset(asset);
        setForm({
            code: asset.code || '',
            name: asset.name || '',
            brand: asset.brand || '',
            vendor: asset.vendor || '',
            acquisitionDate: asset.acquisitionDate ? asset.acquisitionDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
            acquisitionStatus: asset.acquisitionStatus || 'Beli Baru',
            cost: asset.cost !== undefined ? String(asset.cost) : '',
            residualValue: asset.residualValue !== undefined ? String(asset.residualValue) : '0',
            economicLife: asset.economicLife !== undefined ? String(asset.economicLife) : (asset.usefulLifeMonths ? String(Math.round(asset.usefulLifeMonths / 12)) : '4'),
            pic: asset.pic || '',
            category: asset.category || (assetCategories[0]?.name || 'Furnitur'),
            fundSource: asset.fundSource || 'Yayasan',
            condition: asset.condition || 'BAIK',
            unitId: asset.unitId || myUnitId || '',
            assetRoom: asset.assetRoom || asset.room || '',
            description: asset.description || ''
        });
        setShowModal(true);
    };

    // Handle form change without touching code
    const handleCategoryChange = (newCat) => {
        const catObj = assetCategories.find(c => c.name === newCat);
        const newEco = catObj ? String(catObj.economicLife ?? 4) : form.economicLife;
        setForm({
            ...form,
            category: newCat,
            economicLife: newEco
        });
    };

    const handleUnitChange = (newUnitId) => {
        setForm({
            ...form,
            unitId: newUnitId
        });
    };

    const handleDateChange = (newDate) => {
        setForm({
            ...form,
            acquisitionDate: newDate
        });
    };

    // Save Asset
    const handleSaveAsset = (e) => {
        e.preventDefault();
        if (!form.name.trim()) return alert('Nama aset wajib diisi!');
        if (!form.code.trim()) return alert('Kode aset wajib diisi!');

        const costVal = parseFloat(form.cost) || 0;
        const ecoVal = parseInt(form.economicLife, 10) || 0;
        const resVal = parseFloat(form.residualValue) || 0;

        const payload = {
            id: editingAsset ? editingAsset.id : generateId('AST'),
            code: form.code.trim(),
            name: form.name.trim(),
            brand: form.brand.trim() || '-',
            vendor: form.vendor.trim() || '-',
            acquisitionDate: form.acquisitionDate,
            acquisitionStatus: form.acquisitionStatus || 'Beli Baru',
            cost: costVal,
            residualValue: resVal,
            economicLife: ecoVal,
            usefulLifeMonths: ecoVal * 12,
            pic: form.pic.trim() || '-',
            category: form.category || 'Furnitur',
            fundSource: form.fundSource || 'Yayasan',
            condition: form.condition || 'BAIK',
            unitId: form.unitId || null,
            assetRoom: form.assetRoom.trim() || '',
            description: form.description.trim() || '',
            status: 'Tersedia'
        };

        if (editingAsset) {
            dispatch({ type: 'EDIT_ASSET', payload });
            api.pushAction({ type: 'EDIT_ASSET', payload }, state);
        } else {
            dispatch({ type: 'ADD_ASSET', payload });
            api.pushAction({ type: 'ADD_ASSET', payload }, state);
        }

        setShowModal(false);
        setEditingAsset(null);
    };

    // Delete Asset
    const handleDeleteAsset = (asset) => {
        if (window.confirm(`Apakah Anda yakin ingin menghapus aset "${asset.name}" (${asset.code || asset.id})?`)) {
            dispatch({ type: 'DELETE_ASSET', payload: asset.id });
            api.pushAction({ type: 'DELETE_ASSET', payload: asset.id }, state);
        }
    };

    // Export to Excel (100% Matching User's Columns)
    const exportToExcel = () => {
        if (filteredAssets.length === 0) return alert('Tidak ada data aset untuk diekspor.');

        const rows = filteredAssets.map((a, idx) => ({
            'No': idx + 1,
            'Kode': a.code || '-',
            'Nama': a.name || '-',
            'Merek': a.brand || '-',
            'Vendor': a.vendor || '-',
            'Tanggal Perolehan': a.acquisitionDate ? new Date(a.acquisitionDate).toLocaleDateString('id-ID') : '-',
            'Status Perolehan': a.acquisitionStatus || 'Beli Baru',
            'Harga Perolehan': parseFloat(a.cost || 0),
            'PIC': a.pic || '-',
            'Kategori': a.category || '-',
            'Sumber Dana': a.fundSource || 'Yayasan',
            'Kondisi': a.condition || 'BAIK'
        }));

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Database Aset');
        XLSX.writeFile(wb, `Database_Aset_DarElIman_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    // Download Template Excel
    const handleDownloadTemplate = () => {
        const sampleRows = [
            {
                'No': 1,
                'Kode': 'DEI.MIT.FU.2026.0001',
                'Nama': 'Lemari Arsip Besi',
                'Merek': 'Damuzhi',
                'Vendor': 'Azia Furnitur',
                'Tanggal Perolehan': '2026-08-19',
                'Status Perolehan': 'Beli Baru',
                'Harga Perolehan': 1500000,
                'PIC': 'Novi Hendri',
                'Kategori': 'Furnitur',
                'Sumber Dana': 'Yayasan',
                'Kondisi': 'BAIK'
            },
            {
                'No': 2,
                'Kode': 'DEI.MIT.EL.2026.0001',
                'Nama': 'Laptop Guru',
                'Merek': 'Acer',
                'Vendor': 'Max-Indo',
                'Tanggal Perolehan': '2026-07-15',
                'Status Perolehan': 'Beli Baru',
                'Harga Perolehan': 8799000,
                'PIC': 'Novi Hendri',
                'Kategori': 'Elektronik',
                'Sumber Dana': 'BOS',
                'Kondisi': 'BAIK'
            }
        ];

        const ws = XLSX.utils.json_to_sheet(sampleRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template Import Aset');
        XLSX.writeFile(wb, 'Template_Import_Database_Aset.xlsx');
    };

    // Import from Excel
    const handleImportExcel = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                if (!data || data.length === 0) {
                    return alert('File Excel kosong atau format tidak sesuai!');
                }

                let importedCount = 0;
                const newAssets = [];

                data.forEach((row, idx) => {
                    // Flexible key mapping
                    const getCol = (possibleNames) => {
                        for (const name of possibleNames) {
                            if (row[name] !== undefined) return row[name];
                            const trimmed = Object.keys(row).find(k => k.trim().toLowerCase() === name.toLowerCase());
                            if (trimmed) return row[trimmed];
                        }
                        return null;
                    };

                    const nama = getCol(['Nama', 'Nama Aset', 'Nama Barang']);
                    if (!nama) return; // skip row without name

                    const kode = getCol(['Kode', 'Kode Aset', 'Kode Inventaris']) || '-';
                    const merek = getCol(['Merek', 'Merk', 'Brand']) || '-';
                    const vendor = getCol(['Vendor', 'Toko', 'Supplier']) || '-';
                    
                    // Parse date
                    let tgl = getCol(['Tanggal Perolehan', 'Tanggal Peroleha', 'Tanggal', 'Tgl']);
                    let formattedDate = new Date().toISOString().slice(0, 10);
                    if (tgl) {
                        if (typeof tgl === 'number') {
                            // Excel serial date
                            const excelEpoch = new Date(1899, 11, 30);
                            const d = new Date(excelEpoch.getTime() + tgl * 86400000);
                            formattedDate = d.toISOString().slice(0, 10);
                        } else if (typeof tgl === 'string') {
                            if (tgl.includes('/')) {
                                const parts = tgl.split('/');
                                if (parts.length === 3) {
                                    // DD/MM/YYYY or D/M/YYYY
                                    const d = parseInt(parts[0], 10);
                                    const m = parseInt(parts[1], 10) - 1;
                                    const y = parseInt(parts[2], 10);
                                    const dateObj = new Date(y, m, d);
                                    if (!isNaN(dateObj.getTime())) formattedDate = dateObj.toISOString().slice(0, 10);
                                }
                            } else {
                                const dateObj = new Date(tgl);
                                if (!isNaN(dateObj.getTime())) formattedDate = dateObj.toISOString().slice(0, 10);
                            }
                        }
                    }

                    const statusPerolehan = getCol(['Status Perolehan', 'Status', 'Perolehan']) || 'Beli Baru';
                    const harga = parseFloat(getCol(['Harga Perolehan', 'Harga Peroleh', 'Harga', 'Biaya', 'Cost']) || 0);
                    const pic = getCol(['PIC', 'Penanggung Jawab', 'Pemegang']) || '-';
                    const kategori = getCol(['Kategori', 'Kategori Aset', 'Jenis']) || 'Furnitur';
                    const sumberDana = getCol(['Sumber Dana', 'Sumber Da', 'Sumber', 'Dana']) || 'Yayasan';
                    const kondisi = (getCol(['Kondisi', 'Status Kondisi']) || 'BAIK').toUpperCase();

                    newAssets.push({
                        id: generateId('AST'),
                        code: String(kode).trim(),
                        name: String(nama).trim(),
                        brand: String(merek).trim(),
                        vendor: String(vendor).trim(),
                        acquisitionDate: formattedDate,
                        acquisitionStatus: String(statusPerolehan).trim(),
                        cost: isNaN(harga) ? 0 : harga,
                        residualValue: 0,
                        economicLife: 4,
                        usefulLifeMonths: 48,
                        pic: String(pic).trim(),
                        category: String(kategori).trim(),
                        fundSource: String(sumberDana).trim(),
                        condition: kondisi,
                        unitId: myUnitId || (units[0]?.id || null),
                        status: 'Tersedia'
                    });
                    importedCount++;
                });

                if (importedCount > 0) {
                    dispatch({ type: 'IMPORT_ASSETS', payload: newAssets });
                    // Sync each to api
                    newAssets.forEach(item => {
                        api.pushAction({ type: 'ADD_ASSET', payload: item }, state);
                    });
                    alert(`Berhasil mengimpor ${importedCount} data aset ke Database Aset!`);
                } else {
                    alert('Tidak ada data valid yang dapat diimpor. Pastikan header kolom sesuai.');
                }
            } catch (err) {
                console.error('Import Error:', err);
                alert('Gagal mengimpor file Excel: ' + err.message);
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    return (
        <div className="p-8 max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-300">
            {/* Page Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-slate-200/80 pb-6">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center font-black">
                            <Layers size={24} />
                        </div>
                        <div>
                            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Database Aset & Inventaris</h2>
                            <p className="text-slate-500 text-sm font-medium">Buku induk pencatatan inventaris barang fisik seluruh unit Yayasan Dar el-Iman</p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Link ke Pengaturan Aset */}
                    <NavLink
                        to="/anggaran/pengaturan-aset"
                        className="btn bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50 px-4 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 shadow-sm transition-all"
                        title="Buka Menu Pengaturan Aset (Kategori, Vendor, Ruangan, PIC)"
                    >
                        <Settings size={16} />
                        <span>Pengaturan Aset</span>
                    </NavLink>

                    {/* Download Template */}
                    <button
                        onClick={handleDownloadTemplate}
                        className="btn bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition-all"
                        title="Unduh template Excel kosong"
                    >
                        <FileSpreadsheet size={16} className="text-emerald-600" />
                        <span>Template</span>
                    </button>

                    {/* Import Excel */}
                    <label className="btn bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50 px-4 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer">
                        <Upload size={16} />
                        <span>Import Excel</span>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx, .xls"
                            className="hidden"
                            onChange={handleImportExcel}
                        />
                    </label>

                    {/* Export Excel */}
                    <button
                        onClick={exportToExcel}
                        className="btn bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 shadow-sm shadow-emerald-500/20 transition-all"
                    >
                        <Download size={16} />
                        <span>Export Excel</span>
                    </button>

                    {/* Tambah Aset */}
                    <button
                        onClick={handleOpenAdd}
                        className="btn btn-primary px-5 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 shadow-xl shadow-indigo-500/25 active:scale-95 transition-all"
                    >
                        <Plus size={16} />
                        <span>Tambah Aset</span>
                    </button>
                </div>
            </div>

            {/* Quick Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
                        <Layers size={22} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Inventaris</p>
                        <h3 className="text-2xl font-black text-slate-900">{totalCount.toLocaleString('id-ID')} <span className="text-xs font-bold text-slate-400">Unit</span></h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
                        <CheckCircle2 size={22} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kondisi Baik</p>
                        <h3 className="text-2xl font-black text-emerald-600">{goodConditionCount.toLocaleString('id-ID')} <span className="text-xs font-bold text-slate-400">({totalCount > 0 ? Math.round((goodConditionCount / totalCount) * 100) : 0}%)</span></h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black">
                        <Landmark size={22} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sumber Dana</p>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">Yayasan: {yayasanCount}</span>
                            <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">BOS: {bosCount}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-black">
                        <Sparkles size={22} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Nilai Perolehan</p>
                        <h3 className="text-xl font-black text-slate-900">{formatRupiah(totalCost)}</h3>
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap items-center gap-3">
                {/* Search Box */}
                <div className="relative flex-1 min-w-[260px]">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Cari kode, nama barang, merek, vendor, PIC..."
                        className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:bg-white"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            <X size={14} />
                        </button>
                    )}
                </div>

                {/* Filter Kategori */}
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                    <Tag size={14} className="text-slate-400" />
                    <select
                        value={filterCategory}
                        onChange={e => setFilterCategory(e.target.value)}
                        className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                    >
                        <option value="ALL">Semua Kategori</option>
                        {assetCategories.map(c => (
                            <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                    </select>
                </div>

                {/* Filter Sumber Dana */}
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                    <Landmark size={14} className="text-slate-400" />
                    <select
                        value={filterFundSource}
                        onChange={e => setFilterFundSource(e.target.value)}
                        className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                    >
                        <option value="ALL">Semua Sumber Dana</option>
                        <option value="YAYASAN">Yayasan</option>
                        <option value="BOS">BOS</option>
                        <option value="HIBAH">Hibah</option>
                    </select>
                </div>

                {/* Filter Kondisi */}
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                    <CheckCircle2 size={14} className="text-slate-400" />
                    <select
                        value={filterCondition}
                        onChange={e => setFilterCondition(e.target.value)}
                        className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                    >
                        <option value="ALL">Semua Kondisi</option>
                        <option value="BAIK">Baik</option>
                        <option value="RUSAK RINGAN">Rusak Ringan</option>
                        <option value="RUSAK BERAT">Rusak Berat</option>
                    </select>
                </div>

                {/* Filter Unit (Superadmin only) */}
                {isSuperAdmin && (
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                        <Building2 size={14} className="text-slate-400" />
                        <select
                            value={filterUnit}
                            onChange={e => setFilterUnit(e.target.value)}
                            className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer max-w-[160px]"
                        >
                            <option value="ALL">Semua Unit</option>
                            {units.map(u => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Reset Filter */}
                {(search || filterCategory !== 'ALL' || filterFundSource !== 'ALL' || filterCondition !== 'ALL' || (isSuperAdmin && filterUnit !== 'ALL')) && (
                    <button
                        onClick={() => {
                            setSearch('');
                            setFilterCategory('ALL');
                            setFilterFundSource('ALL');
                            setFilterCondition('ALL');
                            if (isSuperAdmin) setFilterUnit('ALL');
                        }}
                        className="text-[10px] font-black text-rose-500 hover:text-rose-700 uppercase tracking-widest px-2"
                    >
                        Reset
                    </button>
                )}
            </div>

            {/* Main Table (Exact 12 Columns from Excel) */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
                <div className="p-6 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h3 className="font-black text-sm uppercase tracking-wider flex items-center gap-2">
                            <Layers size={16} className="text-indigo-400" />
                            <span>Daftar Aset & Inventaris Yayasan</span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">Menampilkan seluruh data sesuai struktur 12 kolom inventaris resmi</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-indigo-300 bg-indigo-500/20 px-3 py-1 rounded-xl border border-indigo-500/30">
                            {filteredAssets.length} Barang Terdata
                        </span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1200px]">
                        <thead>
                            <tr className="border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/70">
                                <th className="py-4 px-3 w-12 text-center">No</th>
                                <th className="py-4 px-4 min-w-[160px]">Kode</th>
                                <th className="py-4 px-4 min-w-[200px]">Nama</th>
                                <th className="py-4 px-3 min-w-[120px]">Merek</th>
                                <th className="py-4 px-3 min-w-[130px]">Vendor</th>
                                <th className="py-4 px-3 min-w-[110px]">Tanggal Perolehan</th>
                                <th className="py-4 px-3 text-center min-w-[110px]">Status Perolehan</th>
                                <th className="py-4 px-4 text-right min-w-[130px]">Harga Perolehan</th>
                                <th className="py-4 px-3 min-w-[130px]">PIC</th>
                                <th className="py-4 px-3 text-center min-w-[110px]">Kategori</th>
                                <th className="py-4 px-3 text-center min-w-[100px]">Sumber Dana</th>
                                <th className="py-4 px-3 text-center min-w-[110px]">Kondisi</th>
                                <th className="py-4 px-3 text-center w-24">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                            {filteredAssets.length > 0 ? filteredAssets.map((asset, idx) => {
                                const isGood = (asset.condition || 'BAIK').toUpperCase() === 'BAIK';
                                const isWarning = (asset.condition || '').toUpperCase().includes('RINGAN');
                                const isBad = (asset.condition || '').toUpperCase().includes('BERAT');

                                const isYayasan = (asset.fundSource || 'Yayasan').toUpperCase() === 'YAYASAN';
                                const isBOS = (asset.fundSource || '').toUpperCase() === 'BOS';

                                return (
                                    <tr key={asset.id} className="hover:bg-indigo-50/30 transition-colors">
                                        {/* 1. No */}
                                        <td className="py-4 px-3 text-center font-bold text-slate-400">{idx + 1}</td>

                                        {/* 2. Kode */}
                                        <td className="py-4 px-4">
                                            <span className="font-mono font-black text-indigo-700 bg-indigo-50/80 px-2 py-1 rounded-md border border-indigo-100 tracking-tight text-[11px]">
                                                {asset.code || '-'}
                                            </span>
                                        </td>

                                        {/* 3. Nama */}
                                        <td className="py-4 px-4">
                                            <p className="font-black text-slate-800 text-xs leading-snug">{asset.name}</p>
                                            {asset.assetRoom && (
                                                <p className="text-[10px] text-slate-400 font-semibold flex items-center gap-1 mt-0.5">
                                                    <MapPin size={10} /> {asset.assetRoom}
                                                </p>
                                            )}
                                        </td>

                                        {/* 4. Merek */}
                                        <td className="py-4 px-3 font-semibold text-slate-600">
                                            {asset.brand || '—'}
                                        </td>

                                        {/* 5. Vendor */}
                                        <td className="py-4 px-3 text-slate-600 font-medium">
                                            {asset.vendor || '—'}
                                        </td>

                                        {/* 6. Tanggal Perolehan */}
                                        <td className="py-4 px-3 text-slate-600 font-semibold">
                                            {asset.acquisitionDate ? formatTanggal(asset.acquisitionDate) : '—'}
                                        </td>

                                        {/* 7. Status Perolehan */}
                                        <td className="py-4 px-3 text-center">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-600 border border-slate-200">
                                                {asset.acquisitionStatus || 'Beli Baru'}
                                            </span>
                                        </td>

                                        {/* 8. Harga Perolehan */}
                                        <td className="py-4 px-4 text-right font-black text-slate-800 font-mono">
                                            {formatRupiah(parseFloat(asset.cost || 0))}
                                        </td>

                                        {/* 9. PIC */}
                                        <td className="py-4 px-3 text-slate-700 font-bold">
                                            {asset.pic || '—'}
                                        </td>

                                        {/* 10. Kategori */}
                                        <td className="py-4 px-3 text-center">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-slate-100 text-slate-700 border border-slate-200 uppercase tracking-wider">
                                                {asset.category || 'Furnitur'}
                                            </span>
                                        </td>

                                        {/* 11. Sumber Dana */}
                                        <td className="py-4 px-3 text-center">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                                isYayasan ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                                isBOS ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                'bg-amber-50 text-amber-700 border-amber-200'
                                            }`}>
                                                {asset.fundSource || 'Yayasan'}
                                            </span>
                                        </td>

                                        {/* 12. Kondisi */}
                                        <td className="py-4 px-3 text-center">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                                isGood ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                isWarning ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                'bg-rose-50 text-rose-700 border-rose-200'
                                            }`}>
                                                {asset.condition || 'BAIK'}
                                            </span>
                                        </td>

                                        {/* Aksi */}
                                        <td className="py-4 px-3 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() => handleOpenEdit(asset)}
                                                    className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors"
                                                    title="Ubah Aset"
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteAsset(asset)}
                                                    className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors"
                                                    title="Hapus Aset"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan={13} className="py-16 text-center text-slate-400 font-medium italic">
                                        <Layers size={36} className="mx-auto mb-2 text-slate-300" />
                                        <p>{search ? 'Tidak ada aset yang cocok dengan filter pencarian.' : 'Belum ada data inventaris aset. Klik "Tambah Aset" atau "Import Excel" untuk memulai.'}</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL FORM TAMBAH / EDIT ASET */}
            {showModal && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
                    <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden border border-slate-100 my-8">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
                                    <Layers size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-900">
                                        {editingAsset ? 'Ubah Data Aset' : 'Tambah Aset Baru'}
                                    </h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Database Inventaris Yayasan</p>
                                </div>
                            </div>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body Form */}
                        <form onSubmit={handleSaveAsset} className="p-6 space-y-5">
                            {/* Baris 1: Kategori & Unit */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                                        Kategori Aset <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        value={form.category}
                                        onChange={e => handleCategoryChange(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                                        required
                                    >
                                        {assetCategories.map(c => (
                                            <option key={c.id} value={c.name}>{c.name} ({c.code || 'KAT'})</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                                        Unit Pemilik <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        value={form.unitId}
                                        onChange={e => handleUnitChange(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                                    >
                                        {units.map(u => (
                                            <option key={u.id} value={u.id}>{u.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Baris 2: Kode Aset & Tanggal Perolehan */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                                        Kode Aset / Inventaris <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={form.code}
                                        onChange={e => setForm({ ...form, code: e.target.value })}
                                        placeholder="Contoh: DEI.MIT.FU.2019.0064"
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                                        Tanggal Perolehan <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={form.acquisitionDate}
                                        onChange={e => handleDateChange(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Baris 3: Nama Barang & Merek */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                                        Nama Barang / Aset <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={form.name}
                                        onChange={e => setForm({ ...form, name: e.target.value })}
                                        placeholder="Contoh: Kursi Siswa Jacob Abu-abu, Lemari Arsip Besi"
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                                        Merek / Brand
                                    </label>
                                    <input
                                        type="text"
                                        value={form.brand}
                                        onChange={e => setForm({ ...form, brand: e.target.value })}
                                        placeholder="Informa, Sharp, Acer..."
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                                    />
                                </div>
                            </div>

                            {/* Baris 4: Vendor & Lokasi Ruangan */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                                        Vendor / Toko Rekanan
                                    </label>
                                    <input
                                        type="text"
                                        list="vendor-options"
                                        value={form.vendor}
                                        onChange={e => setForm({ ...form, vendor: e.target.value })}
                                        placeholder="Pilih atau ketik vendor..."
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                                    />
                                    <datalist id="vendor-options">
                                        {assetVendors.map(v => (
                                            <option key={v.id} value={v.name} />
                                        ))}
                                    </datalist>
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                                        Ruangan / Lokasi Penempatan
                                    </label>
                                    <input
                                        type="text"
                                        list="room-options"
                                        value={form.assetRoom}
                                        onChange={e => setForm({ ...form, assetRoom: e.target.value })}
                                        placeholder="Ruang TU, Ruang Guru, Lab..."
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                                    />
                                    <datalist id="room-options">
                                        {assetRooms.map(r => (
                                            <option key={r.id} value={r.name} />
                                        ))}
                                    </datalist>
                                </div>
                            </div>

                            {/* Baris 5: Harga Perolehan, Status Perolehan & Sumber Dana */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                                        Harga Perolehan (Rp) <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={form.cost}
                                        onChange={e => setForm({ ...form, cost: e.target.value })}
                                        placeholder="Contoh: 1500000"
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none focus:border-indigo-500 focus:bg-white font-mono"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                                        Status Perolehan
                                    </label>
                                    <select
                                        value={form.acquisitionStatus}
                                        onChange={e => setForm({ ...form, acquisitionStatus: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                                    >
                                        <option value="Beli Baru">Beli Baru</option>
                                        <option value="Hibah">Hibah</option>
                                        <option value="Beli Bekas">Beli Bekas</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                                        Sumber Dana
                                    </label>
                                    <select
                                        value={form.fundSource}
                                        onChange={e => setForm({ ...form, fundSource: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                                    >
                                        <option value="Yayasan">Yayasan</option>
                                        <option value="BOS">BOS</option>
                                        <option value="Hibah">Hibah</option>
                                        <option value="Lainnya">Lainnya</option>
                                    </select>
                                </div>
                            </div>

                            {/* Baris 6: PIC & Kondisi */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                                        PIC / Penanggung Jawab
                                    </label>
                                    <input
                                        type="text"
                                        list="pic-options"
                                        value={form.pic}
                                        onChange={e => setForm({ ...form, pic: e.target.value })}
                                        placeholder="Pilih atau ketik nama PIC..."
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                                    />
                                    <datalist id="pic-options">
                                        {assetPics.map(p => (
                                            <option key={p.id} value={p.name} />
                                        ))}
                                    </datalist>
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                                        Kondisi Fisik Barang
                                    </label>
                                    <select
                                        value={form.condition}
                                        onChange={e => setForm({ ...form, condition: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                                    >
                                        <option value="BAIK">BAIK</option>
                                        <option value="RUSAK RINGAN">RUSAK RINGAN</option>
                                        <option value="RUSAK BERAT">RUSAK BERAT</option>
                                    </select>
                                </div>
                            </div>

                            {/* Baris 7: Masa Manfaat (Penyusutan Akuntansi) */}
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                                        Masa Manfaat (Tahun)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={form.economicLife}
                                        onChange={e => setForm({ ...form, economicLife: e.target.value })}
                                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
                                    />
                                    <span className="text-[9px] text-slate-400">Untuk penyusutan buku akuntansi</span>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                                        Nilai Residu (Rp)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={form.residualValue}
                                        onChange={e => setForm({ ...form, residualValue: e.target.value })}
                                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 font-mono"
                                    />
                                    <span className="text-[9px] text-slate-400">Nilai sisa perkiraan aset</span>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-6 py-2.5 text-xs font-black text-slate-400 uppercase tracking-wider hover:text-slate-600"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary px-8 py-2.5 rounded-xl text-xs font-black shadow-xl shadow-indigo-500/25"
                                >
                                    {editingAsset ? 'Simpan Perubahan' : 'Tambahkan Aset'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
