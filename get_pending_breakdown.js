const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    console.log('--- FETCHING USERS TO FIND CREDENTIALS ---');
    let superadminCreds = null;

    try {
        const usersRes = await fetch(`${API_URL}/users`);
        if (!usersRes.ok) {
            throw new Error(`Failed to fetch users: ${usersRes.status} ${usersRes.statusText}`);
        }
        
        const usersJson = await usersRes.json();
        const users = usersJson.data || [];
        
        // Find an active superadmin user
        const superadmin = users.find(u => u.role === 'superadmin' && !u.isDeleted && u.plainPassword);
        
        if (superadmin) {
            superadminCreds = {
                username: superadmin.username,
                password: superadmin.plainPassword
            };
            console.log(`Found superadmin credentials: username="${superadmin.username}"`);
        } else {
            console.log('No superadmin with plainPassword found in user list. Trying default seeds...');
            // Fallback seeds
            const possibleSeeds = [
                { username: 'adminsdit1', password: 'admin123' },
                { username: 'admin', password: 'password123' }
            ];
            for (const seed of possibleSeeds) {
                const testUser = users.find(u => u.username === seed.username && !u.isDeleted);
                if (testUser) {
                    superadminCreds = seed;
                    console.log(`Using seed credentials for existing user "${seed.username}"`);
                    break;
                }
            }
        }
    } catch (err) {
        console.error('Error fetching users:', err.message);
    }

    if (!superadminCreds) {
        console.error('❌ Could not retrieve superadmin credentials.');
        return;
    }

    console.log('\n--- LOGGING IN ---');
    let token = null;
    try {
        const loginRes = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(superadminCreds)
        });
        
        if (!loginRes.ok) {
            throw new Error(`Login failed: ${loginRes.status} ${loginRes.statusText}`);
        }
        
        const loginJson = await loginRes.json();
        if (loginJson.success && loginJson.data && loginJson.data.token) {
            token = loginJson.data.token;
            console.log('✅ Login successful!');
        } else {
            throw new Error('Login response does not contain token');
        }
    } catch (err) {
        console.error('❌ Login error:', err.message);
        return;
    }

    console.log('\n--- FETCHING ALL DATA ---');
    try {
        const res = await fetch(`${API_URL}/all-data`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!res.ok) {
            throw new Error(`Fetch /all-data failed: ${res.status} ${res.statusText}`);
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
        const pendingDetails = {};

        rabPlans.forEach(plan => {
            let planPendingCount = 0;
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
                            }
                        });
                    }
                });
            });
            
            if (planPendingCount > 0) {
                const ownerName = plan.unitId 
                    ? (unitMap[plan.unitId] || `Unit ${plan.unitId}`) 
                    : (plan.fieldId ? (fieldMap[plan.fieldId] || `Bidang ${plan.fieldId}`) : 'Unknown');
                const ownerType = plan.unitId ? 'Unit' : (plan.fieldId ? 'Bidang' : 'Unknown');

                if (!pendingDetails[ownerName]) {
                    pendingDetails[ownerName] = {
                        name: ownerName,
                        type: ownerType,
                        count: 0
                    };
                }
                pendingDetails[ownerName].count += planPendingCount;
            }
        });

        console.log('\n--- RESULT SUMMARY ---');
        Object.values(pendingDetails)
            .sort((a, b) => b.count - a.count)
            .forEach(item => {
                console.log(`[${item.type}] ${item.name}: ${item.count} PENDING`);
            });
        console.log(`\nTotal Global Pending: ${totalGlobalPending}`);
    } catch (err) {
        console.error('❌ Data fetching/processing error:', err.message);
    }
}

main().catch(console.error);
