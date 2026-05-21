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
    console.log("Fields (first 3):", fields.slice(0, 3));
    
    const expenseItemsRaw = await fetchData('/expense-items');
    const expenseItems = expenseItemsRaw.filter(e => 
      !e.isDeleted && (e.name.toLowerCase().includes('penggajian') || e.name.toLowerCase().includes('pengembangan'))
    );
    console.log("\nExpense Items:");
    expenseItems.forEach(e => console.log(`${e.id} - ${e.name} (fieldId: ${e.fieldId}, unitId: ${e.unitId})`));

    const distributionSettings = await fetchData('/distribution-settings');
    const expenseItemIds = expenseItems.map(e => e.id);
    const filteredSettings = distributionSettings.filter(d => expenseItemIds.includes(d.expenseItemId));
    
    console.log("\nDistribution Settings targeting those expense items:");
    const units = await fetchData('/units');
    filteredSettings.forEach(d => {
        const unitName = units.find(u => u.id === d.unitId)?.name || d.unitId;
        console.log(`From Unit ${unitName} -> DestType: ${d.destType}, DestId: ${d.destId}, ExpenseItem: ${d.expenseItemId}, Percent: ${d.percentage}%`);
    });

  } catch (error) {
    console.error(error);
  }
}

main();
