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

/**
 * Parse input tanggal dari Excel (baik nomor seri Excel 46301, DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD, dsb)
 * Menghasilkan string berformat YYYY-MM-DD standar yang kompatibel dengan HTML5 date input dan database.
 */
export function parseExcelDate(rawDate) {
    if (!rawDate) return new Date().toISOString().split('T')[0];

    // Jika sudah berupa objek Date JS
    if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
        const year = rawDate.getFullYear();
        const month = String(rawDate.getMonth() + 1).padStart(2, '0');
        const day = String(rawDate.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // Jika berupa angka nomor seri tanggal Excel (misal 46301)
    if (typeof rawDate === 'number' || (/^\d{4,6}(\.\d+)?$/.test(String(rawDate).trim()) && !String(rawDate).includes('-') && !String(rawDate).includes('/'))) {
        const num = typeof rawDate === 'number' ? rawDate : parseFloat(String(rawDate).trim());
        if (num > 1000 && num < 100000) {
            const dateFromSerial = new Date(Math.round((num - 25569) * 86400 * 1000));
            if (!isNaN(dateFromSerial.getTime())) {
                const year = dateFromSerial.getUTCFullYear();
                const month = String(dateFromSerial.getUTCMonth() + 1).padStart(2, '0');
                const day = String(dateFromSerial.getUTCDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            }
        }
    }

    const str = String(rawDate).trim();

    // Jika sudah format YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        return str.substring(0, 10);
    }

    // Jika format DD-MM-YYYY atau DD/MM/YYYY (misal: 06-10-2026 atau 06/10/2026)
    const ddmmyyyy = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (ddmmyyyy) {
        const day = ddmmyyyy[1].padStart(2, '0');
        const month = ddmmyyyy[2].padStart(2, '0');
        const year = ddmmyyyy[3];
        return `${year}-${month}-${day}`;
    }

    // Jika format YYYY/MM/DD
    const yyyymmdd = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (yyyymmdd) {
        const year = yyyymmdd[1];
        const month = yyyymmdd[2].padStart(2, '0');
        const day = yyyymmdd[3].padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // Fallback: coba native parse jika tahun masuk akal (1990 - 2100)
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1990 && parsed.getFullYear() < 2100) {
        const year = parsed.getFullYear();
        const month = String(parsed.getMonth() + 1).padStart(2, '0');
        const day = String(parsed.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    return new Date().toISOString().split('T')[0];
}

