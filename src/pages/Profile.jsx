import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { User, Key, Save, AlertCircle, CheckCircle, Shield, ArrowRight } from 'lucide-react';

export default function Profile() {
    const { state, dispatch } = useApp();
    const { currentUser } = state;

    const [formData, setFormData] = useState({
        name: currentUser?.name || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    const [status, setStatus] = useState({ type: '', message: '' });

    const handleSubmit = (e) => {
        e.preventDefault();
        setStatus({ type: '', message: '' });

        if (formData.currentPassword !== currentUser.password) {
            setStatus({ type: 'error', message: 'Verifikasi Password Gagal: Kata sandi saat ini tidak cocok.' });
            return;
        }

        if (formData.newPassword !== formData.confirmPassword) {
            setStatus({ type: 'error', message: 'Ketidaksinkronan Data: Konfirmasi password baru tidak sesuai.' });
            return;
        }

        if (formData.newPassword && formData.newPassword.length < 4) {
            setStatus({ type: 'error', message: 'Keamanan Lemah: Password baru minimal harus memiliki 4 karakter.' });
            return;
        }

        const updatedUser = {
            ...currentUser,
            name: formData.name,
            password: formData.newPassword || currentUser.password
        };

        dispatch({ type: 'EDIT_USER', payload: updatedUser });
        setStatus({ type: 'success', message: 'Autentikasi Diperbarui: Profil dan kredensial Anda telah berhasil disimpan.' });

        setFormData(prev => ({
            ...prev,
            currentPassword: '',
            newPassword: '',
            confirmPassword: ''
        }));
    };

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-12">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tighter italic">Profil Personal</h2>
                    <p className="text-slate-500 font-medium">Pengaturan identitas dan keamanan akun operator</p>
                </div>
            </div>

            <div className="max-w-xl animate-in">
                <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl -mr-16 -mt-16 opacity-60"></div>
                    
                    <div className="flex items-center gap-6 mb-12 pb-8 border-b border-slate-50 relative z-10">
                        <div className="w-20 h-20 bg-slate-900 text-white rounded-[28px] flex items-center justify-center font-black text-3xl shadow-xl shadow-slate-200 uppercase italic">
                            {currentUser?.name?.charAt(0)}
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase leading-none">{currentUser?.name}</h3>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
                                    <Shield size={10} /> {currentUser?.role}
                                </span>
                                <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Akses Operator</span>
                            </div>
                        </div>
                    </div>

                    {status.message && (
                        <div className={`p-6 rounded-3xl border flex items-center gap-4 mb-10 animate-in zoom-in-95 ${status.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'}`}>
                            {status.type === 'success' ? <CheckCircle size={20} className="shrink-0" /> : <AlertCircle size={20} className="shrink-0" />}
                            <p className="text-xs font-bold leading-relaxed">{status.message}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-3 pl-1">Identitas Lengkap</label>
                            <div className="relative group">
                                <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={20} />
                                <input className="form-input pl-14" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                            </div>
                        </div>

                        <div className="pt-4 mt-8 border-t border-slate-50">
                            <div className="flex items-center gap-2 mb-8">
                                <Key size={18} className="text-slate-400" />
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest italic">Modifikasi Kredensial</h4>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-3 pl-1">Verifikasi Password Lama</label>
                                    <input type="password" title="Password Lama" className="form-input bg-slate-50 border-transparent focus:bg-white" value={formData.currentPassword} onChange={e => setFormData({ ...formData, currentPassword: e.target.value })} placeholder="••••••••" required />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block pl-1">Password Baru</label>
                                        <input type="password" title="Password Baru" className="form-input" value={formData.newPassword} onChange={e => setFormData({ ...formData, newPassword: e.target.value })} placeholder="••••••••" />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block pl-1">Konfirmasi</label>
                                        <input type="password" title="Konfirmasi Password" className="form-input" value={formData.confirmPassword} onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })} placeholder="••••••••" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button type="submit" className="w-full btn btn-primary py-5 rounded-3xl font-black text-sm uppercase tracking-tight shadow-xl shadow-blue-500/10 hover:scale-[1.02] flex items-center justify-center gap-3 mt-4">
                            <Save size={20} /> PERBARUI PROFIL & KEAMANAN
                        </button>
                    </form>
                </div>
            </div>

            <div className="mt-12 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest italic">
                SIKAK YAYASAN UMUM — IDENTITY AND ACCESS MANAGEMENT (IAM)
            </div>
        </div>
    );
}
