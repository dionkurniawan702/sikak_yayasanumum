const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    try {
        console.log('Logging in to retrieve token...');
        const loginRes = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'adminpdk', password: 'admin123' })
        });
        const loginJson = await loginRes.json();
        if (!loginJson.data) {
            console.error('Login failed!', loginJson);
            return;
        }
        const token = loginJson.data.token;

        console.log('Fetching all remote data...');
        const dataRes = await fetch(`${API_URL}/all-data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataJson = await dataRes.json();
        const state = dataJson.data;

        // Find SMPIT Unit
        const units = state.units || [];
        const smpitUnit = units.find(u => u.name && u.name.toUpperCase().includes('SMPIT'));
        if (!smpitUnit) {
            console.log('SMPIT Unit not found! Available units:', units.map(u => u.name));
            return;
        }
        console.log(`\n=== UNIT FOUND ===`);
        console.log(`ID: ${smpitUnit.id}`);
        console.log(`Name: ${smpitUnit.name}`);

        console.log(`\n=== ALL UNITS ===`);
        console.table(units.map(u => ({ id: u.id, name: u.name })));

        const smpit50 = units.find(u => u.name && (u.name.toUpperCase().includes('50 KOTA') || u.name.toUpperCase().includes('5O KOTA')));
        if (smpit50) {
            console.log(`\n=== SMPIT 50 KOTA FOUND ===`);
            console.log(`ID: ${smpit50.id}`);
            const distSettings = state.distributionSettings || [];
            const smpitDistSettings = distSettings.filter(s => s.unitId === smpit50.id);
            const donatorSettings = smpitDistSettings.filter(s => s.incomeItemId === 'INC-ID-MQEN2SZS-X0G');
            console.log(`\n=== DISTRIBUTION SETTINGS FOR SMPIT 50 KOTA ===`);
            console.log(`Total settings for this unit: ${smpitDistSettings.length}`);
            console.log(`\n=== DONATOR SETTINGS FOR SMPIT 5O KOTA ===`);
            console.log(JSON.stringify(donatorSettings, null, 2));
        }

        console.log(`\n=== ALL ACADEMIC YEARS ===`);
        console.table(state.academicYears.map(y => ({ id: y.id, name: y.name, isCurrent: y.isCurrent, isActive: y.isActive })));

    } catch (e) {
        console.error(e);
    }
}

main();
