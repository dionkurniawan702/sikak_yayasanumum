import React, { useState, useMemo } from 'react';
import { 
    Tag, Store, MapPin, UserCheck, Plus, Pencil, Trash2, Search, X, 
    CheckCircle2, AlertCircle, Info, ShieldCheck, Layers, Building2, 
    FileText, Phone, Hash, Clock
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';

export default function AssetSettings() {
    const { state, dispatch } = useApp();
    const { 
        assetCategories = [], 
        assetVendors = [], 
        assetRooms = [], 
        assetPics = [],
        units = [],
        currentUser
    } = state;

    const [activeTab, setActiveTab] = useState('categories'); // 'categories' | 'vendors' | 'rooms' | 'pics'
    const [search, setSearch] = useState('');

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState('category'); // 'category' | 'vendor' | 'room' | 'pic'
    const [editingItem, setEditingItem] = useState(null);

    // Forms
    const [categoryForm, setCategoryForm] = useState({ name: '', code: '', economicLife: '4', description: '' });
    const [vendorForm, setVendorForm] = useState({ name: '', phone: '', address: '', note: '' });
    const [roomForm, setRoomForm] = useState({ name: '', unitId: '', description: '' });
    const [picForm, setPicForm] = useState({ name: '', role: '', unitId: '', phone: '' });

    // Open Add Modal
    const handleOpenAdd = (type) => {
        setModalType(type);
        setEditingItem(null);
        if (type === 'category') setCategoryForm({ name: '', code: '', economicLife: '4', description: '' });
        if (type === 'vendor') setVendorForm({ name: '', phone: '', address: '', note: '' });
        if (type === 'room') setRoomForm({ name: '', unitId: '', description: '' });
        if (type === 'pic') setPicForm({ name: '', role: '', unitId: '', phone: '' });
        setShowModal(true);
    };

    // Open Edit Modal
    const handleOpenEdit = (type, item) => {
        setModalType(type);
        setEditingItem(item);
        if (type === 'category') {
            setCategoryForm({
                name: item.name || '',
                code: item.code || '',
                economicLife: String(item.economicLife ?? 4),
                description: item.description || ''
            });
        } else if (type === 'vendor') {
            setVendorForm({
                name: item.name || '',
                phone: item.phone || '',
                address: item.address || '',
                note: item.note || ''
            });
        } else if (type === 'room') {
            setRoomForm({
                name: item.name || '',
                unitId: item.unitId || '',
                description: item.description || ''
            });
        } else if (type === 'pic') {
            setPicForm({
                name: item.name || '',
                role: item.role || '',
                unitId: item.unitId || '',
                phone: item.phone || ''
            });
        }
        setShowModal(true);
    };

    // Save Handlers
    const handleSaveCategory = (e) => {
        e.preventDefault();
        if (!categoryForm.name.trim() || !categoryForm.code.trim()) {
            return alert('Nama kategori dan kode singkatan wajib diisi!');
        }

        const payload = {
            id: editingItem?.id,
            name: categoryForm.name.trim(),
            code: categoryForm.code.trim().toUpperCase(),
            economicLife: parseInt(categoryForm.economicLife) || 0,
            description: categoryForm.description.trim()
        };

        if (editingItem) {
            dispatch({ type: 'EDIT_ASSET_CATEGORY', payload });
            api.pushAction({ type: 'EDIT_ASSET_CATEGORY', payload }, state);
        } else {
            dispatch({ type: 'ADD_ASSET_CATEGORY', payload });
            api.pushAction({ type: 'ADD_ASSET_CATEGORY', payload }, state);
        }
        setShowModal(false);
    };

    const handleSaveVendor = (e) => {
        e.preventDefault();
        if (!vendorForm.name.trim()) return alert('Nama vendor/toko wajib diisi!');

        const payload = {
            id: editingItem?.id,
            name: vendorForm.name.trim(),
            phone: vendorForm.phone.trim(),
            address: vendorForm.address.trim(),
            note: vendorForm.note.trim()
        };

        if (editingItem) {
            dispatch({ type: 'EDIT_ASSET_VENDOR', payload });
            api.pushAction({ type: 'EDIT_ASSET_VENDOR', payload }, state);
        } else {
            dispatch({ type: 'ADD_ASSET_VENDOR', payload });
            api.pushAction({ type: 'ADD_ASSET_VENDOR', payload }, state);
        }
        setShowModal(false);
    };

    const handleSaveRoom = (e) => {
        e.preventDefault();
        if (!roomForm.name.trim()) return alert('Nama ruangan/lokasi wajib diisi!');

        const payload = {
            id: editingItem?.id,
            name: roomForm.name.trim(),
            unitId: roomForm.unitId || null,
            description: roomForm.description.trim()
        };

        if (editingItem) {
            dispatch({ type: 'EDIT_ASSET_ROOM', payload });
            api.pushAction({ type: 'EDIT_ASSET_ROOM', payload }, state);
        } else {
            dispatch({ type: 'ADD_ASSET_ROOM', payload });
            api.pushAction({ type: 'ADD_ASSET_ROOM', payload }, state);
        }
        setShowModal(false);
    };

    const handleSavePic = (e) => {
        e.preventDefault();
        if (!picForm.name.trim()) return alert('Nama PIC wajib diisi!');

        const payload = {
            id: editingItem?.id,
            name: picForm.name.trim(),
            role: picForm.role.trim(),
            unitId: picForm.unitId || null,
            phone: picForm.phone.trim()
        };

        if (editingItem) {
            dispatch({ type: 'EDIT_ASSET_PIC', payload });
            api.pushAction({ type: 'EDIT_ASSET_PIC', payload }, state);
        } else {
            dispatch({ type: 'ADD_ASSET_PIC', payload });
            api.pushAction({ type: 'ADD_ASSET_PIC', payload }, state);
        }
        setShowModal(false);
    };

    // Delete Handlers
    const handleDelete = (type, item) => {
        if (!window.confirm(`Hapus data "${item.name}"?`)) return;

        if (type === 'category') {
            dispatch({ type: 'DELETE_ASSET_CATEGORY', payload: item.id });
            api.pushAction({ type: 'DELETE_ASSET_CATEGORY', payload: item.id }, state);
        } else if (type === 'vendor') {
            dispatch({ type: 'DELETE_ASSET_VENDOR', payload: item.id });
            api.pushAction({ type: 'DELETE_ASSET_VENDOR', payload: item.id }, state);
        } else if (type === 'room') {
            dispatch({ type: 'DELETE_ASSET_ROOM', payload: item.id });
            api.pushAction({ type: 'DELETE_ASSET_ROOM', payload: item.id }, state);
        } else if (type === 'pic') {
            dispatch({ type: 'DELETE_ASSET_PIC', payload: item.id });
            api.pushAction({ type: 'DELETE_ASSET_PIC', payload: item.id }, state);
        }
    };

    // Filtered lists based on search
    const filteredCategories = useMemo(() => {
        const q = search.toLowerCase();
        return (assetCategories || []).filter(c => 
            !q || (c.name || '').toLowerCase().includes(q) || (c.code || '').toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q)
        );
    }, [assetCategories, search]);

    const filteredVendors = useMemo(() => {
        const q = search.toLowerCase();
        return (assetVendors || []).filter(v => 
            !q || (v.name || '').toLowerCase().includes(q) || (v.phone || '').toLowerCase().includes(q) || (v.address || '').toLowerCase().includes(q)
        );
    }, [assetVendors, search]);

    const filteredRooms = useMemo(() => {
        const q = search.toLowerCase();
        return (assetRooms || []).filter(r => 
            !q || (r.name || '').toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q)
        );
    }, [assetRooms, search]);

    const filteredPics = useMemo(() => {
        const q = search.toLowerCase();
        return (assetPics || []).filter(p => 
            !q || (p.name || '').toLowerCase().includes(q) || (p.role || '').toLowerCase().includes(q)
        );
    }, [assetPics, search]);

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center font-black">
                            <Tag size={20} />
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Pengaturan Master Aset</h2>
                    </div>
                    <p className="text-slate-500 text-sm font-medium">Kelola kategori, vendor rekanan, nama ruangan, dan PIC penanggung jawab inventaris</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            if (activeTab === 'categories') handleOpenAdd('category');
                            else if (activeTab === 'vendors') handleOpenAdd('vendor');
                            else if (activeTab === 'rooms') handleOpenAdd('room');
                            else if (activeTab === 'pics') handleOpenAdd('pic');
                        }}
                        className="btn btn-primary px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/20 active:scale-95 transition-all text-xs"
                    >
                        <Plus size={16} />
                        <span>
                            {activeTab === 'categories' && 'Tambah Kategori'}
                            {activeTab === 'vendors' && 'Tambah Vendor'}
                            {activeTab === 'rooms' && 'Tambah Ruangan'}
                            {activeTab === 'pics' && 'Tambah PIC'}
                        </span>
                    </button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div 
                    onClick={() => { setActiveTab('categories'); setSearch(''); }}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer ${activeTab === 'categories' ? 'bg-indigo-50 border-indigo-200 shadow-sm ring-2 ring-indigo-500/20' : 'bg-white border-slate-100 hover:border-slate-200 shadow-sm'}`}
                >
                    <div className="flex items-center justify-between text-indigo-600 mb-2">
                        <Tag size={20} />
                        <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md">Kode Aset</span>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kategori Aset</p>
                    <h3 className="text-2xl font-black text-slate-800">{assetCategories.length}</h3>
                </div>

                <div 
                    onClick={() => { setActiveTab('vendors'); setSearch(''); }}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer ${activeTab === 'vendors' ? 'bg-indigo-50 border-indigo-200 shadow-sm ring-2 ring-indigo-500/20' : 'bg-white border-slate-100 hover:border-slate-200 shadow-sm'}`}
                >
                    <div className="flex items-center justify-between text-emerald-600 mb-2">
                        <Store size={20} />
                        <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md">Pemasok</span>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vendor / Toko</p>
                    <h3 className="text-2xl font-black text-slate-800">{assetVendors.length}</h3>
                </div>

                <div 
                    onClick={() => { setActiveTab('rooms'); setSearch(''); }}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer ${activeTab === 'rooms' ? 'bg-indigo-50 border-indigo-200 shadow-sm ring-2 ring-indigo-500/20' : 'bg-white border-slate-100 hover:border-slate-200 shadow-sm'}`}
                >
                    <div className="flex items-center justify-between text-amber-600 mb-2">
                        <MapPin size={20} />
                        <span className="text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md">Lokasi</span>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ruangan</p>
                    <h3 className="text-2xl font-black text-slate-800">{assetRooms.length}</h3>
                </div>

                <div 
                    onClick={() => { setActiveTab('pics'); setSearch(''); }}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer ${activeTab === 'pics' ? 'bg-indigo-50 border-indigo-200 shadow-sm ring-2 ring-indigo-500/20' : 'bg-white border-slate-100 hover:border-slate-200 shadow-sm'}`}
                >
                    <div className="flex items-center justify-between text-blue-600 mb-2">
                        <UserCheck size={20} />
                        <span className="text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md">Penanggung Jawab</span>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Daftar PIC</p>
                    <h3 className="text-2xl font-black text-slate-800">{assetPics.length}</h3>
                </div>
            </div>

            {/* Navigation Tabs & Search */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl w-full sm:w-auto">
                    <button
                        onClick={() => { setActiveTab('categories'); setSearch(''); }}
                        className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${activeTab === 'categories' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Tag size={15} />
                        <span>Kategori Aset ({assetCategories.length})</span>
                    </button>
                    <button
                        onClick={() => { setActiveTab('vendors'); setSearch(''); }}
                        className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${activeTab === 'vendors' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Store size={15} />
                        <span>Vendor ({assetVendors.length})</span>
                    </button>
                    <button
                        onClick={() => { setActiveTab('rooms'); setSearch(''); }}
                        className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${activeTab === 'rooms' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <MapPin size={15} />
                        <span>Ruangan ({assetRooms.length})</span>
                    </button>
                    <button
                        onClick={() => { setActiveTab('pics'); setSearch(''); }}
                        className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${activeTab === 'pics' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <UserCheck size={15} />
                        <span>PIC ({assetPics.length})</span>
                    </button>
                </div>

                <div className="relative w-full sm:w-72">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder={`Cari ${activeTab === 'categories' ? 'kategori atau kode...' : activeTab === 'vendors' ? 'vendor...' : activeTab === 'rooms' ? 'ruangan...' : 'PIC...'}`}
                        className="w-full pl-10 pr-9 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* TAB CONTENT */}

            {/* 1. KATEGORI ASET */}
            {activeTab === 'categories' && (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
                    <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
                        <div>
                            <h3 className="font-black text-sm uppercase tracking-wider flex items-center gap-2">
                                <Tag size={16} className="text-indigo-400" />
                                <span>Master Kategori Aset & Kode Singkatan</span>
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">Kode singkatan digunakan untuk membuat Kode Aset unik otomatis (contoh: DEI.MIT.<b>FU</b>.2026.0001)</p>
                        </div>
                        <span className="text-xs font-bold text-indigo-300">{filteredCategories.length} Kategori</span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">
                                    <th className="py-4 px-6 w-16 text-center">No</th>
                                    <th className="py-4 px-6">Nama Kategori</th>
                                    <th className="py-4 px-6 text-center">Kode Singkatan</th>
                                    <th className="py-4 px-6 text-center">Masa Manfaat</th>
                                    <th className="py-4 px-6">Deskripsi / Contoh Barang</th>
                                    <th className="py-4 px-6 text-center w-28">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                                {filteredCategories.length > 0 ? filteredCategories.map((cat, idx) => (
                                    <tr key={cat.id} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="py-4 px-6 text-center font-bold text-slate-400">{idx + 1}</td>
                                        <td className="py-4 px-6 font-black text-slate-900 text-sm">
                                            {cat.name}
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <span className="inline-flex items-center px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-black tracking-wider font-mono">
                                                {cat.code}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-center font-bold text-slate-700">
                                            {cat.economicLife > 0 ? `${cat.economicLife} Tahun` : 'Tidak Menyusut'}
                                        </td>
                                        <td className="py-4 px-6 text-slate-600 font-medium">
                                            {cat.description || '—'}
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <button
                                                    onClick={() => handleOpenEdit('category', cat)}
                                                    className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors"
                                                    title="Ubah Kategori"
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete('category', cat)}
                                                    className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors"
                                                    title="Hapus Kategori"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={6} className="py-12 text-center text-slate-400 font-medium italic">
                                            {search ? 'Tidak ada kategori yang cocok dengan pencarian.' : 'Belum ada kategori aset yang terdaftar.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* 2. VENDOR / REKANAN */}
            {activeTab === 'vendors' && (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
                    <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
                        <div>
                            <h3 className="font-black text-sm uppercase tracking-wider flex items-center gap-2">
                                <Store size={16} className="text-emerald-400" />
                                <span>Master Vendor / Toko Rekanan Pengadaan</span>
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">Daftar toko dan vendor tempat pengadaan atau servis inventaris yayasan</p>
                        </div>
                        <span className="text-xs font-bold text-emerald-300">{filteredVendors.length} Vendor</span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">
                                    <th className="py-4 px-6 w-16 text-center">No</th>
                                    <th className="py-4 px-6">Nama Toko / Vendor</th>
                                    <th className="py-4 px-6">Kontak / Telepon</th>
                                    <th className="py-4 px-6">Alamat</th>
                                    <th className="py-4 px-6">Keterangan</th>
                                    <th className="py-4 px-6 text-center w-28">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                                {filteredVendors.length > 0 ? filteredVendors.map((ven, idx) => (
                                    <tr key={ven.id} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="py-4 px-6 text-center font-bold text-slate-400">{idx + 1}</td>
                                        <td className="py-4 px-6 font-black text-slate-900 text-sm">
                                            {ven.name}
                                        </td>
                                        <td className="py-4 px-6 font-bold text-slate-600">
                                            {ven.phone || '—'}
                                        </td>
                                        <td className="py-4 px-6 text-slate-600 font-medium">
                                            {ven.address || '—'}
                                        </td>
                                        <td className="py-4 px-6 text-slate-500">
                                            {ven.note || '—'}
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <button
                                                    onClick={() => handleOpenEdit('vendor', ven)}
                                                    className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors"
                                                    title="Ubah Vendor"
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete('vendor', ven)}
                                                    className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors"
                                                    title="Hapus Vendor"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={6} className="py-12 text-center text-slate-400 font-medium italic">
                                            {search ? 'Tidak ada vendor yang cocok dengan pencarian.' : 'Belum ada vendor/toko yang terdaftar.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* 3. NAMA RUANGAN / LOKASI */}
            {activeTab === 'rooms' && (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
                    <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
                        <div>
                            <h3 className="font-black text-sm uppercase tracking-wider flex items-center gap-2">
                                <MapPin size={16} className="text-amber-400" />
                                <span>Master Ruangan & Lokasi Penempatan Aset</span>
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">Daftar ruangan penempatan aset untuk mempermudah inventarisasi dan audit berkala</p>
                        </div>
                        <span className="text-xs font-bold text-amber-300">{filteredRooms.length} Ruangan</span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">
                                    <th className="py-4 px-6 w-16 text-center">No</th>
                                    <th className="py-4 px-6">Nama Ruangan</th>
                                    <th className="py-4 px-6">Unit / Gedung</th>
                                    <th className="py-4 px-6">Keterangan / Fungsi</th>
                                    <th className="py-4 px-6 text-center w-28">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                                {filteredRooms.length > 0 ? filteredRooms.map((room, idx) => {
                                    const unitName = units.find(u => u.id === room.unitId)?.name || 'Semua Unit / Umum';
                                    return (
                                        <tr key={room.id} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="py-4 px-6 text-center font-bold text-slate-400">{idx + 1}</td>
                                            <td className="py-4 px-6 font-black text-slate-900 text-sm">
                                                {room.name}
                                            </td>
                                            <td className="py-4 px-6">
                                                <span className="inline-flex items-center px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-bold">
                                                    {unitName}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6 text-slate-600 font-medium">
                                                {room.description || '—'}
                                            </td>
                                            <td className="py-4 px-6 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button
                                                        onClick={() => handleOpenEdit('room', room)}
                                                        className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors"
                                                        title="Ubah Ruangan"
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete('room', room)}
                                                        className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors"
                                                        title="Hapus Ruangan"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                }) : (
                                    <tr>
                                        <td colSpan={5} className="py-12 text-center text-slate-400 font-medium italic">
                                            {search ? 'Tidak ada ruangan yang cocok dengan pencarian.' : 'Belum ada ruangan yang terdaftar.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* 4. PIC / PENANGGUNG JAWAB */}
            {activeTab === 'pics' && (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
                    <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
                        <div>
                            <h3 className="font-black text-sm uppercase tracking-wider flex items-center gap-2">
                                <UserCheck size={16} className="text-blue-400" />
                                <span>Master PIC / Penanggung Jawab Inventaris</span>
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">Daftar staf, guru, atau pegawai pemegang dan penanggung jawab fisik aset</p>
                        </div>
                        <span className="text-xs font-bold text-blue-300">{filteredPics.length} PIC</span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">
                                    <th className="py-4 px-6 w-16 text-center">No</th>
                                    <th className="py-4 px-6">Nama PIC</th>
                                    <th className="py-4 px-6">Jabatan / Peran</th>
                                    <th className="py-4 px-6">Unit / Bidang</th>
                                    <th className="py-4 px-6">Kontak / No. HP</th>
                                    <th className="py-4 px-6 text-center w-28">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                                {filteredPics.length > 0 ? filteredPics.map((pic, idx) => {
                                    const unitName = units.find(u => u.id === pic.unitId)?.name || 'Yayasan';
                                    return (
                                        <tr key={pic.id} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="py-4 px-6 text-center font-bold text-slate-400">{idx + 1}</td>
                                            <td className="py-4 px-6 font-black text-slate-900 text-sm">
                                                {pic.name}
                                            </td>
                                            <td className="py-4 px-6 font-bold text-slate-700">
                                                {pic.role || '—'}
                                            </td>
                                            <td className="py-4 px-6">
                                                <span className="inline-flex items-center px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold">
                                                    {unitName}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6 text-slate-600 font-medium">
                                                {pic.phone || '—'}
                                            </td>
                                            <td className="py-4 px-6 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button
                                                        onClick={() => handleOpenEdit('pic', pic)}
                                                        className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors"
                                                        title="Ubah PIC"
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete('pic', pic)}
                                                        className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors"
                                                        title="Hapus PIC"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                }) : (
                                    <tr>
                                        <td colSpan={6} className="py-12 text-center text-slate-400 font-medium italic">
                                            {search ? 'Tidak ada PIC yang cocok dengan pencarian.' : 'Belum ada PIC yang terdaftar.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* MODAL FORM */}
            {showModal && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-100">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
                                    {modalType === 'category' && <Tag size={20} />}
                                    {modalType === 'vendor' && <Store size={20} />}
                                    {modalType === 'room' && <MapPin size={20} />}
                                    {modalType === 'pic' && <UserCheck size={20} />}
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-slate-900">
                                        {editingItem ? 'Ubah' : 'Tambah'} {
                                            modalType === 'category' ? 'Kategori Aset' :
                                            modalType === 'vendor' ? 'Vendor / Toko' :
                                            modalType === 'room' ? 'Ruangan' : 'PIC Penanggung Jawab'
                                        }
                                    </h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Master Data Inventaris</p>
                                </div>
                            </div>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6">
                            {/* FORM KATEGORI */}
                            {modalType === 'category' && (
                                <form onSubmit={handleSaveCategory} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                                            Nama Kategori <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={categoryForm.name}
                                            onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })}
                                            placeholder="Contoh: Furnitur, Elektronik, Inventaris"
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                                            required
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                                                Kode Singkatan <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={categoryForm.code}
                                                onChange={e => setCategoryForm({ ...categoryForm, code: e.target.value.toUpperCase() })}
                                                placeholder="Contoh: FU, EL, INV"
                                                maxLength={6}
                                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-indigo-700 outline-none focus:border-indigo-500 focus:bg-white uppercase font-mono tracking-widest"
                                                required
                                            />
                                            <p className="text-[9px] text-slate-400 mt-1 font-semibold">Digunakan untuk penomoran kode aset</p>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                                                Masa Manfaat (Tahun)
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={categoryForm.economicLife}
                                                onChange={e => setCategoryForm({ ...categoryForm, economicLife: e.target.value })}
                                                placeholder="Contoh: 4"
                                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                                            />
                                            <p className="text-[9px] text-slate-400 mt-1 font-semibold">0 = Tidak menyusut (misal: Tanah)</p>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                                            Deskripsi / Contoh Barang
                                        </label>
                                        <textarea
                                            rows={2}
                                            value={categoryForm.description}
                                            onChange={e => setCategoryForm({ ...categoryForm, description: e.target.value })}
                                            placeholder="Contoh: Meja, kursi, lemari, rak loker..."
                                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-indigo-500 focus:bg-white resize-none"
                                        />
                                    </div>

                                    <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                                        <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2 text-xs font-black text-slate-400 uppercase tracking-wider hover:text-slate-600">
                                            Batal
                                        </button>
                                        <button type="submit" className="btn btn-primary px-6 py-2.5 rounded-xl text-xs font-black shadow-md shadow-indigo-500/20">
                                            {editingItem ? 'Simpan Perubahan' : 'Tambahkan Kategori'}
                                        </button>
                                    </div>
                                </form>
                            )}

                            {/* FORM VENDOR */}
                            {modalType === 'vendor' && (
                                <form onSubmit={handleSaveVendor} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                                            Nama Toko / Vendor <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={vendorForm.name}
                                            onChange={e => setVendorForm({ ...vendorForm, name: e.target.value })}
                                            placeholder="Contoh: Informa, Azia Furnitur, Max-Indo"
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                                            No. Telepon / WhatsApp
                                        </label>
                                        <input
                                            type="text"
                                            value={vendorForm.phone}
                                            onChange={e => setVendorForm({ ...vendorForm, phone: e.target.value })}
                                            placeholder="Contoh: 0812-xxxx-xxxx"
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                                            Alamat Toko
                                        </label>
                                        <textarea
                                            rows={2}
                                            value={vendorForm.address}
                                            onChange={e => setVendorForm({ ...vendorForm, address: e.target.value })}
                                            placeholder="Alamat toko atau rekanan..."
                                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-indigo-500 focus:bg-white resize-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                                            Keterangan Tambahan
                                        </label>
                                        <input
                                            type="text"
                                            value={vendorForm.note}
                                            onChange={e => setVendorForm({ ...vendorForm, note: e.target.value })}
                                            placeholder="Spesialis furnitur, servis elektronik, dll"
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                                        />
                                    </div>

                                    <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                                        <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2 text-xs font-black text-slate-400 uppercase tracking-wider hover:text-slate-600">
                                            Batal
                                        </button>
                                        <button type="submit" className="btn btn-primary px-6 py-2.5 rounded-xl text-xs font-black shadow-md shadow-indigo-500/20">
                                            {editingItem ? 'Simpan Perubahan' : 'Tambahkan Vendor'}
                                        </button>
                                    </div>
                                </form>
                            )}

                            {/* FORM RUANGAN */}
                            {modalType === 'room' && (
                                <form onSubmit={handleSaveRoom} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                                            Nama Ruangan / Lokasi <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={roomForm.name}
                                            onChange={e => setRoomForm({ ...roomForm, name: e.target.value })}
                                            placeholder="Contoh: Ruang TU, Ruang Guru, Lab Komputer, Kelas 7-A"
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                                            Unit Terkait
                                        </label>
                                        <select
                                            value={roomForm.unitId}
                                            onChange={e => setRoomForm({ ...roomForm, unitId: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                                        >
                                            <option value="">-- Semua Unit / Umum Yayasan --</option>
                                            {units.map(u => (
                                                <option key={u.id} value={u.id}>{u.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                                            Keterangan / Fungsi
                                        </label>
                                        <textarea
                                            rows={2}
                                            value={roomForm.description}
                                            onChange={e => setRoomForm({ ...roomForm, description: e.target.value })}
                                            placeholder="Deskripsi ruangan, letak lantai, dsb."
                                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-indigo-500 focus:bg-white resize-none"
                                        />
                                    </div>

                                    <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                                        <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2 text-xs font-black text-slate-400 uppercase tracking-wider hover:text-slate-600">
                                            Batal
                                        </button>
                                        <button type="submit" className="btn btn-primary px-6 py-2.5 rounded-xl text-xs font-black shadow-md shadow-indigo-500/20">
                                            {editingItem ? 'Simpan Perubahan' : 'Tambahkan Ruangan'}
                                        </button>
                                    </div>
                                </form>
                            )}

                            {/* FORM PIC */}
                            {modalType === 'pic' && (
                                <form onSubmit={handleSavePic} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                                            Nama PIC / Penanggung Jawab <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={picForm.name}
                                            onChange={e => setPicForm({ ...picForm, name: e.target.value })}
                                            placeholder="Contoh: Siti Nurfadhilah, Novi Hendri"
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                                            required
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                                                Jabatan / Peran
                                            </label>
                                            <input
                                                type="text"
                                                value={picForm.role}
                                                onChange={e => setPicForm({ ...picForm, role: e.target.value })}
                                                placeholder="Contoh: Staff TU, Sarpras, Guru"
                                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                                                No. Kontak / WhatsApp
                                            </label>
                                            <input
                                                type="text"
                                                value={picForm.phone}
                                                onChange={e => setPicForm({ ...picForm, phone: e.target.value })}
                                                placeholder="0812-xxxx-xxxx"
                                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                                            Unit Terkait
                                        </label>
                                        <select
                                            value={picForm.unitId}
                                            onChange={e => setPicForm({ ...picForm, unitId: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                                        >
                                            <option value="">-- Yayasan / Semua Unit --</option>
                                            {units.map(u => (
                                                <option key={u.id} value={u.id}>{u.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                                        <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2 text-xs font-black text-slate-400 uppercase tracking-wider hover:text-slate-600">
                                            Batal
                                        </button>
                                        <button type="submit" className="btn btn-primary px-6 py-2.5 rounded-xl text-xs font-black shadow-md shadow-indigo-500/20">
                                            {editingItem ? 'Simpan Perubahan' : 'Tambahkan PIC'}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
