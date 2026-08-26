process.env.DATABASE_URL = "mysql://mysql:7dff32cee8db81c86c80@127.0.0.1:3306/dion";
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Connecting to Prisma DB to update RET-MRCU432Q...');
    const res = await prisma.budgetReport.update({
        where: { id: 'RET-MRCU432Q' },
        data: { amount: '24814722' }
    });
    console.log('Successfully updated RET-MRCU432Q amount in DB:', res.id, res.amount);

    // Also update remote server if needed via simple PUT or POST
    const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';
    const loginRes = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'adminpdk', password: 'admin123' })
    });
    const loginJson = await loginRes.json();
    const token = loginJson.data?.token;

    if (token) {
        const dataRes = await fetch(`${API_URL}/all-data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataJson = await dataRes.json();
        const state = dataJson.data;
        const reports = state.budgetReports || [];
        const ret = reports.find(r => r.id === 'RET-MRCU432Q');
        if (ret) {
            ret.amount = '24814722';
            await fetch(`${API_URL}/sync-whole-state`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ state: { ...state, budgetReports: reports } })
            });
            console.log('Remote state updated successfully as well!');
        }
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
