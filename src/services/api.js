let API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Handle production hostnames
if (typeof window !== 'undefined') {
    const { hostname, protocol, host } = window.location;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1' && (API_URL.includes('localhost') || API_URL.includes('127.0.0.1'))) {
        API_URL = `${protocol}//${host}/api`;
    }
}

const DATA_MODE = import.meta.env.VITE_DATA_MODE || 'remote'; // Default to remote for SIKAK

export const isRemote = DATA_MODE === 'remote';

export const api = {
    async fetchAllData() {
        if (!isRemote) return null;
        try {
            const fetchEntity = async (name) => {
                const res = await fetch(`${API_URL}/${name}`);
                if (res.status === 401 || res.status === 403) {
                    throw new Error('SESSION_EXPIRED');
                }
                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(`Fetch ${name} failed (${res.status}): ${text.substring(0, 100)}`);
                }
                const json = await res.json();
                return json.data || [];
            };

            const [accounts, journals, assets, programs, users, budgets] = await Promise.all([
                fetchEntity('accounts'),
                fetchEntity('journals'),
                fetchEntity('assets'),
                fetchEntity('programs'),
                fetchEntity('users'),
                fetchEntity('budgets')
            ]);

            return {
                accounts: accounts.map(a => ({
                    ...a,
                    initialBalance: parseFloat(a.balance) || 0,
                    normalBalance: ['Aset', 'Beban'].includes(a.type) ? 'debit' : 'kredit'
                })),
                journals: journals.map(j => ({
                    ...j,
                    entries: typeof j.entries === 'string' ? JSON.parse(j.entries) : j.entries
                })),
                assets: assets,
                programs: programs,
                users: users,
                budgets: budgets.map(b => ({
                    ...b,
                    amount: parseFloat(b.amount) || 0
                })),
                notes: {}, 
            };
        } catch (error) {
            console.error('Failed to load data from server:', error.message);
            return null;
        }
    },

    async pushAction(action, currentState) {
        if (!isRemote) return;
        const { type, payload } = action;

        const syncItem = async (entity, id, data, method = 'PUT') => {
            const url = id ? `${API_URL}/${entity}/${id}` : `${API_URL}/${entity}`;
            
            const token = localStorage.getItem('jwt_token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch(url, {
                method: method,
                headers: headers,
                body: JSON.stringify(data)
            });
            
            if (response.status === 401 || response.status === 403) {
                throw new Error('SESSION_EXPIRED');
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Server error' }));
                throw new Error(errorData.error || `Server error ${response.status}`);
            }
            return response.json();
        };

        try {
            switch (type) {
                case 'ADD_ACCOUNT': {
                    const newAcc = currentState.accounts.find(a => a.id === payload.id);
                    if (newAcc) await syncItem('accounts', null, newAcc, 'POST');
                    break;
                }
                case 'EDIT_ACCOUNT':
                    await syncItem('accounts', payload.id, payload);
                    break;
                case 'DELETE_ACCOUNT':
                    const accDel = currentState.accounts.find(a => a.id === payload);
                    if (accDel) await syncItem('accounts', payload, { ...accDel, isDeleted: true });
                    break;
                case 'ADD_JOURNAL': {
                    const latestJournal = currentState.journals[currentState.journals.length - 1];
                    await syncItem('journals', null, latestJournal, 'POST');
                    break;
                }
                case 'EDIT_JOURNAL':
                    await syncItem('journals', payload.id, payload);
                    break;
                case 'DELETE_JOURNAL': {
                    const jrnDel = currentState.journals.find(j => j.id === payload);
                    if (jrnDel) await syncItem('journals', payload, { ...jrnDel, isDeleted: true });
                    break;
                }
                case 'ADD_PROGRAM':
                    await syncItem('programs', null, payload, 'POST');
                    break;
                case 'EDIT_PROGRAM':
                    await syncItem('programs', payload.id, payload);
                    break;
                case 'DELETE_PROGRAM':
                    const prgDel = currentState.programs.find(p => p.id === payload);
                    if (prgDel) await syncItem('programs', payload, { ...prgDel, isDeleted: true });
                    break;
                case 'ADD_ASSET':
                    await syncItem('assets', null, currentState.assets[currentState.assets.length - 1], 'POST');
                    break;
                case 'EDIT_ASSET':
                    await syncItem('assets', payload.id, payload);
                    break;
                case 'DELETE_ASSET':
                    const astDel = currentState.assets.find(a => a.id === payload);
                    if (astDel) await syncItem('assets', payload, { ...astDel, isDeleted: true });
                    break;
                case 'ADD_USER':
                    await syncItem('users', null, currentState.users[currentState.users.length - 1], 'POST');
                    break;
                case 'EDIT_USER':
                    await syncItem('users', payload.id, payload);
                    break;
                case 'DELETE_USER':
                    const usrDel = currentState.users.find(u => u.id === payload);
                    if (usrDel) await syncItem('users', payload, { ...usrDel, isDeleted: true });
                    break;
                case 'SET_BUDGETS':
                    await this.syncWholeState(currentState);
                    break;
                default:
                    if (type.includes('RESTORE') || type.includes('TRASH') || type.includes('IMPORT') || type.includes('BULK') || type.includes('DEPRECIATION') || type.includes('NOTES')) {
                        await this.syncWholeState(currentState);
                    }
                    break;
            }
        } catch (error) {
            console.error(`Sync Failed [${type}]:`, error.message);
            throw error;
        }
    },

    async syncWholeState(state) {
        if (!isRemote) return;
        try {
            const token = localStorage.getItem('jwt_token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch(`${API_URL}/sync`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    accounts: state.accounts,
                    journals: state.journals,
                    assets: state.assets,
                    programs: state.programs,
                    users: state.users,
                    budgets: state.budgets
                })
            });

            if (response.status === 401 || response.status === 403) {
                throw new Error('SESSION_EXPIRED');
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Sync failed' }));
                throw new Error(errorData.error || `Sync failed ${response.status}`);
            }
        } catch (error) {
            console.error('Failed to sync to server:', error.message);
        }
    }
};
