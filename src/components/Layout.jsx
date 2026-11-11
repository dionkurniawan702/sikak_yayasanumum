import { Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import ErrorBoundary from './ErrorBoundary';

export default function Layout() {
    const { state } = useApp();
    const navigate = useNavigate();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isCmdOpen, setIsCmdOpen] = useState(false);
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
                isCmdOpen={isCmdOpen}
                onOpenCmd={() => setIsCmdOpen(true)}
                onCloseCmd={() => setIsCmdOpen(false)}
            />

            <main className={`main-content flex-1 min-w-0 w-full ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'} transition-all duration-300 flex flex-col`}>
                <div className="show-on-mobile fixed top-3 left-3 z-[1001] lg:hidden">
                    <button
                        className="mobile-nav-toggle p-2 bg-white rounded-xl shadow-xs border border-[#DCE4DF] text-[#24372F]"
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    >
                        {isSidebarOpen ? <X size={19} /> : <Menu size={19} />}
                    </button>
                </div>

                <TopBar onOpenSearch={() => setIsCmdOpen(true)} />

                <ErrorBoundary>
                    <Outlet />
                </ErrorBoundary>
            </main>
        </div>
    );
}
