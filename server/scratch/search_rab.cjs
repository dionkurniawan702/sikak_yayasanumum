const fs = require('fs');
const path = require('path');

const filePath = 'd:/SIKAK YAYASAN UMUM/src/pages/anggaran/RAB.jsx';

function searchFile(pattern) {
    console.log(`Searching for "${pattern}"...`);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    let matchCount = 0;
    lines.forEach((line, index) => {
        if (line.toLowerCase().includes(pattern.toLowerCase())) {
            console.log(`${index + 1}: ${line.trim()}`);
            matchCount++;
            if (matchCount > 30) {
                console.log('... truncated ...');
                return;
            }
        }
    });
    console.log(`Found ${matchCount} matches.\n`);
}

searchFile('approve');
searchFile('status');
searchFile('submit');
