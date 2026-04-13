import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { UserPlus, Edit2, Trash2, Shield, User, Key, X, Check, Search, FileSpreadsheet, Eye, EyeOff } from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../services/api';
import { generateId } from '../utils/format';

export default function UserManagement() {
    const { state, dispatch } = useApp();
    const users = state.users.filter(u => !u.isDeleted);
    const { currentUser, units = [], fields = [] } = state;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        name: '',
        role: 'admin',
        unitId: '',
        fieldId: ''
    });

    const exportToExcel = () => {
        const data = users.map(u => ({
            'ID User': u.id,
            'Username': u.username,
            'Nama Lengkap': u.name,
            'Role': u.role
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Users');
        XLSX.writeFile(wb, 'SIKAK-Yayasan-Users.xlsx');
    };

    const openModal = (user = null) => {
        if (user) {
            setEditingUser(user);
            setFormData({ ...user, password: '', unitId: user.unitId || '', fieldId: user.fieldId || '' });
        } else {
            setEditingUser(null);
            setFormData({ username: '', password: '', name: '', role: 'admin', unitId: '', fieldId: '' });
        }
        setShowPassword(false);
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingUser) {
                const payload = { ...formData, id: editingUser.id };
                dispatch({ type: 'EDIT_USER', payload });
                await api.pushAction({ type: 'EDIT_USER', payload }, state);
            } else {
                const payload = { ...formData, id: `USR-${generateId()}` };
                dispatch({ type: 'ADD_USER', payload });
                await api.pushAction({ type: 'ADD_USER', payload }, state);
            }
            setIsModalOpen(false);
        } catch (error) {
            alert('Gagal menyimpan user: ' + error.message);
        }
    };

    const handleDelete = async (id) => {
        if (id === currentUser.id) {
            alert('Anda tidak bisa menghapus diri sendiri!');
            return;
        }
        if (window.confirm('Hapus user ini?')) {
            try {
                await api.pushAction({ type: 'DELETE_USER', payload: id }, state);
                dispatch({ type: 'DELETE_USER', payload: id });
                alert('User berhasil dihapus permanen.');
            } catch (error) {
                alert('Gagal menghapus user: ' + error.message);
            }
        }
    };

    if (currentUser?.role !== 'superadmin') {
        return (
            <div className="p-20 text-center flex flex-col items-center justify-center animate-in">
                <div className="p-8 bg-rose-50 text-rose-500 rounded-[40px] shadow-inner mb-6">
                    <Shield size={64} />
                </div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">AKSES DITOLAK</h3>
                <p className="text-slate-500 font-medium max-w-sm mt-2 leading-relaxed">Maaf, halaman manajemen pengguna hanya dapat diakses oleh Administrator level tertinggi.</p>
            </div>
        );
    }

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Manajemen User</h2>
                    <p className="text-slate-500 font-medium">Atur hak akses dan kredensial staf yayasan</p>
                </div>
                <div className="flex gap-4">
                    <button onClick={exportToExcel} className="btn bg-white text-emerald-600 border-emerald-100 hover:bg-emerald-50 px-8 py-3 rounded-2xl shadow-sm font-black flex items-center gap-2">
                        <FileSpreadsheet size={18} /> Export Excel
                    </button>
                    <button onClick={() => openModal()} className="btn btn-primary px-8 py-3 rounded-2xl shadow-xl shadow-blue-500/20 font-black">
                        <UserPlus size={18} /> Tambah User
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-[40px] border border-slate-100 shadow-2xl overflow-hidden animate-in">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                        <tr>
                            <th className="px-10 py-6">Personal Info</th>
                            <th className="px-10 py-6">Identitas Login</th>
                            <th className="px-10 py-6">Tingkat Akses</th>
                            <th className="px-10 py-6 text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {users.map(u => (
                            <tr key={u.id} className="hover:bg-slate-50/50 transition-colors group">
                                <td className="px-10 py-5">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-inner ${u.role === 'superadmin' ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-slate-100 text-slate-400'}`}>
                                            {u.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="space-y-0.5">
                                            <p className="font-black text-slate-900 tracking-tight uppercase italic">{u.name}</p>
                                            <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest leading-none">ID: {u.id}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-10 py-5">
                                    <div className="flex items-center gap-2 text-slate-600 font-bold text-sm bg-slate-50 w-fit px-4 py-2 rounded-xl">
                                        <User size={14} className="text-slate-300" />
                                        {u.username}
                                    </div>
                                </td>
                                <td className="px-10 py-5">
                                    <div className="flex flex-col items-start gap-1">
                                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest inline-flex items-center gap-2 ${u.role === 'superadmin' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                                            <Shield size={10} /> {u.role.replace('_', ' ')}
                                        </span>
                                        {u.role === 'admin_unit' && <span className="text-[10px] font-bold text-slate-400">Unit: {units.find(un => un.id === u.unitId)?.name || 'N/A'}</span>}
                                        {u.role === 'admin_bidang' && <span className="text-[10px] font-bold text-slate-400">Bidang: {fields.find(f => f.id === u.fieldId)?.name || 'N/A'}</span>}
                                    </div>
                                </td>
                                <td className="px-10 py-5">
                                    <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => openModal(u)} className="p-3 text-slate-400 hover:text-blue-600 hover:bg-white rounded-xl shadow-sm transition-all"><Edit2 size={16}/></button>
                                        <button onClick={() => handleDelete(u.id)} className="p-3 text-slate-400 hover:text-rose-600 hover:bg-white rounded-xl shadow-sm transition-all" disabled={u.id === currentUser.id}><Trash2 size={16}/></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl z-[100] flex items-center justify-center p-8 animate-in" onClick={() => setIsModalOpen(false)}>
                    <div className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">{editingUser ? 'Ubah Pengguna' : 'Tambah Pengguna'}</h3>
                                <p className="text-xs font-bold text-slate-400 tracking-widest uppercase mt-1">Sistem Keamanan Yayasan</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-3 text-slate-400 hover:text-rose-500 transition-all"><X size={24}/></button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="p-8 space-y-6">
                                <div>
                                    <label className="form-label">Nama Lengkap</label>
                                    <input className="form-input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: Ahmad Dahlan" required />
                                </div>
                                <div>
                                    <label className="form-label">Username Login</label>
                                    <input className="form-input" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} placeholder="Ex: adahlan01" required />
                                </div>
                                <div>
                                    <label className="form-label">Password {editingUser && '(Opsional / Kosongkan jika tidak ubah)'}</label>
                                    <div style={{ position: 'relative' }}>
                                        <input type={showPassword ? "text" : "password"} className="form-input" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} placeholder="••••••••" required={!editingUser} style={{ paddingRight: '44px' }} />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="form-label">Level Akses</label>
                                    <select className="form-select" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                                        <option value="admin">Admin (Operasional/Pencatatan)</option>
                                        <option value="superadmin">Super Admin (Akses Penuh)</option>
                                        <option value="admin_unit">Admin Unit Khusus</option>
                                        <option value="admin_bidang">Admin Bidang Khusus</option>
                                    </select>
                                </div>
                                {formData.role === 'admin_unit' && (
                                    <div className="animate-in fade-in slide-in-from-top-4">
                                        <label className="form-label">Tugas Unit</label>
                                        <select className="form-select" value={formData.unitId} onChange={e => setFormData({ ...formData, unitId: e.target.value })} required>
                                            <option value="">Pilih Unit...</option>
                                            {units.filter(u => !u.isDeleted).map(u => (
                                                <option key={u.id} value={u.id}>{u.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                {formData.role === 'admin_bidang' && (
                                    <div className="animate-in fade-in slide-in-from-top-4">
                                        <label className="form-label">Tugas Bidang</label>
                                        <select className="form-select" value={formData.fieldId} onChange={e => setFormData({ ...formData, fieldId: e.target.value })} required>
                                            <option value="">Pilih Bidang...</option>
                                            {fields.filter(f => !f.isDeleted).map(f => (
                                                <option key={f.id} value={f.id}>{f.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                            <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-6 py-4 rounded-2xl font-black text-xs text-slate-400 uppercase tracking-widest">Batalkan</button>
                                <button type="submit" className="flex-[2] btn btn-primary px-6 py-4 rounded-2xl font-black text-sm uppercase tracking-tight">
                                    <Check size={18} /> Simpan Pengguna
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
