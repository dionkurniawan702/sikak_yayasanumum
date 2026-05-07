const ExcelJS = require('exceljs');
const XLSX = require('xlsx');

async function test() {
    // Generate file
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet(`Rincian Test`);
    const monthsOptions = [{id: 'm1', name: 'Jan'}, {id: 'm2', name: 'Feb'}];
    const columns = [
        { header: 'Keterangan', key: 'keterangan', width: 40 },
        { header: 'Program Belanja', key: 'program', width: 30 },
        { header: 'Semester', key: 'semester', width: 15 },
        { header: 'Vol', key: 'vol', width: 10 },
        { header: 'Satuan', key: 'satuan', width: 15 },
        { header: 'Kali', key: 'kali', width: 10 },
        { header: 'Harga', key: 'harga', width: 20 }
    ];
    monthsOptions.forEach(m => columns.push({ header: m.name, key: m.name, width: 15 }));
    ws.columns = columns;

    const rowData = { keterangan: 'Contoh', program: '', semester: 1, vol: 1, satuan: 'Pcs', kali: 1, harga: 100000 };
    monthsOptions.forEach(m => rowData[m.name] = 0);
    ws.addRow(rowData);

    for(let i=0; i<3; i++) {
         const emptyRow = { keterangan: '', program: '', semester: '', vol: '', satuan: '', kali: '', harga: '' };
         monthsOptions.forEach(m => emptyRow[m.name] = '');
         ws.addRow(emptyRow);
    }
    await workbook.xlsx.writeFile('test.xlsx');

    // Read and Process
    const wb = XLSX.readFile('test.xlsx');
    const wsName = wb.SheetNames[0];
    const data = XLSX.utils.sheet_to_json(wb.Sheets[wsName]);
    const allPrograms = []; // Try with empty allPrograms first
    
    // Simulating RAB.jsx logic
    const newComponents = data.map((row, idx) => {
        const months = {};
        const rowKeys = Object.keys(row);
        monthsOptions.forEach(m => {
            const exactKey = rowKeys.find(k => k.trim().toLowerCase() === m.name.toLowerCase());
            const val = exactKey ? (parseFloat(row[exactKey]) || 0) : 0;
            months[m.id] = { m: val > 0, jumlah: val };
        });

        const volKey = rowKeys.find(k => k.trim().toLowerCase() === 'vol') || 'Vol';
        const kaliKey = rowKeys.find(k => k.trim().toLowerCase() === 'kali') || 'Kali';
        const hargaKey = rowKeys.find(k => k.trim().toLowerCase() === 'harga') || 'Harga';
        const ketKey = rowKeys.find(k => k.trim().toLowerCase() === 'keterangan') || 'Keterangan';
        const progKey = rowKeys.find(k => k.trim().toLowerCase() === 'program belanja') || 'Program Belanja';
        const semKey = rowKeys.find(k => k.trim().toLowerCase() === 'semester') || 'Semester';

        const vol = parseFloat(row[volKey]) || 0;
        const kali = parseFloat(row[kaliKey]) || 1;
        const harga = parseFloat(row[hargaKey]) || 0;
        const total = vol * kali * harga;

        return {
            id: `C-${Date.now()}-${idx}`,
            label: row[ketKey] || '',
            volume: vol,
            satuan: row['Satuan'] || '',
            kali: kali,
            harga: harga,
            total: total,
            programId: allPrograms.find(p => p.name.trim().toLowerCase() === (row[progKey]?.toString() || '').trim().toLowerCase())?.id || null,
            semester: (row[semKey]?.toString() || '1'),
            months: months
        };
    }).filter(comp => {
        const hasLabel = comp.label && comp.label.trim() !== '';
        const hasTotal = comp.total > 0;
        const hasProgram = comp.programId !== null;
        console.log("Filter values:", {hasLabel, hasTotal, hasProgram, comp});
        return hasLabel || hasTotal || hasProgram;
    });

    console.log("New components:", newComponents);
}

test();
