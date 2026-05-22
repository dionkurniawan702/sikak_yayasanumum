import jwt from 'jsonwebtoken';

const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';
const JWT_SECRET = 'sikad-dareliman-secret-2026';

async function main() {
    console.log('--- FETCHING USERS LIST ---');
    let superadminUser = null;
    try {
        const res = await fetch(`${API_URL}/users`);
        if (!res.ok) {
            console.error(`Fetch users failed: ${res.status}`);
        } else {
            const json = await res.json();
            const users = json.data || [];
            console.log(`Successfully fetched ${users.length} users.`);
            
            // Find superadmin
            superadminUser = users.find(u => u.role === 'superadmin' && !u.isDeleted);
            if (superadminUser) {
                console.log(`Found active superadmin: ${superadminUser.username} (ID: ${superadminUser.id})`);
            } else {
                console.log('No active superadmin found in the users list.');
            }
        }
    } catch (err) {
        console.error('Error fetching users:', err.message);
    }

    if (!superadminUser) {
        console.log('Using fallback superadmin ID/username (adminsdit1)...');
        superadminUser = {
            id: 'USR-default-superadmin-id-fallback', // We might need the real ID if the DB checks it.
            username: 'adminsdit1',
            role: 'superadmin'
        };
    }

    console.log('\n--- SIGNING JWT TOKEN ---');
    const token = jwt.sign(
        { id: superadminUser.id, username: superadminUser.username, role: 'superadmin' },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
    console.log('JWT Token signed successfully.');

    console.log('\n--- FETCHING ALL DATA FROM API ---');
    const res = await fetch(`${API_URL}/all-data`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!res.ok) {
        console.error(`❌ Fetch /all-data failed: ${res.status} ${res.statusText}`);
        const text = await res.text();
        console.error(`Response text: ${text}`);
        return;
    }

    const json = await res.json();
    const data = json.data || json;
    
    const rabPlans = data.rabPlans || [];
    const units = data.units || [];
    const fields = data.fields || [];

    const unitMap = {};
    units.forEach(u => { unitMap[u.id] = u.name; });

    const fieldMap = {};
    fields.forEach(f => { fieldMap[f.id] = f.name; });

    console.log(`Total RabPlans fetched: ${rabPlans.length}`);
    console.log(`Total Units fetched: ${units.length}`);
    console.log(`Total Fields fetched: ${fields.length}`);

    let totalGlobalPending = 0;
    const pendingDetails = [];

    rabPlans.forEach(plan => {
        let planPendingCount = 0;
        let planApprovedCount = 0;
        let planDraftCount = 0;
        
        const exp = plan.expense || {};
        Object.entries(exp).forEach(([itemId, dataArray]) => {
            const planArray = Array.isArray(dataArray) 
                ? dataArray 
                : (dataArray && typeof dataArray === 'object' && Object.keys(dataArray).length > 0 ? [dataArray] : []);
                
            planArray.forEach(p => {
                if (p.components) {
                    p.components.forEach(c => {
                        if (c.status === 'PENDING') {
                            planPendingCount++;
                            totalGlobalPending++;
                        } else if (c.status === 'APPROVED' || c.isApproved) {
                            planApprovedCount++;
                        } else {
                            planDraftCount++;
                        }
                    });
                }
            });
        });
        
        if (planPendingCount > 0) {
            const ownerType = plan.unitId ? 'Unit' : (plan.fieldId ? 'Bidang' : 'Unknown');
            const ownerId = plan.unitId || plan.fieldId || 'Unknown';
            const ownerName = plan.unitId 
                ? (unitMap[plan.unitId] || plan.unitId) 
                : (plan.fieldId ? (fieldMap[plan.fieldId] || plan.fieldId) : 'Unknown');

            pendingDetails.push({
                planId: plan.id,
                ownerType,
                ownerId,
                ownerName,
                pendingCount: planPendingCount
            });
        }
    });

    console.log('\n--- PENDING COMPONENTS BREAKDOWN ---');
    pendingDetails.forEach(item => {
        console.log(`- [${item.ownerType}] ${item.ownerName}: ${item.pendingCount} pending`);
    });
    console.log(`\nTotal Pending Components Globally: ${totalGlobalPending}`);
}

main().catch(console.error);
