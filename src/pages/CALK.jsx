import { useState, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { hitungSaldoAkun, hitungSaldoPerTipe, getAvailableTransactionYears } from '../utils/accounting';
import { formatTanggal } from '../utils/format';
import { 
    FileText, Printer, FileSpreadsheet, Building2, BookOpen, 
    Coins, Layers, ShieldCheck, CheckCircle2, ChevronRight, UserCheck
} from 'lucide-react';
import CurrencyDisplay from '../components/CurrencyDisplay';
import * as XLSX from 'xlsx';

export default function CALK() {
    const { state } = useApp();
    const accounts = useMemo(() => state.accounts.filter(a => !a.isDeleted), [state.accounts]);
    const journals = useMemo(() => state.journals.filter(j => !j.isDeleted), [state.journals]);
    const assets = useMemo(() => state.assets.filter(a => !a.isDeleted), [state.assets]);
    const reportRef = useRef(null);

    // Filter Tahun Dinamis (Hanya tahun dengan transaksi)
    const availableYears = useMemo(() => getAvailableTransactionYears(journals), [journals]);
    const [selectedYear, setSelectedYear] = useState(() => availableYears[0] || new Date().getFullYear().toString());
    const [activeTab, setActiveTab] = useState('all'); // 'all', 'umum', 'kebijakan', 'pos'

    const activeYear = availableYears.includes(selectedYear) ? selectedYear : (availableYears[0] || new Date().getFullYear().toString());
    const currentYearStr = activeYear;
    const prevYearStr = (parseInt(activeYear, 10) - 1).toString();

    // Helper rincian akun berdasarkan prefix kode
    const getAccountDetailsByPrefix = (prefix, type = null) => {
        return accounts
            .filter(a => a.category === 'detail' && a.code.startsWith(prefix) && (!type || a.type === type))
            .map(acc => {
                const isNominal = acc.type === 'Pendapatan' || acc.type === 'Beban';
                const saldoCurr = hitungSaldoAkun(journals, acc.id, accounts, currentYearStr, assets, isNominal);
                const saldoPrev = hitungSaldoAkun(journals, acc.id, accounts, prevYearStr, assets, isNominal);
                return {
                    ...acc,
                    saldoCurr: acc.normalBalance === 'kredit' ? Math.abs(saldoCurr) : saldoCurr,
                    saldoPrev: acc.normalBalance === 'kredit' ? Math.abs(saldoPrev) : saldoPrev
                };
            })
            .filter(item => item.saldoCurr !== 0 || item.saldoPrev !== 0);
    };

    // Data Catatan Pos Keuangan Dinamis
    const rincianKas = useMemo(() => getAccountDetailsByPrefix('1-11'), [accounts, journals, assets, currentYearStr, prevYearStr]);
    const totalKasCurr = useMemo(() => rincianKas.reduce((s, a) => s + a.saldoCurr, 0), [rincianKas]);
    const totalKasPrev = useMemo(() => rincianKas.reduce((s, a) => s + a.saldoPrev, 0), [rincianKas]);

    const rincianPiutang = useMemo(() => getAccountDetailsByPrefix('1-12'), [accounts, journals, assets, currentYearStr, prevYearStr]);
    const totalPiutangCurr = useMemo(() => rincianPiutang.reduce((s, a) => s + a.saldoCurr, 0), [rincianPiutang]);
    const totalPiutangPrev = useMemo(() => rincianPiutang.reduce((s, a) => s + a.saldoPrev, 0), [rincianPiutang]);

    const rincianAsetTetap = useMemo(() => getAccountDetailsByPrefix('1-2'), [accounts, journals, assets, currentYearStr, prevYearStr]);
    const totalAsetTetapCurr = useMemo(() => rincianAsetTetap.reduce((s, a) => s + a.saldoCurr, 0), [rincianAsetTetap]);
    const totalAsetTetapPrev = useMemo(() => rincianAsetTetap.reduce((s, a) => s + a.saldoPrev, 0), [rincianAsetTetap]);

    const rincianLiabilitas = useMemo(() => getAccountDetailsByPrefix('2-'), [accounts, journals, assets, currentYearStr, prevYearStr]);
    const totalLiabilitasCurr = useMemo(() => rincianLiabilitas.reduce((s, a) => s + a.saldoCurr, 0), [rincianLiabilitas]);
    const totalLiabilitasPrev = useMemo(() => rincianLiabilitas.reduce((s, a) => s + a.saldoPrev, 0), [rincianLiabilitas]);

    const rincianAsetNeto = useMemo(() => getAccountDetailsByPrefix('3-'), [accounts, journals, assets, currentYearStr, prevYearStr]);
    const totalAsetNetoCurr = useMemo(() => rincianAsetNeto.reduce((s, a) => s + a.saldoCurr, 0), [rincianAsetNeto]);
    const totalAsetNetoPrev = useMemo(() => rincianAsetNeto.reduce((s, a) => s + a.saldoPrev, 0), [rincianAsetNeto]);

    const rincianPendapatan = useMemo(() => getAccountDetailsByPrefix('4-'), [accounts, journals, assets, currentYearStr, prevYearStr]);
    const totalPendapatanCurr = useMemo(() => rincianPendapatan.reduce((s, a) => s + a.saldoCurr, 0), [rincianPendapatan]);
    const totalPendapatanPrev = useMemo(() => rincianPendapatan.reduce((s, a) => s + a.saldoPrev, 0), [rincianPendapatan]);

    const rincianBeban = useMemo(() => [
        ...getAccountDetailsByPrefix('5-'),
        ...getAccountDetailsByPrefix('6-')
    ], [accounts, journals, assets, currentYearStr, prevYearStr]);
    const totalBebanCurr = useMemo(() => rincianBeban.reduce((s, a) => s + a.saldoCurr, 0), [rincianBeban]);
    const totalBebanPrev = useMemo(() => rincianBeban.reduce((s, a) => s + a.saldoPrev, 0), [rincianBeban]);

    const exportToExcel = () => {
        const data = [];
        data.push({ 'Catatan': 'YAYASAN DARELIMAN' });
        data.push({ 'Catatan': `CATATAN ATAS LAPORAN KEUANGAN (CALK) - TAHUN ${currentYearStr}` });
        data.push({ 'Catatan': `Untuk Periode yang Berakhir pada 31 Desember ${currentYearStr}` });
        data.push({});

        const appendSection = (title, items, totCurr, totPrev) => {
            data.push({ 'Catatan': title, 'Kode': '', 'Tahun Berjalan': `Tahun ${currentYearStr}`, 'Tahun Sebelumnya': `Tahun ${prevYearStr}` });
            items.forEach(it => {
                data.push({ 'Catatan': it.name, 'Kode': it.code, 'Tahun Berjalan': it.saldoCurr, 'Tahun Sebelumnya': it.saldoPrev });
            });
            data.push({ 'Catatan': `Total ${title}`, 'Kode': '', 'Tahun Berjalan': totCurr, 'Tahun Sebelumnya': totPrev });
            data.push({});
        };

        appendSection('Kas dan Setara Kas', rincianKas, totalKasCurr, totalKasPrev);
        appendSection('Piutang dan Uang Muka', rincianPiutang, totalPiutangCurr, totalPiutangPrev);
        appendSection('Aset Tetap & Tidak Lancar', rincianAsetTetap, totalAsetTetapCurr, totalAsetTetapPrev);
        appendSection('Liabilitas Jangka Pendek', rincianLiabilitas, totalLiabilitasCurr, totalLiabilitasPrev);
        appendSection('Aset Neto', rincianAsetNeto, totalAsetNetoCurr, totalAsetNetoPrev);
        appendSection('Pendapatan Yayasan', rincianPendapatan, totalPendapatanCurr, totalPendapatanPrev);
        appendSection('Beban Operasional & Program', rincianBeban, totalBebanCurr, totalBebanPrev);

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `CALK_${currentYearStr}`);
        XLSX.writeFile(wb, `SIKAD-Dareliman-CALK-${currentYearStr}.xlsx`);
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header Kontrol */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 print:hidden">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                            <FileText size={22} />
                        </div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Catatan Atas Laporan Keuangan (CALK)</h2>
                    </div>
                    <p className="text-slate-500 font-medium text-sm">Penjelasan Naratif & Pengungkapan Pos Keuangan Resmi Sesuai PSAK 35 / ISAK 35</p>
                </div>

                <div className="flex flex-wrap gap-3 items-center">
                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-2xl border border-slate-200 shadow-sm">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Tahun:</span>
                        <select 
                            className="bg-transparent border-none text-sm font-bold text-slate-800 focus:outline-none cursor-pointer"
                            value={activeYear} 
                            onChange={e => setSelectedYear(e.target.value)}
                        >
                            {availableYears.map(year => (
                                <option key={year} value={year}>Tahun {year}</option>
                            ))}
                        </select>
                    </div>

                    <button 
                        onClick={exportToExcel} 
                        className="btn bg-white text-emerald-600 border border-emerald-200 hover:bg-emerald-50 px-5 py-2.5 rounded-2xl shadow-sm text-sm font-bold flex items-center gap-2 transition-all"
                    >
                        <FileSpreadsheet size={16} /> Export Excel
                    </button>
                    <button 
                        onClick={() => window.print()} 
                        className="btn bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-2xl shadow-lg shadow-blue-500/20 text-sm font-bold flex items-center gap-2 transition-all"
                    >
                        <Printer size={16} /> Cetak CALK
                    </button>
                </div>
            </div>

            {/* Navigasi Tab Bab (Khusus Layar) */}
            <div className="flex gap-2 mb-8 bg-slate-100 p-1.5 rounded-2xl print:hidden overflow-x-auto">
                <button 
                    onClick={() => setActiveTab('all')} 
                    className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'all' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-900'}`}
                >
                    Semua Bab Lengkap
                </button>
                <button 
                    onClick={() => setActiveTab('umum')} 
                    className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'umum' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-900'}`}
                >
                    Bab I: Gambaran Umum
                </button>
                <button 
                    onClick={() => setActiveTab('kebijakan')} 
                    className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'kebijakan' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-900'}`}
                >
                    Bab II: Kebijakan Akuntansi
                </button>
                <button 
                    onClick={() => setActiveTab('pos')} 
                    className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'pos' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-900'}`}
                >
                    Bab III: Penjelasan Pos Keuangan
                </button>
            </div>

            {/* Kontainer Lembar Laporan Formal */}
            <div className="bg-white p-8 md:p-14 rounded-[36px] border border-slate-100 shadow-xl overflow-hidden space-y-12" ref={reportRef}>
                {/* Header Formal Instansi */}
                <div className="text-center pb-8 border-b-2 border-slate-200">
                    <p className="text-xs font-black tracking-[0.25em] text-slate-400 uppercase mb-1">LAPORAN KEUANGAN YAYASAN</p>
                    <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">YAYASAN DARELIMAN</h1>
                    <h2 className="text-lg font-bold text-blue-600 mt-1 uppercase tracking-wide">CATATAN ATAS LAPORAN KEUANGAN (CALK)</h2>
                    <div className="inline-block mt-3 px-4 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                        Untuk Periode yang Berakhir pada 31 Desember {currentYearStr} (Standar PSAK 35 / ISAK 35)
                    </div>
                </div>

                {/* BAB I: GAMBARAN UMUM */}
                {(activeTab === 'all' || activeTab === 'umum') && (
                    <section className="space-y-6">
                        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                            <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 font-black text-sm flex items-center justify-center">1</span>
                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-wide">BAB I — GAMBARAN UMUM ENTITAS</h3>
                        </div>

                        <div className="prose prose-slate max-w-none text-sm text-slate-600 space-y-4 leading-relaxed">
                            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                                <h4 className="font-bold text-slate-900 text-sm">1.1 Pendirian dan Legalitas Entitas</h4>
                                <p>
                                    Yayasan Dareliman adalah entitas nirlaba yang berkedudukan di Indonesia, didirikan secara sah melalui akta notaris pendirian 
                                    serta telah memperoleh pengesahan dari Kementerian Hukum dan Hak Asasi Manusia Republik Indonesia. 
                                    Yayasan bergerak secara aktif di bidang dakwah Islam, pendidikan formal dan non-formal, serta pemberdayaan sosial masyarakat.
                                </p>
                            </div>

                            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                                <h4 className="font-bold text-slate-900 text-sm">1.2 Maksud dan Tujuan Yayasan</h4>
                                <p>
                                    Maksud dan tujuan utama yayasan adalah menghimpun, mengelola, dan mendayagunakan sumber daya umat, donasi, zakat, infak, sedekah, 
                                    serta dana operasional pendidikan secara transparan, akuntabel, dan profesional demi kemaslahatan umat.
                                </p>
                            </div>

                            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                                <h4 className="font-bold text-slate-900 text-sm">1.3 Susunan Organ Yayasan</h4>
                                <p>
                                    Pengelolaan Yayasan Dareliman dilaksanakan oleh organ yayasan yang terdiri dari Pembina, Pengawas, dan Pengurus Harian 
                                    yang bertanggung jawab atas kelangsungan operasional dan kepatuhan terhadap amanah para donatur.
                                </p>
                            </div>
                        </div>
                    </section>
                )}

                {/* BAB II: IKHTISAR KEBIJAKAN AKUNTANSI */}
                {(activeTab === 'all' || activeTab === 'kebijakan') && (
                    <section className="space-y-6">
                        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                            <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 font-black text-sm flex items-center justify-center">2</span>
                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-wide">BAB II — IKHTISAR KEBIJAKAN AKUNTANSI PENTING</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm text-slate-600 leading-relaxed">
                            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2">
                                <h4 className="font-bold text-slate-900 flex items-center gap-2">
                                    <CheckCircle2 size={16} className="text-emerald-600" />
                                    2.1 Kepatuhan terhadap Standar (PSAK 35)
                                </h4>
                                <p className="text-xs text-slate-500">
                                    Laporan keuangan disusun sesuai dengan Pernyataan Standar Akuntansi Keuangan No. 35 (PSAK 35) dan Interpretasi Standar Akuntansi Keuangan (ISAK 35) 
                                    tentang Penyajian Laporan Keuangan Entitas Berorientasi Nonlaba.
                                </p>
                            </div>

                            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2">
                                <h4 className="font-bold text-slate-900 flex items-center gap-2">
                                    <CheckCircle2 size={16} className="text-emerald-600" />
                                    2.2 Dasar Pengukuran dan Mata Uang
                                </h4>
                                <p className="text-xs text-slate-500">
                                    Laporan keuangan disusun atas dasar akrual (*accrual basis*), kecuali laporan arus kas yang disusun atas dasar kas. Mata uang pelaporan yang digunakan adalah Rupiah (IDR).
                                </p>
                            </div>

                            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2">
                                <h4 className="font-bold text-slate-900 flex items-center gap-2">
                                    <CheckCircle2 size={16} className="text-emerald-600" />
                                    2.3 Pengakuan Donasi dan Pendapatan
                                </h4>
                                <p className="text-xs text-slate-500">
                                    Penerimaan donasi tanpa pembatasan diakui sebagai penambah aset neto tanpa pembatasan pada saat penerimaan. Donasi terikat amanah khusus diakui sebagai aset neto dengan pembatasan.
                                </p>
                            </div>

                            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2">
                                <h4 className="font-bold text-slate-900 flex items-center gap-2">
                                    <CheckCircle2 size={16} className="text-emerald-600" />
                                    2.4 Kebijakan Aset Tetap & Penyusutan
                                </h4>
                                <p className="text-xs text-slate-500">
                                    Aset tetap dicatat sebesar biaya perolehan. Penyusutan dihitung menggunakan metode garis lurus (*straight-line method*) berdasarkan estimasi masa manfaat ekonomis masing-masing aset.
                                </p>
                            </div>
                        </div>
                    </section>
                )}

                {/* BAB III: PENJELASAN RINCIAN POS-POS LAPORAN KEUANGAN */}
                {(activeTab === 'all' || activeTab === 'pos') && (
                    <section className="space-y-8">
                        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                            <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 font-black text-sm flex items-center justify-center">3</span>
                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-wide">BAB III — RINCIAN POS-POS LAPORAN KEUANGAN</h3>
                        </div>

                        {/* Catatan 1: Kas dan Setara Kas */}
                        <div className="bg-slate-50/70 p-6 rounded-3xl border border-slate-200/80 space-y-4">
                            <div className="flex justify-between items-center">
                                <h4 className="font-black text-slate-900 text-sm uppercase tracking-wide">
                                    Catatan 1: Kas dan Setara Kas
                                </h4>
                                <span className="text-xs font-bold text-slate-500">Kode Akun: 1-1100 s/d 1-1199</span>
                            </div>
                            <p className="text-xs text-slate-500">Saldo kas tunai dan rekening bank yayasan yang siap digunakan untuk operasional:</p>
                            <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider border-b border-slate-200">
                                        <tr>
                                            <th className="px-5 py-3">Kode</th>
                                            <th className="px-5 py-3">Nama Akun Rekening</th>
                                            <th className="px-5 py-3 text-right">31 Des {currentYearStr} (Rp)</th>
                                            <th className="px-5 py-3 text-right">31 Des {prevYearStr} (Rp)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                        {rincianKas.map(a => (
                                            <tr key={a.id} className="hover:bg-slate-50/50">
                                                <td className="px-5 py-2.5 font-mono text-slate-400 font-bold">{a.code}</td>
                                                <td className="px-5 py-2.5">{a.name}</td>
                                                <td className="px-5 py-2.5 text-right font-bold tabular-nums"><CurrencyDisplay value={a.saldoCurr} useColor={false} /></td>
                                                <td className="px-5 py-2.5 text-right font-bold tabular-nums text-slate-400"><CurrencyDisplay value={a.saldoPrev} useColor={false} /></td>
                                            </tr>
                                        ))}
                                        <tr className="bg-slate-100 font-black text-slate-900">
                                            <td colSpan={2} className="px-5 py-3 text-right uppercase">Total Kas dan Setara Kas</td>
                                            <td className="px-5 py-3 text-right tabular-nums text-blue-700"><CurrencyDisplay value={totalKasCurr} useColor={false} /></td>
                                            <td className="px-5 py-3 text-right tabular-nums text-slate-500"><CurrencyDisplay value={totalKasPrev} useColor={false} /></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Catatan 2: Piutang & Uang Muka */}
                        <div className="bg-slate-50/70 p-6 rounded-3xl border border-slate-200/80 space-y-4">
                            <div className="flex justify-between items-center">
                                <h4 className="font-black text-slate-900 text-sm uppercase tracking-wide">
                                    Catatan 2: Piutang dan Uang Muka
                                </h4>
                                <span className="text-xs font-bold text-slate-500">Kode Akun: 1-1200 s/d 1-1299</span>
                            </div>
                            <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider border-b border-slate-200">
                                        <tr>
                                            <th className="px-5 py-3">Kode</th>
                                            <th className="px-5 py-3">Nama Akun Rekening</th>
                                            <th className="px-5 py-3 text-right">31 Des {currentYearStr} (Rp)</th>
                                            <th className="px-5 py-3 text-right">31 Des {prevYearStr} (Rp)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                        {rincianPiutang.length === 0 ? (
                                            <tr><td colSpan={4} className="px-5 py-4 text-center text-slate-400 italic">Tidak ada piutang atau uang muka aktif</td></tr>
                                        ) : rincianPiutang.map(a => (
                                            <tr key={a.id} className="hover:bg-slate-50/50">
                                                <td className="px-5 py-2.5 font-mono text-slate-400 font-bold">{a.code}</td>
                                                <td className="px-5 py-2.5">{a.name}</td>
                                                <td className="px-5 py-2.5 text-right font-bold tabular-nums"><CurrencyDisplay value={a.saldoCurr} useColor={false} /></td>
                                                <td className="px-5 py-2.5 text-right font-bold tabular-nums text-slate-400"><CurrencyDisplay value={a.saldoPrev} useColor={false} /></td>
                                            </tr>
                                        ))}
                                        <tr className="bg-slate-100 font-black text-slate-900">
                                            <td colSpan={2} className="px-5 py-3 text-right uppercase">Total Piutang dan Uang Muka</td>
                                            <td className="px-5 py-3 text-right tabular-nums text-blue-700"><CurrencyDisplay value={totalPiutangCurr} useColor={false} /></td>
                                            <td className="px-5 py-3 text-right tabular-nums text-slate-500"><CurrencyDisplay value={totalPiutangPrev} useColor={false} /></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Catatan 3: Aset Tetap */}
                        <div className="bg-slate-50/70 p-6 rounded-3xl border border-slate-200/80 space-y-4">
                            <div className="flex justify-between items-center">
                                <h4 className="font-black text-slate-900 text-sm uppercase tracking-wide">
                                    Catatan 3: Aset Tetap dan Akumulasi Penyusutan
                                </h4>
                                <span className="text-xs font-bold text-slate-500">Kode Akun: 1-2000 s/d 1-2999</span>
                            </div>
                            <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider border-b border-slate-200">
                                        <tr>
                                            <th className="px-5 py-3">Kode</th>
                                            <th className="px-5 py-3">Nama Akun Aset Tetap</th>
                                            <th className="px-5 py-3 text-right">31 Des {currentYearStr} (Rp)</th>
                                            <th className="px-5 py-3 text-right">31 Des {prevYearStr} (Rp)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                        {rincianAsetTetap.map(a => (
                                            <tr key={a.id} className="hover:bg-slate-50/50">
                                                <td className="px-5 py-2.5 font-mono text-slate-400 font-bold">{a.code}</td>
                                                <td className="px-5 py-2.5">{a.name}</td>
                                                <td className="px-5 py-2.5 text-right font-bold tabular-nums"><CurrencyDisplay value={a.saldoCurr} useColor={false} /></td>
                                                <td className="px-5 py-2.5 text-right font-bold tabular-nums text-slate-400"><CurrencyDisplay value={a.saldoPrev} useColor={false} /></td>
                                            </tr>
                                        ))}
                                        <tr className="bg-slate-100 font-black text-slate-900">
                                            <td colSpan={2} className="px-5 py-3 text-right uppercase">Nilai Buku Aset Tetap Bersih</td>
                                            <td className="px-5 py-3 text-right tabular-nums text-blue-700"><CurrencyDisplay value={totalAsetTetapCurr} useColor={false} /></td>
                                            <td className="px-5 py-3 text-right tabular-nums text-slate-500"><CurrencyDisplay value={totalAsetTetapPrev} useColor={false} /></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Catatan 4: Liabilitas */}
                        <div className="bg-slate-50/70 p-6 rounded-3xl border border-slate-200/80 space-y-4">
                            <div className="flex justify-between items-center">
                                <h4 className="font-black text-slate-900 text-sm uppercase tracking-wide">
                                    Catatan 4: Liabilitas (Kewajiban)
                                </h4>
                                <span className="text-xs font-bold text-slate-500">Kode Akun: 2-0000 s/d 2-9999</span>
                            </div>
                            <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider border-b border-slate-200">
                                        <tr>
                                            <th className="px-5 py-3">Kode</th>
                                            <th className="px-5 py-3">Nama Akun Kewajiban</th>
                                            <th className="px-5 py-3 text-right">31 Des {currentYearStr} (Rp)</th>
                                            <th className="px-5 py-3 text-right">31 Des {prevYearStr} (Rp)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                        {rincianLiabilitas.length === 0 ? (
                                            <tr><td colSpan={4} className="px-5 py-4 text-center text-slate-400 italic">Tidak ada liabilitas tercatat</td></tr>
                                        ) : rincianLiabilitas.map(a => (
                                            <tr key={a.id} className="hover:bg-slate-50/50">
                                                <td className="px-5 py-2.5 font-mono text-slate-400 font-bold">{a.code}</td>
                                                <td className="px-5 py-2.5">{a.name}</td>
                                                <td className="px-5 py-2.5 text-right font-bold tabular-nums"><CurrencyDisplay value={a.saldoCurr} useColor={false} /></td>
                                                <td className="px-5 py-2.5 text-right font-bold tabular-nums text-slate-400"><CurrencyDisplay value={a.saldoPrev} useColor={false} /></td>
                                            </tr>
                                        ))}
                                        <tr className="bg-slate-100 font-black text-slate-900">
                                            <td colSpan={2} className="px-5 py-3 text-right uppercase">Total Liabilitas</td>
                                            <td className="px-5 py-3 text-right tabular-nums text-blue-700"><CurrencyDisplay value={totalLiabilitasCurr} useColor={false} /></td>
                                            <td className="px-5 py-3 text-right tabular-nums text-slate-500"><CurrencyDisplay value={totalLiabilitasPrev} useColor={false} /></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Catatan 5: Aset Neto */}
                        <div className="bg-slate-50/70 p-6 rounded-3xl border border-slate-200/80 space-y-4">
                            <div className="flex justify-between items-center">
                                <h4 className="font-black text-slate-900 text-sm uppercase tracking-wide">
                                    Catatan 5: Aset Neto (Ekuitas Nirlaba)
                                </h4>
                                <span className="text-xs font-bold text-slate-500">Kode Akun: 3-0000 s/d 3-9999</span>
                            </div>
                            <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider border-b border-slate-200">
                                        <tr>
                                            <th className="px-5 py-3">Kode</th>
                                            <th className="px-5 py-3">Klasifikasi Aset Neto</th>
                                            <th className="px-5 py-3 text-right">31 Des {currentYearStr} (Rp)</th>
                                            <th className="px-5 py-3 text-right">31 Des {prevYearStr} (Rp)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                        {rincianAsetNeto.map(a => (
                                            <tr key={a.id} className="hover:bg-slate-50/50">
                                                <td className="px-5 py-2.5 font-mono text-slate-400 font-bold">{a.code}</td>
                                                <td className="px-5 py-2.5">{a.name}</td>
                                                <td className="px-5 py-2.5 text-right font-bold tabular-nums"><CurrencyDisplay value={a.saldoCurr} useColor={false} /></td>
                                                <td className="px-5 py-2.5 text-right font-bold tabular-nums text-slate-400"><CurrencyDisplay value={a.saldoPrev} useColor={false} /></td>
                                            </tr>
                                        ))}
                                        <tr className="bg-slate-100 font-black text-slate-900">
                                            <td colSpan={2} className="px-5 py-3 text-right uppercase">Total Aset Neto</td>
                                            <td className="px-5 py-3 text-right tabular-nums text-emerald-700"><CurrencyDisplay value={totalAsetNetoCurr} useColor={false} /></td>
                                            <td className="px-5 py-3 text-right tabular-nums text-slate-500"><CurrencyDisplay value={totalAsetNetoPrev} useColor={false} /></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Catatan 6: Pendapatan */}
                        <div className="bg-slate-50/70 p-6 rounded-3xl border border-slate-200/80 space-y-4">
                            <div className="flex justify-between items-center">
                                <h4 className="font-black text-slate-900 text-sm uppercase tracking-wide">
                                    Catatan 6: Pendapatan Yayasan
                                </h4>
                                <span className="text-xs font-bold text-slate-500">Kode Akun: 4-0000 s/d 4-9999</span>
                            </div>
                            <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider border-b border-slate-200">
                                        <tr>
                                            <th className="px-5 py-3">Kode</th>
                                            <th className="px-5 py-3">Uraian Pendapatan</th>
                                            <th className="px-5 py-3 text-right">Tahun {currentYearStr} (Rp)</th>
                                            <th className="px-5 py-3 text-right">Tahun {prevYearStr} (Rp)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                        {rincianPendapatan.map(a => (
                                            <tr key={a.id} className="hover:bg-slate-50/50">
                                                <td className="px-5 py-2.5 font-mono text-slate-400 font-bold">{a.code}</td>
                                                <td className="px-5 py-2.5">{a.name}</td>
                                                <td className="px-5 py-2.5 text-right font-bold tabular-nums"><CurrencyDisplay value={a.saldoCurr} useColor={false} /></td>
                                                <td className="px-5 py-2.5 text-right font-bold tabular-nums text-slate-400"><CurrencyDisplay value={a.saldoPrev} useColor={false} /></td>
                                            </tr>
                                        ))}
                                        <tr className="bg-slate-100 font-black text-slate-900">
                                            <td colSpan={2} className="px-5 py-3 text-right uppercase">Total Seluruh Pendapatan</td>
                                            <td className="px-5 py-3 text-right tabular-nums text-blue-700"><CurrencyDisplay value={totalPendapatanCurr} useColor={false} /></td>
                                            <td className="px-5 py-3 text-right tabular-nums text-slate-500"><CurrencyDisplay value={totalPendapatanPrev} useColor={false} /></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Catatan 7: Beban */}
                        <div className="bg-slate-50/70 p-6 rounded-3xl border border-slate-200/80 space-y-4">
                            <div className="flex justify-between items-center">
                                <h4 className="font-black text-slate-900 text-sm uppercase tracking-wide">
                                    Catatan 7: Beban Operasional & Program
                                </h4>
                                <span className="text-xs font-bold text-slate-500">Kode Akun: 5-0000 & 6-0000</span>
                            </div>
                            <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider border-b border-slate-200">
                                        <tr>
                                            <th className="px-5 py-3">Kode</th>
                                            <th className="px-5 py-3">Uraian Beban</th>
                                            <th className="px-5 py-3 text-right">Tahun {currentYearStr} (Rp)</th>
                                            <th className="px-5 py-3 text-right">Tahun {prevYearStr} (Rp)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                        {rincianBeban.map(a => (
                                            <tr key={a.id} className="hover:bg-slate-50/50">
                                                <td className="px-5 py-2.5 font-mono text-slate-400 font-bold">{a.code}</td>
                                                <td className="px-5 py-2.5">{a.name}</td>
                                                <td className="px-5 py-2.5 text-right font-bold tabular-nums"><CurrencyDisplay value={a.saldoCurr} useColor={false} /></td>
                                                <td className="px-5 py-2.5 text-right font-bold tabular-nums text-slate-400"><CurrencyDisplay value={a.saldoPrev} useColor={false} /></td>
                                            </tr>
                                        ))}
                                        <tr className="bg-slate-100 font-black text-slate-900">
                                            <td colSpan={2} className="px-5 py-3 text-right uppercase">Total Seluruh Beban</td>
                                            <td className="px-5 py-3 text-right tabular-nums text-rose-700"><CurrencyDisplay value={totalBebanCurr} useColor={false} /></td>
                                            <td className="px-5 py-3 text-right tabular-nums text-slate-500"><CurrencyDisplay value={totalBebanPrev} useColor={false} /></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </section>
                )}

                {/* Lembar Tanda Tangan Formal */}
                <div className="mt-14 pt-8 border-t-2 border-slate-200">
                    <p className="text-center text-xs font-bold text-slate-500 mb-8">
                        Disahkan di Padang, Sumatera Barat pada {formatTanggal(new Date().toISOString())}
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-8 text-center text-xs">
                        <div className="space-y-16">
                            <p className="font-bold text-slate-500">Ketua Pengurus</p>
                            <div>
                                <p className="font-black text-slate-900 underline uppercase">H. ELVI SYAM, Lc., M.A.</p>
                                <p className="text-[10px] text-slate-400">Pembina / Pengurus Yayasan</p>
                            </div>
                        </div>
                        <div className="space-y-16">
                            <p className="font-bold text-slate-500">Bendahara Yayasan</p>
                            <div>
                                <p className="font-black text-slate-900 underline uppercase">BENDAHARA YAYASAN</p>
                                <p className="text-[10px] text-slate-400">Pengelola Keuangan</p>
                            </div>
                        </div>
                        <div className="space-y-16 col-span-2 md:col-span-1">
                            <p className="font-bold text-slate-500">Kepala Bagian Akuntansi</p>
                            <div>
                                <p className="font-black text-slate-900 underline uppercase">BAGIAN AKUNTANSI</p>
                                <p className="text-[10px] text-slate-400">Penyusun Laporan</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Informasi Cetak */}
                <div className="pt-6 border-t border-slate-100 flex justify-between items-center text-xs text-slate-400">
                    <p>Dicetak melalui SIKAD Yayasan Dareliman pada {formatTanggal(new Date().toISOString())}</p>
                    <p className="font-mono">Standar PSAK 35 / ISAK 35 (Entitas Nirlaba)</p>
                </div>
            </div>
        </div>
    );
}
