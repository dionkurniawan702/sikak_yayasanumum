const API_URL = 'https://dion-sikak-yayasanumum.0oh83a.easypanel.host/api';

async function fetchData(endpoint) {
  const res = await fetch(`${API_URL}${endpoint}`);
  const json = await res.json();
  return Array.isArray(json) ? json : (json.data || Object.values(json)[0]);
}

async function main() {
    const fields = await fetchData('/fields');
    const validFields = fields.filter(f => !f.isDeleted);
    console.log("fields[0]:", validFields[0]?.name, "ID:", validFields[0]?.id);
}
main();
