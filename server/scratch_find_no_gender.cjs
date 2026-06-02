// Script: cari siswa tanpa keterangan gender yang muncul di view superadmin
// Jalankan: node server/scratch_find_no_gender.cjs

const http = require('http');

const JWT_SECRET = 'sikad-dareliman-secret-2026';
const { sign } = require('crypto');

// Buat JWT token sederhana manual (tanpa library)
function base64url(str) {
  return Buffer.from(str).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function makeJwt(payload) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  const crypto = require('crypto');
  const sig = crypto.createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `${header}.${body}.${sig}`;
}

const token = makeJwt({
  id: 'superadmin_id',
  username: 'superadmin',
  role: 'superadmin',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 86400
});

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/all-data',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
};

console.log('Connecting to API...');

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(body);
      const students = json.data?.students || [];
      const units = json.data?.units || [];
      const classes = json.data?.classes || [];

      const unitMap = {};
      units.forEach(u => unitMap[u.id] = u.name);

      const classMap = {};
      classes.forEach(c => classMap[c.id] = c.name);

      // Siswa tanpa gender (sama dengan logika di StudentDatabase.jsx)
      const noGender = students.filter(s => {
        const g = (s.gender || '').toLowerCase().trim();
        return !['laki-laki', 'l', 'perempuan', 'p'].includes(g);
      });

      console.log(`\n=== SISWA TANPA KETERANGAN GENDER (${noGender.length} siswa) ===\n`);
      noGender.forEach((s, i) => {
        console.log(`${i + 1}. ${s.name}`);
        console.log(`   NIS      : ${s.nis || '-'}`);
        console.log(`   Unit     : ${unitMap[s.unitId] || s.unitId}`);
        console.log(`   Kelas    : ${classMap[s.classId] || '-'}`);
        console.log(`   Gender   : "${s.gender || ''}" (kosong/tidak dikenali)`);
        console.log(`   ID       : ${s.id}`);
        console.log('');
      });

      if (noGender.length === 0) {
        console.log('Tidak ada siswa tanpa keterangan gender!');
      }
    } catch (e) {
      console.error('Error parsing response:', e.message);
      console.error('Raw body (first 500):', body.substring(0, 500));
    }
  });
});

req.on('error', (e) => {
  console.error(`Error: ${e.message}`);
  console.error('Pastikan server backend sedang berjalan di port 5000');
});

req.end();
