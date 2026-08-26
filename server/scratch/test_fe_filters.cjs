const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function main() {
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

    const reports = state.budgetReports || [];
    const requests = state.budgetRequests || [];
    const users = state.users || [];

    const tkit2User = users.find(u => u.username === 'tkit2');
    const myUnitId = tkit2User?.unitId || 'mo7z16fiq1hja';
    const globalAcademicYearId = 'AY-ID-MO8GWIG3-JDK';
    const sourceMode = 'YAYASAN'; // Default mode

    // 1. Check baseReports in MonthlyReport.jsx
    const baseReports = reports.filter(rel => {
        const isYear = rel.academicYearId === globalAcademicYearId;
        if (!isYear) return false;

        const isBosReport = rel.source === 'BOS' || rel.planId?.endsWith('-BOS');
        if (sourceMode === 'BOS' && !isBosReport) return false;
        if (sourceMode === 'YAYASAN' && isBosReport) return false;

        if (myUnitId) return rel.unitId === myUnitId;
        return false;
    });

    console.log(`Total baseReports for TKIT 2 (YAYASAN): ${baseReports.length}`);

    // Konsumsi Rapat reports in baseReports
    const konsumsiInBase = baseReports.filter(r => 
        r.category?.toLowerCase().includes('konsumsi rapat') || r.description?.toLowerCase().includes('konsumsi rapat') || r.description === 'sasad' || r.description === 'qwrwq'
    );
    console.log(`Konsumsi Rapat reports in baseReports: ${konsumsiInBase.length}`);
    konsumsiInBase.forEach(r => console.log(` - ${r.id} | ${r.status} | "${r.description}" | Amt: ${r.amount}`));

    // 2. Check draftReports in MonthlyReport.jsx
    const draftReports = reports.filter(rel => {
        const effectiveStatus = rel.status || (rel.id?.startsWith('REL-') ? 'DRAFT' : 'APPROVED');
        if (effectiveStatus !== 'DRAFT') return false;
        if (rel.academicYearId !== globalAcademicYearId) return false;
        if (myUnitId && rel.unitId !== myUnitId) return false;

        const isBosReport = rel.source === 'BOS' || rel.planId?.endsWith('-BOS');
        if (sourceMode === 'BOS' && !isBosReport) return false;
        if (sourceMode === 'YAYASAN' && isBosReport) return false;

        return true;
    });

    console.log(`\nTotal draftReports for TKIT 2 (YAYASAN): ${draftReports.length}`);
    const konsumsiInDrafts = draftReports.filter(r => 
        r.category?.toLowerCase().includes('konsumsi rapat') || r.description?.toLowerCase().includes('konsumsi rapat') || r.description === 'sasad' || r.description === 'qwrwq'
    );
    console.log(`Konsumsi Rapat in draftReports: ${konsumsiInDrafts.length}`);
    konsumsiInDrafts.forEach(r => console.log(` - ${r.id} | ${r.status} | "${r.description}" | Amt: ${r.amount}`));
}

main().catch(console.error);
