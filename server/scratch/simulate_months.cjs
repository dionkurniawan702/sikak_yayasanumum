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

        const { academicYears = [] } = state;
        const targetYearId = 'AY-ID-MO8GWIG3-JDK'; // "2026-2027"
        const currentYear = academicYears.find(y => y.id === targetYearId);

        console.log(`Current Year name: "${currentYear.name}", startDate: "${currentYear.startDate}", endDate: "${currentYear.endDate}"`);

        // Simulate yearMonths generation
        const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const months = [];
        if (currentYear.startDate && currentYear.endDate) {
            const start = new Date(currentYear.startDate);
            const end = new Date(currentYear.endDate);
            let current = new Date(start);
            let safetyCounter = 0;
            while (current <= end && safetyCounter < 24) {
                const year = current.getFullYear();
                const monthIdx = current.getMonth();
                const monthNum = monthIdx + 1;
                const shortYear = String(year).slice(-2);
                months.push({
                    id: `${year}-${String(monthNum).padStart(2, '0')}`,
                    label: `${monthNames[monthIdx]} '${shortYear}`,
                });
                current.setMonth(current.getMonth() + 1);
                safetyCounter++;
            }
        }
        if (months.length === 0) {
            const [startYearStr, endYearStr] = (currentYear.name || '').split((currentYear.name || '').includes('/') ? '/' : '-');
            const startYear = parseInt(startYearStr) || new Date().getFullYear();
            const endYear = parseInt(endYearStr) || (startYear + 1);

            const sequence = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];
            sequence.forEach((monthNum) => {
                const year = monthNum >= 7 ? startYear : endYear;
                const monthIdx = monthNum - 1;
                const shortYear = String(year).slice(-2);
                months.push({
                    id: `${year}-${String(monthNum).padStart(2, '0')}`,
                    label: `${monthNames[monthIdx]} '${shortYear}`,
                });
            });
        }

        console.log(`Generated yearMonths (${months.length}):`);
        months.forEach(m => console.log(`  - ID: ${m.id}, Label: ${m.label}`));

    } catch (err) {
        console.error('Error:', err.message);
    }
}
main();
