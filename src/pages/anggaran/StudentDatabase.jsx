import React, { useState } from 'react';
import { User, Plus, Search, Filter, Download, Upload, Edit3, Trash2, Wallet, CreditCard, ChevronRight, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import * as XLSX from 'xlsx';

export default function StudentDatabase() {
    const { state, dispatch } = useApp();
    const { students = [], units = [], incomeItems = [] } = state;
    
    const [searchTerm, setSearchTerm] = useState('');
    const [unitFilter, setUnitFilter] = useState('all');
    const [showStudentModal, setShowStudentModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);
    const [showPaymentSettings, setShowPaymentSettings] = useState(null);
    const [studentForm, setStudentForm] = useState({ name: '', nis: '', unitId: '' });
    const [paymentForm, setPaymentForm] = useState([]);

    const filteredStudents = students.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             (s.nis && s.nis.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesUnit = unitFilter === 'all' || s.unitId === unitFilter;
        return matchesSearch && !s.isDeleted;
    });

    const handleOpenStudentModal = (student = null) => {
        if (student) {
            setEditingStudent(student);
            setStudentForm({ name: student.name, nis: student.nis || '', unitId: student.unitId });
        } else {
            setEditingStudent(null);
            setStudentForm({ name: '', nis: '', unitId: units[0]?.id || '' });
        }
        setShowStudentModal(true);
    };

    const handleStudentSubmit = (e) => {
        e.preventDefault();
        const actionType = editingStudent ? 'EDIT_STUDENT' : 'ADD_STUDENT';
        const payload = editingStudent 
            ? { ...editingStudent, ...studentForm }
            : { id: crypto.randomUUID(), ...studentForm, incomeDetails: incomeItems.map(ii => ({ incomeItemId: ii.id, amount: 0 })) };
        
        dispatch({ type: actionType, payload });
        setShowStudentModal(false);
    };

    const handleDeleteStudent = (id) => {
        if (window.confirm('Hapus data siswa ini?')) {
            dispatch({ type: 'DELETE_STUDENT', payload: id });
        }
    };

    const handleOpenPaymentSettings = (student) => {
        setShowPaymentSettings(student);
        setPaymentForm(incomeItems.map(ii => {
            const detail = student.incomeDetails?.find(d => d.incomeItemId === ii.id);
            return { incomeItemId: ii.id, name: ii.name, amount: detail?.amount || 0 };
        }));
    };

    const handlePaymentSubmit = () => {
        const updatedStudent = {
            ...showPaymentSettings,
            incomeDetails: paymentForm.map(p => ({ incomeItemId: p.incomeItemId, amount: parseFloat(p.amount) || 0 }))
        };
        dispatch({ type: 'EDIT_STUDENT', payload: updatedStudent });
        setShowPaymentSettings(null);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws);
            
            if (window.confirm(`Import ${data.length} data siswa?`)) {
                data.forEach(item => {
                    const unit = units.find(u => u.name.toLowerCase() === item.Unit?.toLowerCase());
                    dispatch({
                        type: 'ADD_STUDENT',
                        payload: {
                            id: crypto.randomUUID(),
                            name: item.Nama,
                            nis: item.NIS || '',
                            unitId: unit?.id || units[0]?.id,
                            incomeDetails: incomeItems.map(ii => ({
                                incomeItemId: ii.id,
                                amount: item[ii.name] || 0
                            }))
                        }
                    });
                });
                setShowImportModal(false);
            }
        };
        reader.readAsBinaryString(file);
    };

    return (
        <div className="p-8 animate-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-1 font-display">Database Siswa</h1>
                    <p className="text-slate-500 font-medium italic">Sumber Data Penerimaan Keuangan Yayasan</p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={() => setShowImportModal(true)}
                        className="btn btn-secondary"
                    >
                        <Upload size={18} />
                        <span>Import Masal</span>
                    </button>
                    <button 
                        onClick={() => handleOpenStudentModal()}
                        className="btn btn-primary"
                    >
                        <Plus size={18} />
                        <span>Tambah Siswa</span>
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-8">
                <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        className="form-input !pl-12" 
                        placeholder="Cari nama atau NIS siswa..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="w-full md:w-64 relative">
                    <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <select 
                        className="form-select !pl-12"
                        value={unitFilter}
                        onChange={e => setUnitFilter(e.target.value)}
                    >
                        <option value="all">Semua Unit</option>
                        {units.map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Student List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredStudents.length > 0 ? filteredStudents.map(student => (
                    <div key={student.id} className="card p-6 group hover:border-blue-200 transition-all">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-14 h-14 bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 rounded-2xl flex items-center justify-center text-xl font-black shadow-inner">
                                {student.name.charAt(0)}
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={() => handleOpenStudentModal(student)}
                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                >
                                    <Edit3 size={16} />
                                </button>
                                <button 
                                    onClick={() => handleDeleteStudent(student.id)}
                                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                        
                        <h3 className="font-black text-slate-900 text-lg mb-1">{student.name}</h3>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">NIS: {student.nis || '-'}</p>
                        
                        <div className="flex items-center gap-2 mb-6">
                            <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-[10px] font-black uppercase tracking-wider">
                                {units.find(u => u.id === student.unitId)?.name || 'Unknown Unit'}
                            </span>
                        </div>

                        <button 
                            onClick={() => handleOpenPaymentSettings(student)}
                            className="w-full btn btn-secondary !py-2 !text-xs !rounded-xl border-dashed border-2 hover:border-blue-400 hover:text-blue-600"
                        >
                            <Wallet size={14} />
                            <span>Setting Pembayaran (Budget)</span>
                        </button>
                    </div>
                )) : (
                    <div className="col-span-full py-20 text-center">
                        <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-6 text-slate-300">
                            <User size={40} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Tidak ada data siswa</h3>
                        <p className="text-slate-500">Silakan tambah siswa secara manual atau melalui fitur import masal.</p>
                    </div>
                )}
            </div>

            {/* Student Modal */}
            {showStudentModal && (
                <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowStudentModal(false)} />
                    <div className="bg-white rounded-[32px] w-full max-w-md relative z-10 shadow-2xl animate-in">
                        <div className="p-8">
                            <h2 className="text-2xl font-black text-slate-900 mb-6 font-display">
                                {editingStudent ? 'Edit' : 'Tambah'} Siswa
                            </h2>
                            <form onSubmit={handleStudentSubmit} className="space-y-6">
                                <div>
                                    <label className="form-label">Nama Lengkap</label>
                                    <input
                                        type="text"
                                        required
                                        className="form-input"
                                        value={studentForm.name}
                                        onChange={e => setStudentForm({ ...studentForm, name: e.target.value })}
                                        placeholder="Nama Lengkap Siswa"
                                    />
                                </div>
                                <div>
                                    <label className="form-label">NIS (Pilihan)</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={studentForm.nis}
                                        onChange={e => setStudentForm({ ...studentForm, nis: e.target.value })}
                                        placeholder="Nomor Induk Siswa"
                                    />
                                </div>
                                <div>
                                    <label className="form-label">Unit Pendidikan</label>
                                    <select
                                        required
                                        className="form-select"
                                        value={studentForm.unitId}
                                        onChange={e => setStudentForm({ ...studentForm, unitId: e.target.value })}
                                    >
                                        <option value="">Pilih Unit</option>
                                        {units.map(u => (
                                            <option key={u.id} value={u.id}>{u.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button type="button" onClick={() => setShowStudentModal(false)} className="btn btn-secondary flex-1">Batal</button>
                                    <button type="submit" className="btn btn-primary flex-1 shadow-blue-500/20">Simpan Siswa</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Settings Modal */}
            {showPaymentSettings && (
                <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm shadow-xl" onClick={() => setShowPaymentSettings(null)} />
                    <div className="bg-white rounded-[40px] w-full max-w-2xl relative z-10 shadow-2xl overflow-hidden animate-in">
                        <div className="p-10">
                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 font-display">Setting Pembayaran Tahunan</h2>
                                    <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] mt-1">{showPaymentSettings.name}</p>
                                </div>
                                <button onClick={() => setShowPaymentSettings(null)} className="p-3 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-2xl transition-all">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="max-h-[50vh] overflow-y-auto pr-4 space-y-4 mb-8 custom-scrollbar">
                                {paymentForm.map((item, idx) => (
                                    <div key={item.incomeItemId} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-200 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
                                                <CreditCard size={18} />
                                            </div>
                                            <span className="font-bold text-slate-700 text-sm">{item.name}</span>
                                        </div>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">Rp</span>
                                            <input 
                                                type="number" 
                                                className="form-input !py-2 !pl-10 !w-40 text-right font-black text-blue-600"
                                                value={item.amount}
                                                onChange={e => {
                                                    const newForm = [...paymentForm];
                                                    newForm[idx].amount = e.target.value;
                                                    setPaymentForm(newForm);
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-4">
                                <button onClick={() => setShowPaymentSettings(null)} className="btn btn-secondary flex-1">Batal</button>
                                <button onClick={handlePaymentSubmit} className="btn btn-primary flex-1 shadow-blue-500/20">Simpan Budgeting Siswa</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Import Modal */}
            {showImportModal && (
                <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowImportModal(false)} />
                    <div className="bg-white rounded-[40px] w-full max-w-lg relative z-10 shadow-2xl animate-in">
                        <div className="p-10">
                            <h2 className="text-2xl font-black text-slate-900 mb-2 font-display">Import Masal Siswa</h2>
                            <p className="text-slate-500 mb-8 font-medium">Gunakan file Excel atau CSV sesuai template untuk mempercepat penginputan data siswa dan budget tahunannya.</p>
                            
                            <div className="mb-8 p-10 border-4 border-dashed border-slate-100 rounded-[32px] flex flex-col items-center justify-center text-center hover:border-blue-200 transition-all group">
                                <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <Download size={32} />
                                </div>
                                <label className="cursor-pointer">
                                    <span className="btn btn-primary shadow-blue-500/10 mb-2">Pilih File XLSX/CSV</span>
                                    <input type="file" className="hidden" accept=".xlsx,.csv" onChange={handleFileUpload} />
                                </label>
                                <p className="text-xs text-slate-400 font-bold mt-4 uppercase tracking-widest">Maksimal file 10MB</p>
                            </div>

                            <button onClick={() => setShowImportModal(false)} className="w-full btn btn-secondary">Tutup</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
