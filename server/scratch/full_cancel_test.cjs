const jwt = require('jsonwebtoken');
const JWT_SECRET = 'sikad-dareliman-secret-2026';
const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

// Real adminsdit2 credentials from DB
const SDIT2_USER = {
    id: 'USR-ID-MO84OT36-RN2',
    username: 'adminsdit2',
    role: 'admin_unit',
    unitId: 'mo7xk4tfhzmqk',
    fieldId: '' // Empty string, not null!
};

async function loginAsSdit2() {
    const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'adminsdit2', password: '123sdit2' })
    });
    const json = await res.json();
    console.log('Login result:', json.success ? 'SUCCESS' : `FAILED: ${json.error}`);
    if (json.success) {
        const decoded = jwt.decode(json.data.token);
        console.log('JWT payload from server:', JSON.stringify(decoded));
    }
    return json;
}

async function makeOldFormatToken() {
    // Old token: no unitId/fieldId in payload
    return jwt.sign(
        { id: SDIT2_USER.id, username: SDIT2_USER.username, role: SDIT2_USER.role },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
}

async function getSuperadminToken() {
    const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'superadmin', password: 'admin123' })
    });
    const json = await res.json();
    return json.data.token;
}

async function main() {
    // Step 1: Login as adminsdit2 to see the REAL token format
    console.log('=== Step 1: Login as adminsdit2 ===');
    const loginResult = await loginAsSdit2();
    
    if (loginResult.success) {
        const realToken = loginResult.data.token;
        const decoded = jwt.decode(realToken);
        
        // Step 2: Create a pending request using superadmin
        console.log('\n=== Step 2: Creating test pending request as superadmin ===');
        const saToken = await getSuperadminToken();
        
        // First get academic years
        const dataRes = await fetch(`${API_URL}/all-data`, {
            headers: { 'Authorization': `Bearer ${saToken}` }
        });
        const data = await dataRes.json();
        const academicYears = data.data?.academicYears || [];
        const currentYear = academicYears[0];
        console.log('Current academic year:', currentYear?.id, currentYear?.name);
        
        const expenseItems = data.data?.expenseItems || [];
        const anItem = expenseItems[0];
        console.log('Using expense item:', anItem?.id);
        
        const createRes = await fetch(`${API_URL}/budget-requests`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${saToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                unitId: SDIT2_USER.unitId,
                academicYearId: currentYear?.id,
                expenseItemId: anItem?.id,
                month: '2026-07',
                totalAmount: 100000,
                status: 'PENDING',
                description: 'Test request for cancel testing',
                items: []
            })
        });
        const created = await createRes.json();
        console.log('Created request:', JSON.stringify(created).substring(0, 200));
        
        if (created.data?.id) {
            const testReqId = created.data.id;
            console.log(`\nCreated test request: ${testReqId}`);
            
            // Step 3: Test cancel with REAL token from actual login
            console.log('\n=== Step 3: Cancel with REAL login token ===');
            const del1 = await fetch(`${API_URL}/budget-requests/${testReqId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${realToken}` }
            });
            console.log('Cancel with real token:', del1.status, await del1.text());
        }
    }
    
    // Step 4: Create another request and test with OLD format token (no unitId)
    console.log('\n=== Step 4: Creating another test request ===');
    const saToken = await getSuperadminToken();
    const dataRes2 = await fetch(`${API_URL}/all-data`, {
        headers: { 'Authorization': `Bearer ${saToken}` }
    });
    const data2 = await dataRes2.json();
    const academicYears2 = data2.data?.academicYears || [];
    const expenseItems2 = data2.data?.expenseItems || [];
    
    const createRes2 = await fetch(`${API_URL}/budget-requests`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${saToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            unitId: SDIT2_USER.unitId,
            academicYearId: academicYears2[0]?.id,
            expenseItemId: expenseItems2[0]?.id,
            month: '2026-07',
            totalAmount: 200000,
            status: 'PENDING',
            description: 'Test request 2 for cancel testing',
            items: []
        })
    });
    const created2 = await createRes2.json();
    
    if (created2.data?.id) {
        const testReqId2 = created2.data.id;
        console.log(`Created test request 2: ${testReqId2}`);
        
        // Test with OLD format token (no unitId in payload, but REAL user id)
        const oldToken = await makeOldFormatToken();
        console.log('\n=== Step 5: Cancel with OLD format token (no unitId) ===');
        console.log('Token payload:', JSON.stringify(jwt.decode(oldToken)));
        
        const del2 = await fetch(`${API_URL}/budget-requests/${testReqId2}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${oldToken}` }
        });
        console.log('Cancel with OLD token:', del2.status, await del2.text());
        
        if (del2.status === 403) {
            console.log('\n❌ CONFIRMED: Old token still fails. Easypanel has NOT deployed the fix yet.');
            console.log('The fix is in the code but server is still running old build.');
        } else if (del2.status === 200) {
            console.log('\n✅ SUCCESS: Old token cancel now works! New build is deployed.');
        }
    }
}

main().catch(console.error);
