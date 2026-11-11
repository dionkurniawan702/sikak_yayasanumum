import { useState, useEffect } from 'react';
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
    const [serverStatus, setServerStatus] = useState('checking'); // 'checking', 'online', 'offline'
    
    useEffect(() => {
        const checkConnection = async () => {
            let API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
            if (typeof window !== 'undefined') {
                const { hostname, origin } = window.location;
                if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
                    API_URL = `${origin}/api`;
                }
            }
            try {
                const res = await fetch(`${API_URL}/health`);
                if (res.ok) setServerStatus('online');
                else setServerStatus('offline');
            } catch (err) {
                setServerStatus('offline');
            }
        };
        checkConnection();
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');

        const isRemote = (import.meta.env.VITE_DATA_MODE === 'remote') || (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1');
        
        try {
            if (isRemote) {
                let API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
                if (typeof window !== 'undefined') {
                    const { hostname } = window.location;
                    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
                        // Gunakan jalur relatif saja di produksi
                        API_URL = '/api';
                    }
                }
                
                // Track URL for debugging
                const targetUrl = API_URL.startsWith('http') ? `${API_URL}/login` : `${window.location.origin}${API_URL}/login`;
                
                const res = await fetch(targetUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                
                const result = await res.json();
                
                if (res.ok && result.success) {
                    localStorage.setItem('jwt_token', result.data.token);
                    
                    // Fetch all data immediately after login success
                    try {
                        const { api } = await import('../services/api');
                        const data = await api.fetchAllData();
                        if (data) {
                            dispatch({ type: 'SET_ALL_DATA', payload: data });
                        }
                    } catch (fetchErr) {
                        console.error("Initial data fetch failed:", fetchErr);
                    }

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
            const currentUrl = (window.location.hostname !== 'localhost') ? `${window.location.origin}/api/login` : 'http://localhost:5000/api/login';
            setError(`Gagal terhubung ke server (${currentUrl}). Pesan: ${err.message}. Pastikan internet aktif dan bukan blokir firewall.`);
            console.error(err);
        }
    };

    return (
        <div className="login-container" style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(155deg, #F4F7F5 0%, #E9F3EE 55%, #F4F7F5 100%)',
            padding: '20px'
        }}>
            <div className="card animate-in" style={{
                maxWidth: '410px',
                width: '100%',
                padding: '40px',
                borderRadius: '24px',
                border: '1px solid #E4EAE6',
                boxShadow: '0 20px 45px -15px rgba(19, 38, 30, 0.12)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{
                        width: '60px',
                        height: '60px',
                        background: '#157A52',
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px auto',
                        boxShadow: '0 10px 20px -6px rgba(21, 122, 82, 0.35)'
                    }}>
                        <LogIn size={28} color="#FFFFFF" />
                    </div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#13261E', marginBottom: '8px', letterSpacing: '-0.02em' }}>SIKAD DARELIMAN</h2>
                    <p style={{ color: '#6B7E75', fontSize: '0.875rem', fontWeight: 500 }}>Sistem Keuangan Dareliman — Berbasis PSAK 35</p>
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

                    <button type="submit" className="btn btn-primary w-full py-3.5 text-base font-bold rounded-xl shadow-lg shadow-emerald-600/25">
                        Masuk Sekarang
                    </button>
                </form>

                <div style={{ marginTop: '24px', textAlign: 'center' }}>
                    <div className="flex items-center justify-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                            serverStatus === 'online' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 
                            serverStatus === 'offline' ? 'bg-rose-500' : 'bg-slate-300 animate-pulse'
                        }`} />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Status Server: {
                                serverStatus === 'online' ? 'Tersambung' : 
                                serverStatus === 'offline' ? 'Terputus' : 'Mengecek...'
                            }
                        </span>
                    </div>
                </div>

                <div style={{ marginTop: '32px', textAlign: 'center' }}>
                    <p style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                        &copy; 2026 SIKAD (Sistem Keuangan Dareliman) — Sistem Akuntansi Yayasan Terintegrasi
                    </p>
                </div>
            </div>
        </div>
    );
}
