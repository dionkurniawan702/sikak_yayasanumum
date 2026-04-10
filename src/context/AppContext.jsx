import { createContext, useContext, useReducer, useEffect } from 'react';
import { initialAccounts, initialJournals, initialAssets, initialPrograms, initialIncomeItems, initialExpenseItems, initialAcademicYears, initialStudentStatuses, initialStudents } from '../data/seedData';
import { generateId } from '../utils/format';
import { isRemote, api } from '../services/api';

const AppContext = createContext();

const defaultState = {
    accounts: initialAccounts,
    journals: initialJournals,
    assets: initialAssets,
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
    users: [], // Ensure users is always initialized
    notifications: [], // { id, type, title, message, read: false, createdAt }
    lastAction: null,
    isInitialized: false,
    isSyncing: false,
    syncMessage: '',
    version: '1.3.0'
};

const CURRENT_VERSION = '1.3.0';

function loadState() {
    try {
        const saved = localStorage.getItem('sikak-yayasan-data');
        if (saved) {
            const data = JSON.parse(saved);

            // Forced reset if version mismatch (important for ID synchronization)
            if (data.version !== CURRENT_VERSION) {
                console.log('[Migration] Version mismatch, resetting local cache to initial state.');
                return { ...defaultState, version: CURRENT_VERSION };
            }

            // Ensure all new keys from defaultState are present
            const merged = { ...defaultState, ...data };

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
            if (merged.academicYears && Array.isArray(merged.academicYears)) {
                const currentYear = new Date().getFullYear();
                merged.academicYears = merged.academicYears.map(ay => ({
                    ...ay,
                    startDate: (ay.startDate && !isNaN(new Date(ay.startDate))) ? ay.startDate : `${currentYear}-01-01`,
                    endDate: (ay.endDate && !isNaN(new Date(ay.endDate))) ? ay.endDate : `${currentYear}-12-31`,
                    isCurrent: ay.isCurrent || false
                }));
            }

            return merged;
        }
    } catch (e) { /* ignore */ }
    return null;
}

let syncTimeout = null;

