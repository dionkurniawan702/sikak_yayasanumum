import React, { useState } from 'react';
import { User, Plus, Search, Filter, Download, Upload, Edit3, Trash2, Wallet, CreditCard, ChevronRight, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import * as XLSX from 'xlsx';

export default function StudentDatabase() {
    const { state, dispatch } = useApp();
    const { currentUser, students = [], units = [], incomeItems = [] } = state;
    const isUnitAdmin = currentUser?.role === 'admin_unit';
    
    const [searchTerm, setSearchTerm] = useState('');
    const [unitFilter, setUnitFilter] = useState(isUnitAdmin ? currentUser.unitId : 'all');
    const [academicYearFilter, setAcademicYearFilter] = useState('all');
    const [classFilter, setClassFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    
    const [showStudentModal, setShowStudentModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);
    const [showPaymentSettings, setShowPaymentSettings] = useState(null);
    const [studentForm, setStudentForm] = useState({ 
        name: '', nis: '', unitId: '', 
        classId: '', academicYearId: '', 
        statusId: '', parentStatusId: '',
        incomeDetails: []
    });
    const [paymentForm, setPaymentForm] = useState([]);

    const filteredStudents = students.filter(s => {
        if (isUnitAdmin && s.unitId !== currentUser.unitId) return false;
        const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             (s.nis && s.nis.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesUnit = unitFilter === 'all' || s.unitId === unitFilter;
        const matchesYear = academicYearFilter === 'all' || s.academicYearId === academicYearFilter;
        const matchesClass = classFilter === 'all' || s.classId === classFilter;
        const matchesStatus = statusFilter === 'all' || s.statusId === statusFilter;
        
        return matchesSearch && matchesUnit && matchesYear && matchesClass && matchesStatus && !s.isDeleted;
    });

    const handleOpenStudentModal = (student = null) => {
        if (student) {
            setEditingStudent(student);
            setStudentForm({ 
                name: student.name, 
                nis: student.nis || '', 
                unitId: student.unitId,
                classId: student.classId || '',
                academicYearId: student.academicYearId || '',
                statusId: student.statusId || '',
                parentStatusId: student.parentStatusId || '',
                incomeDetails: student.incomeDetails || []
            });
        } else {
            setEditingStudent(null);
            setStudentForm({ 
                name: '', nis: '', 
                unitId: isUnitAdmin ? currentUser.unitId : (units[0]?.id || ''),
                classId: '',
                academicYearId: state.academicYears?.find(y => y.isCurrent)?.id || '',
                statusId: state.studentStatuses?.find(s => s.name === 'Aktif')?.id || '',
                parentStatusId: '',
                incomeDetails: []
            });
        }
        setShowStudentModal(true);
    };

    const handleStudentSubmit = (e) => {
        e.preventDefault();
        const actionType = editingStudent ? 'EDIT_STUDENT' : 'ADD_STUDENT';
        const payload = editingStudent 
            ? { ...editingStudent, ...studentForm }
            : { id: crypto.randomUUID(), ...studentForm };
        
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

    const activeIncomeItemIdsForUnit = [...new Set(
        state.distributionSettings?.filter(s => s.unitId === studentForm.unitId).map(s => s.incomeItemId) || []
    )];
    const unitIncomeItems = incomeItems.filter(ii => activeIncomeItemIdsForUnit.includes(ii.id));

    return (
        <div className="p-8 animate-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-1 font-display">Database Siswa</h1>
                    <p className="text-slate-500 font-medium italic">Sumber Data Penerimaan Keuangan Yayasan</p>
                </div>
                <div className="flex gap-3">
                    {!isUnitAdmin && (
                        <button 
                            onClick={() => setShowImportModal(true)}
                            className="btn btn-secondary"
                        >
                            <Upload size={18} />
                            <span>Import Masal</span>
                        </button>
                    )}
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        className="form-input !pl-12 w-full" 
                        placeholder="Cari nama/NIS..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <select 
                    className={`form-select ${isUnitAdmin ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''}`}
                    value={unitFilter}
                    onChange={e => setUnitFilter(e.target.value)}
                    disabled={isUnitAdmin}
                >
                    <option value="all">Semua Unit</option>
                    {units.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                </select>
                <select 
                    className="form-select"
                    value={academicYearFilter}
                    onChange={e => setAcademicYearFilter(e.target.value)}
                >
                    <option value="all">Semua Thn Ajaran</option>
                    {state.academicYears?.map(y => (
                        <option key={y.id} value={y.id}>{y.name}</option>
                    ))}
                </select>
                <select 
                    className="form-select"
                    value={classFilter}
                    onChange={e => setClassFilter(e.target.value)}
                >
                    <option value="all">Semua Kelas</option>
                    {state.classes?.filter(c => unitFilter === 'all' || c.unitId === unitFilter).map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
                <select 
                    className="form-select"
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                >
                    <option value="all">Semua Status</option>
                    {state.studentStatuses?.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </select>
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
                        
                        <div className="flex flex-wrap gap-2 mb-6">
                            <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-[10px] font-black uppercase tracking-wider">
                                {units.find(u => u.id === student.unitId)?.name || 'Unknown Unit'}
                            </span>
                            {student.classId && (
                                <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-wider border border-indigo-100">
                                    {state.classes?.find(c => c.id === student.classId)?.name}
                                </span>
                            )}
                            {student.academicYearId && (
                                <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-wider border border-emerald-100">
                                    {state.academicYears?.find(y => y.id === student.academicYearId)?.name}
                                </span>
                            )}
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
                                <div className="grid grid-cols-2 gap-4">
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
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="form-label">Unit Pendidikan</label>
                                        <select
                                            required
                                            className={`form-select ${isUnitAdmin ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''}`}
                                            value={studentForm.unitId}
                                            onChange={e => setStudentForm({ ...studentForm, unitId: e.target.value })}
                                            disabled={isUnitAdmin}
                                        >
                                            <option value="">Pilih Unit</option>
                                            {units.map(u => (
                                                <option key={u.id} value={u.id}>{u.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="form-label">Kelas</label>
                                        <select
                                            className="form-select"
                                            value={studentForm.classId}
                                            onChange={e => setStudentForm({ ...studentForm, classId: e.target.value })}
                                        >
                                            <option value="">Pilih Kelas</option>
                                            {state.classes?.filter(c => c.unitId === studentForm.unitId).map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="form-label">Tahun Ajaran</label>
                                        <select
                                            className="form-select"
                                            value={studentForm.academicYearId}
                                            onChange={e => setStudentForm({ ...studentForm, academicYearId: e.target.value })}
                                        >
                                            <option value="">Pilih Tahun</option>
                                            {state.academicYears?.map(y => (
                                                <option key={y.id} value={y.id}>{y.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="form-label">Status Siswa</label>
                                        <select
                                            className="form-select"
                                            value={studentForm.statusId}
                                            onChange={e => setStudentForm({ ...studentForm, statusId: e.target.value })}
                                        >
                                            <option value="">Pilih Status</option>
                                            {state.studentStatuses?.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="form-label">Status Orang Tua / Ekonomi</label>
                                    <select
                                        className="form-select"
                                        value={studentForm.parentStatusId}
                                        onChange={e => setStudentForm({ ...studentForm, parentStatusId: e.target.value })}
                                    >
                                        <option value="">Pilih Status Orang Tua</option>
                                        {state.parentStatuses?.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {unitIncomeItems.length > 0 && (
                                    <div className="pt-4 pb-2 border-t border-slate-100 mt-2">
                                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Nominal Item Penerimaan (Khusus Unit Ini)</h3>
                                        <div className="space-y-3 max-h-[30vh] overflow-y-auto pr-2 custom-scrollbar">
                                            {unitIncomeItems.map(item => {
                                                const existingDetail = studentForm.incomeDetails?.find(d => d.incomeItemId === item.id);
                                                return (
                                                    <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 bg-slate-50 border border-slate-100 rounded-2xl hover:border-blue-200 transition-all">
                                                        <span className="text-sm font-bold text-slate-700">{item.name}</span>
                                                        <div className="relative w-full sm:w-1/2 md:w-[45%]">
                                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">Rp</span>
                                                            <input 
                                                                type="number"
                                                                className="form-input !py-2 !pl-9 !text-sm text-right font-black text-blue-600 !rounded-xl"
                                                                placeholder="0"
                                                                value={existingDetail?.amount || ''}
                                                                onChange={e => {
                                                                    const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                                                                    const newDetails = [...(studentForm.incomeDetails || [])];
                                                                    const idx = newDetails.findIndex(d => d.incomeItemId === item.id);
                                                                    if (idx >= 0) newDetails[idx].amount = val;
                                                                    else newDetails.push({ incomeItemId: item.id, amount: val });
                                                                    setStudentForm({ ...studentForm, incomeDetails: newDetails });
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-3 pt-4 border-t border-slate-100">
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
