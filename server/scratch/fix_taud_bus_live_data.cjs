const jwt = require('jsonwebtoken');

const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';
const JWT_SECRET = 'sikad-dareliman-secret-2026';

async function main() {
    try {
        console.log('Generating superadmin token...');
        const token = jwt.sign(
            { id: 'USR-default-superadmin-id-fallback', username: 'adminsdit1', role: 'superadmin' },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        console.log('Fetching remote state from server...');
        const dataRes = await fetch(`${API_URL}/all-data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!dataRes.ok) {
            console.error('Fetch all-data failed:', dataRes.status);
            return;
        }

        const dataJson = await dataRes.json();
        const state = dataJson.data;
        const { budgetRequests = [], budgetReports = [], units = [] } = state;

        const taudUnit = units.find(u => u.name && u.name.toUpperCase().includes('TAUD'));
        if (!taudUnit) {
            console.error('TAUD Unit not found');
            return;
        }

        console.log(`TAUD Unit ID: ${taudUnit.id}`);

        // Find TAUD requests that contain Bus items
        const taudReqs = budgetRequests.filter(r => r.unitId === taudUnit.id && !r.isDeleted);
        let busReq = null;
        let busItems = [];

        for (let r of taudReqs) {
            const items = (r.items || []).filter(i => (i.name || '').trim().toLowerCase().includes('bus'));
            if (items.length > 0) {
                busReq = r;
                busItems = r.items;
                break;
            }
        }

        if (!busReq) {
            console.log('No budget request with Bus items found for TAUD.');
            return;
        }

        console.log(`Found Request [${busReq.id}] with ${busItems.length} items for TAUD.`);

        // Ensure distinct componentId for each item in busReq
        const updatedBusItems = busReq.items.map((item, idx) => {
            const compId = item.componentId || item.id || `COMP-${busReq.id}-BUS-${idx}`;
            return {
                ...item,
                componentId: compId
            };
        });

        const updatedRequests = budgetRequests.map(r => {
            if (r.id === busReq.id) {
                return {
                    ...r,
                    items: updatedBusItems
                };
            }
            return r;
        });

        // Find active/approved/pending reports for TAUD with Bus category or description
        const busReports = budgetReports.filter(r => {
            if (r.unitId !== taudUnit.id || r.isDeleted || r.status === 'REJECTED') return false;
            const cat = (r.category || r.description || '').trim().toLowerCase();
            return cat.includes('bus') || r.budgetRequestId === busReq.id || r.requestId === busReq.id;
        });

        console.log(`Found ${busReports.length} reports related to Bus for TAUD:`);
        busReports.forEach((r, idx) => {
            console.log(`  Report [${idx}] ID: ${r.id}, amount: ${r.amount}, desc: "${r.description}"`);
        });

        // Distribute reports across the distinct item componentIds:
        // Item 0: RAB 500k -> gets reports up to 500k
        // Item 1: RAB 250k -> gets reports up to 250k
        // Item 2: RAB 500k -> gets remaining reports
        const compIds = updatedBusItems.map(i => i.componentId);
        const itemBudgets = updatedBusItems.map(i => parseFloat(i.amount || 0));

        let currentItemIdx = 0;
        let currentItemAllocated = 0;

        const updatedReportsMap = new Map();

        busReports.forEach((r) => {
            const amt = parseFloat(r.amount || 0);
            
            // Check if current item has enough room for this report
            if (currentItemIdx < itemBudgets.length - 1 && currentItemAllocated + amt > itemBudgets[currentItemIdx]) {
                // Advance to next item
                currentItemIdx++;
                currentItemAllocated = 0;
            }

            const targetCompId = compIds[currentItemIdx] || compIds[compIds.length - 1];
            currentItemAllocated += amt;

            console.log(`Assigning Report [${r.id}] (Rp ${amt}) to Item ${currentItemIdx} (${targetCompId})`);

            updatedReportsMap.set(r.id, {
                ...r,
                budgetRequestId: busReq.id,
                requestId: busReq.id,
                componentId: targetCompId
            });
        });

        const updatedBudgetReports = budgetReports.map(r => updatedReportsMap.get(r.id) || r);

        const newState = {
            ...state,
            budgetRequests: updatedRequests,
            budgetReports: updatedBudgetReports
        };

        console.log('\nSyncing updated state to live remote server...');
        const syncRes = await fetch(`${API_URL}/sync-state`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ state: newState })
        });

        const syncJson = await syncRes.json();
        console.log('Sync status:', syncJson.success ? 'SUCCESS! ✅' : syncJson);

    } catch (err) {
        console.error('Error:', err.message);
    }
}

main();
