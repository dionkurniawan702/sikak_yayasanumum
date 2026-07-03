const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
    try {
        const loginRes = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'superadmin', password: 'admin123' })
        });
        const loginJson = await loginRes.json();
        const token = loginJson.data.token;

        const dataRes = await fetch(`${API_URL}/all-data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataJson = await dataRes.json();
        const state = dataJson.data;

        const rabPlans = state.rabPlans || [];
        const testPlan = rabPlans.find(p => p.academicYearId === 'AY-ID-MO8GWIG3-JDK' && p.unitId === 'mo7xk4tfhzmqk'); // SDIT 2
        
        if (testPlan) {
            console.log('--- SDIT 2 Plan ---');
            console.log('ID:', testPlan.id);
            const expenseKeys = Object.keys(testPlan.expense || {});
            console.log('Expense Keys (first 5):', expenseKeys.slice(0, 5));
            if (expenseKeys.length > 0) {
                const sampleValue = testPlan.expense[expenseKeys[0]];
                console.log('Type of expense value:', typeof sampleValue);
                console.log('Is Array?', Array.isArray(sampleValue));
                console.log('Sample Value:', JSON.stringify(sampleValue, null, 2));
            }
        } else {
            console.log('No test plan found.');
        }

    } catch (err) {
        console.error('Error:', err.message);
    }
}
main();
