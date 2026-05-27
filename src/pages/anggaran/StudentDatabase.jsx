import React, { useState, useMemo } from 'react';
import { User, Plus, Search, Filter, Download, Upload, Edit3, Trash2, Wallet, CreditCard, ChevronRight, X, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { formatAngka, formatRupiah } from '../../utils/format';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export default function StudentDatabase() {
    const { state, dispatch } = useApp();
    const { currentUser, students = [], units = [], incomeItems = [] } = state;
    const isUnitAdmin = currentUser?.role === 'admin_unit';
    
    const [searchTerm, setSearchTerm] = useState('');
    const [unitFilter, setUnitFilter] = useState(isUnitAdmin ? currentUser.unitId : 'all');
    
    // Global Academic Year Filter
    const academicYearFilter = state.globalAcademicYearId || 'all';
    const setAcademicYearFilter = (id) => dispatch({ type: 'SET_GLOBAL_YEAR', payload: id });
    const [classFilter, setClassFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [showAllYears, setShowAllYears] = useState(false);
    
    // Help calculate defaults for modal
    const sortedYearsCurrent = [...(state.academicYears || [])].filter(ay => !ay.isDeleted).sort((a, b) => (b.name || '').localeCompare(a.name || ''));
    
    // Budget Locking Logic
    const getBudgetStatus = (unitId, yearId) => {
        if (!unitId || !yearId) return 'DRAFT';
        const planId = `${yearId}-${unitId}`;
        return state.rabPlans?.find(p => p.id === planId)?.status || 'DRAFT';
    };

    const isBudgetLocked = (unitId, yearId) => {
        if (currentUser?.role === 'superadmin') return false;
        const status = getBudgetStatus(unitId, yearId);
        return status === 'PENDING' || status === 'APPROVED';
    };

    // Global lock state based on filters (for bulk actions)
    const activeLock = unitFilter !== 'all' && academicYearFilter !== 'all' && isBudgetLocked(unitFilter, academicYearFilter);
    const activeBudgetStatus = unitFilter !== 'all' && academicYearFilter !== 'all' ? getBudgetStatus(unitFilter, academicYearFilter) : null;
    
    const [showStudentModal, setShowStudentModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [selectedStudents, setSelectedStudents] = useState([]);
    const [editingStudent, setEditingStudent] = useState(null);
    const [showPaymentSettings, setShowPaymentSettings] = useState(null);
    const [studentForm, setStudentForm] = useState({ 
        name: '', nis: '', unitId: '', 
        classId: '', academicYearId: '', 
        statusId: '', parentStatusId: '',
        gender: '',
        incomeDetails: []
    });
    const [paymentForm, setPaymentForm] = useState([]);
    const [importData, setImportData] = useState([]);
    const [isImporting, setIsImporting] = useState(false);

    const filteredStudents = useMemo(() => {
        return students.filter(s => {
            if (isUnitAdmin && s.unitId !== currentUser.unitId) return false;
            const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                 (s.nis && s.nis.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesUnit = unitFilter === 'all' || s.unitId === unitFilter;
            const matchesYear = academicYearFilter === 'all' || s.academicYearId === academicYearFilter;
            const matchesClass = classFilter === 'all' || s.classId === classFilter;
            const matchesStatus = statusFilter === 'all' || s.statusId === statusFilter;
            
            return matchesSearch && matchesUnit && matchesYear && matchesClass && matchesStatus && !s.isDeleted;
        });
    }, [students, isUnitAdmin, currentUser.unitId, searchTerm, unitFilter, academicYearFilter, classFilter, statusFilter]);

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
                gender: student.gender || '',
                incomeDetails: student.incomeDetails || []
            });
        } else {
            setEditingStudent(null);
            setStudentForm({ 
                name: '', nis: '', 
                unitId: isUnitAdmin ? currentUser.unitId : (units[0]?.id || ''),
                classId: '',
                academicYearId: sortedYearsCurrent[0]?.id || state.academicYears?.find(y => y.isCurrent)?.id || '',
                statusId: state.studentStatuses?.find(s => s.name === 'Aktif')?.id || '',
                parentStatusId: '',
                gender: '',
                incomeDetails: []
            });
        }
        setShowStudentModal(true);
    };

    const handleStudentSubmit = async (e) => {
        e.preventDefault();
        const actionType = editingStudent ? 'EDIT_STUDENT' : 'ADD_STUDENT';
        const payload = editingStudent 
            ? { ...editingStudent, ...studentForm }
            : { id: crypto.randomUUID(), ...studentForm };
        
        try {
            await api.pushAction({ type: actionType, payload }, state);
            dispatch({ type: actionType, payload });
            setShowStudentModal(false);
        } catch (err) {
            window.alert('Gagal menyimpan data siswa: ' + err.message);
        }
    };

    const handleDeleteStudent = async (id) => {
        if (window.confirm('Hapus data siswa ini?')) {
            try {
                await api.pushAction({ type: 'DELETE_STUDENT', payload: id }, state);
                dispatch({ type: 'DELETE_STUDENT', payload: id });
                window.alert('Data siswa berhasil dipindahkan ke tempat sampah.');
            } catch (err) {
                window.alert('Gagal menghapus siswa: ' + err.message);
            }
        }
    };

    const handleBulkDelete = async () => {
        if (selectedStudents.length === 0) return;
        const count = selectedStudents.length;
        if (window.confirm(`Hapus ${count} siswa yang dipilih? Data akan dipindahkan ke tempat sampah.`)) {
            const failedItems = [];
            for (const id of selectedStudents) {
                try {
                    await api.pushAction({ type: 'DELETE_STUDENT', payload: id }, state);
                    dispatch({ type: 'DELETE_STUDENT', payload: id });
                } catch (err) {
                    const student = state.students.find(s => s.id === id);
                    failedItems.push(`${student?.name || id} (${err.message})`);
                }
            }
            setSelectedStudents([]);
            if (failedItems.length > 0) {
                window.alert(`${count - failedItems.length} siswa berhasil dihapus.\nGagal:\n${failedItems.join('\n')}`);
            } else {
                window.alert(`${count} siswa berhasil dipindahkan ke tempat sampah.`);
            }
        }
    };

    const handleOpenPaymentSettings = (student) => {
        setShowPaymentSettings(student);
        setPaymentForm(incomeItems.map(ii => {
            const detail = student.incomeDetails?.find(d => d.incomeItemId === ii.id);
            return { incomeItemId: ii.id, name: ii.name, amount: detail?.amount || 0 };
        }));
    };

    const handlePaymentSubmit = async () => {
        const updatedStudent = {
            ...showPaymentSettings,
            incomeDetails: paymentForm.map(p => ({ incomeItemId: p.incomeItemId, amount: parseFloat(p.amount) || 0 }))
        };
        try {
            await api.pushAction({ type: 'EDIT_STUDENT', payload: updatedStudent }, state);
            dispatch({ type: 'EDIT_STUDENT', payload: updatedStudent });
            setShowPaymentSettings(null);
        } catch (err) {
            window.alert('Gagal menyimpan setting pembayaran: ' + err.message);
        }
    };

    const handleExport = () => {
        const displayedUnitIds = unitFilter === 'all' 
            ? [...new Set(filteredStudents.map(s => s.unitId))]
            : [unitFilter];
        
        const activeIncomeItemIds = [...new Set(
            state.distributionSettings
                ?.filter(s => displayedUnitIds.includes(s.unitId))
                .map(s => s.incomeItemId) || []
        )];
        const relevantIncomeItems = incomeItems.filter(ii => activeIncomeItemIds.includes(ii.id));

        const exportData = filteredStudents.map(s => {
            const unit = units.find(u => u.id === s.unitId);
            const studentClass = state.classes?.find(c => c.id === s.classId);
            const academicYear = state.academicYears?.find(y => y.id === s.academicYearId);
            const status = state.studentStatuses?.find(st => st.id === s.statusId);
            
            const baseInfo = {
                'Nama': s.name,
                'NIS': s.nis || '',
                'Unit': unit?.name || '',
                'Kelas': studentClass?.name || '',
                'Tahun Ajaran': academicYear?.name || '',
                'Status': status?.name || '',
                'Status Orang Tua': state.parentStatuses?.find(ps => ps.id === s.parentStatusId)?.name || '',
                'Jenis Kelamin': s.gender || ''
            };

            // Only add income items that are relevant to the displayed units
            relevantIncomeItems.forEach(ii => {
                const detail = s.incomeDetails?.find(d => d.incomeItemId === ii.id);
                baseInfo[ii.name] = detail?.amount || 0;
            });

            return baseInfo;
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Database Siswa");
        XLSX.writeFile(wb, `Database_Siswa_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleDownloadTemplate = async () => {
        const targetUnitId = isUnitAdmin ? currentUser.unitId : (unitFilter !== 'all' ? unitFilter : null);
        
        if (!targetUnitId) {
            window.alert('Mohon filter unit terlebih dahulu di halaman utama sebelum mengunduh template, agar kolom item penerimaan sesuai dengan kebutuhan unit tersebut.');
            return;
        }

        const targetUnit = units.find(u => u.id === targetUnitId);
        const activeIncomeItemIds = [...new Set(
            state.distributionSettings
                ?.filter(s => s.unitId === targetUnitId)
                .map(s => s.incomeItemId) || []
        )];
        const relevantIncomeItems = incomeItems.filter(ii => activeIncomeItemIds.includes(ii.id));

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Template Import Siswa');

        // Headers
        const baseHeaders = ['Nama', 'NIS', 'Unit', 'Kelas', 'Tahun Ajaran', 'Status', 'Status Orang Tua', 'Jenis Kelamin'];
        const incomeHeaders = relevantIncomeItems.map(ii => ii.name);
        const allHeaders = [...baseHeaders, ...incomeHeaders];
        
        worksheet.addRow(allHeaders);

        // Example Row
        const exampleRow = [
            'Contoh Siswa',
            '12345',
            targetUnit?.name || 'Nama Unit',
            state.classes?.find(c => c.unitId === targetUnitId)?.name || '7A',
            state.academicYears?.find(y => y.isCurrent)?.name || '',
            'Aktif',
            state.parentStatuses?.[0]?.name || '',
            'Laki-laki',
            ...relevantIncomeItems.map(() => 0)
        ];
        worksheet.addRow(exampleRow);

        // Styling headers
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4F46E5' } // Indigo-600
        };

        // Adding Data Validations (Dropdowns) for rows 2 to 1000
        const validateRange = (colIndex, list) => {
            const colLetter = String.fromCharCode(64 + colIndex);
            if (list && list.length > 0) {
                // Remove commas from list items to avoid breaking the CSV-like formula
                const safeList = list.map(item => String(item).replace(/,/g, ' '));
                const formula = `"${safeList.join(',').substring(0, 250)}"`;
                worksheet.dataValidations.add(`${colLetter}2:${colLetter}1000`, {
                    type: 'list',
                    allowBlank: true,
                    formulae: [formula]
                });
            }
        };

        const unitList = units.map(u => u.name);
        const classList = state.classes?.filter(c => c.unitId === targetUnitId).map(c => c.name) || [];
        const yearList = state.academicYears?.map(y => y.name) || [];
        const statusList = state.studentStatuses?.map(s => s.name) || [];
        const parentStatusList = state.parentStatuses?.map(s => s.name) || [];
        const genderList = ['Laki-laki', 'Perempuan'];

        validateRange(3, unitList); // C: Unit
        validateRange(4, classList); // D: Kelas
        validateRange(5, yearList); // E: Tahun Ajaran
        validateRange(6, statusList); // F: Status
        validateRange(7, parentStatusList); // G: Status Orang Tua
        validateRange(8, genderList); // H: Jenis Kelamin

        // Auto-fit columns
        worksheet.columns.forEach(column => {
            column.width = 20;
        });

        // Write buffer and save
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `Template_Import_${targetUnit?.name || 'Unit'}.xlsx`);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const rawData = XLSX.utils.sheet_to_json(ws);
                
                if (rawData.length === 0) {
                    window.alert('File kosong atau format tidak sesuai.');
                    return;
                }
                
                const currentYear = state.academicYears?.find(y => y.isCurrent) || state.academicYears?.find(y => y.isActive);
                const analyzedData = rawData.map(item => {
                    const studentName = item.Nama?.toString().trim();
                    const studentNis = item.NIS?.toString().trim() || '';
                    if (!studentName) return { ...item, _importStatus: 'INVALID' };

                    let unitId = isUnitAdmin ? currentUser.unitId : null;
                    if (!isUnitAdmin) {
                        const unit = units.find(u => u.name.toLowerCase() === item.Unit?.toString().toLowerCase());
                        unitId = unit?.id || units[0]?.id;
                    }

                    let existing = null;
                    if (studentNis) existing = students.find(s => s.nis === studentNis && s.unitId === unitId && !s.isDeleted);
                    if (!existing) existing = students.find(s => s.name.toLowerCase() === studentName.toLowerCase() && s.unitId === unitId && !s.isDeleted);

                    if (existing) {
                        const studentClass = state.classes?.find(c => c.name?.toLowerCase() === item.Kelas?.toString().toLowerCase() && c.unitId === unitId);
                        const status = state.studentStatuses?.find(s => s.name.toLowerCase() === item.Status?.toString().toLowerCase());
                        const parentStatus = state.parentStatuses?.find(s => s.name.toLowerCase() === item['Status Orang Tua']?.toString().toLowerCase());
                        const newGender = item['Jenis Kelamin']?.toString() || '';

                        const incomeDetails = incomeItems.map(ii => ({
                            incomeItemId: ii.id,
                            amount: parseFloat(item[ii.name]) || 0
                        })).filter(id => id.amount > 0);

                        const sortedCurrentIncome = [...(existing.incomeDetails || [])].sort((a,b) => a.incomeItemId.localeCompare(b.incomeItemId));
                        const sortedNewIncome = [...incomeDetails].sort((a,b) => a.incomeItemId.localeCompare(b.incomeItemId));

                        const isDataChanged = 
                            existing.name !== studentName ||
                            existing.nis !== studentNis ||
                            existing.classId !== (studentClass?.id || existing.classId) ||
                            existing.statusId !== (status?.id || existing.statusId) ||
                            existing.parentStatusId !== (parentStatus?.id || existing.parentStatusId) ||
                            existing.gender !== (newGender || existing.gender) ||
                            JSON.stringify(sortedCurrentIncome) !== JSON.stringify(sortedNewIncome);

                        return { ...item, _importStatus: isDataChanged ? 'UPDATE' : 'DUPLICATE' };
                    }
                    return { ...item, _importStatus: 'NEW' };
                });
                
                setImportData(analyzedData);
            } catch (err) {
                window.alert('Terjadi kesalahan saat membaca file: ' + err.message);
            }
        };
        reader.readAsBinaryString(file);
    };

    const processImport = async () => {
        if (importData.length === 0) return;
        
        setIsImporting(true);
        try {
            const currentYear = state.academicYears?.find(y => y.isCurrent) || state.academicYears?.find(y => y.isActive);
            const defaultStatus = state.studentStatuses?.find(s => s.name === 'Aktif') || state.studentStatuses?.[0];

            let successCount = 0;
            let updatedCount = 0;
            let skippedCount = 0;
            let errorCount = 0;
            let failedStudents = [];

            for (const item of importData) {
                if (item._importStatus === 'DUPLICATE' || item._importStatus === 'INVALID') {
                    if (item._importStatus === 'DUPLICATE') skippedCount++;
                    continue;
                }
                try {
                    const studentName = item.Nama?.toString().trim();
                    const studentNis = item.NIS?.toString().trim() || '';
                    
                    if (!studentName) continue;

                    // 1. Determine Unit
                    let unitId = isUnitAdmin ? currentUser.unitId : null;
                    if (!isUnitAdmin) {
                        const unit = units.find(u => u.name.toLowerCase() === item.Unit?.toString().toLowerCase());
                        unitId = unit?.id || units[0]?.id;
                    }

                    // 2. Determine Class
                    const studentClass = state.classes?.find(c => 
                        c.name?.toLowerCase() === item.Kelas?.toString().toLowerCase() && 
                        c.unitId === unitId
                    );

                    // 3. Determine Status
                    const status = state.studentStatuses?.find(s => s.name.toLowerCase() === item.Status?.toString().toLowerCase());

                    // 3b. Determine Academic Year from Excel (Fallback to current)
                    const academicYear = state.academicYears?.find(y => y.name.toLowerCase() === item['Tahun Ajaran']?.toString().toLowerCase());
                    const finalAcademicYearId = academicYear?.id || currentYear?.id || '';
                    
                    // 3c. Determine Parent Status
                    const parentStatus = state.parentStatuses?.find(s => s.name.toLowerCase() === item['Status Orang Tua']?.toString().toLowerCase());

                    // 4. Map Income Details
                    const incomeDetails = incomeItems.map(ii => ({
                        incomeItemId: ii.id,
                        amount: parseFloat(item[ii.name]) || 0
                    })).filter(id => id.amount > 0);

                    // 5. Find existing student
                    let existingStudent = null;
                    if (studentNis) {
                        existingStudent = students.find(s => s.nis === studentNis && s.unitId === unitId && !s.isDeleted);
                    }
                    if (!existingStudent) {
                        existingStudent = students.find(s => 
                            s.name.toLowerCase() === studentName.toLowerCase() && 
                            s.unitId === unitId && 
                            s.academicYearId === finalAcademicYearId && 
                            !s.isDeleted
                        );
                    }

                    if (existingStudent) {
                        // Check if anything changed
                        const newClassId = studentClass?.id || existingStudent.classId;
                        const newStatusId = status?.id || existingStudent.statusId;
                        const newParentStatusId = parentStatus?.id || existingStudent.parentStatusId;
                        const newGender = item['Jenis Kelamin']?.toString() || existingStudent.gender;

                        const sortedCurrentIncome = [...(existingStudent.incomeDetails || [])].sort((a,b) => a.incomeItemId.localeCompare(b.incomeItemId));
                        const sortedNewIncome = [...incomeDetails].sort((a,b) => a.incomeItemId.localeCompare(b.incomeItemId));

                        const isDataChanged = 
                            existingStudent.name !== studentName ||
                            existingStudent.nis !== studentNis ||
                            existingStudent.classId !== newClassId ||
                            existingStudent.statusId !== newStatusId ||
                            existingStudent.parentStatusId !== newParentStatusId ||
                            existingStudent.gender !== newGender ||
                            JSON.stringify(sortedCurrentIncome) !== JSON.stringify(sortedNewIncome);

                        if (isDataChanged) {
                            const editPayload = {
                                ...existingStudent,
                                name: studentName,
                                nis: studentNis,
                                classId: newClassId,
                                statusId: newStatusId,
                                parentStatusId: newParentStatusId,
                                gender: newGender,
                                incomeDetails: incomeDetails
                            };
                            await api.pushAction({ type: 'EDIT_STUDENT', payload: editPayload }, state);
                            dispatch({ type: 'EDIT_STUDENT', payload: editPayload });
                            updatedCount++;
                        } else {
                            skippedCount++;
                        }
                    } else {
                        // Add new student
                        const payload = {
                            id: crypto.randomUUID(),
                            name: studentName,
                            nis: studentNis,
                            unitId,
                            academicYearId: finalAcademicYearId,
                            statusId: status?.id || defaultStatus?.id || '',
                            parentStatusId: parentStatus?.id || '',
                            gender: item['Jenis Kelamin']?.toString() || '',
                            classId: studentClass?.id || '',
                            incomeDetails
                        };

                        await api.pushAction({ type: 'ADD_STUDENT', payload }, state);
                        dispatch({ type: 'ADD_STUDENT', payload });
                        successCount++;
                    }
                } catch (err) {
                    console.error('Import Error for item:', item, err);
                    errorCount++;
                    failedStudents.push(`${item.Nama || 'Tanpa Nama'} (${err.message})`);
                }
            }

            let alertMsg = `Import Selesai!\nData Baru: ${successCount}\nData Diperbarui: ${updatedCount}\nData Sama (Dilewati): ${skippedCount}\nGagal: ${errorCount}`;
            if (failedStudents.length > 0) {
                alertMsg += `\n\nDetail Siswa Gagal:\n` + failedStudents.join('\n');
            }
            window.alert(alertMsg);
            setImportData([]);
            setShowImportModal(false);
        } catch (err) {
            window.alert('Terjadi kesalahan saat import: ' + err.message);
        } finally {
            setIsImporting(false);
        }
    };

    const activeIncomeItemIdsForUnit = [...new Set(
        state.distributionSettings?.filter(s => s.unitId === studentForm.unitId).map(s => s.incomeItemId) || []
    )];
    const unitIncomeItems = incomeItems.filter(ii => activeIncomeItemIdsForUnit.includes(ii.id));

    const stats = useMemo(() => {
        const male = filteredStudents.filter(s => s.gender?.toLowerCase() === 'laki-laki' || s.gender?.toLowerCase() === 'l').length;
        const female = filteredStudents.filter(s => s.gender?.toLowerCase() === 'perempuan' || s.gender?.toLowerCase() === 'p').length;
        
        // Optimize class distribution calculation (pre-map classes for fast lookup)
        const classMap = (state.classes || []).reduce((acc, c) => {
            acc[c.id] = c.name;
            return acc;
        }, {});

        const distribution = filteredStudents.reduce((acc, student) => {
            const className = classMap[student.classId] || 'Tanpa Kelas';
            acc[className] = (acc[className] || 0) + 1;
            return acc;
        }, {});

        return { male, female, distribution, total: filteredStudents.length, unknown: filteredStudents.length - male - female };
    }, [filteredStudents, state.classes]);

    const { male: maleCount, female: femaleCount, distribution: classDistribution, unknown: unknownCount } = stats;

    return (
        <div className="p-4 md:p-8 animate-in pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-1 font-display">Database Siswa</h1>
                    <p className="text-slate-500 font-medium italic">Sumber Data Penerimaan Keuangan Yayasan</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button 
                        onClick={handleExport}
                        className="budget-export-btn"
                        disabled={filteredStudents.length === 0}
                    >
                        <Download size={18} />
                        <span>Export</span>
                    </button>
                    <button 
                        onClick={() => setShowImportModal(true)}
                        className="flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300 hover:shadow-sm active:scale-95 transition-all duration-200 disabled:opacity-50"
                        disabled={activeLock}
                    >
                        <Upload size={18} />
                        <span>Import Masal</span>
                    </button>
                    {selectedStudents.length > 0 && (
                        <button 
                            onClick={handleBulkDelete}
                            className="flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold bg-rose-600 text-white shadow-md hover:bg-rose-700 active:scale-95 transition-all duration-200"
                            disabled={activeLock}
                        >
                            <Trash2 size={18} />
                            <span>Hapus ({selectedStudents.length})</span>
                        </button>
                    )}
                    <button 
                        onClick={() => handleOpenStudentModal()}
                        className="btn btn-primary"
                        disabled={activeLock}
                    >
                        <Plus size={18} />
                        <span>Tambah Siswa</span>
                    </button>
                </div>
            </div>

            {/* Dashboard Statistik */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <p className="text-sm text-slate-500 font-bold uppercase tracking-wider mb-1">Total Siswa</p>
                    <div className="flex items-end gap-2">
                        <span className="text-3xl font-black text-indigo-700">{filteredStudents.length}</span>
                        <span className="text-sm font-bold text-slate-400 mb-1">Siswa</span>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <p className="text-sm text-slate-500 font-bold uppercase tracking-wider mb-1">Laki-laki</p>
                    <div className="flex items-end gap-2">
                        <span className="text-3xl font-black text-blue-600">{maleCount}</span>
                        <span className="text-sm font-bold text-slate-400 mb-1">Siswa</span>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between relative">
                    <p className="text-sm text-slate-500 font-bold uppercase tracking-wider mb-1">Perempuan</p>
                    <div className="flex items-end gap-2">
                        <span className="text-3xl font-black text-pink-600">{femaleCount}</span>
                        <span className="text-sm font-bold text-slate-400 mb-1">Siswi</span>
                    </div>
                    {unknownCount > 0 && (
                        <div className="absolute top-4 right-4 bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-1 rounded-md">
                            + {unknownCount} Tanpa Ket.
                        </div>
                    )}
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between overflow-y-auto max-h-32 custom-scrollbar">
                    <p className="text-sm text-slate-500 font-bold uppercase tracking-wider mb-2">Sebaran Kelas</p>
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(classDistribution)
                            .sort((a,b) => a[0].localeCompare(b[0]))
                            .map(([clsName, count]) => (
                                <div key={clsName} className="flex items-center gap-1 bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg">
                                    <span className="text-xs font-bold text-slate-700">{clsName}:</span>
                                    <span className="text-xs font-black text-indigo-600">{count}</span>
                                </div>
                            ))
                        }
                    </div>
                </div>
            </div>
            {/* Budget Lock Alert */}
            {activeLock && (
                <div className="mb-8 p-6 bg-amber-50 border-2 border-amber-100 rounded-[2rem] flex items-center justify-between animate-in slide-in-from-top-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center shadow-sm">
                            <CreditCard size={24} />
                        </div>
                        <div>
                            <h3 className="font-black text-slate-900 leading-tight">Database Dikunci (Budget {activeBudgetStatus})</h3>
                            <p className="text-xs text-slate-500 font-medium">Unit ini sedang dalam proses review anggaran. Perubahan data siswa ditangguhkan sementara.</p>
                        </div>
                    </div>
                    {activeBudgetStatus === 'APPROVED' && (
                        <span className="px-4 py-2 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-100">
                            Finalized
                        </span>
                    )}
                </div>
            )}

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
                <div className="flex flex-col gap-1">
                    <select 
                        className="form-select w-full"
                        value={academicYearFilter}
                        onChange={e => setAcademicYearFilter(e.target.value)}
                    >
                        <option value="all">Semua Thn Ajaran</option>
                        {state.academicYears?.filter(y => y.isActive || y.id === academicYearFilter).map(y => (
                            <option key={y.id} value={y.id}>{y.name}</option>
                        ))}
                    </select>
                </div>
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

            {/* Student List Table */}
            <div className="overflow-y-auto max-h-[700px] border-2 border-slate-200 rounded-[2.5rem] shadow-xl bg-white relative scrollbar-thin scrollbar-thumb-slate-200">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="sticky top-0 z-20 bg-slate-100 text-slate-800 text-[10px] uppercase font-black tracking-widest border-b border-slate-200 shadow-sm">
                            <th className="p-6 w-16">
                                <input 
                                    type="checkbox"
                                    className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                                    checked={filteredStudents.length > 0 && selectedStudents.length === filteredStudents.length}
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            setSelectedStudents(filteredStudents.map(s => s.id));
                                        } else {
                                            setSelectedStudents([]);
                                        }
                                    }}
                                />
                            </th>
                            <th className="p-6">Data Siswa</th>
                            <th className="p-6">Unit & Kelas</th>
                            <th className="p-6 text-center">JK</th>
                            <th className="p-6 text-center">Tahun Ajaran</th>
                            <th className="p-6 text-center">Status</th>
                            <th className="p-6 text-right">Jumlah</th>
                            <th className="p-6 text-right">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredStudents.length > 0 ? filteredStudents.map(student => {
                            const unit = units.find(u => u.id === student.unitId);
                            const studentClass = state.classes?.find(c => c.id === student.classId);
                            const academicYear = state.academicYears?.find(y => y.id === student.academicYearId);
                            const status = state.studentStatuses?.find(s => s.id === student.statusId);
                            const isLocked = isBudgetLocked(student.unitId, student.academicYearId);
                            const totalIncome = (student.incomeDetails || []).reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);

                            return (
                                <tr key={student.id} className="group hover:bg-slate-50 transition-colors">
                                    <td className="p-6 w-16">
                                        <input 
                                            type="checkbox"
                                            className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                                            checked={selectedStudents.includes(student.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedStudents([...selectedStudents, student.id]);
                                                } else {
                                                    setSelectedStudents(selectedStudents.filter(id => id !== student.id));
                                                }
                                            }}
                                        />
                                    </td>
                                    <td className="p-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 rounded-xl flex items-center justify-center text-sm font-black shadow-inner">
                                                {student.name.charAt(0)}
                                            </div>
                                            <div>
                                                <h3 className="font-black text-slate-900 text-sm leading-tight">{student.name}</h3>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">NIS: {student.nis || '-'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded-md w-fit">
                                                {unit?.name || 'Unknown Unit'}
                                            </span>
                                            {studentClass && (
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                    Kelas {studentClass.name}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-6 text-center">
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${
                                            student.gender === 'Laki-laki' ? 'bg-blue-50 text-blue-600' : 
                                            student.gender === 'Perempuan' ? 'bg-rose-50 text-rose-600' : 
                                            'bg-slate-50 text-slate-400'
                                        }`}>
                                            {student.gender === 'Laki-laki' ? 'L' : student.gender === 'Perempuan' ? 'P' : '-'}
                                        </span>
                                    </td>
                                    <td className="p-6 text-center">
                                        {academicYear ? (
                                            <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-wider border border-emerald-100">
                                                {academicYear.name}
                                            </span>
                                        ) : (
                                            <span className="text-[10px] text-slate-300">-</span>
                                        )}
                                    </td>
                                    <td className="p-6 text-center">
                                        {status ? (
                                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                                                status.name === 'Aktif' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-600 border-slate-100'
                                            }`}>
                                                {status.name}
                                            </span>
                                        ) : (
                                            <span className="text-[10px] text-slate-300">-</span>
                                        )}
                                    </td>
                                    <td className="p-6 text-right">
                                        <span className="font-black text-slate-900 border-b-2 border-blue-100 italic">
                                            {formatRupiah(totalIncome)}
                                        </span>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex items-center justify-end gap-2">
                                            <button 
                                                onClick={() => handleOpenPaymentSettings(student)}
                                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all disabled:opacity-30 group/btn relative"
                                                disabled={isLocked}
                                            >
                                                <Wallet size={16} />
                                                <span className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-slate-900 text-white text-[8px] font-black uppercase rounded-lg opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap z-30">
                                                    Setting Pembayaran
                                                </span>
                                            </button>
                                            <button 
                                                onClick={() => handleOpenStudentModal(student)}
                                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all disabled:opacity-30"
                                                disabled={isLocked}
                                            >
                                                <Edit3 size={16} />
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteStudent(student.id)}
                                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all disabled:opacity-30"
                                                disabled={isLocked}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        }) : (
                            <tr>
                                <td colSpan={7} className="py-20 text-center">
                                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-200">
                                        <User size={32} />
                                    </div>
                                    <h3 className="text-sm font-bold text-slate-900 mb-1">Tidak ada data siswa</h3>
                                    <p className="text-[11px] text-slate-400">Gunakan fitur import atau tambah manual</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
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
                                            <div className="flex flex-col gap-1">
                                                <select
                                                    className="form-select w-full"
                                                    value={studentForm.academicYearId}
                                                    onChange={e => setStudentForm({ ...studentForm, academicYearId: e.target.value })}
                                                >
                                                    <option value="">Pilih Tahun</option>
                                                    {state.academicYears?.filter(y => y.isActive || y.id === studentForm.academicYearId).map(y => (
                                                        <option key={y.id} value={y.id}>{y.name}</option>
                                                    ))}
                                                </select>
                                            </div>
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
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="form-label">Jenis Kelamin</label>
                                        <select
                                            className="form-select"
                                            value={studentForm.gender}
                                            onChange={e => setStudentForm({ ...studentForm, gender: e.target.value })}
                                        >
                                            <option value="">Pilih JK</option>
                                            <option value="Laki-laki">Laki-laki</option>
                                            <option value="Perempuan">Perempuan</option>
                                        </select>
                                    </div>
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
                                                                type="text"
                                                                className="form-input !py-2 !pl-9 !text-sm text-right font-black text-blue-600 !rounded-xl"
                                                                placeholder="0"
                                                                value={formatAngka(existingDetail?.amount || 0)}
                                                                onChange={e => {
                                                                    const rawValue = e.target.value.replace(/\D/g, '');
                                                                    const val = rawValue === '' ? 0 : parseInt(rawValue, 10);
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

                                        <div className="flex items-center justify-between p-4 bg-blue-50/50 border-2 border-dashed border-blue-100 rounded-[24px] mt-4">
                                            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Total Nominal</span>
                                            <span className="font-black text-blue-700">{formatRupiah((studentForm.incomeDetails || []).reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0))}</span>
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
                                                type="text" 
                                                className="form-input !py-2 !pl-10 !w-40 text-right font-black text-blue-600"
                                                value={formatAngka(item.amount)}
                                                onChange={e => {
                                                    const rawValue = e.target.value.replace(/\D/g, '');
                                                    const val = rawValue === '' ? 0 : parseInt(rawValue, 10);
                                                    const newForm = [...paymentForm];
                                                    newForm[idx].amount = val;
                                                    setPaymentForm(newForm);
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex items-center justify-between p-6 bg-slate-900 rounded-[2rem] mb-8 shadow-xl shadow-slate-900/20">
                                <div>
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Total Pembayaran Tahunan</p>
                                    <p className="text-xl font-black text-white">{formatRupiah(paymentForm.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0))}</p>
                                </div>
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
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => {
                        if (!isImporting) {
                            setShowImportModal(false);
                            setImportData([]);
                        }
                    }} />
                    <div className={`bg-white rounded-[40px] w-full ${importData.length > 0 ? 'max-w-5xl' : 'max-w-lg'} relative z-10 shadow-2xl animate-in transition-all duration-300`}>
                        <div className="p-10">
                            <h2 className="text-2xl font-black text-slate-900 mb-2 font-display">Import Masal Siswa</h2>
                            
                            {importData.length === 0 ? (
                                <>
                                    <p className="text-slate-500 mb-8 font-medium">Gunakan file Excel atau CSV sesuai template untuk mempercepat penginputan data siswa dan budget tahunannya.</p>
                                    
                                    <div className="mb-8 p-10 border-4 border-dashed border-slate-100 rounded-[32px] flex flex-col items-center justify-center text-center hover:border-blue-200 transition-all group">
                                        <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                            <Upload size={32} />
                                        </div>
                                        <button 
                                            onClick={handleDownloadTemplate}
                                            className="text-xs font-black text-blue-600 uppercase tracking-widest mb-6 hover:underline"
                                        >
                                            Unduh Template Excel
                                        </button>
                                        <label className="cursor-pointer">
                                            <span className="btn btn-primary shadow-blue-500/10 mb-2">Pilih File XLSX/CSV</span>
                                            <input type="file" className="hidden" accept=".xlsx,.csv" onChange={handleFileUpload} />
                                        </label>
                                        <p className="text-xs text-slate-400 font-bold mt-4 uppercase tracking-widest">Maksimal file 10MB</p>
                                    </div>

                                    <button onClick={() => setShowImportModal(false)} className="w-full btn btn-secondary">Tutup</button>
                                </>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                                                Review Data: {importData.length} Baris
                                            </div>
                                            {isImporting && (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                                    <span className="text-[10px] font-bold text-blue-600 animate-pulse uppercase tracking-widest">Memproses...</span>
                                                </div>
                                            )}
                                        </div>
                                        <button 
                                            disabled={isImporting}
                                            onClick={() => setImportData([])}
                                            className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 transition-colors"
                                        >
                                            <X size={14} />
                                            Ganti File
                                        </button>
                                    </div>

                                    <div className="border border-slate-100 rounded-3xl overflow-hidden mb-8 shadow-inner bg-slate-50">
                                        <div className="max-h-[50vh] overflow-auto custom-scrollbar">
                                            <table className="w-full text-left border-collapse">
                                                <thead className="sticky top-0 bg-white shadow-sm z-10">
                                                    <tr>
                                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 w-32">Status Import</th>
                                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Nama</th>
                                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">NIS</th>
                                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Unit</th>
                                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Kelas</th>
                                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">T. Ajaran</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {importData.map((item, idx) => {
                                                        const isDup = item._importStatus === 'DUPLICATE';
                                                        return (
                                                            <tr key={idx} className={`transition-colors ${isDup ? 'opacity-50 bg-slate-100' : 'hover:bg-blue-50/50'}`}>
                                                                <td className="px-6 py-4 border-b border-slate-50">
                                                                    {item._importStatus === 'NEW' && <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase rounded-md">Siswa Baru</span>}
                                                                    {item._importStatus === 'UPDATE' && <span className="px-2 py-1 bg-amber-100 text-amber-700 text-[9px] font-black uppercase rounded-md">Update Data</span>}
                                                                    {item._importStatus === 'DUPLICATE' && <span className="px-2 py-1 bg-slate-200 text-slate-500 text-[9px] font-black uppercase rounded-md">Dilewati</span>}
                                                                    {item._importStatus === 'INVALID' && <span className="px-2 py-1 bg-rose-100 text-rose-700 text-[9px] font-black uppercase rounded-md">Invalid</span>}
                                                                </td>
                                                                <td className="px-6 py-4 text-xs font-bold text-slate-700 border-b border-slate-50">{item.Nama || '-'}</td>
                                                                <td className="px-6 py-4 text-xs font-medium text-slate-500 border-b border-slate-50">{item.NIS || '-'}</td>
                                                                <td className="px-6 py-4 text-[10px] font-black text-indigo-600 uppercase tracking-widest border-b border-slate-50">{item.Unit || '-'}</td>
                                                                <td className="px-6 py-4 text-xs font-bold text-slate-600 border-b border-slate-50">{item.Kelas || '-'}</td>
                                                                <td className="px-6 py-4 text-xs font-medium text-slate-500 border-b border-slate-50">{item['Tahun Ajaran'] || '-'}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    <div className="flex gap-4">
                                        <button 
                                            disabled={isImporting}
                                            onClick={() => {
                                                setShowImportModal(false);
                                                setImportData([]);
                                            }} 
                                            className="btn btn-secondary flex-1"
                                        >
                                            Batal
                                        </button>
                                        <button 
                                            disabled={isImporting}
                                            onClick={processImport}
                                            className="btn btn-primary flex-1 shadow-blue-500/20"
                                        >
                                            <Check size={18} />
                                            <span>Proses Import ({importData.filter(i => i._importStatus === 'NEW' || i._importStatus === 'UPDATE').length} Siswa)</span>
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
