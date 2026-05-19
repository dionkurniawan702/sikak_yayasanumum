import { Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import Sidebar from './Sidebar';

export default function Layout() {
    const { state } = useApp();
    const navigate = useNavigate();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isSidebarHovered, setIsSidebarHovered] = useState(false);

    useEffect(() => {
        if (!state.currentUser) {
            navigate('/login');
        }
    }, [state.currentUser, navigate]);

    useEffect(() => {
        setIsSidebarOpen(false);
        setIsSidebarHovered(false);
    }, [navigate]);

    if (!state.currentUser) return null;

    const isSidebarActive = isSidebarOpen || isSidebarHovered;

    return (
        <div className="flex min-h-screen relative overflow-x-hidden">
            {/* Invisible hover trigger zone on the absolute left edge of screen */}
            <div 
                className="fixed left-0 top-0 bottom-0 w-3.5 z-[999] lg:block hidden cursor-pointer"
                onMouseEnter={() => setIsSidebarHovered(true)}
            />

            {isSidebarOpen && (
                <div
                    className="sidebar-overlay fixed inset-0 z-[999] bg-slate-900/40 backdrop-blur-sm lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <div
                onMouseEnter={() => setIsSidebarHovered(true)}
                onMouseLeave={() => setIsSidebarHovered(false)}
                className="contents"
            >
                <Sidebar isOpen={isSidebarActive} onClose={() => setIsSidebarOpen(false)} />
            </div>

            <main className={`main-content flex-1 w-full transition-all duration-300 ease-out pt-16 lg:pt-0 ${isSidebarActive ? 'lg:ml-72' : 'lg:ml-0'}`}>
                <div className="show-on-mobile fixed top-4 left-4 z-[1001] lg:hidden">
                    <button
                        className="mobile-nav-toggle p-2 bg-white rounded-lg shadow-md border border-slate-200"
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    >
                        {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>

                <Outlet />
            </main>
        </div>
    );
}
