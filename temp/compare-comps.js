const XLSX = require('xlsx');
const path = require('path');

// Excel file performances
const excelPath = path.join(__dirname, '..', 'Comps for 25-26 Performances.xlsx');
const workbook = XLSX.readFile(excelPath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const range = XLSX.utils.decode_range(sheet['!ref']);

const excelPerformances = new Set();
for (let row = 14; row <= range.e.r; row++) {
  const cellA = sheet[XLSX.utils.encode_cell({ r: row, c: 0 })];
  const cellC = sheet[XLSX.utils.encode_cell({ r: row, c: 2 })];
  if (cellA && cellA.v && cellC && cellC.v) {
    excelPerformances.add(cellA.v.toString());
  }
}

// Database performances (from previous query)
const dbPerformances = new Set([
  '251031E', '251101E', '251102M', '251109M', '251121E', '251122E', '251123M',
  '251128E', '251129AM', '251129BE', '251130M', '251205E', '251206E', '251207M',
  '251212E', '251213E', '251218E', '251219E', '251220AM', '251220BE', '251221AM',
  '251221BE', '251223E', '251224M', '260109E', '260110E', '260111M', '260116E',
  '260117E', '260118M', '260122E', '260123E', '260124E', '260125M', '260130E',
  '260131E', '260201M', '260206E', '260207E', '260208M', '260213E', '260214E',
  '260215M', '260313E', '260314E', '260315M', '260327E', '260328E', '260329M',
  '260410E', '260411E', '260412M', '260417E', '260418E', '260419M'
]);

console.log('📊 COMPARISON ANALYSIS:');
console.log('='.repeat(80));
console.log(`Database:    ${dbPerformances.size} performances`);
console.log(`Excel file:  ${excelPerformances.size} performances`);
console.log('');

// Find differences
const inDbNotInExcel = Array.from(dbPerformances).filter(p => !excelPerformances.has(p));
const inExcelNotInDb = Array.from(excelPerformances).filter(p => !dbPerformances.has(p));

if (inDbNotInExcel.length > 0) {
  console.log(`❌ IN DATABASE BUT NOT IN EXCEL (${inDbNotInExcel.length}):`);
  console.log(`   ${inDbNotInExcel.join(', ')}`);
  console.log('');
}

if (inExcelNotInDb.length > 0) {
  console.log(`✨ NEW IN EXCEL (${inExcelNotInDb.length}):`);
  console.log(`   ${inExcelNotInDb.join(', ')}`);
  console.log('');
}

if (inDbNotInExcel.length === 0 && inExcelNotInDb.length === 0) {
  console.log('✅ EXACT MATCH - Same performances in both');
  console.log('');
}

// Conclusion
console.log('='.repeat(80));
console.log('📋 CONCLUSION:');
if (inExcelNotInDb.length > 0) {
  console.log(`   ✅ Excel file contains NEW data (${inExcelNotInDb.length} new performances)`);
  console.log('   Recommendation: Import the new data');
} else if (inDbNotInExcel.length > 0) {
  console.log(`   ⚠️  Excel file is MISSING data (${inDbNotInExcel.length} performances removed)`);
  console.log('   Recommendation: Check if performances were cancelled/removed intentionally');
} else {
  console.log('   ℹ️  Excel file matches database (no new performances)');
  console.log('   Note: Data values may have been updated - run import to refresh');
}
