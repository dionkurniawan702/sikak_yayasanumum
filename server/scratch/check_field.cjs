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
    const targetField = fields.find(f => f.id === '194b211f-fb5a-44bd-934e-675e4aa21311');
    console.log("Target Field:", targetField ? targetField.name : "Not found");
  } catch (error) {
    console.error(error);
  }
}

main();
