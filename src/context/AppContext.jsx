import { createContext, useContext, useReducer, useEffect } from 'react';
import { initialAccounts, initialJournals, initialAssets, initialPrograms, initialIncomeItems, initialExpenseItems, initialAcademicYears, initialStudentStatuses, initialStudents, initialAssetCategories, initialAssetVendors, initialAssetRooms, initialAssetPics } from '../data/seedData';
import { generateId } from '../utils/format';
import { isRemote, api } from '../services/api';

const AppContext = createContext();

const defaultState = {
    accounts: initialAccounts,
    journals: initialJournals,
    assets: initialAssets,
    assetCategories: initialAssetCategories,
    assetVendors: initialAssetVendors,
    assetRooms: initialAssetRooms,
    assetPics: initialAssetPics,
    programs: initialPrograms,
    expensePrograms: [],
    budgets: [],
    fields: [],
    units: [],
    students: [],
    incomeItems: initialIncomeItems,
    expenseItems: initialExpenseItems,
    distributionSettings: [],
    budgetRequests: [],
    budgetReports: [],
    academicYears: initialAcademicYears,
    classGroups: [],
    positions: [],
    studentStatuses: initialStudentStatuses,
    parentStatuses: [],
    classes: [],
    financialYears: [],
    backupInfo: null,
    rabPlans: [],
    bosStages: [],
    bosPosList: [],
    bosAllocations: [],
    users: [], // Ensure users is always initialized
    notifications: [], // { id, type, title, message, read: false, createdAt }
    globalAcademicYearId: null, // Persisted globally
    isSyncing: false,
    syncMessage: '',
    lastSyncedAt: null,
    syncResults: null,
    version: '1.3.1',
    isInitialLoading: false
};

const CURRENT_VERSION = '1.3.1';

const isEmptyPlan = (plan) => {
    if (!plan) return true;
    const isObjEmpty = (obj) => {
        if (!obj) return true;
        if (Object.keys(obj).length === 0) return true;
        return Object.values(obj).every(arr => Array.isArray(arr) && arr.length === 0);
    };
    return isObjEmpty(plan.income) && isObjEmpty(plan.expense);
};

