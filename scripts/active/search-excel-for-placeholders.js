const XLSX = require('xlsx');
const path = require('path');

function searchExcelForPerformances() {
  const excelPath = path.join(__dirname, '../../data/source-files/KCS 25-26 Weekly Sales Report - Sep 17.xlsx');

  console.log('📂 Reading Excel file:', excelPath, '\n');

  const workbook = XLSX.readFile(excelPath);

  // Performance codes to search for
  const searchCodes = [
    '251011A', '251011B', '251011C',
    '251205M', '251206A', '251206B', '251206C',
    '251215M'
  ];

  console.log('🔍 Searching for placeholder performance codes in Excel...\n');

  const found = [];
  const notFound = [];

  // Search through all sheets
  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Find header row
    let headerRow = -1;
    let codeCol = -1;
    let titleCol = -1;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (row && row.some(cell => cell && cell.toString().toLowerCase().includes('perf'))) {
        headerRow = i;
        codeCol = row.findIndex(cell => cell && cell.toString().toLowerCase().includes('perf'));
        titleCol = row.findIndex(cell => cell && (
          cell.toString().toLowerCase().includes('title') ||
          cell.toString().toLowerCase().includes('program') ||
          cell.toString().toLowerCase().includes('concert')
        ));
        break;
      }
    }

    if (headerRow === -1) return;

    // Search for performance codes
    for (let i = headerRow + 1; i < data.length; i++) {
      const row = data[i];
      if (!row || !row[codeCol]) continue;

      const code = row[codeCol].toString().trim();

      if (searchCodes.includes(code)) {
        const title = titleCol !== -1 ? (row[titleCol] || 'NO TITLE') : 'NO TITLE COLUMN';
        found.push({
          code,
          title,
          sheet: sheetName,
          row: i + 1
        });
      }
    }
  });

  // Identify which codes were not found
  searchCodes.forEach(code => {
    if (!found.find(f => f.code === code)) {
      notFound.push(code);
    }
  });

  // Display results
  if (found.length > 0) {
    console.log(`✅ Found ${found.length} performances in Excel:\n`);
    found.forEach(f => {
      console.log(`  ${f.code}: "${f.title}"`);
      console.log(`    (Sheet: ${f.sheet}, Row: ${f.row})\n`);
    });
  }

  if (notFound.length > 0) {
    console.log(`\n❌ NOT found in Excel (${notFound.length} performances):\n`);
    notFound.forEach(code => {
      console.log(`  ${code}`);
    });
  }

  console.log(`\n📊 Summary: ${found.length} found, ${notFound.length} not found`);
}

searchExcelForPerformances();
