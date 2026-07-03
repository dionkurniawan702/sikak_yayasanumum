const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    try {
        console.log('Logging in as superadmin...');
        const loginRes = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'superadmin', password: 'admin123' })
        });
        const loginJson = await loginRes.json();
        const token = loginJson.data.token;

        console.log('Fetching all data...');
        const dataRes = await fetch(`${API_URL}/all-data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataJson = await dataRes.json();
        const state = dataJson.data;

        const rabPlans = state.rabPlans || [];
        console.log(`Total rabPlans received: ${rabPlans.length}`);

        const targetYearId = 'AY-ID-MO8GWIG3-JDK'; // "2026-2027"
        const yearPlans = rabPlans.filter(p => p.academicYearId === targetYearId);
        console.log(`Plans in 2026-2027: ${yearPlans.length}`);

        yearPlans.forEach(p => {
            const hasIncome = p.income && Object.keys(p.income).length > 0;
            const hasExpense = p.expense && Object.keys(p.expense).length > 0;
            console.log(`- Plan ID: ${p.id}, Unit: ${p.unitId}, Field: ${p.fieldId}, Status: ${p.status}, HasIncome: ${hasIncome}, HasExpense: ${hasExpense}`);
            if (hasExpense) {
                // Sum the total of expenses
                let total = 0;
                Object.values(p.expense).forEach(plans => {
                    const planArray = Array.isArray(plans) ? plans : [plans];
                    planArray.forEach(pl => {
                        total += parseFloat(pl.total || 0);
                    });
                });
                console.log(`  Total calculated expense: Rp ${total.toLocaleString('id-ID')}`);
            }
        });

    } catch (err) {
        console.error('Error:', err.message);
    }
}
main();
