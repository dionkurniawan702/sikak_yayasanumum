import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatRupiah, formatTanggal, generateId } from '../utils/format';
import { hitungPenyusutanBulanan, hitungNilaiBuku, hitungTotalPenyusutan } from '../utils/depreciation';
import { Plus, X, Play, Calculator, Trash2, Coins, TrendingDown, Landmark, Info, Calendar, Tag, DollarSign, Clock, Layout, Pencil, Download, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import CurrencyDisplay from '../components/CurrencyDisplay';

export default function FixedAssets() {
    const { state, dispatch } = useApp();
    const assets = state.assets
        .filter(a => !a.isDeleted)
        .sort((a, b) => new Date(b.acquisitionDate) - new Date(a.acquisitionDate));
    const accounts = state.accounts.filter(a => !a.isDeleted);
    const [showModal, setShowModal] = useState(false);
    const [editingAsset, setEditingAsset] = useState(null);

    const exportToExcel = () => {
        const data = assets.map(a => ({
            'ID Aset': a.id,
            'Nama Aset': a.name,
            'Tanggal Perolehan': a.acquisitionDate,
            'Harga Perolehan': a.cost,
            'Umur Ekonomis (Thn)': a.economicLife,
            'Kategori': a.category,
            'Posisi': a.assetPosition || 'Pusat',
            'Kondisi': a.assetCondition,
            'Status': a.status,
            'Nilai Buku': hitungNilaiBuku(a)
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Assets');
        XLSX.writeFile(wb, 'SIKAD-Dareliman-Assets.xlsx');
    };

    const depAccounts = accounts.filter(a => a.category === 'detail' && a.type === 'Beban');
    const accumAccounts = accounts.filter(a => a.category === 'detail' && a.normalBalance === 'kredit' && a.type === 'Aset');
    const assetAccounts = accounts.filter(a => a.category === 'detail' && a.normalBalance === 'debit' && a.type === 'Aset');

    const TAX_GROUPS = [
        { label: 'Tanah (Tidak Menyusut)', value: '0' },
        { label: 'Kelompok 1 (4 Tahun) - Peralatan/Laptop/Motor', value: '4' },
        { label: 'Kelompok 2 (8 Tahun) - Kendaraan/Mesin/AC', value: '8' },
        { label: 'Kelompok 3 (16 Tahun) - Alat Berat/Mesin Kimia', value: '16' },
        { label: 'Kelompok 4 (20 Tahun) - Bangunan Permanen', value: '20' },
    ];

    const [form, setForm] = useState({
        name: '',
        acquisitionDate: new Date().toISOString().slice(0, 10),
        cost: '',
        residualValue: '0',
        economicLife: '',
        depreciationAccountId: depAccounts[0]?.id || '',
        accumulatedDepAccountId: accumAccounts[0]?.id || '',
        assetAccountId: assetAccounts[0]?.id || '',
        category: 'Peralatan',
        assetPosition: '',
        assetRoom: '',
        assetCondition: 'Baik',
        status: 'Tersedia',
    });

    const totalCost = assets.reduce((s, a) => s + a.cost, 0);
    const totalAccumDep = assets.reduce((s, a) => s + hitungTotalPenyusutan(a), 0);
    const totalBookValue = assets.reduce((s, a) => s + hitungNilaiBuku(a), 0);

    function handleSaveAsset() {
        if (!form.name || !form.cost || form.economicLife === '') return alert('Lengkapi data aset!');
        const payload = {
            ...form,
            cost: parseFloat(form.cost),
            residualValue: parseFloat(form.residualValue) || 0,
            usefulLifeMonths: parseInt(form.economicLife) * 12,
        };

        if (editingAsset) {
            dispatch({ type: 'EDIT_ASSET', payload: { ...payload, id: editingAsset.id } });
        } else {
            dispatch({ type: 'ADD_ASSET', payload });
        }
        setShowModal(false);
        setEditingAsset(null);
    }

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Database Aset Tetap</h2>
                    <p className="text-slate-500 font-medium">Manajemen Aset & Penyusutan Otomatis (PSAK 35)</p>
                </div>
                <div className="flex gap-4">
                    <button onClick={exportToExcel} className="btn bg-white text-emerald-600 border-emerald-100 hover:bg-emerald-50 px-8 py-3 rounded-2xl shadow-sm font-black flex items-center gap-2">
                        <FileSpreadsheet size={18} /> Export
                    </button>
                    <button onClick={() => { setEditingAsset(null); setShowModal(true); }} className="btn btn-primary px-8 py-3 rounded-2xl shadow-xl shadow-blue-500/20 font-black tracking-tight">
                        <Plus size={18} /> Tambah Aset
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Nilai Perolehan</p>
                    <h3 className="text-2xl font-black text-slate-900"><CurrencyDisplay value={totalCost} /></h3>
                </div>
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Akumulasi Penyusutan</p>
                    <h3 className="text-2xl font-black text-slate-900 text-rose-600"><CurrencyDisplay value={-totalAccumDep} /></h3>
                </div>
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nilai Buku Saat Ini</p>
                    <h3 className="text-2xl font-black text-blue-600"><CurrencyDisplay value={totalBookValue} /></h3>
                </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <tr>
                            <th className="px-8 py-6">Informasi Aset</th>
                            <th className="px-8 py-6">Kategori / Lokasi</th>
                            <th className="px-8 py-6 text-right">Nilai Buku</th>
                            <th className="px-8 py-6 text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {assets.map(asset => (
                            <tr key={asset.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-8 py-4">
                                    <p className="font-bold text-slate-900 text-sm">{asset.name}</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{formatTanggal(asset.acquisitionDate)}</p>
                                </td>
                                <td className="px-8 py-4">
                                    <div className="flex gap-2">
                                        <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-[9px] font-black uppercase tracking-widest">{asset.category}</span>
                                        <span className="px-2 py-1 bg-slate-50 text-slate-500 rounded text-[9px] font-black uppercase tracking-widest">{asset.assetPosition || 'Pusat'}</span>
                                    </div>
                                </td>
                                <td className="px-8 py-4 text-right font-black text-slate-900">
                                    <CurrencyDisplay value={hitungNilaiBuku(asset)} />
                                </td>
                                <td className="px-8 py-4">
                                    <div className="flex justify-center gap-2">
                                        <button onClick={() => { setEditingAsset(asset); setForm(asset); setShowModal(true); }} className="p-2 text-slate-300 hover:text-blue-600 transition-all"><Pencil size={16}/></button>
                                        <button onClick={() => dispatch({type:'DELETE_ASSET', payload: asset.id})} className="p-2 text-slate-300 hover:text-rose-600 transition-all"><Trash2 size={16}/></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in">
                    <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="text-xl font-black text-slate-900">{editingAsset ? 'Ubah Aset' : 'Aset Baru'}</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                        </div>
                        <div className="p-8 grid grid-cols-2 gap-6">
                            <div className="col-span-2">
                                <label className="form-label">Nama Aset</label>
                                <input className="form-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Toyota Avanza..." />
                            </div>
                            <div>
                                <label className="form-label">Tanggal Perolehan</label>
                                <input type="date" className="form-input" value={form.acquisitionDate} onChange={e => setForm({...form, acquisitionDate: e.target.value})} />
                            </div>
                            <div>
                                <label className="form-label">Kategori Aset</label>
                                <select className="form-select" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                                    <option value="Tanah">Tanah</option>
                                    <option value="Bangunan">Bangunan</option>
                                    <option value="Kendaraan">Kendaraan</option>
                                    <option value="Peralatan">Peralatan</option>
                                </select>
                            </div>
                            <div>
                                <label className="form-label">Harga Perolehan</label>
                                <input type="number" className="form-input" value={form.cost} onChange={e => setForm({...form, cost: e.target.value})} />
                            </div>
                            <div>
                                <label className="form-label">Kelompok Masa Manfaat</label>
                                <select className="form-select" value={form.economicLife} onChange={e => setForm({...form, economicLife: e.target.value})}>
                                    {TAX_GROUPS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex justify-end gap-4">
                            <button onClick={() => setShowModal(false)} className="px-6 py-2 text-xs font-black text-slate-400 uppercase tracking-widest">Batal</button>
                            <button onClick={handleSaveAsset} className="btn btn-primary px-8 py-3 rounded-2xl font-black">SIMPAN ASET</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
