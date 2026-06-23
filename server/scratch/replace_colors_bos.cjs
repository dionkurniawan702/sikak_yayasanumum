const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', '..', 'src', 'pages', 'pelaporan', 'BOSMonthlyReport.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replace indigo classes with emerald classes
content = content.replace(/indigo/g, 'emerald');

// Replace blue classes with emerald/green classes in appropriate places
content = content.replace(/blue-600/g, 'emerald-600');
content = content.replace(/blue-700/g, 'emerald-700');
content = content.replace(/blue-500/g, 'emerald-500');
content = content.replace(/blue-50/g, 'emerald-50');
content = content.replace(/blue-200/g, 'emerald-200');

// Replace text occurrences of "Yayasan" in headers/labels to "BOS"
content = content.replace(/Laporan Pengeluaran Yayasan/g, 'Laporan Pengeluaran BOS');
content = content.replace(/Laporan Pengeluaran {sourceMode === 'BOS' \? 'BOS' : 'Yayasan'}/g, 'Laporan Pengeluaran BOS');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated color classes and labels in BOSMonthlyReport.jsx!');
