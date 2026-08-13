// ========================================
// Utilitas Format — SIKAD DARELIMAN
// ========================================

/**
 * Format angka ke Rupiah Indonesia
 */
export function formatRupiah(angka) {
    if (angka === null || angka === undefined) return 'Rp 0';
    const abs = Math.abs(angka);
    const formatted = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(abs);
    return angka < 0 ? `- ${formatted}` : formatted;
}

/**
 * Mendapatkan warna untuk angka Rupiah (Merah jika negatif)
 */
export function getRupiahColor(angka) {
    return (angka < 0) ? '#e11d48' : 'inherit';
}

/**
 * Format angka biasa dengan pemisah ribuan
 */
export function formatAngka(angka) {
    if (angka === null || angka === undefined) return '0';
    return new Intl.NumberFormat('id-ID').format(angka);
}

/**
 * Format tanggal ke bahasa Indonesia
 */
export function formatTanggal(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).format(date);
}

/**
 * Format tanggal pendek
 */
export function formatTanggalPendek(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(date);
}

/**
 * Generate ID unik yang lebih aman
 */
export function generateId(prefix = 'ID') {
    const timestamp = Date.now().toString(36).toUpperCase();
    const randomStr = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${prefix}-${timestamp}-${randomStr}`;
}
