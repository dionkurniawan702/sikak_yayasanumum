const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function fetchData(endpoint) {
  const res = await fetch(`${API_URL}${endpoint}`);
  const json = await res.json();
  return Array.isArray(json) ? json : (json.data || Object.values(json)[0]);
}

async function main() {
  try {
    const fields = await fetchData('/fields');
    const sarpras = fields.find(f => f.name.toLowerCase().includes('sarana prasarana'));
    
    const distributionSettings = await fetchData('/distribution-settings');
    const sarprasRules = distributionSettings.filter(d => d.destId === sarpras?.id);
    
    const expenseItems = await fetchData('/expense-items');
    const summary = {};
    
    sarprasRules.forEach(d => {
        const exName = expenseItems.find(e => e.id === d.expenseItemId)?.name || d.expenseItemId;
        if (!summary[exName]) summary[exName] = 0;
        summary[exName]++;
    });

    console.log("Expense Items targeted to Sarpras:");
    for (const [name, count] of Object.entries(summary)) {
        console.log(`- ${name}: ${count} rules`);
    }

  } catch (error) {
    console.error(error);
  }
}

main();
