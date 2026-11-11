import { Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
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
        <div className="flex min-h-screen relative overflow-x-clip bg-gradient-to-br from-[#0B1E3D] via-[#174673] to-[#1A7385] lg:bg-none lg:bg-[#F4F7F5] print:bg-white">
            <Sidebar
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                isCollapsed={isSidebarCollapsed}
                onToggleCollapse={toggleSidebarCollapse}
                isCmdOpen={isCmdOpen}
                onOpenCmd={() => setIsCmdOpen(true)}
                onCloseCmd={() => setIsCmdOpen(false)}
            />

            <main
                onClick={() => {
                    if (isSidebarOpen && window.innerWidth < 1024) {
                        setIsSidebarOpen(false);
                    }
                }}
                className={`main-content relative z-[950] lg:z-auto flex-1 min-w-0 w-full bg-[#F4F7F5] min-h-screen transition-all duration-300 ease-out flex flex-col print:ml-0 print:bg-white print:transform-none ${
                    isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'
                } ${
                    isSidebarOpen
                        ? 'translate-x-[252px] scale-[0.86] origin-left rounded-[28px] shadow-[0_28px_65px_rgba(5,15,32,0.55)] h-screen overflow-hidden cursor-pointer ring-1 ring-white/30 lg:translate-x-0 lg:scale-100 lg:origin-center lg:rounded-none lg:shadow-none lg:h-auto lg:overflow-visible lg:cursor-default lg:ring-0'
                        : ''
                }`}
            >
                <TopBar
                    onOpenSearch={() => setIsCmdOpen(true)}
                    isSidebarOpen={isSidebarOpen}
                    onToggleMobileMenu={() => setIsSidebarOpen(prev => !prev)}
                />

                <div className={`flex-1 flex flex-col ${isSidebarOpen ? 'pointer-events-none select-none lg:pointer-events-auto lg:select-auto' : ''}`}>
                    <ErrorBoundary>
                        <Outlet />
                    </ErrorBoundary>
                </div>
            </main>
        </div>
    );
}
