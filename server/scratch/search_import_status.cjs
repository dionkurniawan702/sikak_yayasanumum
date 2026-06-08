const fs = require('fs');
const content = fs.readFileSync('d:/SIKAK YAYASAN UMUM/src/pages/anggaran/RAB.jsx', 'utf8');

const lines = content.split('\n');

function printLinesAround(targetLine, before = 10, after = 30) {
    const start = Math.max(0, targetLine - before);
    const end = Math.min(lines.length - 1, targetLine + after);
    console.log(`=== Context around line ${targetLine} ===`);
    for (let i = start; i <= end; i++) {
        console.log(`${i + 1}: ${lines[i]}`);
    }
    console.log('\n');
}

// Lines identified from search:
// 2163: const handleFileUpload = async (e) => {
// 2315: const handleLocalFileUpload = (e, itemId) => {
printLinesAround(2163, 5, 40);
printLinesAround(2315, 5, 45);
