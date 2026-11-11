import { Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import Sidebar from './Sidebar';
import ErrorBoundary from './ErrorBoundary';

export default function Layout() {
    const { state } = useApp();
    const navigate = useNavigate();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
        try {
            return localStorage.getItem('sikad_sidebar_collapsed') === 'true';
        } catch {
            return false;
        }
    });

    const toggleSidebarCollapse = () => {
        setIsSidebarCollapsed(prev => {
            const next = !prev;
            try {
                localStorage.setItem('sikad_sidebar_collapsed', String(next));
            } catch {
                // ignore storage errors
            }
            return next;
        });
    };

    useEffect(() => {
        if (!state.currentUser) {
            navigate('/login');
        }
    }, [state.currentUser, navigate]);

    useEffect(() => {
        setIsSidebarOpen(false);
    }, [navigate]);

    if (!state.currentUser) return null;

    return (
        <div className="flex min-h-screen relative">
            {isSidebarOpen && (
                <div
                    className="sidebar-overlay fixed inset-0 z-[999] bg-slate-900/40 backdrop-blur-sm lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <Sidebar
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                isCollapsed={isSidebarCollapsed}
                onToggleCollapse={toggleSidebarCollapse}
            />

            <main className={`main-content flex-1 min-w-0 w-full ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'} transition-all duration-300 pt-16 lg:pt-0`}>
                <div className="show-on-mobile fixed top-4 left-4 z-[1001] lg:hidden">
                    <button
                        className="mobile-nav-toggle p-2 bg-white rounded-lg shadow-md border border-slate-200"
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    >
                        {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>

                <ErrorBoundary>
                    <Outlet />
                </ErrorBoundary>
            </main>
        </div>
    );
}
