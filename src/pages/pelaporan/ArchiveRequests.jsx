import React, { useState, useMemo } from 'react';
import { FileText, Building2, Gem, Search, Calendar, CheckCircle, Archive } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatRupiah } from '../../utils/format';

export default function ArchiveRequests() {
    const { state } = useApp();
    const { currentUser, budgetRequests, units, fields, academicYears, globalAcademicYearId, rabPlans, expenseItems } = state;

    const [searchTerm, setSearchTerm] = useState('');
    const [sourceMode, setSourceMode] = useState('YAYASAN'); // 'YAYASAN' or 'BOS'
    const [filterMonth, setFilterMonth] = useState('ALL');

    const isSuperAdmin = currentUser?.role === 'superadmin';
    const myUnitId = currentUser?.unitId;
    const myFieldId = currentUser?.fieldId;

    const currentYear = academicYears.find(y => y.id === globalAcademicYearId);
    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    const yearMonths = useMemo(() => {
        if (!currentYear) return [];
        const months = [];

        try {
            if (currentYear.startDate && currentYear.endDate) {
                const start = new Date(currentYear.startDate);
                const end = new Date(currentYear.endDate);
                let current = new Date(start);
                let safetyCounter = 0;
                while (current <= end && safetyCounter < 24) {
                    const year = current.getFullYear();
                    const monthIdx = current.getMonth();
                    const monthNum = monthIdx + 1;
                    const shortYear = String(year).slice(-2);

                    months.push({
                        id: `${year}-${String(monthNum).padStart(2, '0')}`,
                        label: `${monthNames[monthIdx]} '${shortYear}`,
                    });
                    current.setMonth(current.getMonth() + 1);
                    safetyCounter++;
                }
            }
            if (months.length === 0) {
                const [startYearStr, endYearStr] = (currentYear.name || '').split((currentYear.name || '').includes('/') ? '/' : '-');
                const startYear = parseInt(startYearStr) || new Date().getFullYear();
                const endYear = parseInt(endYearStr) || (startYear + 1);

                const sequence = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];
                sequence.forEach((monthNum) => {
                    const year = monthNum >= 7 ? startYear : endYear;
                    const monthIdx = monthNum - 1;
                    const shortYear = String(year).slice(-2);
                    months.push({
                        id: `${year}-${String(monthNum).padStart(2, '0')}`,
                        label: `${monthNames[monthIdx]} '${shortYear}`,
                    });
                });
            }
        } catch (err) {
            console.error('Error generating months:', err);
        }
        return months;
    }, [currentYear]);

    const filteredArchives = useMemo(() => {
        return (budgetRequests || []).filter(req => {
            // Only APPROVED requests
            if (req.status !== 'APPROVED') return false;

            // Filter by source
            const isBosRequest = req.source === 'BOS' || req.items?.some(i => i.planId?.endsWith('-BOS'));
            if (sourceMode === 'BOS' && !isBosRequest) return false;
            if (sourceMode === 'YAYASAN' && isBosRequest) return false;

            // Role access
            let hasAccess = false;
            if (isSuperAdmin) hasAccess = true;
            else if (myUnitId) hasAccess = req.unitId === myUnitId;
            else if (myFieldId) hasAccess = req.fieldId === myFieldId;
            if (!hasAccess) return false;

            // Filter by month
            if (filterMonth !== 'ALL' && req.month !== filterMonth) return false;

            // Filter by search term
            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase();
                const matchesDesc = (req.description || '').toLowerCase().includes(searchLower);
                const matchesId = (req.id || '').toLowerCase().includes(searchLower);
                if (!matchesDesc && !matchesId) return false;
            }

            return true;
        }).sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [budgetRequests, isSuperAdmin, myUnitId, myFieldId, sourceMode, filterMonth, searchTerm]);

    const totalDanaDiarsipkan = useMemo(() => {
        return filteredArchives.reduce((sum, req) => sum + (parseFloat(req.totalAmount) || 0), 0);
    }, [filteredArchives]);

    const resolveItemDetails = (item) => {
        // 1. If direct properties exist, use them
        if (item.volume !== undefined && item.satuan !== undefined && item.harga !== undefined) {
            const harga = parseFloat(item.harga) || 0;
            const amount = parseFloat(item.amount) || 0;
            const vol = harga > 0 ? (amount / harga) : (parseFloat(item.volume) || 0);
            return {
                volume: vol,
                satuan: item.satuan || '-',
                harga: harga
            };
        }

        // 2. Otherwise search in rabPlans
        if (rabPlans && Array.isArray(rabPlans)) {
            // Find plan first using item.planId
            const plan = rabPlans.find(p => p.id === item.planId);
            if (plan && plan.expense && typeof plan.expense === 'object') {
                for (const [itemId, rawItemPlans] of Object.entries(plan.expense)) {
                    const itemPlans = Array.isArray(rawItemPlans) 
                        ? rawItemPlans 
                        : (rawItemPlans && typeof rawItemPlans === 'object' && Object.keys(rawItemPlans).length > 0 
                            ? [{ id: `P-${itemId}-LEGACY`, itemId: itemId, ...rawItemPlans }] 
                            : []);
                    for (let pIdx = 0; pIdx < itemPlans.length; pIdx++) {
                        const p = itemPlans[pIdx];
                        if (p.components && Array.isArray(p.components)) {
                            for (let cIdx = 0; cIdx < p.components.length; cIdx++) {
                                const comp = p.components[cIdx];
                                const compId = comp.id || `COMP-${plan.id}-${itemId}-${pIdx}-${cIdx}`;
                                if (compId === item.componentId || comp.label === item.name || comp.name === item.name) {
                                    return {
                                        volume: comp.volume !== undefined ? parseFloat(comp.volume) : 1,
                                        satuan: comp.satuan || comp.unit || '-',
                                        harga: comp.harga !== undefined ? parseFloat(comp.harga) : 0
                                    };
                                }
                            }
                        }
                    }
                }
            }
            
            // Fallback: search all plans if planId mismatch or missing
            for (const p of rabPlans) {
                if (p.expense && typeof p.expense === 'object') {
                    for (const [itemId, rawItemPlans] of Object.entries(p.expense)) {
                        const itemPlans = Array.isArray(rawItemPlans) 
                            ? rawItemPlans 
                            : (rawItemPlans && typeof rawItemPlans === 'object' && Object.keys(rawItemPlans).length > 0 
                                ? [{ id: `P-${itemId}-LEGACY`, itemId: itemId, ...rawItemPlans }] 
                                : []);
                        for (let pIdx = 0; pIdx < itemPlans.length; pIdx++) {
                            const itemPlan = itemPlans[pIdx];
                            if (itemPlan.components && Array.isArray(itemPlan.components)) {
                                for (let cIdx = 0; cIdx < itemPlan.components.length; cIdx++) {
                                    const comp = itemPlan.components[cIdx];
                                    const compId = comp.id || `COMP-${p.id}-${itemId}-${pIdx}-${cIdx}`;
                                    if (compId === item.componentId || comp.label === item.name || comp.name === item.name) {
                                        return {
                                            volume: comp.volume !== undefined ? parseFloat(comp.volume) : 1,
                                            satuan: comp.satuan || comp.unit || '-',
                                            harga: comp.harga !== undefined ? parseFloat(comp.harga) : 0
                                        };
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Default if not found
        return {
            volume: 1,
            satuan: '-',
            harga: parseFloat(item.amount) || 0
        };
    };

    const handlePrint = (req) => {
        const printWindow = window.open('', '_blank');
        const unitName = units.find(u => u.id === req.unitId)?.name || fields.find(f => f.id === req.fieldId)?.name || 'Unit/Bidang';

        const html = `
            <html>
                <head>
                    <title>Surat Persetujuan Dana - ${req.id}</title>
                    <style>
                        body { font-family: 'Times New Roman', serif; padding: 50px; line-height: 1.6; }
                        .header { text-align: center; border-bottom: 3px double #000; padding-bottom: 20px; margin-bottom: 30px; }
                        .header h1 { margin: 0; font-size: 24px; text-transform: uppercase; }
                        .header p { margin: 5px 0; font-size: 14px; }
                        .info { margin-bottom: 30px; }
                        .info table { width: 100%; }
                        .info td { vertical-align: top; }
                        .content { margin-bottom: 40px; }
                        .content table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
                        .content th, .content td { border: 1px solid #000; padding: 6px 10px; text-align: left; }
                        .content th { background: #f2f2f2; text-align: center; }
                        .footer { margin-top: 50px; display: flex; justify-content: space-between; }
                        .signature { text-align: center; width: 200px; }
                        .signature .space { height: 80px; }
                        @media print { .no-print { display: none; } }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>YAYASAN DARELIMAN</h1>
                        <p>Jl. Belakang Olo No. 46, Kota Padang</p>
                        <p>Tlp: (0751) 1234567 • Email: info@dareliman.org</p>
                    </div>

                    <div class="info">
                        <h2 style="text-align: center; text-decoration: underline;">SURAT PERSETUJUAN DANA (${req.source || 'YAYASAN'})</h2>
                        <p style="text-align: center;">Nomor Referensi: ${req.id}</p>
                        
                        <table style="margin-top: 20px;">
                            <tr>
                                <td width="150">Tanggal Disetujui</td>
                                <td>: ${req.date}</td>
                            </tr>
                            <tr>
                                <td>Unit / Bidang</td>
                                <td>: ${unitName}</td>
                            </tr>
                            <tr>
                                <td>Periode RAB</td>
                                <td>: ${yearMonths.find(m => m.id === req.month)?.label || req.month}</td>
                            </tr>
                        </table>
                    </div>

                    <div class="content">
                        <p>Berdasarkan pengajuan permintaan dana yang telah diajukan, bersama ini kami sampaikan bahwa pengajuan berikut telah <b>DISETUJUI</b>:</p>
                        
                        <table>
                            <thead>
                                <tr>
                                    <th width="30">No</th>
                                    <th>Item Pengeluaran</th>
                                    <th>Deskripsi Keperluan</th>
                                    <th style="text-align: center; width: 60px;">Jumlah</th>
                                    <th style="text-align: center; width: 80px;">Satuan</th>
                                    <th style="text-align: right; width: 120px;">Harga Satuan</th>
                                    <th style="text-align: right; width: 130px;">Total Dana ACC</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${req.items.map((item, idx) => {
                                    const maName = expenseItems?.find(e => e.id === item.expenseItemId)?.name || '-';
                                    const details = resolveItemDetails(item);
                                    return `
                                    <tr>
                                        <td style="text-align: center;">${idx + 1}</td>
                                        <td>${maName}</td>
                                        <td>${item.name}</td>
                                        <td style="text-align: center;">${details.volume}</td>
                                        <td style="text-align: center;">${details.satuan}</td>
                                        <td style="text-align: right;">${formatRupiah(details.harga)}</td>
                                        <td style="text-align: right;">${formatRupiah(item.amount)}</td>
                                    </tr>
                                    `;
                                }).join('')}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <th colspan="6" style="text-align: right;">TOTAL DANA DISETUJUI</th>
                                    <th style="text-align: right;">${formatRupiah(req.totalAmount)}</th>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <div class="footer">
                        <div class="signature">
                            <p>Telah Diterima Oleh,</p>
                            <div class="space"></div>
                            <p>____________________</p>
                            <p>( Kepala Unit / Bidang )</p>
                        </div>
                        <div class="signature">
                            <p>Disetujui Oleh,</p>
                            <div class="space"></div>
                            <p><b>Superadmin Keuangan</b></p>
                            <p>Yayasan Dareliman</p>
                        </div>
                    </div>

                    <div class="no-print" style="margin-top: 50px; text-align: center;">
                        <button onclick="window.print()" style="padding: 10px 30px; background: #4f46e5; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">CETAK PDF SEKARANG</button>
                    </div>
                </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    return (
        <div className="p-8 animate-in text-slate-900">
            {/* Header */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
                <div className="lg:col-span-3 bg-gradient-to-br from-indigo-800 to-slate-900 rounded-[40px] p-10 text-white shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:scale-110 transition-transform">
                        <Archive size={160} />
                    </div>
                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div>
                            <h1 className="text-3xl font-black mb-1">Arsip Permintaan Dana</h1>
                            <p className="text-blue-100/70 font-medium mb-6 uppercase text-[10px] tracking-widest italic">
                                DOKUMEN RESMI YANG TELAH DI-ACC • {isSuperAdmin ? 'SELURUH YAYASAN' : (units.find(u => u.id === myUnitId)?.name || fields.find(f => f.id === myFieldId)?.name || 'UNIT SAYA')}
                            </p>

                            <div className="flex flex-wrap gap-4 items-center bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/20 inline-flex">
                                <div className="flex bg-slate-900/40 p-1 rounded-xl">
                                    <button 
                                        onClick={() => setSourceMode('YAYASAN')}
                                        className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${sourceMode === 'YAYASAN' ? 'bg-white text-indigo-700 shadow-xl' : 'text-white/60 hover:text-white'}`}
                                    >
                                        <Building2 size={12} className="inline mr-2" />
                                        Yayasan
                                    </button>
                                    {(!myFieldId || isSuperAdmin) && (
                                        <button 
                                            onClick={() => setSourceMode('BOS')}
                                            className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${sourceMode === 'BOS' ? 'bg-emerald-500 text-white shadow-xl' : 'text-white/60 hover:text-white'}`}
                                        >
                                            <Gem size={12} className="inline mr-2" />
                                            BOS
                                        </button>
                                    )}
                                </div>
                                
                                <div className="w-px h-8 bg-white/20 mx-2"></div>

                                <div className="flex items-center gap-2">
                                    <Calendar size={16} className="text-white/60" />
                                    <select
                                        value={filterMonth}
                                        onChange={(e) => setFilterMonth(e.target.value)}
                                        className="bg-transparent border-0 text-sm font-bold text-white focus:ring-0 cursor-pointer outline-none appearance-none pr-4"
                                    >
                                        <option value="ALL" className="text-slate-900">Semua Bulan</option>
                                        {yearMonths.map(m => (
                                            <option key={m.id} value={m.id} className="text-slate-900">{m.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="relative ml-2">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50" size={14} />
                                    <input
                                        type="text"
                                        placeholder="Cari ID / Deskripsi..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="bg-white/10 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-white/50 focus:bg-white/20 focus:outline-none transition-all w-48"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card p-8 bg-white rounded-[40px] flex flex-col items-center justify-center text-center shadow-xl border-slate-100">
                    <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4">
                        <CheckCircle size={32} />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Dana ACC (Filter)</p>
                    <h2 className="text-2xl font-black text-slate-900 italic tracking-tighter">{formatRupiah(totalDanaDiarsipkan)}</h2>
                    <p className="text-[10px] font-bold text-slate-400 mt-2">{filteredArchives.length} Surat Tersedia</p>
                </div>
            </div>

            {/* Archive List */}
            <div className="grid grid-cols-1 gap-4">
                {filteredArchives.length === 0 ? (
                    <div className="p-20 text-center bg-white/40 backdrop-blur-md rounded-[32px] border-2 border-dashed border-slate-200">
                        <Archive size={48} className="mx-auto text-slate-300 mb-4" />
                        <p className="font-bold text-slate-400 italic">Belum ada dokumen arsip yang sesuai dengan kriteria.</p>
                    </div>
                ) : (
                    filteredArchives.map(req => (
                        <div key={req.id} className="card p-6 bg-white hover:shadow-2xl transition-all border-slate-100 group relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 rounded-3xl">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600" />
                            
                            <div className="flex items-center gap-6">
                                <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner">
                                    <FileText size={28} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ID: {req.id}</span>
                                        <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                        <span className="text-[10px] font-bold text-slate-400">{req.date}</span>
                                        {req.month && (
                                            <>
                                                <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-widest">
                                                    {yearMonths.find(m => m.id === req.month)?.label || req.month}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                    <h4 className="font-black text-slate-900 text-lg leading-tight mb-1">{req.description}</h4>
                                    {isSuperAdmin && (
                                        <div className="flex items-center gap-2">
                                            <div className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-black uppercase tracking-widest border border-slate-200">
                                                {req.unitId === 'FOUNDATION' ? 'YAYASAN' : (state.units.find(u => u.id === req.unitId)?.name || req.unitId)}
                                            </div>
                                            {req.fieldId && (
                                                <div className="px-2 py-0.5 bg-indigo-50 text-indigo-500 rounded text-[9px] font-black uppercase tracking-widest border border-indigo-100">
                                                    {state.fields.find(f => f.id === req.fieldId)?.name || req.fieldId}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-8">
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Total Dana ACC</p>
                                    <h4 className="text-2xl font-black text-slate-900 italic tracking-tighter">{formatRupiah(req.totalAmount)}</h4>
                                </div>
                                <button
                                    onClick={() => handlePrint(req)}
                                    className="px-6 py-4 bg-slate-50 text-indigo-600 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all font-black text-[10px] flex items-center gap-2 uppercase tracking-widest shadow-sm group-hover:shadow-lg"
                                >
                                    <FileText size={16} />
                                    Cetak Dokumen
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
