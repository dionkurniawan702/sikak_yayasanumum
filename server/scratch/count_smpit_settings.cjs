const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    try {
        const loginRes = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'adminpdk', password: 'admin123' })
        });
        const loginJson = await loginRes.json();
        const token = loginJson.data.token;

        const dataRes = await fetch(`${API_URL}/all-data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataJson = await dataRes.json();
        const state = dataJson.data;

        const units = state.units || [];
        const smpit50 = units.find(u => u.name && (u.name.toUpperCase().includes('50 KOTA') || u.name.toUpperCase().includes('5O KOTA')));
        if (!smpit50) {
            console.log('SMPIT 50 Kota not found!');
            return;
        }

        console.log(`SMPIT 50 KOTA ID: ${smpit50.id}`);
        const distSettings = state.distributionSettings || [];
        const smpitSettings = distSettings.filter(s => s.unitId === smpit50.id);

        const counts = {};
        smpitSettings.forEach(s => {
            const yearName = state.academicYears.find(y => y.id === s.academicYearId)?.name || s.academicYearId || 'unknown';
            counts[yearName] = (counts[yearName] || 0) + 1;
        });

        console.log('\n=== SMPIT 50 KOTA DISTRIBUTION SETTINGS COUNT BY YEAR ===');
        console.log(counts);

    } catch (e) {
        console.error(e);
    }
}

main();
