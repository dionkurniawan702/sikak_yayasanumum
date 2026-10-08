import { generateId } from '../utils/format';

export const isRemote = true; 
const API_URL = isRemote ? '/api' : '';

let activeRequests = 0;

function incrementLoading() {
    activeRequests++;
    if (activeRequests === 1) {
        window.dispatchEvent(new CustomEvent('app-loading-start'));
    }
}

function decrementLoading() {
    activeRequests--;
    if (activeRequests <= 0) {
        activeRequests = 0;
        window.dispatchEvent(new CustomEvent('app-loading-end'));
    }
}

/**
 * Global Safe Fetch Helper
 * Handles:
 * 1. Authentication Headers
 * 2. Status Error Handling
 * 3. Malformed JSON Body Diagnostics (The "null" error detector)
 */
async function safeFetch(url, options = {}) {
    incrementLoading();
    const token = localStorage.getItem('jwt_token');
    const headers = { 
        'Content-Type': 'application/json',
        'X-Client-Version': '1.5.0-diag',
        ...options.headers 
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
        console.log(`[API Diagnostic] Fetching: ${url}`, options);
        const response = await fetch(url, { ...options, headers });
        
        // --- 1. STATUS CHECK ---
        if (!response.ok) {
            const rawBody = await response.text();
            console.error(`[SAFE-FETCH ERROR] ${options.method || 'GET'} ${url} - Status: ${response.status}`, {
                rawBody
            });

            if (response.status === 401) {
                localStorage.removeItem('jwt_token');
                throw new Error('SESSION_EXPIRED');
            }

            // Attempt to parse error JSON
            let errData = { error: rawBody };
            try { if (rawBody) errData = JSON.parse(rawBody); } catch(e) {}
            
            throw new Error(errData.message || errData.details || errData.error || `Server Error ${response.status}`);
        }

        // --- 2. JSON PARSING & NULL CHECK ---
        const text = await response.text();
        if (!text) return {};
        
        try {
            const parsed = JSON.parse(text);
            
            // If the body is explicitly the string "null" (JSON logic), log it
            if (parsed === null) {
                console.warn(`[SAFE-FETCH DIAGNOSTIC] Server returned explicit null JSON for ${url}`);
                return {};
            }
            
            return parsed;
        } catch (e) {
            console.error(`[SAFE-FETCH PARSE FAILURE] ${url}`, {
                status: response.status,
                rawText: text
            });
            throw new Error(`[DIAGNOSTIC] Respon server tidak valid/null. Teks diterima: ${text.substring(0, 50)}...`);
        }
    } catch (error) {
        if (error.message === 'SESSION_EXPIRED') throw error;
        console.error(`[SAFE-FETCH CRITICAL] ${url}`, error);
        throw error;
    } finally {
        decrementLoading();
    }
}

