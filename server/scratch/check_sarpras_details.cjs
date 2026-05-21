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
    const units = await fetchData('/units');
    const incomeItems = await fetchData('/income-items');

    console.log("Details for Pengembangan dan Pelatihan & Penggajian targeted to Sarpras:\n");
    
    sarprasRules.forEach(d => {
        const exName = expenseItems.find(e => e.id === d.expenseItemId)?.name || '';
        if (exName.toLowerCase().includes('penggajian') || exName.toLowerCase().includes('pengembangan')) {
            const unitName = units.find(u => u.id === d.unitId)?.name || 'Unknown Unit';
            const incName = incomeItems.find(i => i.id === d.incomeItemId)?.name || 'Unknown Income';
            console.log(`- Dari Unit: ${unitName}`);
            console.log(`  Sumber Pendapatan: ${incName}`);
            console.log(`  Dialokasikan ke: ${exName} (${d.percentage}%)\n`);
        }
    });

  } catch (error) {
    console.error(error);
  }
}

main();
