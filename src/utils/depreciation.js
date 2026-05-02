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
