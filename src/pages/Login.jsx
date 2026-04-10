import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { LogIn, Key, User as UserIcon, AlertCircle, Clock, Eye, EyeOff } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function Login() {
    const { state, dispatch } = useApp();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const isExpired = searchParams.get('expired') === 'true';
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');

        const isRemote = import.meta.env.VITE_DATA_MODE === 'remote';
        
        try {
            if (isRemote) {
                let API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
                if (typeof window !== 'undefined') {
                    const { hostname, origin } = window.location;
                    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
                        API_URL = `${origin}/api`;
                    }
                }
                
                // Track URL for debugging
                const targetUrl = `${API_URL}/login`;
                
                const res = await fetch(targetUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                
                const result = await res.json();
                
                if (res.ok && result.success) {
                    localStorage.setItem('jwt_token', result.data.token);
                    dispatch({ type: 'LOGIN', payload: result.data });
                    navigate('/');
                } else {
                    setError(result.error || 'Username atau password salah');
                }
            } else {
                const user = state.users.find(u => u.username === username && u.password === password && !u.isDeleted);
                if (user) {
                    dispatch({ type: 'LOGIN', payload: user });
                    navigate('/');
                } else {
                    setError('Username atau password salah');
                }
            }
        } catch (err) {
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
            const { origin } = window.location;
            const targetUrl = (window.location.hostname !== 'localhost') ? `${origin}/api/login` : `${API_URL}/login`;
            setError(`Gagal terhubung ke server (${targetUrl}). Pastikan server aktif dan port 5000 terbuka.`);
            console.error(err);
        }
    };

    return (
        <div className="login-container" style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            padding: '20px'
        }}>
            <div className="card animate-in" style={{
                maxWidth: '400px',
                width: '100%',
                padding: '40px',
                borderRadius: '24px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        background: 'linear-gradient(to bottom right, #1e40af, #1e3a8a)',
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px auto',
                        boxShadow: '0 10px 15px -3px rgba(30, 64, 175, 0.3)'
                    }}>
                        <LogIn size={32} color="white" />
                    </div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b', marginBottom: '8px' }}>SIKAK YAYASAN Login</h2>
                    <p style={{ color: '#64748b', fontSize: '0.875rem' }}>SIKAK YAYASAN UMUM — Berbasis PSAK 35</p>
                </div>

                {error && (
                    <div className="bg-rose-50 text-rose-800 p-4 rounded-xl mb-6 text-sm flex items-center gap-3 border border-rose-100">
                        <AlertCircle size={18} />
                        {error}
                    </div>
                )}

                {isExpired && !error && (
                    <div className="bg-amber-50 text-amber-800 p-4 rounded-xl mb-6 text-sm flex items-center gap-3 border border-amber-100">
                        <Clock size={18} />
                        Sesi Anda telah berakhir. Silakan login kembali.
                    </div>
                )}

                <form onSubmit={handleLogin}>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' }}>Username</label>
                        <div style={{ position: 'relative' }}>
                            <UserIcon style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={18} />
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Masukkan username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                style={{ paddingLeft: '44px' }}
                                required
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: '32px' }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' }}>Password</label>
                        <div style={{ position: 'relative' }}>
                            <Key style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={18} />
                            <input
                                type={showPassword ? "text" : "password"}
                                className="form-input"
                                placeholder="Masukkan password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                style={{ paddingLeft: '44px', paddingRight: '44px' }}
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <button type="submit" className="btn btn-primary w-full py-3.5 text-base font-bold rounded-xl shadow-lg shadow-blue-500/25">
                        Masuk Sekarang
                    </button>
                </form>

                <div style={{ marginTop: '32px', textAlign: 'center' }}>
                    <p style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                        &copy; 2026 SIKAK YAYASAN UMUM — Sistem Akuntansi Yayasan Terintegrasi
                    </p>
                </div>
            </div>
        </div>
    );
}
