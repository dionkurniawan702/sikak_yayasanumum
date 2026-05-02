import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
    Users, 
    UserCheck, 
    GraduationCap, 
    TrendingUp, 
    PieChart, 
    BarChart3, 
    Calendar,
    Building2,
    Users2,
    Venus,
    Mars,
    ChevronDown,
    Filter
} from 'lucide-react';

import { 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    Legend, 
    ResponsiveContainer, 
    PieChart as RPieChart, 
    Pie, 
    Cell,
    AreaChart,
    Area,
    LabelList
} from 'recharts';
import { formatRupiah } from '../../utils/format';

export default function StudentDashboard() {
    const { state, dispatch } = useApp();
    const [trendUnitId, setTrendUnitId] = React.useState('all');

    const { 
        currentUser, 
        students = [], 
        units = [], 
        academicYears = [], 
        classes = [],
        studentStatuses = []
    } = state;

    const isSuperAdmin = currentUser?.role === 'superadmin';
    const isUnitAdmin = currentUser?.role === 'admin_unit';
    const currentUnitId = currentUser?.unitId;

    // Academic Year Filter
    const selectedAcademicYearId = state.globalAcademicYearId || '';
    const setSelectedAcademicYearId = (id) => dispatch({ type: 'SET_GLOBAL_YEAR', payload: id });

    // Filters
    const activeStudents = useMemo(() => students.filter(s => !s.isDeleted), [students]);
    
    const filteredStudents = useMemo(() => {
        let list = activeStudents;
        if (isUnitAdmin) list = list.filter(s => s.unitId === currentUnitId);
        if (selectedAcademicYearId && selectedAcademicYearId !== 'all') {
            list = list.filter(s => s.academicYearId === selectedAcademicYearId);
        }
        return list;
    }, [activeStudents, isUnitAdmin, currentUnitId, selectedAcademicYearId]);

    // 1. Stats Summary
    const stats = useMemo(() => {
        const total = filteredStudents.length;
        const male = filteredStudents.filter(s => s.gender?.toLowerCase() === 'laki-laki' || s.gender?.toLowerCase() === 'l').length;
        const female = filteredStudents.filter(s => s.gender?.toLowerCase() === 'perempuan' || s.gender?.toLowerCase() === 'p').length;
        const active = filteredStudents.filter(s => {
            const status = studentStatuses.find(st => st.id === s.statusId);
            return status?.name?.toLowerCase() === 'aktif';
        }).length;

        // Estimated Revenue (Annual)
        const totalRevenue = filteredStudents.reduce((acc, s) => {
            return acc + (s.incomeDetails || []).reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
        }, 0);

        return { total, male, female, active, totalRevenue };
    }, [filteredStudents, studentStatuses]);

    // 2. Unit Distribution
    const unitDistData = useMemo(() => {
        return units.filter(u => !u.isDeleted).map(u => {
            const count = filteredStudents.filter(s => s.unitId === u.id).length;
            return { name: u.name, count };
        }).filter(u => u.count > 0).sort((a, b) => b.count - a.count);
    }, [units, filteredStudents]);

    // 3. Gender Distribution
    const genderData = [
        { name: 'Laki-laki', value: stats.male, color: '#3b82f6' },
        { name: 'Perempuan', value: stats.female, color: '#ec4899' },
        { name: 'Lainnya', value: stats.total - stats.male - stats.female, color: '#94a3b8' }
    ].filter(g => g.value > 0);

    // 4. Class Distribution
    const classDistData = useMemo(() => {
        const relevantClasses = isUnitAdmin ? classes.filter(c => c.unitId === currentUnitId) : classes;
        return relevantClasses.filter(c => !c.isDeleted).map(c => {
            const count = filteredStudents.filter(s => s.classId === c.id).length;
            return { name: c.name, count };
        }).filter(c => c.count > 0).sort((a, b) => b.count - a.count);
    }, [classes, filteredStudents, isUnitAdmin, currentUnitId]);

    // 5. Academic Year Growth
    const growthData = useMemo(() => {
        return academicYears.filter(y => !y.isDeleted).map(y => {
            let list = activeStudents.filter(s => s.academicYearId === y.id);
            
            // Filter by Unit for Trend
            if (isSuperAdmin && trendUnitId !== 'all') {
                list = list.filter(s => s.unitId === trendUnitId);
            } else if (isUnitAdmin) {
                list = list.filter(s => s.unitId === currentUnitId);
            }
            
            return { name: y.name, count: list.length };
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [academicYears, activeStudents, isSuperAdmin, trendUnitId, isUnitAdmin, currentUnitId]);


    const chartData = isSuperAdmin ? unitDistData : classDistData;
    const chartHeight = Math.max(350, chartData.length * 40);

    const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

    return (
        <div className="p-4 md:p-8 animate-in bg-slate-50 min-h-screen pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Dashboard Siswa</h1>
                    <p className="text-slate-500 font-medium italic">
                        {isSuperAdmin ? 'Ringkasan Statistik Global Seluruh Unit' : `Statistik Siswa - ${units.find(u => u.id === currentUnitId)?.name || 'Unit'}`}
                    </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-4">
                    {/* Academic Year Selector */}
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-blue-600">
                            <Calendar size={18} />
                        </div>
                        <select 
                            value={selectedAcademicYearId}
                            onChange={(e) => setSelectedAcademicYearId(e.target.value)}
                            className="pl-12 pr-10 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm text-sm font-black text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer transition-all hover:border-blue-300"
                        >
                            <option value="all">Semua Tahun Ajaran</option>
                            {academicYears.filter(y => !y.isDeleted).map(y => (
                                <option key={y.id} value={y.id}>{y.name} {y.isCurrent ? '(Aktif)' : ''}</option>
                            ))}
                        </select>
                        <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400 group-hover:text-blue-500 transition-colors">
                            <ChevronDown size={18} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {/* Total Students */}
                <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/50 flex items-center gap-6 group hover:scale-[1.02] transition-all">
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner">
                        <Users size={32} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Total Siswa</p>
                        <h3 className="text-3xl font-black text-slate-900">{stats.total}</h3>
                    </div>
                </div>

                {/* Male/Female Ratio */}
                <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/50 flex items-center gap-6 group hover:scale-[1.02] transition-all">
                    <div className="w-16 h-16 bg-pink-50 text-pink-600 rounded-2xl flex items-center justify-center group-hover:bg-pink-600 group-hover:text-white transition-all shadow-inner">
                        <Users2 size={32} />
                    </div>
                    <div className="flex flex-col gap-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">L : P Ratio</p>
                        <div className="flex items-center gap-2">
                            <span className="text-xl font-black text-blue-600">{stats.male}</span>
                            <span className="text-slate-300">/</span>
                            <span className="text-xl font-black text-pink-600">{stats.female}</span>
                        </div>
                    </div>
                </div>

                {/* Active Students */}
                <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/50 flex items-center gap-6 group hover:scale-[1.02] transition-all">
                    <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-inner">
                        <UserCheck size={32} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Siswa Aktif</p>
                        <h3 className="text-3xl font-black text-slate-900">{stats.active}</h3>
                    </div>
                </div>

                {/* Revenue Projection (Super Admin Only) */}
                {isSuperAdmin && (
                    <div className="bg-indigo-600 p-6 rounded-[32px] shadow-xl shadow-indigo-200/50 flex items-center gap-6 group hover:scale-[1.02] transition-all relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl" />
                        <div className="w-16 h-16 bg-white/20 text-white rounded-2xl flex items-center justify-center shadow-lg backdrop-blur-sm">
                            <TrendingUp size={32} />
                        </div>
                        <div className="relative z-10">
                            <p className="text-[10px] font-black text-indigo-100 uppercase tracking-[0.2em] mb-1">Proyeksi Anggaran</p>
                            <h3 className="text-xl font-black text-white">{formatRupiah(stats.totalRevenue)}</h3>
                        </div>
                    </div>
                )}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Distribution Chart */}
                <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                                {isSuperAdmin ? <Building2 size={20} /> : <GraduationCap size={20} />}
                            </div>
                            <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase">
                                Sebaran {isSuperAdmin ? 'Unit' : 'Seluruh Kelas'}
                            </h3>
                        </div>
                    </div>
                    
                    {/* Scrollable Container for many items */}
                    <div className="flex-1 min-h-[400px] max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                        <div style={{ height: `${chartHeight}px` }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 60, top: 10, bottom: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                    <XAxis type="number" hide />
                                    <YAxis 
                                        dataKey="name" 
                                        type="category" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }}
                                        width={120}
                                    />
                                    <Tooltip 
                                        cursor={{ fill: '#f8fafc' }}
                                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '16px', color: '#fff' }}
                                        itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 700 }}
                                    />
                                    <Bar dataKey="count" fill="#6366f1" radius={[0, 12, 12, 0]} barSize={24}>
                                        <LabelList 
                                            dataKey="count" 
                                            position="right" 
                                            style={{ fill: '#64748b', fontSize: 11, fontWeight: 900 }}
                                            offset={10}
                                        />
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Gender & Status Pie Charts */}
                <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/50">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-pink-50 text-pink-600 rounded-2xl flex items-center justify-center">
                                <PieChart size={20} />
                            </div>
                            <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase">Komposisi Gender</h3>
                        </div>
                    </div>
                    <div className="flex flex-col md:flex-row items-center justify-around h-[350px]">
                        <div className="h-full w-full md:w-1/2">
                            <ResponsiveContainer width="100%" height="100%">
                                <RPieChart>
                                    <Pie
                                        data={genderData}
                                        innerRadius={80}
                                        outerRadius={120}
                                        paddingAngle={8}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {genderData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </RPieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="w-full md:w-1/2 flex flex-col gap-4">
                            {genderData.map((g, i) => (
                                <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: g.color }} />
                                        <span className="text-xs font-black text-slate-600 uppercase tracking-widest">{g.name}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-lg font-black text-slate-900">{g.value}</span>
                                        <span className="text-[10px] text-slate-400 font-bold block">
                                            {stats.total > 0 ? ((g.value / stats.total) * 100).toFixed(1) : 0}%
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Trend Chart */}
                <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/50 lg:col-span-2">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                                <BarChart3 size={20} />
                            </div>
                            <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase">Pertumbuhan Siswa Per Tahun Ajaran</h3>
                        </div>

                        {/* Unit Filter for Trend (Super Admin Only) */}
                        {isSuperAdmin && (
                            <div className="flex items-center gap-3">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden md:block">Filter Unit:</div>
                                <select 
                                    value={trendUnitId}
                                    onChange={(e) => setTrendUnitId(e.target.value)}
                                    className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer transition-all hover:bg-white"
                                >
                                    <option value="all">Seluruh Unit</option>
                                    {units.filter(u => !u.isDeleted).map(u => (
                                        <option key={u.id} value={u.id}>{u.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={growthData}>
                                <defs>
                                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis 
                                    dataKey="name" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }}
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }}
                                />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '16px', color: '#fff' }}
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="count" 
                                    stroke="#10b981" 
                                    strokeWidth={4}
                                    fillOpacity={1} 
                                    fill="url(#colorCount)" 
                                >
                                    <LabelList 
                                        dataKey="count" 
                                        position="top" 
                                        style={{ fill: '#10b981', fontSize: 11, fontWeight: 900 }}
                                        offset={15}
                                    />
                                </Area>

                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}