function saveState(state) {
    try {
        localStorage.setItem('sikak-yayasan-data', JSON.stringify(state));
        if (isRemote) {
            if (syncTimeout) clearTimeout(syncTimeout);
            syncTimeout = setTimeout(() => {
                api.syncWholeState(state);
            }, 1000);
        }
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
        case 'LOGIN':
            newState = { ...state, currentUser: action.payload };
            break;
        case 'SET_ONLINE_STATUS':
            newState = { ...state, isOnline: action.payload };
            break;
        case 'SET_ALL_DATA': {
            const serverData = action.payload || {};
            newState = {
                ...state,
                accounts: serverData.accounts || state.accounts || [],
                journals: (serverData.journals || state.journals || []).map(j => ({ ...j, programId: j.programId || 'PRG-GEN' })),
                assets: serverData.assets || state.assets || [],
                programs: serverData.programs || state.programs || [],
                expensePrograms: serverData.expensePrograms || state.expensePrograms || [],
                budgets: serverData.budgets || state.budgets || [],
                fields: (serverData.fields || state.fields || []).filter(f => !f.id.startsWith('fld-')),
                units: (serverData.units || state.units || []).filter(u => !u.id.startsWith('unt-')),
                students: serverData.students || state.students || [],
                incomeItems: serverData.incomeItems || state.incomeItems || [],
                expenseItems: serverData.expenseItems || state.expenseItems || [],
                distributionSettings: serverData.distributionSettings || state.distributionSettings || [],
                budgetRequests: serverData.budgetRequests || state.budgetRequests || [],
                budgetReports: serverData.budgetReports || state.budgetReports || [],
                academicYears: serverData.academicYears || state.academicYears || [],
                classGroups: serverData.classGroups || state.classGroups || [],
                positions: serverData.positions || state.positions || [],
                studentStatuses: serverData.studentStatuses || state.studentStatuses || [],
                parentStatuses: serverData.parentStatuses || state.parentStatuses || [],
                classes: serverData.classes || state.classes || [],
                rabPlans: serverData.rabPlans || state.rabPlans || [],
                bosStages: serverData.bosStages || state.bosStages || [],
                bosPosList: serverData.bosPosList || state.bosPosList || [],

                users: serverData.users || state.users || [],
                currentUser: state.currentUser,
                isOnline: true,
                isInitialized: true,
                notes: serverData.notes || state.notes || {}
            };

            // Server Data Migration
            if (newState.accounts) {
                newState.accounts = newState.accounts.map(acc => {
                    if (acc.type === 'Saldo Dana') {
                        return { ...acc, type: 'Aset Neto', subType: 'Aset Neto' };
                    }
                    return acc;
                });
            }
            break;
        }
        case 'LOGOUT':
            localStorage.removeItem('jwt_token');
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
                accounts: state.accounts.map(a => a.id === action.payload ? { ...a, isDeleted: true, deletedAt: new Date().toISOString() } : a)
            };
            break;
        case 'ADD_JOURNAL': {
            const journalId = generateId('JRN');
            const newJournal = { ...action.payload, id: journalId, programId: action.payload.programId || 'PRG-GEN' };
            const detectedAssets = getPotentialAssetsFromJournal(newJournal, state.accounts);
            newState = { ...state, journals: [...state.journals, newJournal], assets: [...state.assets, ...detectedAssets] };
            break;
        }
        case 'DELETE_JOURNAL':
            newState = {
                ...state,
                journals: state.journals.map(j => j.id === action.payload ? { ...j, isDeleted: true, deletedAt: new Date().toISOString() } : j),
                assets: state.assets.map(a => a.journalId === action.payload ? { ...a, isDeleted: true, deletedAt: new Date().toISOString() } : a)
            };
            break;
        case 'ADD_ASSET':
            newState = { ...state, assets: [...state.assets, { ...action.payload, id: generateId('AST'), depreciationHistory: [] }] };
            break;
        case 'ADD_PROGRAM':
            newState = { ...state, programs: [...state.programs, { ...action.payload, id: generateId('PRG') }] };
            break;
        case 'EDIT_PROGRAM':
            newState = { ...state, programs: state.programs.map(p => p.id === action.payload.id ? action.payload : p) };
            break;
        case 'DELETE_PROGRAM':
            newState = { ...state, programs: state.programs.map(p => p.id === action.payload ? { ...p, isDeleted: true } : p) };
            break;

        case 'ADD_BUDGET_PROGRAM':
            newState = { ...state, expensePrograms: [...state.expensePrograms, { ...action.payload }] };
            break;
        case 'EDIT_BUDGET_PROGRAM':
            newState = { ...state, expensePrograms: state.expensePrograms.map(p => p.id === action.payload.id ? action.payload : p) };
            break;
        case 'DELETE_BUDGET_PROGRAM':
            newState = { ...state, expensePrograms: state.expensePrograms.map(p => p.id === action.payload ? { ...p, isDeleted: true } : p) };
            break;

        case 'SET_BUDGETS':
            newState = { ...state, budgets: action.payload };
            break;
        case 'RESET_DATA':
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
            newState = { ...state, fields: state.fields.map(f => f.id === action.payload ? { ...f, isDeleted: true } : f) };
            break;
        case 'ADD_UNIT':
            newState = { ...state, units: [...state.units, action.payload] };
            break;
        case 'EDIT_UNIT':
            newState = { ...state, units: state.units.map(u => u.id === action.payload.id ? action.payload : u) };
            break;
        case 'DELETE_UNIT':
            newState = { ...state, units: state.units.map(u => u.id === action.payload ? { ...u, isDeleted: true } : u) };
            break;
        case 'ADD_STUDENT':
            newState = { ...state, students: [...state.students, action.payload] };
            break;
        case 'EDIT_STUDENT':
            newState = { ...state, students: state.students.map(s => s.id === action.payload.id ? action.payload : s) };
            break;
        case 'DELETE_STUDENT':
            newState = { ...state, students: state.students.map(s => s.id === action.payload ? { ...s, isDeleted: true } : s) };
            break;
        case 'ADD_USER':
            newState = { ...state, users: [...state.users, action.payload] };
            break;
        case 'EDIT_USER':
            newState = { ...state, users: state.users.map(u => u.id === action.payload.id ? action.payload : u) };
            break;
        case 'DELETE_USER':
            newState = { ...state, users: state.users.map(u => u.id === action.payload ? { ...u, isDeleted: true } : u) };
            break;
        case 'UPDATE_DISTRIBUTION_SETTINGS': {
            const { unitId, incomeItemId, settings } = action.payload;
            const otherSettings = state.distributionSettings.filter(s => !(s.unitId === unitId && s.incomeItemId === incomeItemId));
            newState = { ...state, distributionSettings: [...otherSettings, ...settings] };
            break;
        }
        case 'ADD_BUDGET_REQUEST':
            newState = { ...state, budgetRequests: [...state.budgetRequests, action.payload] };
            break;
        case 'EDIT_BUDGET_REQUEST':
            newState = { ...state, budgetRequests: state.budgetRequests.map(r => r.id === action.payload.id ? action.payload : r) };
            break;
        case 'ADD_INCOME_ITEM':
            newState = { ...state, incomeItems: [action.payload, ...state.incomeItems] };
            break;
        case 'EDIT_INCOME_ITEM':
            newState = { ...state, incomeItems: state.incomeItems.map(i => i.id === action.payload.id ? action.payload : i) };
            break;
        case 'DELETE_INCOME_ITEM':
            newState = { ...state, incomeItems: state.incomeItems.filter(i => i.id !== action.payload) };
            break;
        case 'ADD_EXPENSE_ITEM':
            newState = { ...state, expenseItems: [action.payload, ...state.expenseItems] };
            break;
        case 'EDIT_EXPENSE_ITEM':
            newState = { ...state, expenseItems: state.expenseItems.map(i => i.id === action.payload.id ? action.payload : i) };
            break;
        case 'DELETE_EXPENSE_ITEM':
            newState = { ...state, expenseItems: state.expenseItems.filter(i => i.id !== action.payload) };
            break;
        case 'ADD_BUDGET_REPORT':
            newState = { ...state, budgetReports: [...state.budgetReports, action.payload] };
            break;

        case 'ADD_ACADEMIC_YEAR': newState = { ...state, academicYears: [...state.academicYears, action.payload] }; break;
        case 'EDIT_ACADEMIC_YEAR': newState = { ...state, academicYears: state.academicYears.map(i => i.id === action.payload.id ? action.payload : i) }; break;
        case 'DELETE_ACADEMIC_YEAR': newState = { ...state, academicYears: state.academicYears.filter(i => i.id !== action.payload) }; break;

        case 'ADD_CLASS_GROUP': newState = { ...state, classGroups: [...state.classGroups, action.payload] }; break;
        case 'EDIT_CLASS_GROUP': newState = { ...state, classGroups: state.classGroups.map(i => i.id === action.payload.id ? action.payload : i) }; break;
        case 'DELETE_CLASS_GROUP': newState = { ...state, classGroups: state.classGroups.filter(i => i.id !== action.payload) }; break;

        case 'ADD_POSITION': newState = { ...state, positions: [...state.positions, action.payload] }; break;
        case 'EDIT_POSITION': newState = { ...state, positions: state.positions.map(i => i.id === action.payload.id ? action.payload : i) }; break;
        case 'DELETE_POSITION': newState = { ...state, positions: state.positions.filter(i => i.id !== action.payload) }; break;

        case 'ADD_STUDENT_STATUS': newState = { ...state, studentStatuses: [...state.studentStatuses, action.payload] }; break;
        case 'EDIT_STUDENT_STATUS': newState = { ...state, studentStatuses: state.studentStatuses.map(i => i.id === action.payload.id ? action.payload : i) }; break;
        case 'DELETE_STUDENT_STATUS': newState = { ...state, studentStatuses: state.studentStatuses.filter(i => i.id !== action.payload) }; break;

        case 'ADD_PARENT_STATUS': newState = { ...state, parentStatuses: [...state.parentStatuses, action.payload] }; break;
        case 'EDIT_PARENT_STATUS': newState = { ...state, parentStatuses: state.parentStatuses.map(i => i.id === action.payload.id ? action.payload : i) }; break;
        case 'DELETE_PARENT_STATUS': newState = { ...state, parentStatuses: state.parentStatuses.filter(i => i.id !== action.payload) }; break;

        case 'ADD_CLASS': newState = { ...state, classes: [...state.classes, action.payload] }; break;
        case 'EDIT_CLASS': newState = { ...state, classes: state.classes.map(i => i.id === action.payload.id ? action.payload : i) }; break;
        case 'DELETE_CLASS': newState = { ...state, classes: state.classes.map(i => i.id === action.payload ? { ...i, isDeleted: true } : i) }; break;

        case 'SET_RAB_PLAN':
            newState = { ...state, rabPlans: [...state.rabPlans.filter(p => p.id !== action.payload.id), action.payload] };
            break;
        case 'ADD_BOS_STAGE': newState = { ...state, bosStages: [...state.bosStages, action.payload] }; break;
        case 'EDIT_BOS_STAGE': newState = { ...state, bosStages: state.bosStages.map(i => i.id === action.payload.id ? action.payload : i) }; break;
        case 'DELETE_BOS_STAGE': newState = { ...state, bosStages: state.bosStages.map(i => i.id === action.payload ? { ...i, isDeleted: true } : i) }; break;

        case 'ADD_BOS_POS': newState = { ...state, bosPosList: [...state.bosPosList, action.payload] }; break;
        case 'EDIT_BOS_POS': newState = { ...state, bosPosList: state.bosPosList.map(i => i.id === action.payload.id ? action.payload : i) }; break;
        case 'DELETE_BOS_POS': newState = { ...state, bosPosList: state.bosPosList.map(i => i.id === action.payload ? { ...i, isDeleted: true } : i) }; break;

        case 'ADD_NOTIFICATION': newState = { ...state, notifications: [action.payload, ...state.notifications] }; break;
        case 'MARK_NOTIFICATION_READ': newState = { ...state, notifications: state.notifications.map(n => n.id === action.payload ? { ...n, read: true } : n) }; break;
        case 'CLEAR_NOTIFICATIONS': newState = { ...state, notifications: [] }; break;


        case 'SET_SYNCING': newState = { ...state, isSyncing: action.payload.status, syncMessage: action.payload.message || '' }; break;

        default:
            return state;
    }
    saveState(newState);
    return { ...newState, lastAction: action };
}

