const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    console.log('--- Logging in to SIKAK Yayasan Umum ---');
    
    let token = null;
    const loginCredentials = [
        { username: 'adminsdit1', password: 'admin123' },
        { username: 'admin', password: 'password123' }
    ];

    for (const creds of loginCredentials) {
        try {
            console.log(`Trying login with ${creds.username}...`);
            const loginRes = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(creds)
            });
            
            if (loginRes.ok) {
                const loginJson = await loginRes.json();
                if (loginJson.success && loginJson.data && loginJson.data.token) {
                    token = loginJson.data.token;
                    console.log(`✅ Login successful for user: ${creds.username}`);
                    break;
                }
            } else {
                console.log(`❌ Login failed for ${creds.username}: ${loginRes.status}`);
            }
        } catch (err) {
            console.error(`Error during login for ${creds.username}:`, err.message);
        }
    }

    if (!token) {
        console.error('❌ Could not login with any known credentials. Exiting.');
        return;
    }

    console.log('\n--- Fetching All Data from API ---');
    const res = await fetch(`${API_URL}/all-data`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!res.ok) {
        console.error(`❌ Fetch /all-data failed: ${res.status} ${res.statusText}`);
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
    const breakdown = [];

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

            breakdown.push({
                planId: plan.id,
                ownerType,
                ownerId,
                ownerName,
                pendingCount: planPendingCount
            });
        }
    });

    console.log('\n--- PENDING COMPONENTS BREAKDOWN ---');
    breakdown.forEach(item => {
        console.log(`- [${item.ownerType}] ${item.ownerName}: ${item.pendingCount} pending`);
    });
    console.log(`\nTotal Pending Components Globally: ${totalGlobalPending}`);
}

main().catch(console.error);
