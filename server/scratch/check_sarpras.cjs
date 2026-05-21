const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function fetchData(endpoint) {
  const res = await fetch(`${API_URL}${endpoint}`);
  if (!res.ok) throw new Error(`Failed to fetch ${endpoint}: ${res.statusText}`);
  const json = await res.json();
  return Array.isArray(json) ? json : (json.data || Object.values(json)[0]);
}

async function main() {
  try {
    const fields = await fetchData('/fields');
    const sarpras = fields.find(f => f.name.toLowerCase().includes('sarana prasarana'));
    console.log("Sarpras Field ID:", sarpras?.id);

    const distributionSettings = await fetchData('/distribution-settings');
    const sarprasRules = distributionSettings.filter(d => d.destId === sarpras?.id);
    
    console.log("\nDistribution Settings targeting Sarpras:");
    const units = await fetchData('/units');
    const expenseItems = await fetchData('/expense-items');
    sarprasRules.forEach(d => {
        const unitName = units.find(u => u.id === d.unitId)?.name || d.unitId;
        const exName = expenseItems.find(e => e.id === d.expenseItemId)?.name || d.expenseItemId;
        console.log(`From Unit ${unitName} -> ExpenseItem: ${exName} (${d.expenseItemId}), Percent: ${d.percentage}%`);
    });

  } catch (error) {
    console.error(error);
  }
}

main();
