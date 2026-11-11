import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Key, User as UserIcon, AlertCircle, Clock, Eye, EyeOff, Check, ArrowLeft, HelpCircle, ShieldCheck } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function Login() {
    const { state, dispatch } = useApp();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const isExpired = searchParams.get('expired') === 'true';
    const [username, setUsername] = useState(() => {
        try {
            return localStorage.getItem('sikad_remember_username') || '';
        } catch {
            return '';
        }
    });
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberUsername, setRememberUsername] = useState(() => {
        try {
            return Boolean(localStorage.getItem('sikad_remember_username'));
        } catch {
            return false;
        }
    });
    const [activeView, setActiveView] = useState('login'); // 'login' | 'help'
    const [isSubmitting, setIsSubmitting] = useState(false);
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
        setIsSubmitting(true);

        try {
            try {
                if (rememberUsername && username.trim()) {
                    localStorage.setItem('sikad_remember_username', username.trim());
                } else {
                    localStorage.removeItem('sikad_remember_username');
                }
            } catch {
                // ignore storage errors
            }

            const isRemote = (import.meta.env.VITE_DATA_MODE === 'remote') || (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1');
            
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
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="login-container min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden bg-gradient-to-br from-[#08241C] via-[#0A293A] to-[#071830]">
            {/* Ambient Emerald, Cobalt Blue & Soft Gold Glows */}
            <div className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[#157A52]/24 blur-3xl" />
            <div className="pointer-events-none absolute -top-20 -right-20 w-80 h-80 rounded-full bg-[#2563EB]/18 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-[#1D4ED8]/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 left-12 w-72 h-72 rounded-full bg-[#C28D38]/10 blur-3xl" />

            {/* Main Diagonal Split-Blade Card */}
            <div className="w-full max-w-[840px] md:min-h-[500px] rounded-[28px] bg-gradient-to-br from-[#0F4938] via-[#0E3A4D] to-[#0B2342] shadow-[0_28px_90px_-12px_rgba(3,10,24,0.72)] relative overflow-hidden animate-in fade-in zoom-in-95 duration-300 flex flex-col md:block">
                {/* Sliding Ivory Cream Backdrop (Desktop Only: keeps opposite curved corners matching dark blade with zero white edge bleed) */}
                <div
                    className="hidden md:block absolute top-0 bottom-0 w-[55%] z-0 bg-[#FCF9F1] transition-all duration-700 ease-in-out"
                    style={{ left: activeView === 'login' ? '0%' : '45%' }}
                />

                {/* Mobile Top Emerald-to-Blue Header Banner */}
                <div className="md:hidden bg-gradient-to-br from-[#0F4938] via-[#0E3A4D] to-[#0B2342] px-7 pt-7 pb-10 text-white relative">
                    <p className="text-[10px] font-bold tracking-[0.26em] uppercase text-[#DFB262]">SIKAD DARELIMAN</p>
                    <h1
                        className="mt-2 text-left text-4xl sm:text-[42px] text-[#FAF6EC] leading-[1.12] tracking-normal font-normal drop-shadow-sm"
                        style={{ fontFamily: "'Berkshire Swash', Georgia, serif" }}
                    >
                        Ahlan wa sahlan.
                    </h1>
                    <p className="text-xs text-sky-100/80 mt-2.5 leading-relaxed">
                        Sistem Keuangan Dareliman berbasis PSAK 35.
                    </p>
                </div>

                {/* Desktop & Mobile Panel Wrapper */}
                <div className="relative flex-1 md:min-h-[500px] flex flex-col md:flex-row bg-[#FCF9F1] rounded-t-[24px] -mt-4 pt-1 md:bg-transparent md:rounded-none md:mt-0 md:pt-0 z-10">
                    {/* LEFT SLOT: Login Form Panel */}
                    <div
                        className={`w-full md:w-[47%] px-7 py-7 sm:px-10 sm:py-10 flex flex-col justify-center relative z-10 transition-all duration-500 ${
                            activeView === 'login'
                                ? 'opacity-100 translate-x-0 pointer-events-auto flex'
                                : 'hidden md:flex md:opacity-0 md:-translate-x-4 md:pointer-events-none'
                        }`}
                    >
                        <div className="mb-7">
                            <h2 className="text-2xl sm:text-[26px] font-extrabold text-[#102937] tracking-tight leading-none">
                                Masuk
                            </h2>
                            <div className="w-10 h-[2.5px] bg-gradient-to-r from-[#157A52] via-[#136690] to-[#C28D38] rounded-full mt-2" />
                        </div>

                        {error && (
                            <div className="bg-rose-50 text-rose-800 px-3.5 py-2.5 rounded-xl mb-5 text-xs font-medium flex items-start gap-2.5 border border-rose-200/80">
                                <AlertCircle size={15} className="text-rose-600 shrink-0 mt-0.5" />
                                <span className="leading-relaxed">{error}</span>
                            </div>
                        )}

                        {isExpired && !error && (
                            <div className="bg-amber-50 text-amber-900 px-3.5 py-2.5 rounded-xl mb-5 text-xs font-medium flex items-center gap-2.5 border border-amber-200">
                                <Clock size={15} className="text-amber-600 shrink-0" />
                                <span>Sesi Anda telah berakhir. Silakan login kembali.</span>
                            </div>
                        )}

                        <form onSubmit={handleLogin} className="space-y-5">
                            {/* Username Minimalist Underline Input */}
                            <div>
                                <div className="relative">
                                    <input
                                        type="text"
                                        aria-label="Username"
                                        placeholder="Username"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="login-underline-input w-full bg-transparent border-0 border-b border-[#D6D0C2] focus:border-[#135E7A] py-2.5 pr-8 text-sm font-medium text-[#102937] placeholder-[#8E8B80] outline-none transition-colors"
                                        required
                                    />
                                    <UserIcon
                                        size={16}
                                        className="absolute right-0.5 top-1/2 -translate-y-1/2 text-[#8E8B80] pointer-events-none"
                                    />
                                </div>
                            </div>

                            {/* Password Minimalist Underline Input */}
                            <div>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        aria-label="Password"
                                        placeholder="Password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="login-underline-input w-full bg-transparent border-0 border-b border-[#D6D0C2] focus:border-[#135E7A] py-2.5 pr-8 text-sm font-medium text-[#102937] placeholder-[#8E8B80] outline-none transition-colors"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-0 top-1/2 -translate-y-1/2 text-[#8E8B80] hover:text-[#13261E] p-1 transition-colors cursor-pointer"
                                        title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            {/* Helper Row: Ingat Username + Lupa Password */}
                            <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                                <label className="inline-flex items-center gap-2 cursor-pointer select-none text-[#4E5B53] font-medium">
                                    <button
                                        type="button"
                                        role="checkbox"
                                        aria-checked={rememberUsername}
                                        onClick={() => setRememberUsername(prev => !prev)}
                                        className={`w-4 h-4 rounded-[4px] flex items-center justify-center border transition-all cursor-pointer ${
                                            rememberUsername
                                                ? 'bg-gradient-to-br from-[#157A52] to-[#1B4E8C] border-[#135E7A] text-white'
                                                : 'bg-white border-[#C9C2B2]'
                                        }`}
                                    >
                                        {rememberUsername && <Check size={11} strokeWidth={3} />}
                                    </button>
                                    <span>Ingat username</span>
                                </label>

                                <button
                                    type="button"
                                    onClick={() => setActiveView('help')}
                                    className="text-[#A87528] hover:text-[#7E5518] font-semibold underline decoration-[#C28D38]/70 underline-offset-4 transition-colors cursor-pointer"
                                >
                                    Lupa password?
                                </button>
                            </div>

                            {/* Primary Pill Submit Button */}
                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#0F523B] via-[#135E6B] to-[#1B4982] hover:from-[#13664A] hover:via-[#177080] hover:to-[#22589B] text-white text-sm font-bold tracking-wide shadow-[0_12px_28px_-6px_rgba(17,78,108,0.48)] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
                                >
                                    {isSubmitting ? 'Memproses...' : 'Masuk Sekarang'}
                                </button>
                            </div>
                        </form>

                        {/* Bottom Secondary Action */}
                        <div className="mt-6 text-center md:text-left text-xs text-[#6B7066]">
                            <span>Butuh akses unit baru? </span>
                            <button
                                type="button"
                                onClick={() => setActiveView('help')}
                                className="font-bold text-[#102937] underline decoration-[#C28D38] decoration-2 underline-offset-4 hover:text-[#14658E] transition-colors cursor-pointer"
                            >
                                Panduan &amp; Kontak Admin
                            </button>
                        </div>

                        {/* Mobile Server Status Indicator */}
                        <div className="mt-5 md:hidden flex items-center justify-center gap-2">
                            <span
                                className={`w-2 h-2 rounded-full ${
                                    serverStatus === 'online'
                                        ? 'bg-emerald-500'
                                        : serverStatus === 'offline'
                                            ? 'bg-rose-500'
                                            : 'bg-slate-400 animate-pulse'
                                }`}
                            />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-[#7A7E75]">
                                Status Server: {serverStatus === 'online' ? 'Tersambung' : serverStatus === 'offline' ? 'Terputus' : 'Mengecek...'}
                            </span>
                        </div>
                    </div>

                    {/* RIGHT SLOT: Bantuan & Panduan Akses Panel (Revealed when Diagonal Blade slides Left) */}
                    <div
                        className={`w-full md:w-[47%] md:ml-auto px-7 py-7 sm:px-10 sm:py-10 flex flex-col justify-center relative z-10 transition-all duration-500 ${
                            activeView === 'help'
                                ? 'opacity-100 translate-x-0 pointer-events-auto flex'
                                : 'hidden md:flex md:opacity-0 md:translate-x-4 md:pointer-events-none'
                        }`}
                    >
                        <div className="mb-6">
                            <h2 className="text-2xl sm:text-[26px] font-extrabold text-[#102937] tracking-tight leading-none">
                                Bantuan Akses
                            </h2>
                            <div className="w-10 h-[2.5px] bg-gradient-to-r from-[#157A52] via-[#136690] to-[#C28D38] rounded-full mt-2" />
                        </div>

                        <div className="space-y-4 text-xs text-[#3D4B43] leading-relaxed">
                            <div className="p-4 rounded-2xl bg-white border border-[#E5DEC9] shadow-2xs flex items-start gap-3">
                                <div className="w-8 h-8 rounded-xl bg-[#E9F5EF] text-[#157A52] flex items-center justify-center shrink-0">
                                    <ShieldCheck size={16} />
                                </div>
                                <div>
                                    <p className="font-bold text-[#102937] mb-0.5">Pembuatan &amp; Reset Akun</p>
                                    <p className="text-[#5C665E]">
                                        Akun unit pendidikan &amp; bidang dikelola terpusat oleh Super Administrator Keuangan Yayasan Dareliman untuk menjaga integritas data PSAK 35.
                                    </p>
                                </div>
                            </div>

                            <div className="p-4 rounded-2xl bg-white border border-[#E5DEC9] shadow-2xs flex items-start gap-3">
                                <div className="w-8 h-8 rounded-xl bg-[#E8F2FC] text-[#1D5EA8] flex items-center justify-center shrink-0">
                                    <HelpCircle size={16} />
                                </div>
                                <div>
                                    <p className="font-bold text-[#102937] mb-0.5">Lupa Username / Password?</p>
                                    <p className="text-[#5C665E]">
                                        Silakan hubungi bagian <strong>Keuangan Yayasan Dareliman (Superadmin)</strong> untuk melakukan reset kata sandi sementara atau aktivasi unit baru.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-7">
                            <button
                                type="button"
                                onClick={() => setActiveView('login')}
                                className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#0F523B] via-[#135E6B] to-[#1B4982] hover:from-[#13664A] hover:via-[#177080] hover:to-[#22589B] text-white text-sm font-bold tracking-wide shadow-[0_12px_28px_-6px_rgba(17,78,108,0.48)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <ArrowLeft size={16} />
                                Kembali ke Login
                            </button>
                        </div>
                    </div>
                </div>

                {/* ANIMATED DIAGONAL EMERALD-TO-BLUE BLADE (Desktop Only) */}
                <div
                    className="hidden md:flex flex-col justify-center absolute -top-px -bottom-px w-[55%] z-20 transition-all duration-700 ease-in-out overflow-hidden bg-gradient-to-br from-[#0F4938] via-[#0E3A4D] to-[#0B2342] text-white"
                    style={{
                        left: activeView === 'login' ? '45.5%' : '-0.5%',
                        clipPath:
                            activeView === 'login'
                                ? 'polygon(14% 0%, 100% 0%, 100% 100%, 0% 100%)'
                                : 'polygon(0% 0%, 100% 0%, 86% 100%, 0% 100%)',
                        paddingLeft: activeView === 'login' ? '4.5rem' : '2.75rem',
                        paddingRight: activeView === 'login' ? '2.5rem' : '4.5rem'
                    }}
                >
                    {/* Subtle Cobalt Blue, Emerald & Soft Gold Diagonal Edge Aura */}
                    <div className="pointer-events-none -top-12 -right-12 absolute w-56 h-56 rounded-full bg-[#38BDF8]/18 blur-3xl" />
                    <div className="pointer-events-none -bottom-16 left-8 w-56 h-56 absolute rounded-full bg-[#10B981]/20 blur-3xl" />
                    <div className="pointer-events-none top-1/2 -left-10 w-40 h-40 absolute rounded-full bg-[#D49B27]/10 blur-3xl" />

                    <div className="relative z-10 max-w-[320px]">
                        <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-[#DFB262]">
                            {activeView === 'login' ? 'SIKAD DARELIMAN' : 'PUSAT BANTUAN'}
                        </p>

                        <h1 className="mt-3 text-left">
                            {activeView === 'login' ? (
                                <span
                                    className="block text-[44px] lg:text-[52px] text-[#FAF6EC] leading-[1.12] tracking-normal font-normal drop-shadow-sm"
                                    style={{ fontFamily: "'Berkshire Swash', Georgia, serif" }}
                                >
                                    Ahlan wa <br />
                                    sahlan.
                                </span>
                            ) : (
                                <span className="block text-3xl lg:text-[34px] font-serif font-bold text-[#FAF6EC] leading-[1.15]">
                                    Akses aman <br />
                                    <span className="italic font-normal text-[#F2EAD5]">terkelola pusat.</span>
                                </span>
                            )}
                        </h1>

                        <p className="text-xs leading-relaxed text-sky-100/80 mt-4 font-normal">
                            {activeView === 'login'
                                ? 'Sistem Keuangan Yayasan Dareliman berbasis PSAK 35 — pantau RAP, realisasi RAB, dan laporan secara terintegrasi.'
                                : 'Setiap pengajuan akun & pembaruan kata sandi diverifikasi langsung oleh Superadmin untuk keamanan data keuangan yayasan.'}
                        </p>

                        <div className="mt-8 pt-5 border-t border-white/10 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <span
                                    className={`w-2 h-2 rounded-full shrink-0 ${
                                        serverStatus === 'online'
                                            ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]'
                                            : serverStatus === 'offline'
                                                ? 'bg-rose-400'
                                                : 'bg-amber-300 animate-pulse'
                                    }`}
                                />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-sky-100/85">
                                    Server: {serverStatus === 'online' ? 'Tersambung' : serverStatus === 'offline' ? 'Terputus' : 'Mengecek...'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Subtle Footer Caption Below Card */}
            <p className="mt-6 text-[11px] text-sky-100/50 text-center tracking-wide">
                &copy; 2026 SIKAD Dareliman — Sistem Keuangan Yayasan Terintegrasi (PSAK 35)
            </p>
        </div>
    );
}
