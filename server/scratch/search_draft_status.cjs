const fs = require('fs');
const content = fs.readFileSync('d:/SIKAK YAYASAN UMUM/src/pages/anggaran/RAB.jsx', 'utf8');

const lines = content.split('\n');

lines.forEach((line, index) => {
    if (line.includes("'DRAFT'") || line.includes('"DRAFT"')) {
        console.log(`${index + 1}: ${line.trim()}`);
    }
});
