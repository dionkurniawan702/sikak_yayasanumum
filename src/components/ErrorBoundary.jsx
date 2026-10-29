import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('[SIKAD ErrorBoundary caught an error]:', error, errorInfo);
    }

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-[50vh] flex items-center justify-center p-6">
                    <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-rose-100 shadow-xl shadow-rose-500/5 text-center">
                        <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-100">
                            <AlertTriangle size={32} />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 mb-2">Terjadi Kesalahan Tampilan</h3>
                        <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                            Halaman ini mengalami kendala teknis saat memuat komponen. Silakan segarkan halaman untuk mencoba kembali.
                        </p>
                        {this.state.error && (
                            <div className="mb-6 p-3 bg-slate-50 rounded-xl text-left border border-slate-200">
                                <p className="text-[10px] font-mono text-rose-600 break-words line-clamp-3">
                                    {this.state.error.toString()}
                                </p>
                            </div>
                        )}
                        <button
                            onClick={this.handleReload}
                            className="w-full py-3 px-6 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg"
                        >
                            <RotateCcw size={16} />
                            Segarkan Halaman
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;

