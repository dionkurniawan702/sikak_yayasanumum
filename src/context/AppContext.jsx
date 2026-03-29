import { createContext, useContext, useReducer, useEffect } from 'react';
import { initialAccounts, initialJournals, initialAssets, initialPrograms } from '../data/seedData';
import { generateId } from '../utils/format';
import { isRemote, api } from '../services/api';

const AppContext = createContext();

const defaultState = {
    accounts: initialAccounts,
    journals: initialJournals,
    assets: initialAssets,
    programs: initialPrograms,
    budgets: [],
    notes: {},
    users: [
        { id: 'USR-001', username: 'superadmin', password: 'admin123', role: 'superadmin', name: 'Super Administrator' }
    ],
    currentUser: null,
    isOnline: true,
};

function loadState() {
    try {
        const saved = localStorage.getItem('sikak-yayasan-data');
        if (saved) {
            const data = JSON.parse(saved);
            if (!data.programs) data.programs = initialPrograms;
            if (!data.notes) data.notes = {};
            if (!data.users || data.users.length === 0) data.users = defaultState.users;
            if (data.currentUser === undefined) data.currentUser = null;
            if (data.accounts) {
                const currentSeedIds = new Set(initialAccounts.map(a => a.id));
                data.accounts = data.accounts.filter(a => {
                    const isSeedId = /^\d{5}$/.test(a.id);
                    if (!isSeedId) return true;
                    return currentSeedIds.has(a.id);
                });

                const storedIds = new Set(data.accounts.map(a => a.id));
                initialAccounts.forEach(seedAcc => {
                    if (!storedIds.has(seedAcc.id)) {
                        data.accounts.push(seedAcc);
                    } else {
                        const idx = data.accounts.findIndex(a => a.id === seedAcc.id);
                        if (idx !== -1) {
                            data.accounts[idx] = { ...seedAcc, ...data.accounts[idx] };
                        }
                    }
                });
            } else {
                data.accounts = initialAccounts;
            }
            if (!data.assets) data.assets = initialAssets;
            if (!data.journals) data.journals = initialJournals;
            if (!data.budgets) data.budgets = [];
            return data;
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
            const serverData = action.payload;
            newState = {
                ...state,
                accounts: serverData.accounts || state.accounts,
                journals: (serverData.journals || []).map(j => ({ ...j, programId: j.programId || 'PRG-GEN' })),
                assets: serverData.assets || state.assets,
                programs: serverData.programs || state.programs,
                budgets: serverData.budgets || state.budgets || [],
                users: serverData.users || state.users,
                currentUser: state.currentUser,
                isOnline: true,
                notes: serverData.notes || state.notes
            };
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
        default:
            return state;
    }
    saveState(newState);
    return { ...newState, lastAction: action };
}

export function AppProvider({ children }) {
    const [state, dispatch] = useReducer(appReducer, initialState);

    useEffect(() => {
        if (isRemote) {
            api.fetchAllData().then(data => {
                if (data) dispatch({ type: 'SET_ALL_DATA', payload: data });
                else dispatch({ type: 'SET_ONLINE_STATUS', payload: false });
            }).catch(() => dispatch({ type: 'SET_ONLINE_STATUS', payload: false }));
        }
    }, []);

    useEffect(() => {
        if (state.lastAction) {
            api.pushAction(state.lastAction, state).catch(err => {
                if (err.message === 'SESSION_EXPIRED') {
                    dispatch({ type: 'LOGOUT' });
                    window.location.href = '/login?expired=true';
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
