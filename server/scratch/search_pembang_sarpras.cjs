const fs = require('fs');
const path = require('path');

function searchDir(dirPath, query) {
    const files = fs.readdirSync(dirPath);
    files.forEach(file => {
        const fullPath = path.join(dirPath, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
                searchDir(fullPath, query);
            }
        } else if (file.endsWith('.js') || file.endsWith('.cjs') || file.endsWith('.prisma') || file.endsWith('.sh') || file.endsWith('.json')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.toLowerCase().includes(query.toLowerCase())) {
                console.log(`Found "${query}" in: ${fullPath}`);
                const lines = content.split('\n');
                lines.forEach((line, idx) => {
                    if (line.toLowerCase().includes(query.toLowerCase())) {
                        console.log(`  Line ${idx+1}: ${line.trim()}`);
                    }
                });
            }
        }
    });
}

console.log('=== Searching for Pembangunan ===');
searchDir('d:/SIKAK YAYASAN UMUM/server', 'pembangunan');
searchDir('d:/SIKAK YAYASAN UMUM/server', '23dfc180-eccb-4e44-aace-702eab3705ed');

console.log('\n=== Searching for Sarpras ===');
searchDir('d:/SIKAK YAYASAN UMUM/server', 'sarana');
searchDir('d:/SIKAK YAYASAN UMUM/server', '7af86f5b-c9a8-4c14-9fd6-86a12e2a5c77');
searchDir('d:/SIKAK YAYASAN UMUM/server', 'sarpras');