export function AppProvider({ children }) {
    const [state, dispatch] = useReducer(appReducer, initialState);

    useEffect(() => {
        const token = localStorage.getItem('jwt_token');
        const isLoginPage = window.location.pathname === '/login';
        
        // Trigger fetch if we have a token AND (we are logged in OR we have no data)
        const needsData = state.accounts.length <= 5 || state.units.length === 0;

        if (isRemote && token && !isLoginPage && (needsData || !state.isInitialized)) {
            dispatch({ type: 'SET_SYNCING', payload: { status: true, message: 'Sinkronisasi data...' } });
            api.fetchAllData().then(data => {
                if (data) {
                    dispatch({ type: 'SET_ALL_DATA', payload: data });
                    dispatch({ type: 'SET_SYNCING', payload: { status: false } });
                } else {
                    dispatch({ type: 'SET_ONLINE_STATUS', payload: false });
                    dispatch({ type: 'SET_SYNCING', payload: { status: false } });
                }
            }).catch(err => {
                dispatch({ type: 'SET_SYNCING', payload: { status: false } });
                if (err.message === 'SESSION_EXPIRED') {
                    dispatch({ type: 'LOGOUT' });
                    window.location.href = '/login?expired=true';
                } else {
                    dispatch({ type: 'SET_ONLINE_STATUS', payload: false });
                }
            });
        }
    }, [isRemote, state.currentUser, state.isInitialized]);

    useEffect(() => {
        if (!isRemote || !state.currentUser || !state.isInitialized) return;

        // Background poll every 60 seconds
        const pollInterval = setInterval(() => {
            api.fetchAllData().then(data => {
                if (data) {
                    dispatch({ type: 'SET_ALL_DATA', payload: data });
                }
            }).catch(err => {
                console.warn('[Sync] Background poll failed:', err.message);
            });
        }, 60000);

        return () => clearInterval(pollInterval);
    }, [isRemote, state.currentUser, state.isInitialized]);

    useEffect(() => {
        if (!state.isInitialized) return;
        saveState(state);
    }, [state]);

    useEffect(() => {
        if (state.isInitialized && isRemote && state.lastAction) {
            api.pushAction(state.lastAction, state).catch(err => {
                console.error(`[Sync Failed] Action: ${state.lastAction.type}`, err);
                if (err.message === 'SESSION_EXPIRED') {
                    const isLoginPage = window.location.pathname === '/login';
                    dispatch({ type: 'LOGOUT' });
                    if (!isLoginPage) {
                        window.location.href = '/login?expired=true';
                    }
                } else {
                    // Generic sync error alert for debugging
                    console.error('Critical Sync Error:', err.message);
                }
            });
        }
    }, [state.lastAction]);

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
