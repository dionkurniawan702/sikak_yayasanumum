import { generateId } from '../utils/format';

export const isRemote = true; 
const API_URL = isRemote ? '/api' : '';

export const api = {
    async fetchAllData() {
        if (!isRemote) return null;
        try {
            const token = localStorage.getItem('jwt_token');
            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`${API_URL}/all-data`, { headers });
            if (!res.ok) {
                if (res.status === 401 || res.status === 403) throw new Error('SESSION_EXPIRED');
                throw new Error('Fetch failed');
            }
            const json = await res.json();
            return json.data;
        } catch (error) {
            console.error('Failed to load data from server:', error.message);
            return null;
        }
    },

    async request(method, endpoint, data = null) {
        if (!isRemote) return null;
        try {
            const token = localStorage.getItem('jwt_token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const config = {
                method,
                headers,
            };
            if (data) config.body = JSON.stringify(data);

            const res = await fetch(`${API_URL}${endpoint}`, config);
            if (!res.ok) {
                if (res.status === 401 || res.status === 403) throw new Error('SESSION_EXPIRED');
                const errorData = await res.json().catch(() => ({ error: 'Server error' }));
                throw new Error(errorData.error || `Error ${res.status}`);
            }
            return await res.json();
        } catch (error) {
            console.error(`API ${method} ${endpoint} failed:`, error.message);
            throw error;
        }
    },

    async post(endpoint, data = null) {
        return this.request('POST', endpoint, data);
    },

    async fetchFundAvailability(unitId) {
        const json = await this.request('GET', `/fund-availability/${unitId}`);
        return json?.data || [];
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

                case 'ADD_PROGRAM':
                    await syncItem('programs', null, payload, 'POST');
                    break;
                case 'EDIT_PROGRAM':
                    await syncItem('programs', payload.id, payload);
                    break;
                case 'DELETE_PROGRAM':
                    await syncItem('programs', payload, { isDeleted: true }, 'DELETE');
                    break;

                case 'ADD_BUDGET_PROGRAM':
                    await syncItem('expense-programs', null, payload, 'POST');
                    break;
                case 'EDIT_BUDGET_PROGRAM':
                    await syncItem('expense-programs', payload.id, payload);
                    break;
                case 'DELETE_BUDGET_PROGRAM':
                    await syncItem('expense-programs', payload, { isDeleted: true }, 'DELETE');
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

                case 'ADD_CLASS': await syncItem('classes', null, payload, 'POST'); break;
                case 'EDIT_CLASS': await syncItem('classes', payload.id, payload); break;
                case 'DELETE_CLASS': await syncItem('classes', payload, { isDeleted: true }, 'DELETE'); break;

                case 'ADD_BOS_STAGE': await syncItem('bos-stages', null, payload, 'POST'); break;
                case 'EDIT_BOS_STAGE': await syncItem('bos-stages', payload.id, payload); break;
                case 'DELETE_BOS_STAGE': await syncItem('bos-stages', payload, { isDeleted: true }, 'DELETE'); break;

                case 'ADD_BOS_POS': await syncItem('bos-pos', null, payload, 'POST'); break;
                case 'EDIT_BOS_POS': await syncItem('bos-pos', payload.id, payload); break;
                case 'DELETE_BOS_POS': await syncItem('bos-pos', payload, { isDeleted: true }, 'DELETE'); break;

                case 'RESTORE_FROM_TRASH': {
                    const { id, type: eType } = payload;
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
                        'income-item': 'income-items',
                        'expense-item': 'expense-items'
                    };
                    const endpoint = mapping[eType];
                    if (endpoint) {
                        await syncItem(endpoint, id, { isDeleted: false, deletedAt: null });
                    }
                    break;
                }
                case 'PERMANENT_DELETE': {
                    const { id, type: eType } = payload;
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
                        'income-item': 'income-items',
                        'expense-item': 'expense-items'
                    };
                    const endpoint = mapping[eType];
                    if (endpoint) {
                        await syncItem(`${endpoint}/${id}`, null, { permanent: true }, 'DELETE');
                    }
                    break;
                }
                case 'EMPTY_TRASH':
                    await fetch(`${API_URL}/trash/empty`, { 
                        method: 'DELETE',
                        headers: { 
                            'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    break;

                case 'SET_SYNCING':
                    // Local only
                    break;

                default:
                    console.warn(`[API] Unhandled pushAction type: ${type}`);
            }
        } catch (error) {
            console.error(`[API] Push action failed (${type}):`, error.message);
            throw error;
        }
    },

    async syncWholeState(state, isPurge = false) {
        if (!isRemote) return;
        try {
            const token = localStorage.getItem('jwt_token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch(`${API_URL}/sync`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    isPurge,
                    accounts: state.accounts,
                    journals: state.journals,
                    assets: state.assets,
                    programs: state.programs,
                    expensePrograms: state.expensePrograms,
                    users: state.users,
                    budgets: state.budgets,
                    fields: state.fields,
                    units: state.units,
                    students: state.students,
                    incomeItems: state.incomeItems,
                    expenseItems: state.expenseItems,
                    distributionSettings: state.distributionSettings,
                    academicYears: state.academicYears,
                    classGroups: state.classGroups,
                    positions: state.positions,
                    studentStatuses: state.studentStatuses,
                    parentStatuses: state.parentStatuses,
                    budgetRequests: state.budgetRequests,
                    budgetReports: state.budgetReports,
                    classes: state.classes,
                    rabPlans: state.rabPlans,
                    bosStages: state.bosStages,
                    bosPosList: state.bosPosList
                })
            });

            if (response.status === 401 || response.status === 403) {
                throw new Error('SESSION_EXPIRED');
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Sync failed' }));
                throw new Error(errorData.error || `Sync failed ${response.status}`);
            }
            return { success: true };
        } catch (error) {
            console.error('Failed to sync to server:', error.message);
            throw error;
        }
    }
};
