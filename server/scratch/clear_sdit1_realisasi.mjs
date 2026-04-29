/**
 * Script untuk menghapus semua data realisasi (budgetReport) dan pengajuan (budgetRequest)
 * milik unit SDIT 1 saja, via API HTTP.
 * 
 * Jalankan: node scratch/clear_sdit1_realisasi.mjs
 */

// Ganti dengan token superadmin yang aktif (ambil dari localStorage browser: key 'jwt_token')
const TOKEN = process.argv[2];
const BASE_URL = 'http://localhost:5000/api';

if (!TOKEN) {
    console.error('❌ Usage: node scratch/clear_sdit1_realisasi.mjs <JWT_TOKEN>');
    console.error('   Token bisa diambil dari browser DevTools > Application > Local Storage > jwt_token');
    process.exit(1);
}

const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${TOKEN}`
};

async function main() {
    console.log('🔍 Mengambil semua data dari server...');
    
    const res = await fetch(`${BASE_URL}/all-data`, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const { data } = await res.json();

    // Cari unit SDIT 1
    const sditUnits = (data.units || []).filter(u => u.name.toLowerCase().includes('sdit') && !u.isDeleted);
    console.log(`\n📋 Unit SDIT ditemukan: ${sditUnits.map(u => `${u.name} (${u.id})`).join(', ')}`);

    if (sditUnits.length === 0) {
        console.log('Tidak ada unit SDIT aktif!');
        return;
    }

    const sditIds = new Set(sditUnits.map(u => u.id));

    // Filter budgetReports milik SDIT
    const reportsToDelete = (data.budgetReports || []).filter(r => sditIds.has(r.unitId));
    console.log(`\n📄 BudgetReport SDIT yang akan dihapus: ${reportsToDelete.length}`);
    reportsToDelete.forEach(r => console.log(`  - ID: ${r.id} | Status: ${r.status} | Amount: ${r.totalAmount}`));

    // Filter budgetRequests milik SDIT
    const requestsToDelete = (data.budgetRequests || []).filter(r => sditIds.has(r.unitId));
    console.log(`\n📄 BudgetRequest SDIT yang akan dihapus: ${requestsToDelete.length}`);
    requestsToDelete.forEach(r => console.log(`  - ID: ${r.id} | Status: ${r.status} | Amount: ${r.totalAmount}`));

    if (reportsToDelete.length === 0 && requestsToDelete.length === 0) {
        console.log('\n✅ Tidak ada data yang perlu dihapus!');
        return;
    }

    // Konfirmasi
    console.log('\n⚠️  Lanjutkan hapus? (ctrl+C untuk batal, tunggu 3 detik untuk lanjut...)');
    await new Promise(r => setTimeout(r, 3000));

    // Hapus budgetReports
    for (const report of reportsToDelete) {
        process.stdout.write(`  Menghapus report ${report.id}...`);
        const delRes = await fetch(`${BASE_URL}/budget-reports/${report.id}`, { method: 'DELETE', headers });
        if (delRes.ok) {
            console.log(' ✅');
        } else {
            console.log(` ❌ (${delRes.status}: ${await delRes.text()})`);
        }
    }

    // Hapus budgetRequests
    for (const req of requestsToDelete) {
        process.stdout.write(`  Menghapus request ${req.id}...`);
        const delRes = await fetch(`${BASE_URL}/budget-requests/${req.id}`, { method: 'DELETE', headers });
        if (delRes.ok) {
            console.log(' ✅');
        } else {
            console.log(` ❌ (${delRes.status}: ${await delRes.text()})`);
        }
    }

    console.log('\n🎉 Selesai! Data realisasi SDIT 1 berhasil dikosongkan.');
}

main().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
