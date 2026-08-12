const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    try {
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

        const { budgetRequests = [], budgetReports = [], units = [], globalAcademicYearId } = state;
        const taudUnit = units.find(u => u.name && u.name.toUpperCase().includes('TAUD'));

        console.log('globalAcademicYearId:', globalAcademicYearId);

        const sampleReport = budgetReports.find(r => r.unitId === taudUnit.id);
        console.log('Sample TAUD Report academicYearId:', sampleReport?.academicYearId);
        console.log('Sample TAUD Request academicYearId:', budgetRequests.find(r => r.unitId === taudUnit.id)?.academicYearId);

    } catch (err) {
        console.error(err);
    }
}

main();
