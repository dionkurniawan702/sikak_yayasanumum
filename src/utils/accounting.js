import { hitungTotalPenyusutan } from './depreciation';

// ========================================
// Utilitas Akuntansi — SIKAK YAYASAN UMUM
// ========================================

/**
 * Membangun buku besar untuk satu akun
 */
export function bangunBukuBesar(journals, accountId, startDate = null, endDate = null, accounts = []) {
    const entries = [];

    journals.forEach(journal => {
        if (startDate && journal.date < startDate) return;
        if (endDate && journal.date > endDate) return;

        journal.entries.forEach(entry => {
            if (entry.accountId === accountId) {
                entries.push({
                    date: journal.date,
                    journalId: journal.id,
                    description: journal.description,
                    debit: entry.debit || 0,
                    credit: entry.credit || 0,
                });
            }
        });
    });

    entries.sort((a, b) => a.date.localeCompare(b.date));

    const acc = accounts.find(a => a.id === accountId);
    let saldo = acc?.initialBalance || 0;
    const isDebit = acc ? acc.normalBalance === 'debit' : true;

    return entries.map(entry => {
        const mutation = (entry.debit || 0) - (entry.credit || 0);
        saldo += isDebit ? mutation : -mutation;
        return { ...entry, saldo };
    });
}

/**
 * Menghitung saldo akun dari jurnal + otomatisasi penyusutan aset (PSAK 35)
 */
export function hitungSaldoAkun(journals, accountId, accounts, yearLimit = null, assets = [], isYearOnly = false, programId = null, mode = 'balance', startDate = null, endDate = null) {
    const acc = accounts.find(a => a.id === accountId);
    let saldo = (mode === 'balance' && !isYearOnly && !startDate) ? (acc?.initialBalance || 0) : 0;

    // 1. Jurnal Umum
    journals.forEach(journal => {
        const jDate = journal.date;
        const jYear = parseInt(jDate.substring(0, 4));
        const jDateOnly = jDate ? jDate.substring(0, 10) : '';

        if (startDate && jDateOnly < startDate) return;
        if (endDate && jDateOnly > endDate) return;

        if (!startDate && !endDate) {
            if (isYearOnly) {
                if (yearLimit && jYear !== parseInt(yearLimit)) return;
            } else {
                if (yearLimit && jYear > parseInt(yearLimit)) return;
            }
        }

        if (programId && journal.programId !== programId) return;

        journal.entries.forEach(entry => {
            if (entry.accountId === accountId) {
                if (mode === 'debitOnly') {
                    saldo += (entry.debit || 0);
                } else if (mode === 'creditOnly') {
                    saldo += (entry.credit || 0);
                } else {
                    const mutation = (entry.debit || 0) - (entry.credit || 0);
                    if (acc) {
                        saldo += acc.normalBalance === 'debit' ? mutation : -mutation;
                    } else {
                        saldo += mutation;
                    }
                }
            }
        });
    });

    // 2. Aset & Penyusutan Otomatis
    if (assets && assets.length > 0) {
        let targetDate = new Date();
        if (endDate) targetDate = new Date(endDate);
        else if (yearLimit) targetDate = new Date(`${yearLimit}-12-31`);

        assets.forEach(asset => {
            const assetProgramId = asset.programId || 'PRG-GEN';
            if (programId && assetProgramId !== programId) return;

            // Beban Penyusutan
            if (asset.depreciationAccountId === accountId) {
                let depAmount = hitungTotalPenyusutan(asset, targetDate);
                if (startDate) {
                    const prevDate = new Date(startDate);
                    prevDate.setDate(prevDate.getDate() - 1);
                    depAmount -= hitungTotalPenyusutan(asset, prevDate);
                }
                if (mode !== 'creditOnly') saldo += depAmount;
            }
            // Akumulasi Penyusutan
            else if (asset.accumulatedDepAccountId === accountId || asset.accumulatedDepAccountId === acc?.code) {
                let depAmount = hitungTotalPenyusutan(asset, targetDate);
                if (startDate) {
                    const prevDate = new Date(startDate);
                    prevDate.setDate(prevDate.getDate() - 1);
                    depAmount -= hitungTotalPenyusutan(asset, prevDate);
                }
                if (mode !== 'debitOnly') saldo += depAmount;
            }

            // Aset tanpa Jurnal (Manual Input)
            if (!asset.journalId) {
                const aDate = asset.acquisitionDate ? asset.acquisitionDate.substring(0, 10) : '';
                const limitDate = endDate || (yearLimit ? `${yearLimit}-12-31` : '');
                if (limitDate && aDate > limitDate) return;

                let targetAssetAcc = accounts.find(a => a.id === asset.assetAccountId || a.code === asset.assetAccountId);
                
                // Debet Aset
                if (asset.assetAccountId === accountId || (targetAssetAcc && targetAssetAcc.id === accountId)) {
                    if (mode !== 'creditOnly') saldo += asset.cost;
                }
                
                // Kredit Aset Neto (PSAK 35)
                // Default balancing account for assets in Yayasan is usually Aset Neto Tanpa Pembatasan
                const balancingCode = '3-1101'; 
                if (acc?.code === balancingCode || acc?.id === balancingCode) {
                    if (mode !== 'debitOnly') saldo += asset.cost;
                }
            }
        });
    }

    return saldo;
}

export function hitungPersentaseProgram(totalPenyaluran, totalPenerimaan) {
    if (totalPenerimaan <= 0) return 0;
    return (totalPenyaluran / totalPenerimaan) * 100;
}
