const XLSX = require('xlsx');
const path = require('path');

const excelPath = path.join(__dirname, '..', 'Comps for 25-26 Performances.xlsx');
console.log('Reading:', excelPath);

try {
  const workbook = XLSX.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Get the range
  const range = XLSX.utils.decode_range(sheet['!ref']);
  console.log(`\nSheet: "${sheetName}"`);
  console.log(`Range: ${range.s.r} to ${range.e.r} rows, ${range.s.c} to ${range.e.c} columns`);
  console.log(`Total rows: ${range.e.r + 1}`);
  console.log('');

  // Show first 20 rows
  console.log('First 20 rows (columns A-H):');
  console.log('='.repeat(120));
  for (let row = 0; row < Math.min(20, range.e.r + 1); row++) {
    const rowData = [];
    for (let col = 0; col <= Math.min(7, range.e.c); col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = sheet[cellAddress];
      const value = cell ? (cell.v || '').toString() : '';
      rowData.push(value.substring(0, 15).padEnd(15));
    }
    console.log(`${String(row + 1).padStart(3)}: ${rowData.join(' | ')}`);
  }

  // Count data rows (skip headers/notes, start at row 15 = index 14)
  let dataRows = 0;
  const performances = new Set();

  for (let row = 14; row <= range.e.r; row++) {
    const cellA = sheet[XLSX.utils.encode_cell({ r: row, c: 0 })];
    const cellC = sheet[XLSX.utils.encode_cell({ r: row, c: 2 })];
    if (cellA && cellA.v && cellC && cellC.v) {
      dataRows++;
      performances.add(cellA.v.toString());
    }
  }

  console.log('\n' + '='.repeat(120));
  console.log(`📊 SUMMARY:`);
  console.log(`   Total data rows (row 15+): ${dataRows}`);
  console.log(`   Unique performances: ${performances.size}`);
  console.log(`   Performances: ${Array.from(performances).sort().join(', ')}`);

} catch (error) {
  console.error('Error reading Excel file:', error.message);
  process.exit(1);
}
