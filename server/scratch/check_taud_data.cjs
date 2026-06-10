const jwt = require('jsonwebtoken');

const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';
const JWT_SECRET = 'sikad-dareliman-secret-2026';

async function main() {
    try {
        console.log('Signing superadmin JWT token...');
        const token = jwt.sign(
            { id: 'USR-default-superadmin-id-fallback', username: 'adminsdit1', role: 'superadmin' },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        console.log('Fetching all-data from live API...');
        const res = await fetch(`${API_URL}/all-data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) {
            console.error(`Fetch failed: ${res.status}`);
            return;
        }
        
        const json = await res.json();
        const state = json.data;
        const rabPlans = state.rabPlans || [];
        const units = state.units || [];
        
        const unit = units.find(u => u.name.includes('TAUD'));
        if (!unit) {
            console.log('TAUD Unit not found');
            return;
        }
        
        console.log(`TAUD Unit ID: ${unit.id}, Name: ${unit.name}`);
        
        const plans = rabPlans.filter(p => p.unitId === unit.id);
        console.log(`Found ${plans.length} RAB Plans for TAUD on the server:`);
        
        for (let p of plans) {
            console.log(`- Plan ID: ${p.id}`);
            console.log(`  Status: ${p.status}`);
            console.log(`  Updated At: ${p.updatedAt}`);
            console.log(`  Rejection Reason: ${p.rejectionReason}`);
            
            let componentCount = 0;
            let approvedComponentCount = 0;
            let pendingComponentCount = 0;
            let rejectedComponentCount = 0;
            let draftComponentCount = 0;

            const expense = p.expense || {};
            
            Object.entries(expense).forEach(([itemId, rawItemPlans]) => {
                const itemPlans = Array.isArray(rawItemPlans) ? rawItemPlans : [rawItemPlans];
                itemPlans.forEach(ip => {
                    if (ip && ip.components) {
                        ip.components.forEach(comp => {
                            componentCount++;
                            const status = comp.status || (comp.isApproved ? 'APPROVED' : 'PENDING');
                            if (status === 'APPROVED') approvedComponentCount++;
                            else if (status === 'PENDING') pendingComponentCount++;
                            else if (status === 'REJECTED') rejectedComponentCount++;
                            else draftComponentCount++;
                        });
                    }
                });
            });
            
            console.log(`  Total Components: ${componentCount}`);
            console.log(`  Approved Components: ${approvedComponentCount}`);
            console.log(`  Pending Components: ${pendingComponentCount}`);
            console.log(`  Rejected Components: ${rejectedComponentCount}`);
            console.log(`  Draft Components: ${draftComponentCount}`);
        }
    } catch (e) {
        console.error('ERROR:', e.message);
    }
}
main();
