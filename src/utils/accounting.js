import { hitungTotalPenyusutan } from './depreciation';

// ========================================
// Utilitas Akuntansi — SIKAD DARELIMAN
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
        typeAccounts = typeAccounts.filter(a => funds.includes(a.fund) || a.category === 'header' || a.isParent);
    }

    const isHeaderAccount = (a) => a.category === 'header' || a.isParent || a.code?.endsWith('0000') || a.code?.endsWith('000') || a.code?.endsWith('00');
    const headers = typeAccounts.filter(isHeaderAccount).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' }));
    const details = typeAccounts.filter(a => !isHeaderAccount(a));

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
            .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' }));

        // Calculate sum for high-level headers that have no direct children
        let totalSaldo = childrenWithSaldo.reduce((sum, c) => sum + (c.normalBalance === 'debit' ? c.saldo : -c.saldo), 0) + (header.initialBalance || 0);
        if (header.code?.endsWith('0000') && childrenWithSaldo.length === 0) {
            // Grand header (e.g. 1-0000 ASET) sums all details of this type
            totalSaldo = details.reduce((sum, c) => {
                const s = hitungSaldoAkun(journals, c.id, accounts, yearLimit, assets, isYearOnly);
                return sum + (c.normalBalance === 'debit' ? s : -s);
            }, 0) + (header.initialBalance || 0);
        } else if (header.code?.endsWith('000') && childrenWithSaldo.length === 0) {
            // Sub-class header (e.g. 1-1000 Aset Lancar, 1-2000 Aset Tidak Lancar)
            const prefix = header.code.substring(0, 3); // '1-1' or '1-2'
            const matchingDetails = details.filter(c => c.code?.startsWith(prefix));
            totalSaldo = matchingDetails.reduce((sum, c) => {
                const s = hitungSaldoAkun(journals, c.id, accounts, yearLimit, assets, isYearOnly);
                return sum + (c.normalBalance === 'debit' ? s : -s);
            }, 0) + (header.initialBalance || 0);
        }

        // Ensure subType aligns with account code if missing or generic
        let resolvedSubType = header.subType;
        if (header.code?.endsWith('0000')) {
            if (!showEmpty) return; // Grand class headers are only for Bagan Akun (showEmpty = true)
            resolvedSubType = header.type || 'Aset';
        } else if (!resolvedSubType || resolvedSubType === 'Aset' || resolvedSubType === 'Lainnya') {
            if (header.code?.startsWith('1-1')) resolvedSubType = 'Aset Lancar';
            else if (header.code?.startsWith('1-2')) resolvedSubType = 'Aset Tidak Lancar';
        }

        if (showEmpty || visibleChildren.length > 0 || totalSaldo !== 0) {
            headerHierarchy.push({
                ...header,
                subType: resolvedSubType,
                saldo: header.normalBalance === 'debit' ? totalSaldo : -totalSaldo,
                children: visibleChildren
            });
        }
    });

    const orphanedDetails = details.filter(d => detailToHeader[d.id] === null);
    if (orphanedDetails.length > 0) {
        // Group orphans by code prefix rather than dumping everything into Aset Tidak Lancar
        const orphanGroups = {};
        orphanedDetails.forEach(child => {
            let groupKey = 'Lainnya';
            let groupCode = 'N/A';
            let groupName = `Akun ${type} (Lainnya)`;
            let subType = 'Lainnya';

            if (type === 'Aset') {
                if (child.code?.startsWith('1-1')) {
                    groupKey = 'Aset Lancar';
                    groupCode = '1-1000';
                    groupName = 'Aset Lancar (Lainnya)';
                    subType = 'Aset Lancar';
                } else {
                    groupKey = 'Aset Tidak Lancar';
                    groupCode = '1-2000';
                    groupName = 'Aset Tidak Lancar (Lainnya)';
                    subType = 'Aset Tidak Lancar';
                }
            } else if (type === 'Kewajiban') {
                if (child.code?.startsWith('2-1')) {
                    groupKey = 'Kewajiban Jangka Pendek';
                    groupCode = '2-1000';
                    groupName = 'Liabilitas Jangka Pendek';
                    subType = 'Kewajiban Jangka Pendek';
                } else {
                    groupKey = 'Kewajiban Jangka Panjang';
                    groupCode = '2-2000';
                    groupName = 'Liabilitas Jangka Panjang';
                    subType = 'Kewajiban Jangka Panjang';
                }
            } else if (type === 'Beban') {
                if (child.code?.startsWith('5-1')) {
                    groupKey = 'Beban Program';
                    groupCode = '5-1000';
                    groupName = 'Beban Program';
                    subType = 'Beban Program';
                } else if (child.code?.startsWith('5-3')) {
                    groupKey = 'Beban Program BOS';
                    groupCode = '5-3000';
                    groupName = 'Beban Program BOS';
                    subType = 'Beban Program BOS';
                } else {
                    groupKey = 'Beban Umum & Administrasi';
                    groupCode = '5-4000';
                    groupName = 'Beban Umum & Administrasi';
                    subType = 'Beban Umum & Administrasi';
                }
            }

            if (!orphanGroups[groupKey]) {
                orphanGroups[groupKey] = {
                    groupKey,
                    groupCode,
                    groupName,
                    subType,
                    items: []
                };
            }
            orphanGroups[groupKey].items.push(child);
        });

        Object.values(orphanGroups).forEach(og => {
            const orphansWithSaldo = og.items.map(c => ({
                ...c,
                saldo: hitungSaldoAkun(journals, c.id, accounts, yearLimit, assets, isYearOnly)
            }));
            const visibleOrphans = (showEmpty ? orphansWithSaldo : orphansWithSaldo.filter(c => c.saldo !== 0))
                .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' }));

            if (showEmpty || visibleOrphans.length > 0) {
                const totalOrphanSaldo = orphansWithSaldo.reduce((sum, c) => sum + (c.normalBalance === 'debit' ? c.saldo : -c.saldo), 0);
                headerHierarchy.push({
                    id: 'ORPHAN-' + type + '-' + og.groupKey,
                    code: og.groupCode,
                    name: og.groupName,
                    type: type,
                    fund: 'Umum',
                    subType: og.subType,
                    category: 'header',
                    normalBalance: 'debit',
                    children: visibleOrphans,
                    saldo: totalOrphanSaldo,
                    isOrphan: true
                });
            }
        });
    }

    const subTypes = {};
    headerHierarchy.forEach(h => {
        let st = h.subType;
        if (!st || st === 'Lainnya') {
            if (h.code?.endsWith('0000')) st = h.type;
            else if (h.code?.startsWith('1-1')) st = 'Aset Lancar';
            else if (h.code?.startsWith('1-2')) st = 'Aset Tidak Lancar';
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
    });

    Object.values(subTypes).forEach(stObj => {
        const allChildren = stObj.headers.flatMap(h => h.children || []);
        if (allChildren.length > 0) {
            stObj.saldo = allChildren.reduce((sum, c) => sum + (c.normalBalance === 'debit' ? c.saldo : -c.saldo), 0);
        } else {
            stObj.saldo = stObj.headers.reduce((sum, h) => sum + h.saldo, 0);
        }
    });

    return Object.values(subTypes).sort((a, b) => {
        const order = {
            'Aset': 1,
            'Aset Lancar': 2,
            'Aset Tidak Lancar': 3,
            'Kewajiban': 4,
            'Liabilitas Jangka Pendek': 5,
            'Kewajiban Jangka Pendek': 5,
            'Liabilitas Jangka Panjang': 6,
            'Kewajiban Jangka Panjang': 6,
            'Aset Neto': 7,
            'Aset Neto Tanpa Pembatasan': 8,
            'Aset Neto Dengan Pembatasan': 9,
            'Saldo Dana': 10,
            'Pendapatan': 11,
            'Penghasilan': 11,
            'Penghasilan Tanpa Pembatasan': 12,
            'Penghasilan Dengan Pembatasan': 13,
            'Beban': 14,
            'Beban Program': 15,
            'Beban Program BOS': 16,
            'Beban Umum & Administrasi': 17
        };
        const orderA = order[a.name] !== undefined ? order[a.name] : 99;
        const orderB = order[b.name] !== undefined ? order[b.name] : 99;
        return orderA - orderB;
    });
}
/**
 * Menghitung total saldo untuk tipe akun tertentu (Aset, Kewajiban, Aset Neto, Pendapatan, Beban)
 */
export function hitungSaldoPerTipe(journals, accounts, type, yearLimit = null, assets = [], isYearOnly = false, programId = null) {
    const typeAccounts = accounts.filter(a => a.type === type && a.category === 'detail');
    
    return typeAccounts.reduce((sum, acc) => {
        const saldo = hitungSaldoAkun(journals, acc.id, accounts, yearLimit, assets, isYearOnly, programId);
        return sum + (acc.normalBalance === 'debit' ? saldo : -saldo);
    }, 0);
}
