import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { generateId } from '../utils/format';
import { 
    Users, MapPin, Search, Plus, Edit2, Trash2, Save, X, Phone 
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Leaflet icon fix for React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Simple approx coordinates for Indonesia Provinces (can be improved)
const COORDS = {
    'dki jakarta': [-6.2088, 106.8456],
    'jakarta': [-6.2088, 106.8456],
    'jawa barat': [-6.9175, 107.6191], 
    'bandung': [-6.9175, 107.6191],
    'jawa tengah': [-7.0051, 110.4381], 
    'semarang': [-7.0051, 110.4381],
    'di yogyakarta': [-7.7956, 110.3695],
    'yogyakarta': [-7.7956, 110.3695],
    'jawa timur': [-7.2504, 112.7688], 
    'surabaya': [-7.2504, 112.7688],
    'banten': [-6.1200, 106.1503], 
    'sulawesi selatan': [-5.1477, 119.4327], 
    'makassar': [-5.1477, 119.4327],
    'sumatera utara': [3.5952, 98.6722],
    'medan': [3.5952, 98.6722],
    'bali': [-8.4095, 115.1889],
    'denpasar': [-8.4095, 115.1889],
    'kalimantan timur': [0.5387, 116.4194]
};

export default function ContactsData() {
    const { state, dispatch } = useApp();
    const contacts = (state.contacts || []).filter(c => !c.isDeleted);
    
    const [activeTab, setActiveTab] = useState('data'); // 'data' | 'map'
    const [filterType, setFilterType] = useState('All'); // 'All' | 'Donatur' | 'Penerima Manfaat' | 'Lainnya'
    const [search, setSearch] = useState('');
    
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({});

    const filteredContacts = useMemo(() => {
        return contacts.filter(c => {
            const matchesType = filterType === 'All' || c.type === filterType;
            const matchesSearch = c.name?.toLowerCase().includes(search.toLowerCase()) || c.city?.toLowerCase().includes(search.toLowerCase());
            return matchesType && matchesSearch;
        });
    }, [contacts, filterType, search]);

    const handleEdit = (contact) => {
        setFormData(contact);
        setIsEditing(true);
    };

    const handleCreate = () => {
        setFormData({ name: '', type: 'Donatur', phone: '', address: '', province: '', city: '', district: '' });
        setIsEditing(true);
    };

    const handleSave = () => {
        if (!formData.name || !formData.type) return alert("Nama dan Status wajib diisi.");
        
        if (formData.id) {
            dispatch({ type: 'EDIT_CONTACT', payload: formData });
        } else {
            dispatch({ type: 'ADD_CONTACT', payload: { ...formData, id: generateId('CNT') } });
        }
        setIsEditing(false);
    };

    const handleDelete = (id) => {
        if (window.confirm("Yakin ingin menghapus kontak ini?")) {
            dispatch({ type: 'DELETE_CONTACT', payload: id });
        }
    };

    // Prepare map markers with slight random offset so same-city markers don't overlap perfectly
    const mapMarkers = useMemo(() => {
        return filteredContacts
            .filter(c => c.province || c.city || c.address)
            .map(c => {
                const provKey = (c.province || '').toLowerCase();
                const cityKey = (c.city || '').toLowerCase();
                let latlng = COORDS[cityKey] || COORDS[provKey] || [-2.5489, 118.0149]; // default central indo
                // Add tiny random offset (about ~1-5km)
                latlng = [latlng[0] + (Math.random() - 0.5) * 0.05, latlng[1] + (Math.random() - 0.5) * 0.05];
                return { ...c, latlng };
            });
    }, [filteredContacts]);

    return (
        <div className="p-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Data Pihak Terkait</h2>
                    <p className="text-slate-500 font-medium tracking-tight">Manajemen Donatur, Penerima Manfaat, dan Sebaran Lokasi</p>
                </div>
                
                <div className="flex bg-slate-100 p-1 rounded-2xl w-full md:w-auto">
                    <button 
                        onClick={() => setActiveTab('data')}
                        className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'data' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Tabel Data
                    </button>
                    <button 
                        onClick={() => setActiveTab('map')}
                        className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'map' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Peta Sebaran
                    </button>
                </div>
            </div>

            {isEditing && (
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl mb-8 animate-in">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h3 className="text-xl font-black text-slate-800 tracking-tight">{formData.id ? 'Edit Profil Kontak' : 'Tambah Kontak Baru'}</h3>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Isi formulir secara lengkap</p>
                        </div>
                        <button onClick={() => setIsEditing(false)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors rounded-xl"><X size={20}/></button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Nama Entitas / Individu</label>
                            <input className="form-input rounded-2xl border-slate-200" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Misal: Bapak Hamba Allah" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Status Pihak</label>
                            <select className="form-select rounded-2xl border-slate-200" value={formData.type || ''} onChange={e => setFormData({...formData, type: e.target.value})}>
                                <option value="Donatur">🚀 Donatur</option>
                                <option value="Penerima Manfaat">❤️ Penerima Manfaat</option>
                                <option value="Lainnya">🤝 Lainnya</option>
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Nomor Telepon/HP</label>
                            <input className="form-input rounded-2xl border-slate-200" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="0812XXXXX" />
                        </div>
                    </div>

                    <div className="bg-blue-50/30 p-6 rounded-3xl border border-blue-100/50 mb-8">
                        <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest block mb-6">Informasi Alamat & Lokasi</label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Alamat Lengkap</label>
                                <input className="form-input rounded-2xl border-slate-200" value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Nama jalan, nomor rumah, detail lainnya..." />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Provinsi</label>
                                <input className="form-input rounded-2xl border-slate-200" value={formData.province || ''} onChange={e => setFormData({...formData, province: e.target.value})} placeholder="DKI Jakarta" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Kabupaten / Kota</label>
                                <input className="form-input rounded-2xl border-slate-200" value={formData.city || ''} onChange={e => setFormData({...formData, city: e.target.value})} placeholder="Jakarta Selatan" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Kecamatan</label>
                                <input className="form-input rounded-2xl border-slate-200" value={formData.district || ''} onChange={e => setFormData({...formData, district: e.target.value})} placeholder="Kebayoran Baru" />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-4">
                        <button onClick={() => setIsEditing(false)} className="px-8 py-3 rounded-2xl font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest text-xs">Batal</button>
                        <button onClick={handleSave} className="btn btn-primary px-12 py-4 rounded-2xl shadow-xl shadow-blue-500/30 font-black tracking-tight flex items-center gap-3">
                            <Save size={18}/> {formData.id ? 'SIMPAN PERUBAHAN' : 'TAMBAHKAN KONTAK'}
                        </button>
                    </div>
                </div>
            )}

            {!isEditing && activeTab === 'data' && (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden animate-in">
                    <div className="p-6 md:p-8 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center bg-slate-50/50">
                        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-4 md:pb-0 hide-scrollbar">
                            {['All', 'Donatur', 'Penerima Manfaat', 'Lainnya'].map(type => (
                                <button key={type} onClick={() => setFilterType(type)}
                                    className={`px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all ${filterType === type ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-white text-slate-400 border border-slate-200/60 hover:border-slate-300'}`}>
                                    {type === 'All' ? 'Semua Kontak' : type}
                                </button>
                            ))}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                            <div className="relative flex-1 sm:w-64">
                                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input className="form-input py-3 pl-12 pr-4 rounded-2xl border-slate-200 text-sm font-bold bg-white" placeholder="Cari nama atau kota..." value={search} onChange={e => setSearch(e.target.value)} />
                            </div>
                            <button onClick={handleCreate} className="px-6 py-3 rounded-2xl bg-emerald-500 text-white font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/30 whitespace-nowrap">
                                <Plus size={16}/> Kontak Baru
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-t border-slate-100">
                            <thead className="bg-white text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                <tr>
                                    <th className="px-8 py-5">Identitas & Status</th>
                                    <th className="px-8 py-5">Informasi Kontak</th>
                                    <th className="px-8 py-5 text-center">Tindakan</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredContacts.map(c => (
                                    <tr key={c.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className={`p-4 rounded-2xl shadow-sm ${c.type === 'Donatur' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100/50' : c.type === 'Penerima Manfaat' ? 'bg-amber-50 text-amber-600 border border-amber-100/50' : 'bg-slate-50 text-slate-500 border border-slate-100'}`}>
                                                    <Users size={20} />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800 text-base">{c.name}</p>
                                                    <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${c.type === 'Donatur' ? 'text-emerald-500' : c.type === 'Penerima Manfaat' ? 'text-amber-500' : 'text-slate-400'}`}>
                                                        {c.type}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex flex-col gap-2">
                                                <p className="text-sm text-slate-700 font-bold flex items-center gap-2"><Phone size={14} className="text-slate-400"/> {c.phone || 'Belum ada nomor'}</p>
                                                <p className="text-xs text-slate-500 flex items-center gap-2 max-w-xs truncate" title={c.address || c.city || ''}><MapPin size={14} className="text-slate-400"/> {c.city ? `${c.city}, ${c.province}` : c.address || 'Alamat tidak tersedia'}</p>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleEdit(c)} className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all rounded-xl focus:opacity-100">
                                                    <Edit2 size={16}/>
                                                </button>
                                                <button onClick={() => handleDelete(c.id)} className="p-3 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all rounded-xl focus:opacity-100">
                                                    <Trash2 size={16}/>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredContacts.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="px-8 py-20 text-center">
                                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                                <Users size={32} className="text-slate-300" />
                                            </div>
                                            <p className="text-lg font-bold text-slate-600 mb-1">Tidak Ada Data</p>
                                            <p className="text-sm text-slate-400 font-medium max-w-sm mx-auto">Kami tidak dapat menemukan kontak yang sesuai dengan filter atau pencarian Anda.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {!isEditing && activeTab === 'map' && (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden relative animate-in">
                    <div className="absolute top-6 left-6 z-[400] bg-white/90 backdrop-blur-xl p-4 md:p-6 rounded-3xl shadow-2xl border border-slate-100/50 w-72 pointer-events-none transition-all">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2.5 bg-blue-100 text-blue-600 rounded-xl">
                                <MapPin size={20} />
                            </div>
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Statistik Global</h4>
                                <p className="text-sm font-bold text-slate-800">Sebaran Wilayah</p>
                            </div>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-2xl border border-emerald-100/50">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                    <span className="text-xs font-black uppercase tracking-widest text-emerald-800">Donatur Aktif</span>
                                </div>
                                <span className="text-lg font-black text-emerald-600">{mapMarkers.filter(m => m.type === 'Donatur').length}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-amber-50 rounded-2xl border border-amber-100/50">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                                    <span className="text-xs font-black uppercase tracking-widest text-amber-800">Penerima Bantuan</span>
                                </div>
                                <span className="text-lg font-black text-amber-600">{mapMarkers.filter(m => m.type === 'Penerima Manfaat').length}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl border border-slate-200/60">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                                    <span className="text-xs font-black uppercase tracking-widest text-slate-600">Lainnya</span>
                                </div>
                                <span className="text-lg font-black text-slate-600">{mapMarkers.filter(m => m.type === 'Lainnya').length}</span>
                            </div>
                        </div>
                    </div>

                    <div className="h-[70vh] min-h-[500px] w-full z-0 relative">
                        <MapContainer 
                            center={[-2.5489, 118.0149]} 
                            zoom={5} 
                            style={{ height: '100%', width: '100%' }}
                            zoomControl={false}
                        >
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                            />
                            {mapMarkers.map(c => (
                                <Marker key={c.id} position={c.latlng}>
                                    <Popup className="rounded-2xl">
                                        <div className="font-sans px-1 py-1 min-w-[180px]">
                                            <p className="font-black text-sm mb-1 text-slate-800">{c.name}</p>
                                            <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md inline-block mb-3 ${c.type === 'Donatur' ? 'bg-emerald-100 text-emerald-800' : c.type === 'Penerima Manfaat' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{c.type}</span>
                                            
                                            {c.phone && <p className="text-[11px] text-slate-600 flex items-center gap-1.5 mb-1"><Phone size={10} className="text-slate-400"/> {c.phone}</p>}
                                            {c.city && <p className="text-[11px] text-slate-600 flex items-center gap-1.5"><MapPin size={10} className="text-slate-400"/> {c.city}, {c.province}</p>}
                                        </div>
                                    </Popup>
                                </Marker>
                            ))}
                        </MapContainer>
                    </div>
                </div>
            )}
        </div>
    );
}
