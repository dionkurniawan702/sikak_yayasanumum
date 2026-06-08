const fs = require('fs');

const filePath = 'd:/SIKAK YAYASAN UMUM/src/pages/anggaran/RAB.jsx';
const content = fs.readFileSync(filePath, 'utf8');

function searchAround(pattern, contextLines = 20) {
    console.log(`Searching for "${pattern}"...`);
    const lines = content.split('\n');
    lines.forEach((line, index) => {
        if (line.toLowerCase().includes(pattern.toLowerCase())) {
            console.log(`=== Match on line ${index + 1} ===`);
            const start = Math.max(0, index - contextLines);
            const end = Math.min(lines.length - 1, index + contextLines);
            for (let i = start; i <= end; i++) {
                console.log(`${i + 1}: ${lines[i]}`);
            }
            console.log('\n');
        }
    });
}

searchAround('status: \'APPROVED\'', 5);
searchAround('status: \'PENDING\'', 5);
searchAround('isApproved: true', 5);
