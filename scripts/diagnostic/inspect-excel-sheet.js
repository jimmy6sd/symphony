// Inspect a specific sheet in detail
// Run with: node scripts/diagnostic/inspect-excel-sheet.js "FY26" "2025.08.18 FY26 Ticket Sales Report.xlsx" "Summary (Draft)"

require('dotenv').config();
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data/YTD-Comp-Data');

const fy = process.argv[2] || 'FY26';
const filename = process.argv[3] || '2025.08.18 FY26 Ticket Sales Report.xlsx';
const sheetName = process.argv[4] || 'Summary (Draft)';

const filePath = path.join(DATA_DIR, fy, filename);

if (!fs.existsSync(filePath)) {
  console.log(`File not found: ${filePath}`);
  process.exit(1);
}

const workbook = XLSX.readFile(filePath);

console.log(`\nFile: ${filename}`);
console.log(`Available sheets: ${workbook.SheetNames.join(', ')}\n`);

if (!workbook.Sheets[sheetName]) {
  console.log(`Sheet "${sheetName}" not found. Available: ${workbook.SheetNames.join(', ')}`);
  process.exit(1);
}

const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

console.log(`Sheet: "${sheetName}" - ${data.length} rows\n`);
console.log('Full sheet contents:');
console.log('='.repeat(120));

data.forEach((row, i) => {
  // Format each cell, truncating long values
  const formatted = row.map((cell, j) => {
    let val = cell;
    if (typeof val === 'number') {
      val = val.toLocaleString();
    }
    val = String(val || '').substring(0, 18).padEnd(18);
    return `[${j}]${val}`;
  }).join(' ');

  console.log(`Row ${(i + 1).toString().padStart(3)}: ${formatted}`);
});

console.log('\n' + '='.repeat(120));
