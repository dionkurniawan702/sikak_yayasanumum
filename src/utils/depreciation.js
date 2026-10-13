// ========================================
// Utilitas Penyusutan — SIKAD DARELIMAN
// ========================================

export function hitungPenyusutanBulanan(hargaPerolehan, nilaiResidu, masaManfaatBulan) {
    if (masaManfaatBulan <= 0) return 0;
    return (hargaPerolehan - nilaiResidu) / masaManfaatBulan;
}

export function hitungSelisihBulan(dateStart, dateEnd) {
    const start = new Date(dateStart);
    const end = new Date(dateEnd);
    let months = (end.getFullYear() - start.getFullYear()) * 12;
    months -= start.getMonth();
    months += end.getMonth();
    return Math.max(0, months);
}

export function hitungTotalPenyusutan(aset, targetDate = new Date()) {
    const bulanBerjalan = hitungSelisihBulan(aset.acquisitionDate, targetDate);
    const penyusutanBulanan = hitungPenyusutanBulanan(aset.cost, aset.residualValue, aset.usefulLifeMonths);
    const totalPenyusutan = bulanBerjalan * penyusutanBulanan;
    const maksimalPenyusutan = aset.cost - aset.residualValue;
    return Math.min(Math.round(totalPenyusutan), maksimalPenyusutan);
}

export function hitungNilaiBuku(aset) {
    const totalPenyusutan = hitungTotalPenyusutan(aset);
    return aset.cost - totalPenyusutan;
}

/**
 * Mendapatkan detail kategori aset dan default umur ekonomis secara otomatis
 * berdasarkan konfigurasi komponen RAB, kategori aset, atau kode akun COA.
 */
export function getAssetDefaultDetails({ item, expenseItem, account, assetCategories = [] }) {
    // 1. Jika item sudah memiliki umur ekonomis eksplisit (dari RAB atau pengajuan)
    if (item?.umurEkonomis) {
        return { isAsset: true, umurEkonomis: String(item.umurEkonomis) };
    }
    if (item?.economicLife) {
        return { isAsset: true, umurEkonomis: String(item.economicLife) };
    }

    // 2. Cek apakah item memiliki assetCategory yang cocok dengan master kategori aset
    if (item?.assetCategory && Array.isArray(assetCategories)) {
        const cat = assetCategories.find(c => 
            (c?.name && c.name.trim().toLowerCase() === String(item.assetCategory).trim().toLowerCase()) || 
            c?.id === item.assetCategory
        );
        if (cat?.economicLife) {
            return { isAsset: true, umurEkonomis: String(cat.economicLife) };
        }
    }

    // 3. Cek flag isAsset pada item
    if (item?.isAsset) {
        return { isAsset: true, umurEkonomis: '4' };
    }

    // 4. Deteksi otomatis dari Akun Beban / Debit (COA)
    const code = String(account?.code || expenseItem?.code || '').trim();
    const accName = String(account?.name || '').toLowerCase();
    const expName = String(expenseItem?.name || '').toLowerCase();
    const itemName = String(item?.name || item?.label || '').toLowerCase();

    // Akun Aset Tetap (1-2xxx)
    if (code.startsWith('1-2') || code.startsWith('12')) {
        // 1-2101 Gedung & Bangunan
        if (code.startsWith('1-2101') || accName.includes('gedung') || accName.includes('bangunan')) {
            return { isAsset: true, umurEkonomis: '20' };
        }
        // 1-2102 Kendaraan
        if (code.startsWith('1-2102') || accName.includes('kendaraan') || accName.includes('motor') || accName.includes('mobil')) {
            return { isAsset: true, umurEkonomis: '8' };
        }
        // 1-2103 Peralatan Kantor, Mesin, Komputer, Elektronik
        if (code.startsWith('1-2103') || accName.includes('peralatan') || accName.includes('elektronik') || accName.includes('komputer') || accName.includes('mesin')) {
            return { isAsset: true, umurEkonomis: '4' };
        }
        // 1-2104 Mebel & Perabot Kantor
        if (code.startsWith('1-2104') || accName.includes('mebel') || accName.includes('perabot')) {
            return { isAsset: true, umurEkonomis: '8' };
        }
        // Default akun aset tetap lainnya
        return { isAsset: true, umurEkonomis: '4' };
    }

    // Deteksi kata kunci barang inventaris pada nama item/akun
    const combinedName = `${accName} ${expName} ${itemName}`;
    if (
        combinedName.includes('laptop') || 
        combinedName.includes('komputer') || 
        combinedName.includes('printer') || 
        combinedName.includes('proyektor') || 
        combinedName.includes('elektronik') || 
        combinedName.includes('peralatan kantor') ||
        combinedName.includes('peralatan ') ||
        combinedName.includes('mesin')
    ) {
        return { isAsset: true, umurEkonomis: '4' };
    }
    if (
        combinedName.includes('meja kantor') || 
        combinedName.includes('kursi kantor') || 
        combinedName.includes('lemari kantor') || 
        combinedName.includes('mebel') || 
        combinedName.includes('perabot') ||
        combinedName.includes('sofa')
    ) {
        return { isAsset: true, umurEkonomis: '8' };
    }
    if (combinedName.includes('kendaraan') || combinedName.includes('motor') || combinedName.includes('mobil')) {
        return { isAsset: true, umurEkonomis: '8' };
    }
    if (combinedName.includes('bangunan') || combinedName.includes('gedung') || combinedName.includes('renovasi ruang')) {
        return { isAsset: true, umurEkonomis: '20' };
    }

    return { isAsset: false, umurEkonomis: '' };
}
