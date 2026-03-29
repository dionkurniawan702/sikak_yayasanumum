import { useState } from 'react'
import { 
  LayoutDashboard, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  History, 
  BarChart3, 
  Settings,
  Menu,
  X,
  Plus
} from 'lucide-react'

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-slate-50 font-inter">
      {/* Sidebar Overlay (Mobile) */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed left-0 top-0 z-50 h-screen w-72 bg-slate-900 text-slate-200 transition-transform duration-300 ease-in-out lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex h-20 items-center border-b border-slate-800 px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-500/20">
              <LayoutDashboard size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">SIKAK</h1>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Yayasan Umum</p>
            </div>
          </div>
        </div>

        <nav className="mt-8 space-y-1 px-4">
          <SidebarLink icon={<LayoutDashboard size={18} />} label="Dashboard" active />
          <SidebarLink icon={<Wallet size={18} />} label="Kas & Bank" />
          <SidebarLink icon={<History size={18} />} label="Jurnal Umum" />
          <SidebarLink icon={<BarChart3 size={18} />} label="Laporan" />
          <SidebarLink icon={<Settings size={18} />} label="Pengaturan" />
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-72">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200 bg-white px-8">
          <div className="flex items-center gap-4">
            <button 
              className="rounded-lg bg-slate-100 p-2 text-slate-600 lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Dashboard</h2>
              <p className="text-xs text-slate-500">Ringkasan aktivitas keuangan hari ini.</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/30">
              <Plus size={18} />
              <span className="hidden sm:inline">Tambah Transaksi</span>
            </button>
          </div>
        </header>

        {/* Content Body */}
        <section className="p-8">
          {/* Stats Grid */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard 
              label="Saldo Kas & Bank" 
              value="Rp 125.450.000" 
              icon={<Wallet className="text-blue-600" />} 
            />
            <StatCard 
              label="Pemasukan (Bulan Ini)" 
              value="Rp 45.300.000" 
              icon={<ArrowUpRight className="text-emerald-600" />} 
              trend="+12% dari bln lalu"
            />
            <StatCard 
              label="Pengeluaran (Bulan Ini)" 
              value="Rp 18.250.000" 
              icon={<ArrowDownLeft className="text-rose-600" />} 
              trend="-5% dari bln lalu"
            />
          </div>

          {/* Table Placeholder */}
          <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Transaksi Terakhir</h3>
              <button className="text-xs font-semibold text-blue-600 hover:underline">Lihat Semua</button>
            </div>
            
            <div className="overflow-hidden rounded-xl border border-slate-100 bg-slate-50/50">
              <table className="w-full text-left text-sm text-slate-600">
                <thead>
                  <tr className="border-b border-slate-100 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="px-6 py-4">Tanggal</th>
                    <th className="px-6 py-4">Keterangan</th>
                    <th className="px-6 py-4">Kategori</th>
                    <th className="px-6 py-4 text-right">Jumlah</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <TableRow date="29 Mar 2026" title="Sewa Kantor" cat="Operasional" amount="- Rp 5.000.000" isNeg />
                  <TableRow date="28 Mar 2026" title="Donasi Yayasan" cat="Sosial" amount="+ Rp 10.000.000" />
                  <TableRow date="27 Mar 2026" title="Biaya Listrik" cat="Operasional" amount="- Rp 1.500.000" isNeg />
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

function SidebarLink({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <a 
      href="#" 
      className={`
        flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all
        ${active ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}
      `}
    >
      {icon}
      {label}
    </a>
  )
}

function StatCard({ label, value, icon, trend }: { label: string, value: string, icon: React.ReactNode, trend?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-transform hover:-translate-y-1">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-slate-600">
          {icon}
        </div>
        {trend && (
          <span className={`text-[10px] font-bold ${trend.includes('+') ? 'text-emerald-600' : 'text-slate-400'}`}>
            {trend}
          </span>
        )}
      </div>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
      <h4 className="mt-1 text-2xl font-bold text-slate-900">{value}</h4>
    </div>
  )
}

function TableRow({ date, title, cat, amount, isNeg = false }: { date: string, title: string, cat: string, amount: string, isNeg?: boolean }) {
  return (
    <tr className="bg-white hover:bg-slate-50 transition-colors">
      <td className="px-6 py-4 text-xs font-medium text-slate-500">{date}</td>
      <td className="px-6 py-4 font-semibold text-slate-900">{title}</td>
      <td className="px-6 py-4">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-600">
          {cat}
        </span>
      </td>
      <td className={`px-6 py-4 text-right font-bold ${isNeg ? 'text-rose-600' : 'text-emerald-600'}`}>
        {amount}
      </td>
    </tr>
  )
}

export default App