export const api = {
    async fetchAllData() {
        if (!isRemote) return null;
        try {
            const json = await safeFetch(`${API_URL}/all-data`);
            return json.data;
        } catch (error) {
            console.error('Failed to load data:', error.message);
            if (error.message === 'SESSION_EXPIRED') throw error;
            return null;
        }
    },

    async getTrashItems() {
        return await this.get('/trash');
    },

    async request(method, endpoint, data = null) {
        if (!isRemote) return null;
        const config = { method };
        if (data) config.body = JSON.stringify(data);
        return await safeFetch(`${API_URL}${endpoint}`, config);
    },

    async get(endpoint) {
        return await this.request('GET', endpoint);
    },

    async post(endpoint, data) {
        return await this.request('POST', endpoint, data);
    },

    async put(endpoint, data) {
        return await this.request('PUT', endpoint, data);
    },

    async delete(endpoint) {
        const url = `${API_URL}${endpoint}`;
        return await safeFetch(url, { method: 'DELETE' });
    },

    async pushAction(action, currentState) {
        if (!isRemote) return;
        const { type, payload } = action;

        const syncItem = async (endpoint, id, data, method = 'PUT') => {
            const url = id ? `${API_URL}/${endpoint}/${id}` : `${API_URL}/${endpoint}`;
            const config = { method };
            if (data) config.body = JSON.stringify(data);
            return await safeFetch(url, config);
        };

        try {
            switch (type) {
                case 'ADD_ACCOUNT': {
                    const accToSave = payload.id 
                        ? (currentState.accounts.find(a => a.id === payload.id) || payload)
                        : (currentState.accounts.find(a => a.code === payload.code) || payload);
                    await syncItem('accounts', null, accToSave, 'POST');
                    break;
                }
                case 'EDIT_ACCOUNT':
                    try {
                        await syncItem('accounts', payload.id, payload, 'PUT');
                    } catch (err) {
                        if (err.message && (err.message.includes('Akun tidak ditemukan') || err.message.includes('404'))) {
                            console.log('[API] Akun belum ada di server saat update, membuat via POST...');
                            await syncItem('accounts', null, payload, 'POST');
                        } else {
                            throw err;
                        }
                    }
                    break;
                case 'DELETE_ACCOUNT':
                    await syncItem('accounts', payload, null, 'DELETE');
                    break;
                case 'ADD_JOURNAL':
                    await syncItem('journals', null, payload, 'POST');
                    break;
                case 'EDIT_JOURNAL':
                    await syncItem('journals', payload.id, payload, 'PUT');
                    break;
                case 'DELETE_JOURNAL':
                    await syncItem('journals', payload, null, 'DELETE');
                    break;
                case 'ADD_ASSET':
                    await syncItem('assets', null, payload, 'POST');
                    break;
                case 'EDIT_ASSET':
                    await syncItem('assets', payload.id, payload, 'PUT');
                    break;
                case 'DELETE_ASSET':
                    await syncItem('assets', payload, null, 'DELETE');
                    break;
                case 'IMPORT_ASSETS': {
                    if (Array.isArray(payload)) {
                        for (const item of payload) {
                            try {
                                await syncItem('assets', null, item, 'POST');
                            } catch (e) {
                                console.error('[Sync Import Asset Error]', e.message);
                            }
                        }
                    }
                    break;
                }
                case 'ADD_ASSET_CATEGORY':
                    await syncItem('asset-categories', null, payload, 'POST');
                    break;
                case 'EDIT_ASSET_CATEGORY':
                    await syncItem('asset-categories', payload.id, payload, 'PUT');
                    break;
                case 'DELETE_ASSET_CATEGORY':
                    await syncItem('asset-categories', payload, null, 'DELETE');
                    break;
                case 'ADD_ASSET_VENDOR':
                    await syncItem('asset-vendors', null, payload, 'POST');
                    break;
                case 'EDIT_ASSET_VENDOR':
                    await syncItem('asset-vendors', payload.id, payload, 'PUT');
                    break;
                case 'DELETE_ASSET_VENDOR':
                    await syncItem('asset-vendors', payload, null, 'DELETE');
                    break;
                case 'ADD_ASSET_ROOM':
                    await syncItem('asset-rooms', null, payload, 'POST');
                    break;
                case 'EDIT_ASSET_ROOM':
                    await syncItem('asset-rooms', payload.id, payload, 'PUT');
                    break;
                case 'DELETE_ASSET_ROOM':
                    await syncItem('asset-rooms', payload, null, 'DELETE');
                    break;
                case 'ADD_ASSET_PIC':
                    await syncItem('asset-pics', null, payload, 'POST');
                    break;
                case 'EDIT_ASSET_PIC':
                    await syncItem('asset-pics', payload.id, payload, 'PUT');
                    break;
                case 'DELETE_ASSET_PIC':
                    await syncItem('asset-pics', payload, null, 'DELETE');
                    break;
                case 'ADD_PROGRAM':
                    await syncItem('programs', null, payload, 'POST');
                    break;
                case 'EDIT_PROGRAM':
                    await syncItem('programs', payload.id, payload);
                    break;
                case 'DELETE_PROGRAM':
                    await syncItem('programs', payload, null, 'DELETE');
                    break;
                case 'ADD_BUDGET_PROGRAM':
                    await syncItem('expense-programs', null, payload, 'POST');
                    break;
                case 'EDIT_BUDGET_PROGRAM':
                    await syncItem('expense-programs', payload.id, payload);
                    break;
                case 'DELETE_BUDGET_PROGRAM':
                    await syncItem('expense-programs', payload, null, 'DELETE');
                    break;
                case 'ADD_FIELD':
                    await syncItem('fields', null, payload, 'POST');
                    break;
                case 'EDIT_FIELD':
                    await syncItem('fields', payload.id, payload);
                    break;
                case 'DELETE_FIELD':
                    await syncItem('fields', payload, null, 'DELETE');
                    break;
                case 'ADD_UNIT':
                    await syncItem('units', null, payload, 'POST');
                    break;
                case 'EDIT_UNIT':
                    await syncItem('units', payload.id, payload);
                    break;
                case 'DELETE_UNIT':
                    await syncItem('units', payload, null, 'DELETE');
                    break;
                case 'ADD_STUDENT':
                    await syncItem('students', null, payload, 'POST');
                    break;
                case 'EDIT_STUDENT':
                    await syncItem('students', payload.id, payload);
                    break;
                case 'DELETE_STUDENT':
                    await syncItem('students', payload, null, 'DELETE');
                    break;
                case 'ADD_INCOME_ITEM':
                    await syncItem('income-items', null, payload, 'POST');
                    break;
                case 'EDIT_INCOME_ITEM':
                    await syncItem('income-items', payload.id, payload);
                    break;
                case 'DELETE_INCOME_ITEM':
                    await syncItem('income-items', payload, null, 'DELETE');
                    break;
                case 'ADD_EXPENSE_ITEM':
                    await syncItem('expense-items', null, payload, 'POST');
                    break;
                case 'EDIT_EXPENSE_ITEM':
                    await syncItem('expense-items', payload.id, payload);
                    break;
                case 'DELETE_EXPENSE_ITEM':
                    await syncItem('expense-items', payload, null, 'DELETE');
                    break;
                case 'UPDATE_DISTRIBUTION_SETTINGS':
                    await this.post('/distribution-settings', payload);
                    break;
                case 'ADD_BUDGET_REQUEST': {
                    const BUDGET_REQUEST_FIELDS = ['id', 'status', 'description', 'month', 'year',
                        'totalAmount', 'amount', 'items', 'unitId', 'fieldId', 'academicYearId',
                        'date', 'expenseItemId', 'isDeleted', 'source', 'notified', 'isClosed',
                        'creditAccountId', 'sourceBankAccountId', 'targetUnitBankAccountId', 'transferJournalId', 'bypassBalanceCheck'];
                    const cleanPayload = {};
                    BUDGET_REQUEST_FIELDS.forEach(f => {
                        if (payload[f] !== undefined) cleanPayload[f] = payload[f];
                    });
                    await syncItem('budget-requests', null, cleanPayload, 'POST');
                    break;
                }
                case 'EDIT_BUDGET_REQUEST': {
                    const BUDGET_REQUEST_FIELDS = ['status', 'description', 'month', 'year',
                        'totalAmount', 'amount', 'items', 'unitId', 'fieldId', 'academicYearId',
                        'date', 'expenseItemId', 'isDeleted', 'source', 'notified', 'creditAccountId',
                        'sourceBankAccountId', 'targetUnitBankAccountId', 'transferJournalId', 'bypassBalanceCheck'];
                    const cleanPayload = { id: payload.id };
                    BUDGET_REQUEST_FIELDS.forEach(f => {
                        if (payload[f] !== undefined) cleanPayload[f] = payload[f];
                    });
                    await syncItem('budget-requests', payload.id, cleanPayload);
                    break;
                }
                case 'DELETE_BUDGET_REQUEST':
                    await syncItem('budget-requests', payload, null, 'DELETE');
                    break;
                case 'ADD_BUDGET_REPORT':
                    await syncItem('budget-reports', null, payload, 'POST');
                    break;
                case 'EDIT_BUDGET_REPORT':
                    await syncItem('budget-reports', payload.id, payload);
                    break;
                case 'DELETE_BUDGET_REPORT':
                    await syncItem('budget-reports', payload, null, 'DELETE');
                    break;
                case 'ADD_ACADEMIC_YEAR':
                    await syncItem('academic-years', null, payload, 'POST');
                    break;
                case 'EDIT_ACADEMIC_YEAR':
                    await syncItem('academic-years', payload.id, payload);
                    break;
                case 'DELETE_ACADEMIC_YEAR':
                    await syncItem('academic-years', `${payload}?permanent=true`, null, 'DELETE');
                    break;
                case 'ADD_CLASS_GROUP':
                    await syncItem('class-groups', null, payload, 'POST');
                    break;
                case 'EDIT_CLASS_GROUP':
                    await syncItem('class-groups', payload.id, payload);
                    break;
                case 'DELETE_CLASS_GROUP':
                    await syncItem('class-groups', payload, null, 'DELETE');
                    break;
                case 'ADD_POSITION':
                    await syncItem('positions', null, payload, 'POST');
                    break;
                case 'EDIT_POSITION':
                    await syncItem('positions', payload.id, payload);
                    break;
                case 'DELETE_POSITION':
                    await syncItem('positions', payload, null, 'DELETE');
                    break;
                case 'ADD_STUDENT_STATUS':
                    await syncItem('student-statuses', null, payload, 'POST');
                    break;
                case 'EDIT_STUDENT_STATUS':
                    await syncItem('student-statuses', payload.id, payload);
                    break;
                case 'DELETE_STUDENT_STATUS':
                    await syncItem('student-statuses', payload, null, 'DELETE');
                    break;
                case 'ADD_PARENT_STATUS':
                    await syncItem('parent-statuses', null, payload, 'POST');
                    break;
                case 'EDIT_PARENT_STATUS':
                    await syncItem('parent-statuses', payload.id, payload);
                    break;
                case 'DELETE_PARENT_STATUS':
                    await syncItem('parent-statuses', payload, null, 'DELETE');
                    break;
                case 'ADD_CLASS':
                    await syncItem('classes', null, payload, 'POST');
                    break;
                case 'EDIT_CLASS':
                    await syncItem('classes', payload.id, payload);
                    break;
                case 'DELETE_CLASS':
                    await syncItem('classes', payload, null, 'DELETE');
                    break;
                case 'SET_RAB_PLAN':
                    console.log('[API] Pushing RAB Plan:', payload.id);
                    if (payload.expense) {
                        const keys = Object.keys(payload.expense);
                        console.log(`[API] Expense Items: ${keys.length}. Sample Component Check:`, 
                            keys[0] ? (payload.expense[keys[0]].components?.length || 0) : 0);
                    }
                    await this.post('/rab-plans', payload);
                    break;
                case 'DELETE_RAB_PLAN':
                    console.log('[API] Deleting RAB Plan:', payload);
                    await this.delete('/rab-plans/' + payload);
                    break;
                case 'ADD_BOS_STAGE':
                    await syncItem('bos-stages', null, payload, 'POST');
                    break;
                case 'EDIT_BOS_STAGE':
                    await syncItem('bos-stages', payload.id, payload);
                    break;
                case 'DELETE_BOS_STAGE':
                    await syncItem('bos-stages', payload, null, 'DELETE');
                    break;
                case 'ADD_BOS_POS':
                    await syncItem('bos-pos', null, payload, 'POST');
                    break;
                case 'EDIT_BOS_POS':
                    await syncItem('bos-pos', payload.id, payload);
                    break;
                case 'DELETE_BOS_POS':
                    await syncItem('bos-pos', payload, null, 'DELETE');
                    break;
                case 'ADD_BOS_ALLOCATION':
                    await syncItem('bos-allocations', null, payload, 'POST');
                    break;
                case 'EDIT_BOS_ALLOCATION':
                    await syncItem('bos-allocations', payload.id, payload);
                    break;
                case 'DELETE_BOS_ALLOCATION':
                    await syncItem('bos-allocations', payload, null, 'DELETE');
                    break;
                case 'ADD_USER':
                    await syncItem('users', null, payload, 'POST');
                    break;
                case 'EDIT_USER':
                    await syncItem('users', payload.id, payload);
                    break;
                case 'DELETE_USER':
                    await syncItem('users', payload, null, 'DELETE');
                    break;
                case 'ADD_ACADEMIC_YEAR':
                    await syncItem('academic-years', payload.id, payload);
                    break;
                case 'EDIT_ACADEMIC_YEAR':
                    await syncItem('academic-years', payload.id, payload);
                    break;
                case 'DELETE_ACADEMIC_YEAR':
                    await syncItem('academic-years', payload, null, 'DELETE');
                    break;
                case 'RESTORE_FROM_TRASH': {
                    const { id, type } = payload;
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
                        'expense-item': 'expense-items',
                        'class-group': 'class-groups',
                        'position': 'positions',
                        'student-status': 'student-statuses',
                        'parent-status': 'parent-statuses',
                        'bos-stage': 'bos-stages',
                        'bos-pos': 'bos-pos',
                        budgetRequest: 'budget-requests',
                        budgetReport: 'budget-reports',
                        bosAllocation: 'bos-allocations'
                    };
                    const endpoint = mapping[type];
                    if (endpoint) {
                        await syncItem(endpoint, id, { isDeleted: false, deletedAt: null });
                    }
                    break;
                }
                case 'PERMANENT_DELETE': {
                    const { id, type } = payload;
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
                        'expense-item': 'expense-items',
                        'class-group': 'class-groups',
                        'position': 'positions',
                        'student-status': 'student-statuses',
                        'parent-status': 'parent-statuses',
                        'bos-stage': 'bos-stages',
                        'bos-pos': 'bos-pos',
                        budgetRequest: 'budget-requests',
                        budgetReport: 'budget-reports',
                        bosAllocation: 'bos-allocations'
                    };
                    const endpoint = mapping[type];
                    if (endpoint) {
                        await syncItem(endpoint, `${id}?permanent=true`, null, 'DELETE');
                    }
                    break;
                }
                case 'EMPTY_TRASH':
                    await this.delete('/trash/empty');
                    break;
                default:
                    console.log(`[Sync] Action ${type} not mapped for sync.`);
            }
        } catch (error) {
            console.error(`[Sync Error] ${type}:`, error.message);
            throw error;
        }
    },

    async duplicateDistributionSettings(sourceYearId, targetYearId) {
        if (!isRemote) return null;
        return await this.post('/distribution-settings/duplicate', { sourceYearId, targetYearId });
    },

    async syncWholeState(state, includeAll = false) {
        if (!isRemote) return { status: 'disabled' };
        try {
            const syncData = {
                accounts: state.accounts || [],
                assets: state.assets || [],
                programs: state.programs || [],
                expensePrograms: state.expensePrograms || [],
                users: state.users || [],
                budgets: state.budgets || [],
                fields: state.fields || [],
                units: state.units || [],
                incomeItems: state.incomeItems || [],
                expenseItems: state.expenseItems || [],
                // distributionSettings, rabPlans, and budgetReports removed from auto-sync to prevent dormant tabs from resurrecting deleted records / stale data
                academicYears: state.academicYears || [],
                classGroups: state.classGroups || [],
                positions: state.positions || [],
                studentStatuses: state.studentStatuses || [],
                parentStatuses: state.parentStatuses || [],
                classes: state.classes || [],
                budgetRequests: state.budgetRequests || [],
                bosStages: state.bosStages || [],
                bosPosList: state.bosPosList || [],
                bosAllocations: state.bosAllocations || []
            };

            // Only include large/sensitive tables for manual syncs/restores to avoid background conflicts and database limits
            if (includeAll) {
                syncData.students = state.students || [];
                syncData.journals = state.journals || [];
                syncData.rabPlans = state.rabPlans || [];
            }

            const response = await this.post('/sync', syncData);
            return response;
        } catch (error) {
            console.error('Whole state sync failed:', error.message);
            throw error;
        }
    },

    /**
     * Membatalkan verifikasi (APPROVED → PENDING) untuk banyak laporan sekaligus.
     * Server akan sekaligus menghapus / menonaktifkan entri jurnal terkait.
     * @param {string[]} ids - Daftar ID BudgetReport yang akan dibatalkan verifikasinya
     * @returns {Promise<{success: string[], failed: Array}>}
     */
    async bulkCancelApproval(ids) {
        if (!isRemote) return { success: ids, failed: [] };
        return await this.post('/budget-reports/bulk-cancel-approval', { ids });
    }
};
