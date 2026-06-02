import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'sikad-dareliman-secret-2026';
// Create a superadmin token
const token = jwt.sign(
    { id: 'superadmin_id', username: 'superadmin', role: 'superadmin' },
    JWT_SECRET,
    { expiresIn: '24h' }
);

async function main() {
    const res = await fetch('http://localhost:5000/api/all-data', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const { data } = await res.json();
    
    console.log("=== UNITS ===");
    const sditUnits = data.units.filter(u => u.name.toLowerCase().includes('sdit 3'));
    console.log(sditUnits);
    
    console.log("\n=== STUDENTS IN SDIT 3 ===");
    for (const unit of sditUnits) {
        const count = data.students.filter(s => s.unitId === unit.id).length;
        console.log(`Unit ID ${unit.id} (${unit.name}): ${count} students`);
    }
}

main().catch(console.error);
