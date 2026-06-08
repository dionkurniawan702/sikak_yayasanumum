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

        // Fetch audit logs
        console.log('Fetching audit logs...');
        const logRes = await fetch(`${API_URL}/audit-logs`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!logRes.ok) {
            console.error('Failed to fetch audit logs:', logRes.status, await logRes.text());
            return;
        }

        const logJson = await logRes.json();
        const logs = logJson.data || [];
        console.log(`Retrieved ${logs.length} audit logs.`);

        // Filter logs related to RAB plans or fields Pembangunan/Sarpras
        const relevantLogs = logs.filter(log => 
            (log.action && log.action.includes('RAB')) || 
            (log.details && (log.details.includes('23dfc180') || log.details.includes('7af86f5b') || log.details.includes('pbg') || log.details.includes('sarpras')))
        );

        console.log(`\n=== Relevant Audit Logs (${relevantLogs.length} found) ===`);
        relevantLogs.forEach(log => {
            console.log(`- Timestamp: ${log.timestamp || log.createdAt}
  User: ${log.user || log.username}
  Action: ${log.action}
  Details: ${log.details}`);
        });

    } catch (err) {
        console.error('Error:', err.message);
    }
}
main();
