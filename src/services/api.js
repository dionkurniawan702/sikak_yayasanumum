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
                const token = localStorage.getItem('jwt_token');
                const headers = {};
                if (token) headers['Authorization'] = `Bearer ${token}`;

                const res = await fetch(`${API_URL}/${name}`, { headers });
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

            const [
                accounts, journals, assets, programs, users, budgets,
                fields, units, students, incomeItems, distributionSettings,
                budgetRequests, budgetReports,
                academicYears, classGroups, positions, studentStatuses, parentStatuses
            ] = await Promise.all([
                fetchEntity('accounts'),
                fetchEntity('journals'),
                fetchEntity('assets'),
                fetchEntity('programs'),
                fetchEntity('users'),
                fetchEntity('budgets'),
                fetchEntity('fields'),
                fetchEntity('units'),
                fetchEntity('students'),
                fetchEntity('income-items'),
                fetchEntity('distribution-settings'),
                fetchEntity('budget-requests'),
                fetchEntity('budget-reports'),
                fetchEntity('academic-years'),
                fetchEntity('class-groups'),
                fetchEntity('positions'),
                fetchEntity('student-statuses'),
                fetchEntity('parent-statuses')
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
                assets, programs, users, 
                budgets: budgets.map(b => ({ ...b, amount: parseFloat(b.amount) || 0 })),
                fields, units, students, incomeItems, distributionSettings,
                budgetRequests, budgetReports,
                academicYears, classGroups, positions, studentStatuses, parentStatuses,
                notes: {}, 
            };
        } catch (error) {
            console.error('Failed to load data from server:', error.message);
            return null;
        }
    },

    async fetchFundAvailability(unitId) {
        if (!isRemote) return [];
        try {
            const token = localStorage.getItem('jwt_token');
            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`${API_URL}/fund-availability/${unitId}`, { headers });
            if (!res.ok) throw new Error('Fetch failed');
            const json = await res.json();
            return json.data || [];
        } catch (error) {
            console.error('Failed to fetch fund availability:', error);
            return [];
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
                case 'ADD_FIELD':
                    await syncItem('fields', null, payload, 'POST');
                    break;
                case 'EDIT_FIELD':
                    await syncItem('fields', payload.id, payload);
                    break;
                case 'DELETE_FIELD':
                    await syncItem('fields', payload, { isDeleted: true }, 'DELETE');
                    break;
                case 'ADD_UNIT':
                    await syncItem('units', null, payload, 'POST');
                    break;
                case 'EDIT_UNIT':
                    await syncItem('units', payload.id, payload);
                    break;
                case 'DELETE_UNIT':
                    await syncItem('units', payload, { isDeleted: true }, 'DELETE');
                    break;
                case 'ADD_STUDENT':
                    await syncItem('students', null, payload, 'POST');
                    break;
                case 'EDIT_STUDENT':
                    await syncItem('students', payload.id, payload);
                    break;
                case 'DELETE_STUDENT':
                    await syncItem('students', payload, { isDeleted: true }, 'DELETE');
                    break;
                case 'ADD_INCOME_ITEM':
                    await syncItem('income-items', null, payload, 'POST');
                    break;
                case 'EDIT_INCOME_ITEM':
                    await syncItem('income-items', payload.id, payload);
                    break;
                case 'DELETE_INCOME_ITEM':
                    await syncItem('income-items', payload, { isDeleted: true }, 'DELETE');
                    break;
                case 'ADD_EXPENSE_ITEM':
                    await syncItem('expense-items', null, payload, 'POST');
                    break;
                case 'EDIT_EXPENSE_ITEM':
                    await syncItem('expense-items', payload.id, payload);
                    break;
                case 'DELETE_EXPENSE_ITEM':
                    await syncItem('expense-items', payload, { isDeleted: true }, 'DELETE');
                    break;
                case 'UPDATE_DISTRIBUTION_SETTINGS':
                    await syncItem('distribution-settings', null, payload, 'POST');
                    break;
                case 'ADD_BUDGET_REQUEST':
                    await syncItem('budget-requests', null, payload, 'POST');
                    break;
                case 'EDIT_BUDGET_REQUEST':
                    await syncItem('budget-requests', payload.id, payload);
                    break;
                case 'ADD_BUDGET_REPORT':
                    await syncItem('budget-reports', null, payload, 'POST');
                    break;
                case 'SET_BUDGETS':
                    await this.syncWholeState(currentState);
                    break;
                case 'ADD_ACADEMIC_YEAR': await syncItem('academic-years', null, payload, 'POST'); break;
                case 'EDIT_ACADEMIC_YEAR': await syncItem('academic-years', payload.id, payload); break;
                case 'DELETE_ACADEMIC_YEAR': await syncItem('academic-years', payload, { isDeleted: true }, 'DELETE'); break;
                
                case 'ADD_CLASS_GROUP': await syncItem('class-groups', null, payload, 'POST'); break;
                case 'EDIT_CLASS_GROUP': await syncItem('class-groups', payload.id, payload); break;
                case 'DELETE_CLASS_GROUP': await syncItem('class-groups', payload, { isDeleted: true }, 'DELETE'); break;

                case 'ADD_POSITION': await syncItem('positions', null, payload, 'POST'); break;
                case 'EDIT_POSITION': await syncItem('positions', payload.id, payload); break;
                case 'DELETE_POSITION': await syncItem('positions', payload, { isDeleted: true }, 'DELETE'); break;

                case 'ADD_STUDENT_STATUS': await syncItem('student-statuses', null, payload, 'POST'); break;
                case 'EDIT_STUDENT_STATUS': await syncItem('student-statuses', payload.id, payload); break;
                case 'DELETE_STUDENT_STATUS': await syncItem('student-statuses', payload, { isDeleted: true }, 'DELETE'); break;

                case 'ADD_PARENT_STATUS': await syncItem('parent-statuses', null, payload, 'POST'); break;
                case 'EDIT_PARENT_STATUS': await syncItem('parent-statuses', payload.id, payload); break;
                case 'DELETE_PARENT_STATUS': await syncItem('parent-statuses', payload, { isDeleted: true }, 'DELETE'); break;


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
                    budgets: state.budgets,
                    fields: state.fields,
                    units: state.units
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
