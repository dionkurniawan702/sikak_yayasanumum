const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    const loginRes = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'adminpdk', password: 'admin123' })
    });
    const loginJson = await loginRes.json();
    const token = loginJson.data?.token;

    const dataRes = await fetch(`${API_URL}/all-data`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const dataJson = await dataRes.json();
    const state = dataJson.data;

    const { budgetRequests = [] } = state;
    
    const reqJuly = budgetRequests.find(r => r.id === 'REQ-MROG905F-B56');
    console.log('=== JULY REQUEST DETAILS (REQ-MROG905F-B56) ===');
    console.log(`Month: ${reqJuly?.month}`);
    console.log(`TotalAmount: ${reqJuly?.totalAmount}`);
    console.log(`Description: ${reqJuly?.description}`);
    console.log('Items in REQ-MROG905F-B56:');
    (reqJuly?.items || []).forEach(i => {
        console.log(` - ${i.name}: Rp ${parseFloat(i.amount).toLocaleString('id-ID')} (ComponentId: ${i.componentId})`);
    });

    const reqJune = budgetRequests.find(r => r.id === 'REQ-MQERNJL9-GNQ');
    console.log('\n=== JUNE REQUEST DETAILS (REQ-MQERNJL9-GNQ) ===');
    console.log(`Month: ${reqJune?.month}`);
    console.log(`TotalAmount: ${reqJune?.totalAmount}`);
    console.log(`Description: ${reqJune?.description}`);
    console.log('Items in REQ-MQERNJL9-GNQ:');
    (reqJune?.items || []).forEach(i => {
        console.log(` - ${i.name}: Rp ${parseFloat(i.amount).toLocaleString('id-ID')} (ComponentId: ${i.componentId})`);
    });
}

main();
