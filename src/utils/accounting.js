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
 * Membangun neraca saldo (trial balance)
 */
export function bangunNeracaSaldo(journals, accounts) {
    const saldoAkun = {};

    accounts
        .filter(acc => acc.category === 'detail')
        .forEach(acc => {
            saldoAkun[acc.id] = { debit: 0, credit: 0 };
        });

    journals.forEach(journal => {
        journal.entries.forEach(entry => {
            if (!saldoAkun[entry.accountId]) {
                saldoAkun[entry.accountId] = { debit: 0, credit: 0 };
            }
            saldoAkun[entry.accountId].debit += entry.debit || 0;
            saldoAkun[entry.accountId].credit += entry.credit || 0;
        });
    });

    return accounts
        .filter(acc => acc.category === 'detail')
        .map(acc => {
            const data = saldoAkun[acc.id] || { debit: 0, credit: 0 };
            const initial = acc.initialBalance || 0;
            const mutation = data.debit - data.credit;

            const netDebit = acc.normalBalance === 'debit'
                ? initial + mutation
                : mutation - initial;

            return {
                accountId: acc.id,
                code: acc.code,
                name: acc.name,
                type: acc.type,
                fund: acc.fund,
                debit: netDebit > 0 ? netDebit : 0,
                credit: netDebit < 0 ? Math.abs(netDebit) : 0,
            };
        })
        .filter(item => item.debit !== 0 || item.credit !== 0);
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

/**
 * Helper Universal Pembuat Hierarki Induk->Anak (Grup -> Header -> Detail)
 */
export function buildHierarchyAccounts(journals, accounts, type, funds = null, yearLimit = null, assets = [], isYearOnly = false, showEmpty = false) {
    let typeAccounts = accounts.filter(a => a.type === type);

    if (funds) {
        typeAccounts = typeAccounts.filter(a => funds.includes(a.fund) || a.category === 'header');
    }

    const headers = typeAccounts.filter(a => a.category === 'header').sort((a, b) => a.code.localeCompare(b.code));
    const details = typeAccounts.filter(a => a.category === 'detail');

    const detailToHeader = {};
    details.forEach(child => {
        let bestMatch = null;
        let longestMatch = 0;
        headers.forEach(header => {
            const cleanPrefix = header.code.replace(/0+$/, '');
            if (child.code.startsWith(cleanPrefix) && cleanPrefix.length > longestMatch) {
                longestMatch = cleanPrefix.length;
                bestMatch = header.id;
            }
        });
        detailToHeader[child.id] = bestMatch;
    });

    const headerHierarchy = [];
    headers.forEach(header => {
        const children = details.filter(d => detailToHeader[d.id] === header.id);
        const childrenWithSaldo = children.map(c => ({
            ...c,
            saldo: hitungSaldoAkun(journals, c.id, accounts, yearLimit, assets, isYearOnly)
        }));

        const visibleChildren = (showEmpty ? childrenWithSaldo : childrenWithSaldo.filter(c => c.saldo !== 0))
            .sort((a, b) => a.code.localeCompare(b.code));

        const totalSaldo = childrenWithSaldo.reduce((sum, c) => sum + (c.normalBalance === 'debit' ? c.saldo : -c.saldo), 0) + (header.initialBalance || 0);

        if (showEmpty || visibleChildren.length > 0 || totalSaldo !== 0) {
            headerHierarchy.push({
                ...header,
                saldo: header.normalBalance === 'debit' ? totalSaldo : -totalSaldo,
                children: visibleChildren
            });
        }
    });

    const orphanedDetails = details.filter(d => detailToHeader[d.id] === null);
    if (orphanedDetails.length > 0) {
        const orphansWithSaldo = orphanedDetails.map(c => ({
            ...c,
            saldo: hitungSaldoAkun(journals, c.id, accounts, yearLimit, assets, isYearOnly)
        }));
        const visibleOrphans = (showEmpty ? orphansWithSaldo : orphansWithSaldo.filter(c => c.saldo !== 0))
            .sort((a, b) => a.code.localeCompare(b.code));

        if (showEmpty || visibleOrphans.length > 0) {
            const totalOrphanSaldo = orphansWithSaldo.reduce((sum, c) => sum + (c.normalBalance === 'debit' ? c.saldo : -c.saldo), 0);
            headerHierarchy.push({
                id: 'ORPHAN-' + type,
                code: type === 'Aset' ? '1-2000' : 'N/A',
                name: type === 'Aset' ? 'Aset Tidak Lancar' : `Akun ${type} (Tanpa Induk)`,
                type: type,
                fund: type === 'Aset' ? 'Umum' : '-',
                subType: type === 'Aset' ? 'Aset Tidak Lancar' : 'Lainnya',
                category: 'header',
                normalBalance: 'debit',
                children: visibleOrphans,
                saldo: totalOrphanSaldo,
                isOrphan: true
            });
        }
    }

    const subTypes = {};
    headerHierarchy.forEach(h => {
        let st = h.subType;
        if (!st || st === 'Lainnya') {
            if (h.type === 'Aset') {
                const codeNum = parseInt(h.code.split('-')[1]);
                st = codeNum >= 2000 ? 'Aset Tidak Lancar' : 'Aset Lancar';
            }
            else if (h.type === 'Kewajiban') st = 'Kewajiban Jangka Pendek';
            else st = h.type || 'Lainnya';
        }
        if (!subTypes[st]) {
            subTypes[st] = {
                name: st,
                headers: [],
                saldo: 0
            };
        }
        subTypes[st].headers.push(h);
        subTypes[st].saldo += h.saldo;
    });

    return Object.values(subTypes).sort((a, b) => {
        const order = {
            'Aset Lancar': 1, 'Aset Tidak Lancar': 2,
            'Kewajiban Jangka Pendek': 3, 'Kewajiban Jangka Panjang': 4,
            'Aset Neto': 5, 'Saldo Dana': 6,
            'Pendapatan': 7, 'Beban': 8
        };
        return (order[a.name] || 99) - (order[b.name] || 99);
    });
}