function loadState() {
    try {
        const saved = localStorage.getItem('sikad-dareliman-data') || localStorage.getItem('sikak-yayasan-data');
        if (saved) {
            const data = JSON.parse(saved);

            // Forced reset if version mismatch (important for ID synchronization)
            if (data.version !== CURRENT_VERSION) {
                console.log('[Migration] Version mismatch, resetting local cache to initial state.');
                return { ...defaultState, version: CURRENT_VERSION };
            }

            // Ensure all new keys from defaultState are present and transient state is reset
            const merged = { 
                ...defaultState, 
                ...data,
                isInitialLoading: false,
                isSyncing: false,
                syncMessage: ''
            };

            if (data.accounts) {
                const currentSeedIds = new Set(initialAccounts.map(a => a.id));
                merged.accounts = data.accounts.filter(a => {
                    const isSeedId = /^\d{5}$/.test(a.id);
                    if (!isSeedId) return true;
                    return currentSeedIds.has(a.id);
                });

                const storedIds = new Set(merged.accounts.map(a => a.id));
                initialAccounts.forEach(seedAcc => {
                    if (!storedIds.has(seedAcc.id)) {
                        merged.accounts.push(seedAcc);
                    } else {
                        const idx = merged.accounts.findIndex(a => a.id === seedAcc.id);
                        if (idx !== -1) {
                            merged.accounts[idx] = { ...seedAcc, ...merged.accounts[idx] };
                        }
                    }
                });
            } else {
                merged.accounts = initialAccounts;
            }

            // Restore currentUser securely from separate key to avoid quota loss
            try {
                const storedUser = localStorage.getItem('currentUser');
                if (storedUser) {
                    merged.currentUser = JSON.parse(storedUser);
                }
            } catch (e) {
                console.error('Failed to parse currentUser from local storage', e);
            }

            // Migration: Ensure entries in journals are parsed arrays, not JSON strings
            if (merged.journals && Array.isArray(merged.journals)) {
                merged.journals = merged.journals.map(j => ({
                    ...j,
                    entries: typeof j.entries === 'string' ? JSON.parse(j.entries) : j.entries
                }));
            }

            // Fallback for asset settings
            if (!merged.assetCategories || merged.assetCategories.length === 0) {
                merged.assetCategories = initialAssetCategories;
            }
            if (!merged.assetVendors || merged.assetVendors.length === 0) {
                merged.assetVendors = initialAssetVendors;
            }
            if (!merged.assetRooms || merged.assetRooms.length === 0) {
                merged.assetRooms = initialAssetRooms;
            }
            if (!merged.assetPics || merged.assetPics.length === 0) {
                merged.assetPics = initialAssetPics;
            }

            // Migration: Standardize 'Saldo Dana' to 'Aset Neto'
            if (merged.accounts) {
                merged.accounts = merged.accounts.map(acc => {
                    if (acc.type === 'Saldo Dana') {
                        return { ...acc, type: 'Aset Neto', subType: 'Aset Neto' };
                    }
                    return acc;
                });
            }

            // Migration: Add specific field-only expense items
            if (merged.expenseItems) {
                if (!merged.expenseItems.some(ex => ex.id === 'EXP-036' || ex.name === 'Aset' || ex.isFieldOnly)) {
                    merged.expenseItems.push({ id: 'EXP-036', name: 'Aset', sourceOfFunds: 'Persentase Konfigurasi', isFieldOnly: true });
                    merged.expenseItems.push({ id: 'EXP-037', name: 'Pengembangan (umum)', sourceOfFunds: 'Persentase Konfigurasi', isFieldOnly: true });
                }
            }

            // Migration: Ensure Academic Years have valid dates (Fix for "Invalid Date" sync issue)
            // Migration: Replace slash (/) with dash (-) in academic year names and IDs
            if (merged.academicYears && Array.isArray(merged.academicYears)) {
                merged.academicYears = merged.academicYears.map(ay => {
                    const newName = ay.name ? ay.name.replace(/\//g, '-') : ay.name;
                    const newId = ay.id ? ay.id.replace(/\//g, '-') : ay.id;
                    return {
                        ...ay,
                        id: newId,
                        name: newName,
                        isCurrent: ay.isCurrent || false,
                        isActive: ay.isActive !== undefined ? ay.isActive : true
                    };
                });
            }

            // Migration: Fix academicYearId references in students
            if (merged.students && Array.isArray(merged.students)) {
                merged.students = merged.students.map(s => ({
                    ...s,
                    academicYearId: s.academicYearId ? s.academicYearId.replace(/\//g, '-') : s.academicYearId
                }));
            }

            // Migration: Robust year formatting for all other entities (Drafts, Reports, etc.)
            const migrationMap = {
                rabPlans: true,  // id and academicYearId
                budgetRequests: false, // only academicYearId
                budgetReports: false,
                bosStages: false,
                bosAllocations: false
            };

            Object.entries(migrationMap).forEach(([key, fixId]) => {
                if (merged[key] && Array.isArray(merged[key])) {
                    merged[key] = merged[key].map(item => {
                        if (!item) return item;
                        const updated = { ...item };
                        if (item.academicYearId && typeof item.academicYearId === 'string') {
                            updated.academicYearId = item.academicYearId.replace(/\//g, '-');
                        }
                        if (fixId && item.id && typeof item.id === 'string') {
                            updated.id = item.id.replace(/\//g, '-');
                        }
                        return updated;
                    });

                    // [Armor] Purge ghost records (IDs without fund source suffix)
                    if (key === 'rabPlans') {
                        merged[key] = merged[key].filter(item => {
                            if (!item?.id) return false;
                            const isStandard = item.id.endsWith('-YAYASAN') || item.id.endsWith('-BOS');
                            if (!isStandard) {
                                console.warn(`[Migration] Purging ghost RabPlan record: ${item.id}`);
                                return false;
                            }
                            // Also purge empty plans to avoid "ghost" records with no data
                            if (isEmptyPlan(item) && item.status === 'DRAFT') {
                                console.warn(`[Migration] Purging empty RabPlan draft: ${item.id}`);
                                return false;
                            }
                            return true;
                        });
                    }
                }
            });

            return merged;
        }
    } catch (e) { /* ignore */ }
    return null;
}

let syncTimeout = null;

function saveState(state) {
    try {
        localStorage.setItem('sikad-dareliman-data', JSON.stringify(state));
    } catch (e) { /* ignore */ }
}

const savedState = loadState();
const initialState = savedState || defaultState;

function getPotentialAssetsFromJournal(journal, accounts) {
    const { id: journalId, entries, date, description, phoneNumber, economicLife } = journal;
    const potentialAssets = [];

    entries.forEach(entry => {
        if (entry.debit <= 0) return;
        const acc = accounts.find(a => a.id === entry.accountId);
        if (!acc || acc.category !== 'detail' || acc.type !== 'Aset') return;

        // Simplified logic for General Foundation
        const isAsetTetap = acc.code.startsWith('1-2') || acc.code.startsWith('1-3');
        if (!isAsetTetap) return;

        potentialAssets.push({
            id: generateId('AST'),
            name: `${acc.name}${description ? ' - ' + description : ''}`,
            acquisitionDate: date,
            cost: entry.debit,
            residualValue: 0,
            usefulLifeMonths: parseInt(economicLife) * 12 || 48,
            depreciationAccountId: '61106', // Default depreciation account
            accumulatedDepAccountId: '12901', // Default accumulated account
            assetAccountId: acc.id,
            category: acc.name,
            depreciationHistory: [],
            phoneNumber: phoneNumber || '-',
            journalId: journalId,
            status: "Tersedia"
        });
    });

    return potentialAssets;
}

function appReducer(state, action) {
    let newState;
    switch (action.type) {
        case 'SET_INITIAL_LOADING':
            newState = { ...state, isInitialLoading: action.payload };
            break;
        case 'SET_RAB_PLAN': {
            const index = state.rabPlans.findIndex(p => p.id === action.payload.id);
            let updatedRabPlans = [...state.rabPlans];

            if (isEmptyPlan(action.payload) && action.payload.status === 'DRAFT') {
                // If it becomes empty, treat it as a delete to keep state clean
                if (index >= 0) updatedRabPlans.splice(index, 1);
            } else {
                if (index >= 0) updatedRabPlans[index] = action.payload;
                else updatedRabPlans.push(action.payload);
            }

            newState = { ...state, rabPlans: updatedRabPlans };
            break;
        }
        case 'DELETE_RAB_PLAN':
            newState = { ...state, rabPlans: state.rabPlans.filter(p => p.id !== action.payload) };
            break;
        case 'LOGIN':
            localStorage.setItem('currentUser', JSON.stringify(action.payload));
            newState = { ...state, currentUser: action.payload };
            break;
        case 'SET_GLOBAL_YEAR':
            newState = { ...state, globalAcademicYearId: action.payload };
            break;
        case 'SET_ONLINE_STATUS':
            newState = { ...state, isOnline: action.payload };
            break;
        case 'SET_ALL_DATA': {
            const serverData = action.payload || {};
            console.log('[Sync Diagnostic] Received Academic Years from Server:', serverData.academicYears);

            // Safety Check: Don't overwrite with empty data if we already have local data
            const hasLocalData = state.accounts?.length > 15 || state.units?.length > 0;
            const hasServerData = serverData.accounts?.length > 0 || serverData.units?.length > 0;

            if (hasLocalData && !hasServerData && state.isInitialized) {
                console.warn('[Sync Safety] Server returned empty data while local state is populated. Ignoring SET_ALL_DATA to prevent data loss.');
                return state;
            }

            newState = {
                ...state,
                accounts: serverData.accounts || state.accounts || [],
                journals: (serverData.journals || state.journals || []).map(j => ({ 
                    ...j, 
                    programId: j.programId || 'PRG-GEN',
                    entries: typeof j.entries === 'string' ? JSON.parse(j.entries) : j.entries
                })),
                classes: serverData.classes || state.classes || [],
                rabPlans: (serverData.rabPlans || state.rabPlans || []).filter(p => {
                    const isGhost = !p.id.endsWith('-YAYASAN') && !p.id.endsWith('-BOS');
                    const isEmpty = isEmptyPlan(p) && p.status === 'DRAFT';
                    return !isGhost && !isEmpty;
                }),
                assets: serverData.assets || state.assets || [],
                programs: serverData.programs || state.programs || [],
                expensePrograms: serverData.expensePrograms || state.expensePrograms || [],
                budgets: serverData.budgets || state.budgets || [],
                fields: serverData.fields ?? state.fields ?? [],
                units: serverData.units ?? state.units ?? [],
                students: serverData.students || state.students || [],
                incomeItems: serverData.incomeItems || state.incomeItems || [],
                expenseItems: serverData.expenseItems || state.expenseItems || [],
                distributionSettings: (() => {
                    const rawData = serverData.distributionSettings || state.distributionSettings || [];
                    const uniqueMap = new Map();
                    // Sort descending by percentage to keep the one with highest percentage if duplicates exist
                    const sorted = [...rawData].sort((a, b) => parseFloat(b.percentage || 0) - parseFloat(a.percentage || 0));
                    for (const s of sorted) {
                        const key = `${s.unitId}-${s.incomeItemId}-${s.destId}-${s.destType}-${s.expenseItemId}`;
                        if (!uniqueMap.has(key)) {
                            uniqueMap.set(key, s);
                        }
                    }
                    // Add stable sort so items don't randomly swap positions in UI
                    return Array.from(uniqueMap.values()).sort((a, b) => {
                        if (a.incomeItemId !== b.incomeItemId) return (a.incomeItemId || '').localeCompare(b.incomeItemId || '');
                        if (a.expenseItemId !== b.expenseItemId) return (a.expenseItemId || '').localeCompare(b.expenseItemId || '');
                        return (a.id || '').localeCompare(b.id || '');
                    });
                })(),
                budgetRequests: serverData.budgetRequests || state.budgetRequests || [],
                budgetReports: serverData.budgetReports || state.budgetReports || [],
                academicYears: (serverData.academicYears || state.academicYears || []).map(serverAy => {
                    const localAy = (state.academicYears || []).find(lay => lay.id === serverAy.id);
                    if (!localAy) return serverAy;
                    // Armor: Proteksi agar data tanggal tidak terhapus oleh sinkronisasi NULL dari server
                    return {
                        ...serverAy,
                        startDate: serverAy.startDate || localAy.startDate,
                        endDate: serverAy.endDate || localAy.endDate
                    };
                }),
                classGroups: serverData.classGroups || state.classGroups || [],
                positions: serverData.positions || state.positions || [],
                studentStatuses: serverData.studentStatuses || state.studentStatuses || [],
                parentStatuses: serverData.parentStatuses || state.parentStatuses || [],
                bosStages: serverData.bosStages || state.bosStages || [],
                bosPosList: serverData.bosPosList || state.bosPosList || [],
                bosAllocations: serverData.bosAllocations || state.bosAllocations || [],

                assetCategories: (serverData.assetCategories && serverData.assetCategories.length > 0) ? serverData.assetCategories : (state.assetCategories || []),
                assetVendors: (serverData.assetVendors && serverData.assetVendors.length > 0) ? serverData.assetVendors : (state.assetVendors || []),
                assetRooms: (serverData.assetRooms && serverData.assetRooms.length > 0) ? serverData.assetRooms : (state.assetRooms || []),
                assetPics: (serverData.assetPics && serverData.assetPics.length > 0) ? serverData.assetPics : (state.assetPics || []),

                users: serverData.users || state.users || [],
                currentUser: state.currentUser,
                isOnline: true,
                isInitialized: true,
                notes: serverData.notes || state.notes || {},
                globalAcademicYearId: state.globalAcademicYearId
            };

            // Initialize global year if not set
            if (!newState.globalAcademicYearId && newState.academicYears?.length > 0) {
                const sorted = [...newState.academicYears].filter(y => !y.isDeleted).sort((a, b) => (b.name || '').localeCompare(a.name || ''));
                newState.globalAcademicYearId = sorted[0]?.id || newState.academicYears.find(y => y.isCurrent)?.id;
            }

            // Server Data Migration: account type rename
            if (newState.accounts) {
                newState.accounts = newState.accounts.map(acc => {
                    if (acc.type === 'Saldo Dana') {
                        return { ...acc, type: 'Aset Neto', subType: 'Aset Neto' };
                    }
                    return acc;
                });
            }

            // Server Data Migration: Replace slash (/) with dash (-) in all academic year references
            if (newState.academicYears && Array.isArray(newState.academicYears)) {
                newState.academicYears = newState.academicYears.map(ay => ({
                    ...ay,
                    id: ay.id ? ay.id.replace(/\//g, '-') : ay.id,
                    name: ay.name ? ay.name.replace(/\//g, '-') : ay.name,
                    isActive: ay.isActive !== undefined ? ay.isActive : true
                }));
            }

            const migrationMap = {
                classes: state.classes || [],
                rabPlans: (state.rabPlans || []).filter(p => !isEmptyPlan(p) || p.status !== 'DRAFT'),
                budgetRequests: state.budgetRequests || [],
                budgetReports: false,
                bosStages: false,
                bosAllocations: false
            };

            Object.entries(migrationMap).forEach(([key, fixId]) => {
                if (newState[key] && Array.isArray(newState[key])) {
                    const migrated = newState[key].map(item => {
                        if (!item) return item;
                        const updated = { ...item };
                        if (item.academicYearId && typeof item.academicYearId === 'string') {
                            updated.academicYearId = item.academicYearId.replace(/\//g, '-');
                        }
                        if (fixId && item.id && typeof item.id === 'string') {
                            updated.id = item.id.replace(/\//g, '-');
                        }
                        return updated;
                    });

                    // [Armor] Purge ghost records (IDs without fund source suffix)
                    if (key === 'rabPlans') {
                        const uniqueMap = new Map();
                        migrated.forEach(item => {
                            if (!item?.id) return;
                            const isStandard = item.id.endsWith('-YAYASAN') || item.id.endsWith('-BOS');
                            if (!isStandard) return; // Skip ghosts

                            const existing = uniqueMap.get(item.id);
                            if (!existing || new Date(item.updatedAt || 0) > new Date(existing.updatedAt || 0)) {
                                uniqueMap.set(item.id, item);
                            }
                        });
                        newState[key] = Array.from(uniqueMap.values());
                    } else if (fixId) {
                        const uniqueMap = new Map();
                        migrated.forEach(item => {
                            if (!item.id) return;
                            const existing = uniqueMap.get(item.id);
                            if (!existing || new Date(item.updatedAt || 0) > new Date(existing.updatedAt || 0)) {
                                uniqueMap.set(item.id, item);
                            }
                        });
                        newState[key] = Array.from(uniqueMap.values());
                    } else {
                        newState[key] = migrated;
                    }
                }
            });
            break;
        }
        case 'LOGOUT':
            localStorage.removeItem('jwt_token');
            localStorage.removeItem('currentUser');
            newState = { ...state, currentUser: null };
            break;
        case 'ADD_ACCOUNT':
            newState = { ...state, accounts: [...state.accounts, { ...action.payload, id: generateId('ACC') }] };
            break;
        case 'EDIT_ACCOUNT':
            newState = {
                ...state,
                accounts: state.accounts.map(a => a.id === action.payload.id ? action.payload : a),
                journals: state.journals.map(j => ({
                    ...j,
                    entries: j.entries.map(e => e.accountId === action.payload.id ? { ...e, accountName: action.payload.name } : e)
                }))
            };
            break;
        case 'DELETE_ACCOUNT':
            newState = {
                ...state,
                accounts: state.accounts.filter(a => a.id !== action.payload)
            };
            break;
        case 'ADD_JOURNAL': {
            const journalId = action.payload.id || generateId('JRN');
            const newJournal = { 
                ...action.payload, 
                id: journalId, 
                programId: action.payload.programId || 'PRG-GEN',
                entries: typeof action.payload.entries === 'string' ? JSON.parse(action.payload.entries) : action.payload.entries
            };
            const detectedAssets = getPotentialAssetsFromJournal(newJournal, state.accounts);
            newState = { ...state, journals: [...state.journals, newJournal], assets: [...state.assets, ...detectedAssets] };
            break;
        }
        case 'DELETE_JOURNAL':
            newState = {
                ...state,
                journals: state.journals.filter(j => j.id !== action.payload)
            };
            break;
        case 'ADD_ASSET': {
            const assetId = action.payload.id || generateId('AST');
            newState = { ...state, assets: [...state.assets, { ...action.payload, id: assetId, depreciationHistory: [] }] };
            break;
        }
        case 'EDIT_ASSET':
            newState = { ...state, assets: state.assets.map(a => a.id === action.payload.id ? { ...a, ...action.payload } : a) };
            break;
        case 'DELETE_ASSET':
            newState = { ...state, assets: state.assets.filter(a => a.id !== action.payload) };
            break;
        case 'IMPORT_ASSETS':
            newState = { ...state, assets: [...state.assets, ...action.payload] };
            break;

        // Master Kategori Aset
        case 'ADD_ASSET_CATEGORY':
            newState = { ...state, assetCategories: [...(state.assetCategories || []), { ...action.payload, id: action.payload.id || generateId('ACAT') }] };
            break;
        case 'EDIT_ASSET_CATEGORY':
            newState = { ...state, assetCategories: (state.assetCategories || []).map(c => c.id === action.payload.id ? { ...c, ...action.payload } : c) };
            break;
        case 'DELETE_ASSET_CATEGORY':
            newState = { ...state, assetCategories: (state.assetCategories || []).filter(c => c.id !== action.payload) };
            break;

        // Master Vendor Aset
        case 'ADD_ASSET_VENDOR':
            newState = { ...state, assetVendors: [...(state.assetVendors || []), { ...action.payload, id: action.payload.id || generateId('AVEN') }] };
            break;
        case 'EDIT_ASSET_VENDOR':
            newState = { ...state, assetVendors: (state.assetVendors || []).map(v => v.id === action.payload.id ? { ...v, ...action.payload } : v) };
            break;
        case 'DELETE_ASSET_VENDOR':
            newState = { ...state, assetVendors: (state.assetVendors || []).filter(v => v.id !== action.payload) };
            break;

        // Master Ruangan / Lokasi Aset
        case 'ADD_ASSET_ROOM':
            newState = { ...state, assetRooms: [...(state.assetRooms || []), { ...action.payload, id: action.payload.id || generateId('ARM') }] };
            break;
        case 'EDIT_ASSET_ROOM':
            newState = { ...state, assetRooms: (state.assetRooms || []).map(r => r.id === action.payload.id ? { ...r, ...action.payload } : r) };
            break;
        case 'DELETE_ASSET_ROOM':
            newState = { ...state, assetRooms: (state.assetRooms || []).filter(r => r.id !== action.payload) };
            break;

        // Master PIC Aset
        case 'ADD_ASSET_PIC':
            newState = { ...state, assetPics: [...(state.assetPics || []), { ...action.payload, id: action.payload.id || generateId('APIC') }] };
            break;
        case 'EDIT_ASSET_PIC':
            newState = { ...state, assetPics: (state.assetPics || []).map(p => p.id === action.payload.id ? { ...p, ...action.payload } : p) };
            break;
        case 'DELETE_ASSET_PIC':
            newState = { ...state, assetPics: (state.assetPics || []).filter(p => p.id !== action.payload) };
            break;
        case 'ADD_PROGRAM':
            newState = { ...state, programs: [...state.programs, { ...action.payload, id: generateId('PRG') }] };
            break;
        case 'EDIT_PROGRAM':
            newState = { ...state, programs: state.programs.map(p => p.id === action.payload.id ? action.payload : p) };
            break;
        case 'DELETE_PROGRAM':
            newState = { ...state, programs: state.programs.map(p => p.id === action.payload ? { ...p, isDeleted: true, deletedAt: new Date().toISOString() } : p) };
            break;

        case 'ADD_BUDGET_PROGRAM':
            newState = { ...state, expensePrograms: [...state.expensePrograms, { ...action.payload }] };
            break;
        case 'EDIT_BUDGET_PROGRAM':
            newState = { ...state, expensePrograms: state.expensePrograms.map(p => p.id === action.payload.id ? action.payload : p) };
            break;
        case 'DELETE_BUDGET_PROGRAM':
            newState = { ...state, expensePrograms: state.expensePrograms.map(p => p.id === action.payload ? { ...p, isDeleted: true, deletedAt: new Date().toISOString() } : p) };
            break;

        case 'SET_BUDGETS':
            newState = { ...state, budgets: action.payload };
            break;
        case 'RESET_DATA':
            localStorage.removeItem('sikad-dareliman-data');
            localStorage.removeItem('sikak-yayasan-data');
            newState = defaultState;
            break;
        case 'RESTORE_DATA':
            newState = action.payload;
            break;
        case 'ADD_FIELD':
            newState = { ...state, fields: [...state.fields, action.payload] };
            break;
        case 'EDIT_FIELD':
            newState = { ...state, fields: state.fields.map(f => f.id === action.payload.id ? action.payload : f) };
            break;
        case 'DELETE_FIELD':
            newState = { ...state, fields: state.fields.map(f => f.id === action.payload ? { ...f, isDeleted: true, deletedAt: new Date().toISOString() } : f) };
            break;
        case 'ADD_UNIT':
            newState = { ...state, units: [...state.units, action.payload] };
            break;
        case 'EDIT_UNIT':
            newState = { ...state, units: state.units.map(u => u.id === action.payload.id ? action.payload : u) };
            break;
        case 'DELETE_UNIT':
            newState = { ...state, units: state.units.map(u => u.id === action.payload ? { ...u, isDeleted: true, deletedAt: new Date().toISOString() } : u) };
            break;
        case 'ADD_STUDENT':
            newState = { ...state, students: [...state.students, action.payload] };
            break;
        case 'EDIT_STUDENT':
            newState = { ...state, students: state.students.map(s => s.id === action.payload.id ? action.payload : s) };
            break;
        case 'DELETE_STUDENT':
            newState = { ...state, students: state.students.map(s => s.id === action.payload ? { ...s, isDeleted: true, deletedAt: new Date().toISOString() } : s) };
            break;
        case 'ADD_USER':
            newState = { ...state, users: [...state.users, action.payload] };
            break;
        case 'EDIT_USER':
            newState = { ...state, users: state.users.map(u => u.id === action.payload.id ? action.payload : u) };
            break;
        case 'DELETE_USER':
            newState = { ...state, users: state.users.map(u => u.id === action.payload ? { ...u, isDeleted: true, deletedAt: new Date().toISOString() } : u) };
            break;
        case 'UPDATE_DISTRIBUTION_SETTINGS': {
            const { unitId, incomeItemId, settings, batch, academicYearId } = action.payload;
            const yearId = academicYearId || (settings && settings[0]?.academicYearId) || null;
            // batch=true: remove ALL settings for this unitId in the target year
            // batch=false/undefined: remove only for the specific incomeItemId in the target year
            const otherSettings = batch
                ? state.distributionSettings.filter(s => s.unitId !== unitId || s.academicYearId !== yearId)
                : state.distributionSettings.filter(s => !(s.unitId === unitId && s.incomeItemId === incomeItemId && s.academicYearId === yearId));
            newState = { ...state, distributionSettings: [...otherSettings, ...settings] };
            break;
        }
        case 'ADD_BUDGET_REQUEST':
            newState = { ...state, budgetRequests: [...state.budgetRequests, action.payload] };
            break;
        case 'EDIT_BUDGET_REQUEST':
            newState = { ...state, budgetRequests: state.budgetRequests.map(r => r.id === action.payload.id ? action.payload : r) };
            break;
        case 'DELETE_BUDGET_REQUEST':
            newState = { ...state, budgetRequests: state.budgetRequests.filter(r => r.id !== action.payload) };
            break;
        case 'ADD_INCOME_ITEM':
            newState = { ...state, incomeItems: [action.payload, ...state.incomeItems] };
            break;
        case 'EDIT_INCOME_ITEM':
            newState = { ...state, incomeItems: state.incomeItems.map(i => i.id === action.payload.id ? action.payload : i) };
            break;
        case 'DELETE_INCOME_ITEM':
            newState = { ...state, incomeItems: state.incomeItems.map(i => i.id === action.payload ? { ...i, isDeleted: true, deletedAt: new Date().toISOString() } : i) };
            break;
        case 'ADD_EXPENSE_ITEM':
            newState = { ...state, expenseItems: [action.payload, ...state.expenseItems] };
            break;
        case 'EDIT_EXPENSE_ITEM':
            newState = { ...state, expenseItems: state.expenseItems.map(i => i.id === action.payload.id ? action.payload : i) };
            break;
        case 'DELETE_EXPENSE_ITEM':
            newState = { ...state, expenseItems: state.expenseItems.map(i => i.id === action.payload ? { ...i, isDeleted: true, deletedAt: new Date().toISOString() } : i) };
            break;
        case 'ADD_BUDGET_REPORT':
            newState = { ...state, budgetReports: [...state.budgetReports, action.payload] };
            break;
        case 'EDIT_BUDGET_REPORT':
            newState = { ...state, budgetReports: state.budgetReports.map(r => r.id === action.payload.id ? action.payload : r) };
            break;
        case 'DELETE_BUDGET_REPORT':
            newState = { ...state, budgetReports: state.budgetReports.filter(r => r.id !== action.payload) };
            break;

        case 'ADD_ACADEMIC_YEAR': newState = { ...state, academicYears: [...state.academicYears, action.payload] }; break;
        case 'EDIT_ACADEMIC_YEAR': newState = { ...state, academicYears: state.academicYears.map(i => i.id === action.payload.id ? action.payload : i) }; break;
        case 'DELETE_ACADEMIC_YEAR': newState = { ...state, academicYears: state.academicYears.filter(i => i.id !== action.payload) }; break;

        case 'ADD_CLASS_GROUP': newState = { ...state, classGroups: [...state.classGroups, action.payload] }; break;
        case 'EDIT_CLASS_GROUP': newState = { ...state, classGroups: state.classGroups.map(i => i.id === action.payload.id ? action.payload : i) }; break;
        case 'DELETE_CLASS_GROUP': newState = { ...state, classGroups: state.classGroups.map(i => i.id === action.payload ? { ...i, isDeleted: true, deletedAt: new Date().toISOString() } : i) }; break;

        case 'ADD_POSITION': newState = { ...state, positions: [...state.positions, action.payload] }; break;
        case 'EDIT_POSITION': newState = { ...state, positions: state.positions.map(i => i.id === action.payload.id ? action.payload : i) }; break;
        case 'DELETE_POSITION': newState = { ...state, positions: state.positions.map(i => i.id === action.payload ? { ...i, isDeleted: true, deletedAt: new Date().toISOString() } : i) }; break;

        case 'ADD_STUDENT_STATUS': newState = { ...state, studentStatuses: [...state.studentStatuses, action.payload] }; break;
        case 'EDIT_STUDENT_STATUS': newState = { ...state, studentStatuses: state.studentStatuses.map(i => i.id === action.payload.id ? action.payload : i) }; break;
        case 'DELETE_STUDENT_STATUS': newState = { ...state, studentStatuses: state.studentStatuses.map(i => i.id === action.payload ? { ...i, isDeleted: true, deletedAt: new Date().toISOString() } : i) }; break;

        case 'ADD_PARENT_STATUS': newState = { ...state, parentStatuses: [...state.parentStatuses, action.payload] }; break;
        case 'EDIT_PARENT_STATUS': newState = { ...state, parentStatuses: state.parentStatuses.map(i => i.id === action.payload.id ? action.payload : i) }; break;
        case 'DELETE_PARENT_STATUS': newState = { ...state, parentStatuses: state.parentStatuses.map(i => i.id === action.payload ? { ...i, isDeleted: true, deletedAt: new Date().toISOString() } : i) }; break;

        case 'ADD_CLASS': newState = { ...state, classes: [...state.classes, action.payload] }; break;
        case 'EDIT_CLASS': newState = { ...state, classes: state.classes.map(i => i.id === action.payload.id ? action.payload : i) }; break;
        case 'DELETE_CLASS': newState = { ...state, classes: state.classes.map(i => i.id === action.payload ? { ...i, isDeleted: true, deletedAt: new Date().toISOString() } : i) }; break;



        case 'ADD_BOS_STAGE': newState = { ...state, bosStages: [...state.bosStages, action.payload] }; break;
        case 'EDIT_BOS_STAGE': newState = { ...state, bosStages: state.bosStages.map(i => i.id === action.payload.id ? { ...i, ...action.payload } : i) }; break;
        case 'DELETE_BOS_STAGE': newState = { ...state, bosStages: state.bosStages.map(i => i.id === action.payload ? { ...i, isDeleted: true, deletedAt: new Date().toISOString() } : i) }; break;

        case 'ADD_BOS_POS': newState = { ...state, bosPosList: [...state.bosPosList, action.payload] }; break;
        case 'EDIT_BOS_POS': newState = { ...state, bosPosList: state.bosPosList.map(i => i.id === action.payload.id ? { ...i, ...action.payload } : i) }; break;
        case 'DELETE_BOS_POS': newState = { ...state, bosPosList: state.bosPosList.map(i => i.id === action.payload ? { ...i, isDeleted: true, deletedAt: new Date().toISOString() } : i) }; break;

        case 'ADD_BOS_ALLOCATION': newState = { ...state, bosAllocations: [...state.bosAllocations, action.payload] }; break;
        case 'EDIT_BOS_ALLOCATION': newState = { ...state, bosAllocations: state.bosAllocations.map(i => i.id === action.payload.id ? action.payload : i) }; break;
        case 'DELETE_BOS_ALLOCATION': newState = { ...state, bosAllocations: state.bosAllocations.map(i => i.id === action.payload ? { ...i, isDeleted: true, deletedAt: new Date().toISOString() } : i) }; break;

        case 'ADD_NOTIFICATION': newState = { ...state, notifications: [action.payload, ...state.notifications] }; break;
        case 'MARK_NOTIFICATION_READ': newState = { ...state, notifications: state.notifications.map(n => n.id === action.payload ? { ...n, read: true } : n) }; break;
        case 'CLEAR_NOTIFICATIONS': newState = { ...state, notifications: [] }; break;

        case 'RESTORE_FROM_TRASH': {
            const { id, type } = action.payload;
            const mapping = {
                journal: 'journals',
                account: 'accounts',
                asset: 'assets',
                program: 'programs',
                user: 'users',
                unit: 'units',
                field: 'fields',
                student: 'students',
                class: 'classes',
                'income-item': 'incomeItems',
                'expense-item': 'expenseItems',
                'class-group': 'classGroups',
                'position': 'positions',
                'student-status': 'studentStatuses',
                'parent-status': 'parentStatuses',
                'bos-stage': 'bosStages',
                'bos-pos': 'bosPosList',
                bosAllocation: 'bosAllocations',
                budgetRequest: 'budgetRequests',
                budgetReport: 'budgetReports'
            };
            const collection = mapping[type];
            if (collection) {
                newState = { ...state, [collection]: state[collection].map(item => item.id === id ? { ...item, isDeleted: false, deletedAt: null } : item) };
            }
            break;
        }

        case 'PERMANENT_DELETE': {
            const { id, type } = action.payload;
            const mapping = {
                journal: 'journals',
                account: 'accounts',
                asset: 'assets',
                program: 'programs',
                user: 'users',
                unit: 'units',
                field: 'fields',
                student: 'students',
                class: 'classes',
                'income-item': 'incomeItems',
                'expense-item': 'expenseItems',
                'class-group': 'classGroups',
                'position': 'positions',
                'student-status': 'studentStatuses',
                'parent-status': 'parentStatuses',
                'bos-stage': 'bosStages',
                'bos-pos': 'bosPosList',
                budgetRequest: 'budgetRequests',
                budgetReport: 'budgetReports'
            };
            const collection = mapping[type];
            if (collection) {
                newState = { ...state, [collection]: state[collection].filter(item => item.id !== id) };
            }
            break;
        }

        case 'EMPTY_TRASH':
            newState = {
                ...state,
                journals: state.journals.filter(j => !j.isDeleted),
                accounts: state.accounts.filter(a => !a.isDeleted),
                assets: state.assets.filter(a => !a.isDeleted),
                programs: state.programs.filter(p => !p.isDeleted),
                users: state.users.filter(u => !u.isDeleted),
                units: state.units.filter(u => !u.isDeleted),
                fields: state.fields.filter(f => !f.isDeleted),
                students: state.students.filter(s => !s.isDeleted),
                classes: state.classes.filter(c => !c.isDeleted),
                incomeItems: state.incomeItems.filter(i => !i.isDeleted),
                expenseItems: state.expenseItems.filter(e => !e.isDeleted),
                academicYears: state.academicYears.filter(ay => !ay.isDeleted),
                classGroups: state.classGroups.filter(cg => !cg.isDeleted),
                positions: state.positions.filter(p => !p.isDeleted),
                studentStatuses: state.studentStatuses.filter(s => !s.isDeleted),
                parentStatuses: state.parentStatuses.filter(ps => !ps.isDeleted),
                bosStages: state.bosStages.filter(bs => !bs.isDeleted),
                bosPosList: state.bosPosList.filter(bp => !bp.isDeleted),
                bosAllocations: state.bosAllocations.filter(ba => !ba.isDeleted),
                budgetRequests: state.budgetRequests.filter(br => !br.isDeleted),
                budgetReports: state.budgetReports.filter(br => !br.isDeleted)
            };
            break;

        case 'SET_SYNCING': newState = { ...state, isSyncing: action.payload.status, syncMessage: action.payload.message || '' }; break;
        case 'SET_SYNC_RESULT': newState = { ...state, lastSyncedAt: action.payload.timestamp, syncResults: action.payload.results }; break;

        default:
            return state;
    }
    saveState(newState);
    return {
        ...newState,
        lastAction: action,
        isSyncing: action.type === 'SET_SYNCING' ? action.payload.status : state.isSyncing,
        syncMessage: action.type === 'SET_SYNCING' ? (action.payload.message || '') : state.syncMessage,
        lastSyncedAt: (action.type === 'SET_SYNC_RESULT' || action.type === 'SET_ALL_DATA') ? (action.payload.timestamp || state.lastSyncedAt) : state.lastSyncedAt,
        syncResults: (action.type === 'SET_SYNC_RESULT' || action.type === 'SET_ALL_DATA') ? (action.payload.results || state.syncResults) : state.syncResults
    };
}

export function AppProvider({ children }) {
    const [state, dispatch] = useReducer(appReducer, initialState);

    useEffect(() => {
        const token = localStorage.getItem('jwt_token');
        const isLoginPage = window.location.pathname === '/login';

        // Trigger fetch if we have a token AND (we are logged in OR we have no data)
        const needsData = state.accounts.length <= 5 || state.units.length === 0;

        // ALWAYS fetch fresh data on mount if we have a token and are in remote mode
        if (isRemote && token && !isLoginPage) {
            dispatch({ type: 'SET_INITIAL_LOADING', payload: true });
            api.fetchAllData().then(data => {
                if (data) {
                    dispatch({ type: 'SET_ALL_DATA', payload: data });
                } else {
                    dispatch({ type: 'SET_ONLINE_STATUS', payload: false });
                }
                dispatch({ type: 'SET_INITIAL_LOADING', payload: false });
            }).catch(err => {
                dispatch({ type: 'SET_INITIAL_LOADING', payload: false });
                if (err.message === 'SESSION_EXPIRED') {
                    dispatch({ type: 'LOGOUT' });
                    window.location.href = '/login?expired=true';
                } else {
                    dispatch({ type: 'SET_ONLINE_STATUS', payload: false });
                }
            });
        }
    }, [isRemote, state.currentUser]); // Trigger on mount or user change

    // Background Auto-Sync / Polling completely removed per user request.
    // Data updates are loaded on page mount/refresh or via direct user actions.

    // Auto-Sync Trigger (Disabled: All CRUD actions are already pushed in real-time via api.pushAction)
    // useEffect(() => {
    //     if (!isRemote || !state.currentUser || !state.isInitialized) return;
    //     const timer = setTimeout(async () => {
    //         dispatch({ type: 'SET_SYNCING', payload: { status: true, message: 'Menyamakan data...' } });
    //         try {
    //             await api.syncWholeState(state);
    //         } catch (err) {
    //             console.warn('[Sync] Auto-Sync failed:', err.message);
    //         } finally {
    //             dispatch({ type: 'SET_SYNCING', payload: { status: false } });
    //         }
    //     }, 3000);
    //     return () => clearTimeout(timer);
    // }, [...]);

    return (
        <AppContext.Provider value={{ state, dispatch }}>
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    const context = useContext(AppContext);
    if (!context) throw new Error('useApp must be used within AppProvider');
    return context;
}
